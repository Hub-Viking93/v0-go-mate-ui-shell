// Phase 2A verification — basic document vault.
//
// Frontend-first per verify.md: real user flow with viewport screenshots
// at every meaningful state. API + DB + Storage are used as supplementary
// proof for the bits the UI can't show (ownership/RLS, signed-URL
// generation, storage-path correctness).

import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TEST_EMAIL || !TEST_PASSWORD || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing TEST_EMAIL/TEST_PASSWORD/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY");
}

const STORAGE_BUCKET = "relocation-documents";

let admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (admin) return admin;
  admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return admin;
}

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-2a");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

// Make a tiny in-memory test PDF so we have a real, content-stable file.
function makeTestPdf(label: string): Buffer {
  // Minimal valid PDF (one page, text).
  const body = `%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 50]/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj\n4 0 obj<</Length ${20 + label.length}>>stream\nBT /F1 12 Tf 10 25 Td (${label}) Tj ET\nendstream\nendobj\n`;
  const trailer = `xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000111 00000 n \n0000000216 00000 n \ntrailer<</Size 5/Root 1 0 R>>startxref\n300\n%%EOF\n`;
  return Buffer.from(body + trailer, "utf8");
}

test("Phase 2A — basic document vault", async ({ page }) => {
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200));
  });

  // ---- Resolve test user via paginated listUsers ---------------------------
  const a = adminClient();
  let user: { id: string; email?: string | null } | null = null;
  for (let p = 1; p <= 50; p++) {
    const { data, error } = await a.auth.admin.listUsers({ page: p, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === TEST_EMAIL!.toLowerCase());
    if (found) { user = found; break; }
    if (data.users.length < 200) break;
  }
  if (!user) throw new Error(`Test user ${TEST_EMAIL} not found`);
  const userId = user.id;

  // ---- Clean slate: wipe any existing vault state for this user ------------
  const { data: priorRows } = await a
    .from("relocation_documents")
    .select("id, storage_path")
    .eq("user_id", userId);
  if (priorRows && priorRows.length > 0) {
    const paths = priorRows.map((r) => r.storage_path as string);
    await a.storage.from(STORAGE_BUCKET).remove(paths);
    await a.from("relocation_documents").delete().eq("user_id", userId);
  }

  try {
    // ---- Sign in -----------------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL!);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD!);
    await page
      .locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]')
      .first()
      .click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

    // ===== Empty state =====================================================
    await page.goto("/vault", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Document vault/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/No documents yet/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Upload your first document/i })).toBeVisible();
    await shot(page, "01-empty-state");

    // ===== Upload a passport PDF ===========================================
    // The "Upload your first document" CTA in the empty state opens the dialog.
    await page.getByRole("button", { name: /Upload your first document/i }).click();
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 5_000 });
    // Pick file via the hidden input.
    const passportPdf = makeTestPdf("Verify2A passport");
    await page.locator('input[type="file"]').setInputFiles({
      name: "verify2a-passport.pdf",
      mimeType: "application/pdf",
      buffer: passportPdf,
    });
    await expect(page.getByText("verify2a-passport.pdf")).toBeVisible();
    // Default category should already be "Passport / ID".
    await expect(page.getByText("Passport / ID").first()).toBeVisible();
    await page.locator('textarea').fill("Verify2A — first upload notes");
    await shot(page, "02-upload-dialog-filled");
    await page.getByRole("button", { name: /^Upload$/i }).first().click();
    // Dialog auto-closes on success.
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText("verify2a-passport.pdf")).toBeVisible({ timeout: 10_000 });
    await shot(page, "03-after-first-upload");

    // ===== Category visible on the row =====================================
    // Category section header is present.
    await expect(page.getByRole("heading", { name: /^Passport \/ ID$/ })).toBeVisible();

    // ===== Refresh — file persists =========================================
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByText("verify2a-passport.pdf")).toBeVisible({ timeout: 10_000 });
    await shot(page, "04-after-reload-still-there");

    // ===== Download via signed URL (programmatic + visual) =================
    const apiUrlRes = await page.evaluate(async () => {
      const list = await fetch("/api/vault").then((r) => r.json());
      const doc = (list.documents as Array<Record<string, unknown>>).find(
        (d) => d.fileName === "verify2a-passport.pdf",
      )!;
      const r = await fetch(`/api/vault/${encodeURIComponent(doc.id as string)}/url`);
      return { status: r.status, body: await r.json() };
    });
    expect(apiUrlRes.status, "GET /api/vault/:id/url").toBe(200);
    const signedUrl = apiUrlRes.body.url as string;
    expect(signedUrl).toContain(`/storage/v1/object/sign/${STORAGE_BUCKET}/`);
    expect(signedUrl).toMatch(/[?&]token=/);

    // The signed URL serves the actual bytes we uploaded.
    const fetchRes = await fetch(signedUrl);
    expect(fetchRes.status, "signed URL fetches content").toBe(200);
    const downloaded = Buffer.from(await fetchRes.arrayBuffer());
    expect(downloaded.equals(passportPdf), "downloaded bytes match upload").toBe(true);

    // ===== Multiple files in same category =================================
    await page.getByRole("button", { name: /^Upload$/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 5_000 });
    const passportPdf2 = makeTestPdf("Verify2A passport-2");
    await page.locator('input[type="file"]').setInputFiles({
      name: "verify2a-passport-2.pdf",
      mimeType: "application/pdf",
      buffer: passportPdf2,
    });
    // Keep default category (Passport / ID).
    await page.getByRole("button", { name: /^Upload$/i }).first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText("verify2a-passport-2.pdf")).toBeVisible({ timeout: 10_000 });

    // ===== Different category ==============================================
    await page.getByRole("button", { name: /^Upload$/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 5_000 });
    const housingPdf = makeTestPdf("Verify2A lease");
    await page.locator('input[type="file"]').setInputFiles({
      name: "verify2a-lease.pdf",
      mimeType: "application/pdf",
      buffer: housingPdf,
    });
    // Switch category to Housing.
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: /^Housing$/ }).click();
    await page.getByRole("button", { name: /^Upload$/i }).first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText("verify2a-lease.pdf")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /^Housing$/ })).toBeVisible();
    await shot(page, "05-three-files-grouped-by-category");

    // ===== API contract =====================================================
    const listAfter = await page.evaluate(async () => {
      const r = await fetch("/api/vault");
      return await r.json();
    });
    const docs = listAfter.documents as Array<Record<string, unknown>>;
    expect(docs.length, "API returns 3 docs").toBe(3);
    for (const d of docs) {
      expect(typeof d.id).toBe("string");
      expect(typeof d.fileName).toBe("string");
      expect(typeof d.category).toBe("string");
      expect(typeof d.uploadedAt).toBe("string");
      expect(Array.isArray(d.linkedTaskKeys)).toBe(true);
      expect(typeof d.storagePath).toBe("string");
      expect(typeof d.signedUrl === "string" || d.signedUrl === null).toBe(true);
    }
    const passport1 = docs.find((d) => d.fileName === "verify2a-passport.pdf")!;
    const passport2 = docs.find((d) => d.fileName === "verify2a-passport-2.pdf")!;
    const lease = docs.find((d) => d.fileName === "verify2a-lease.pdf")!;
    expect(passport1.category).toBe("passport_id");
    expect(passport2.category).toBe("passport_id");
    expect(lease.category).toBe("housing");

    // ===== DB cross-check ==================================================
    const { data: dbRows } = await a
      .from("relocation_documents")
      .select("id, user_id, category, file_name, storage_path, plan_id")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: true });
    expect(dbRows).toHaveLength(3);
    for (const r of dbRows!) {
      expect(r.user_id).toBe(userId);
      // Storage path is namespaced under {user_id}/...
      expect((r.storage_path as string).startsWith(`${userId}/`)).toBe(true);
    }

    // ===== Storage cross-check =============================================
    // Confirm objects exist at the recorded paths.
    for (const r of dbRows!) {
      const sp = r.storage_path as string;
      const folder = sp.substring(0, sp.lastIndexOf("/"));
      const filename = sp.substring(sp.lastIndexOf("/") + 1);
      const { data: list } = await a.storage
        .from(STORAGE_BUCKET)
        .list(folder, { limit: 100 });
      expect((list ?? []).some((o) => o.name === filename), `storage has ${sp}`).toBe(true);
    }

    // ===== RLS — anon (unauthenticated) cannot read =========================
    if (SUPABASE_ANON_KEY) {
      const anon = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
      });
      // Table read with anon key — RLS should return 0 rows for this user's docs.
      const { data: anonRows } = await anon
        .from("relocation_documents")
        .select("id")
        .eq("user_id", userId);
      expect(anonRows ?? []).toHaveLength(0);
      // Storage read by raw object URL (no signed token) should fail.
      const samplePath = (dbRows![0].storage_path as string);
      const rawUrl = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${samplePath}`;
      const rawRes = await fetch(rawUrl);
      expect([400, 401, 403, 404]).toContain(rawRes.status);
    }

    // ===== Delete — UI =====================================================
    // Delete the lease doc.
    const leaseRow = page
      .locator("li", { hasText: "verify2a-lease.pdf" })
      .first();
    // Find the delete button inside the row (Trash2 icon button).
    const deleteBtn = leaseRow.locator("button").nth(1); // [download, delete]
    await deleteBtn.click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: /Delete this document/i })).toBeVisible();
    await shot(page, "06-delete-confirmation");
    await page.getByRole("button", { name: /^Delete$/ }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText("verify2a-lease.pdf")).toHaveCount(0);
    await shot(page, "07-after-delete");

    // ===== Storage cleanup verification: deleted file is gone ==============
    const { data: leaseRowAfter } = await a
      .from("relocation_documents")
      .select("id")
      .eq("user_id", userId)
      .eq("file_name", "verify2a-lease.pdf");
    expect(leaseRowAfter ?? []).toHaveLength(0);
    // Hosting paths might survive briefly in some object stores, but for
    // Supabase storage the remove is synchronous; verify.
    const stillThere = await a.storage
      .from(STORAGE_BUCKET)
      .list(`${userId}`, { limit: 200, search: "verify2a-lease" });
    expect((stillThere.data ?? []).filter((o) => o.name.includes("verify2a-lease"))).toHaveLength(0);
  } finally {
    // ---- Cleanup: wipe any leftover seeded files + rows --------------------
    const { data: leftover } = await a
      .from("relocation_documents")
      .select("id, storage_path, file_name")
      .eq("user_id", userId)
      .like("file_name", "verify2a%");
    if (leftover && leftover.length > 0) {
      await a.storage
        .from(STORAGE_BUCKET)
        .remove(leftover.map((r) => r.storage_path as string));
      await a
        .from("relocation_documents")
        .delete()
        .in(
          "id",
          leftover.map((r) => r.id as string),
        );
    }
  }
});
