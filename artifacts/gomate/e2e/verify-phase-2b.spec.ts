// Phase 2B verification — task ↔ document linkage.
//
// Frontend-first per verify.md:
//   1. Open task that declares required document categories.
//   2. Verify Required chips render.
//   3. Upload from task view → auto-links + covered.
//   4. Upload to /vault directly → matched-by-category in task.
//   5. Click "Link existing" on matched-by-category row → row promotes
//      to explicitly linked (Unlink button visible).
//   6. Click "Unlink" → row reverts to matched-by-category.
//
// API + DB cross-checks:
//   • linked_task_keys[] persists on the document row.
//   • Canonical task ref is namespaced ("settling-in:<task_key>").
//   • Explicit linkage takes precedence over category-only matching.

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
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TEST_EMAIL || !TEST_PASSWORD || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing TEST_EMAIL/TEST_PASSWORD/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY");
}

const STORAGE_BUCKET = "relocation-documents";
const DAY = 24 * 60 * 60 * 1000;

let admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (admin) return admin;
  admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return admin;
}

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-2b");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

async function waitForSheetSettled(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-slot="sheet-content"]');
      return Boolean(el && el.getAttribute("data-state") === "open");
    },
    null,
    { timeout: 5_000 },
  );
  await page.waitForTimeout(600);
}

function makeTestPdf(label: string): Buffer {
  const body = `%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 50]/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj\n4 0 obj<</Length ${20 + label.length}>>stream\nBT /F1 12 Tf 10 25 Td (${label}) Tj ET\nendstream\nendobj\n`;
  const trailer = `xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000111 00000 n \n0000000216 00000 n \ntrailer<</Size 5/Root 1 0 R>>startxref\n300\n%%EOF\n`;
  return Buffer.from(body + trailer, "utf8");
}

test("Phase 2B — task ↔ document linkage", async ({ page }) => {
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200));
  });

  // ---- Resolve test user ---------------------------------------------------
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

  // ---- Snapshot prior plan + wipe vault for clean slate --------------------
  const { data: planRow } = await a
    .from("relocation_plans")
    .select("id, stage, arrival_date, post_relocation_generated")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  if (!planRow) throw new Error("Test user has no active plan — onboard first");
  const planId = planRow.id as string;
  const priorStage = planRow.stage as string | null;
  const priorArrival = planRow.arrival_date as string | null;
  const priorGenerated = planRow.post_relocation_generated as boolean | null;

  const { data: priorDocs } = await a
    .from("relocation_documents")
    .select("id, storage_path")
    .eq("user_id", userId);
  if (priorDocs && priorDocs.length > 0) {
    await a.storage.from(STORAGE_BUCKET).remove(priorDocs.map((d) => d.storage_path as string));
    await a.from("relocation_documents").delete().eq("user_id", userId);
  }

  const now = new Date();
  await a
    .from("relocation_plans")
    .update({
      stage: "arrived",
      arrival_date: new Date(now.getTime() - 2 * DAY).toISOString().slice(0, 10),
      post_relocation_generated: true,
    })
    .eq("id", planId);
  await a.from("settling_in_tasks").delete().eq("plan_id", planId);

  const TASK_KEY = "verify-2b-task";
  const TASK_REF = `settling-in:${TASK_KEY}`;
  await a.from("settling_in_tasks").insert({
    user_id: userId,
    plan_id: planId,
    task_key: TASK_KEY,
    title: "Verify2B-TASK",
    description: "Phase 2B verify task with required: passport_id, housing",
    category: "registration",
    depends_on: [],
    deadline_days: 14,
    deadline_at: new Date(now.getTime() + 14 * DAY).toISOString(),
    is_legal_requirement: false,
    deadline_type: "practical",
    steps: [],
    documents_needed: [],
    official_link: null,
    estimated_time: "30 minutes",
    cost: "Free",
    status: "available",
    sort_order: 400,
    walkthrough: {
      whatThisIs: "Verify2B walkthrough.",
      requiredDocumentCategories: ["passport_id", "housing"],
    },
  });

  try {
    // ---- Sign in -----------------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL!);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD!);
    await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]')
      .first()
      .click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

    // ===== 1. Open task → required chips render ============================
    await page.goto("/checklist?tab=post-move", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const allTasksBtn = page.getByRole("button", { name: /^all tasks$/i }).first();
    if (await allTasksBtn.isVisible().catch(() => false)) {
      await allTasksBtn.click();
      await page.waitForTimeout(300);
    }
    const taskHeading = page.getByRole("heading", { name: "Verify2B-TASK" }).first();
    await expect(taskHeading).toBeVisible({ timeout: 15_000 });
    await taskHeading.click();
    let dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await waitForSheetSettled(page);

    // Documents section visible with both required cats as missing chips.
    await expect(dialog.getByRole("heading", { name: /Documents for this task/i })).toBeVisible();
    await expect(dialog.getByText(/0\/2 covered/)).toBeVisible();
    // Chips for both required categories.
    const requiredArea = dialog.locator("p", { hasText: /^Required$/ }).locator("..");
    await expect(requiredArea.getByText(/^Passport \/ ID$/)).toBeVisible();
    await expect(requiredArea.getByText(/^Housing$/)).toBeVisible();
    // Missing block lists both with Upload buttons.
    await expect(dialog.getByText(/^Missing$/)).toBeVisible();
    await shot(page, "01-task-opened-both-missing");

    // ===== 2. Upload from task view → Passport auto-linked =================
    // Click Upload on the Passport / ID missing row.
    const passportMissingRow = dialog
      .locator("li", { has: page.locator("p", { hasText: /^Passport \/ ID$/ }) })
      .first();
    await passportMissingRow.getByRole("button", { name: /^Upload$/i }).click();
    // Upload-for-task dialog opens. Locate it by its unique heading.
    const uploadDialogHeading = page.getByRole("heading", {
      name: /^Upload document for this task$/i,
    });
    await expect(uploadDialogHeading).toBeVisible({ timeout: 5_000 });
    const uploadDialog = uploadDialogHeading.locator("xpath=ancestor::*[@role='dialog'][1]");
    await expect(uploadDialog.getByText(/Verify2B-TASK/)).toBeVisible();
    const passportBuf = makeTestPdf("Verify2B passport");
    await page.locator('input[type="file"]').setInputFiles({
      name: "verify2b-passport.pdf",
      mimeType: "application/pdf",
      buffer: passportBuf,
    });
    await shot(page, "02-upload-for-task-dialog");
    await uploadDialog.getByRole("button", { name: /^Upload$/i }).click();
    // Upload dialog closes; the sheet remains.
    await expect(uploadDialogHeading).toHaveCount(0, { timeout: 15_000 });
    dialog = page.getByRole("dialog").first();

    // Counter ticks to 1/2 covered + Already-in-vault block shows passport
    // with Unlink (explicitly linked).
    await expect(dialog.getByText(/1\/2 covered/)).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByText("verify2b-passport.pdf")).toBeVisible();
    const passportRow = dialog
      .locator("li", { has: page.locator("text=verify2b-passport.pdf") })
      .first();
    await expect(passportRow.getByRole("button", { name: /^Unlink$/i })).toBeVisible();
    await shot(page, "03-passport-explicitly-linked");

    // API: passport doc has TASK_REF in linked_task_keys.
    const apiAfter1 = await page.evaluate(async () => {
      const r = await fetch("/api/vault");
      return await r.json();
    });
    const apiPassport = (apiAfter1.documents as Array<Record<string, unknown>>).find(
      (d) => d.fileName === "verify2b-passport.pdf",
    )!;
    expect((apiPassport.linkedTaskKeys as string[]).includes(TASK_REF)).toBe(true);

    // DB: same.
    const { data: dbAfter1 } = await a
      .from("relocation_documents")
      .select("file_name, linked_task_keys, category")
      .eq("user_id", userId);
    const dbPassport = dbAfter1!.find((r) => r.file_name === "verify2b-passport.pdf")!;
    expect((dbPassport.linked_task_keys as string[]).includes(TASK_REF)).toBe(true);
    expect(dbPassport.category).toBe("passport_id");

    // Close sheet, navigate to /vault for the next step.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // ===== 3. Upload to /vault directly (housing, no task linkage) =========
    await page.goto("/vault", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Document vault/i })).toBeVisible();
    await page.getByRole("button", { name: /^Upload$/i }).first().click();
    const vaultUploadDialog = page.getByRole("dialog").first();
    await expect(vaultUploadDialog).toBeVisible({ timeout: 5_000 });
    // Generic dialog title — NOT task-specific (proves we're not in task-upload mode).
    await expect(vaultUploadDialog.getByRole("heading", { name: /^Upload document$/ })).toBeVisible();
    const housingBuf = makeTestPdf("Verify2B lease");
    await page.locator('input[type="file"]').setInputFiles({
      name: "verify2b-lease.pdf",
      mimeType: "application/pdf",
      buffer: housingBuf,
    });
    // Switch category to Housing.
    await page.locator('[role="combobox"]').first().click();
    await page.getByRole("option", { name: /^Housing$/ }).click();
    await page.getByRole("button", { name: /^Upload$/i }).first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText("verify2b-lease.pdf")).toBeVisible();
    await shot(page, "04-vault-with-housing-doc");

    // DB: housing doc unlinked.
    const { data: dbAfter2 } = await a
      .from("relocation_documents")
      .select("file_name, linked_task_keys")
      .eq("user_id", userId);
    const dbHousing = dbAfter2!.find((r) => r.file_name === "verify2b-lease.pdf")!;
    expect(dbHousing.linked_task_keys as string[]).toHaveLength(0);

    // ===== 4. Back to task — housing now matched-by-category, Link existing visible
    await page.goto("/checklist?tab=post-move", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const allTasksBtn2 = page.getByRole("button", { name: /^all tasks$/i }).first();
    if (await allTasksBtn2.isVisible().catch(() => false)) {
      await allTasksBtn2.click();
      await page.waitForTimeout(300);
    }
    await page.getByRole("heading", { name: "Verify2B-TASK" }).first().click();
    dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await waitForSheetSettled(page);

    // Both cats now covered — counter 2/2.
    await expect(dialog.getByText(/2\/2 covered/)).toBeVisible({ timeout: 10_000 });
    // Housing row in "Already in your vault" shows matched-by-category italic
    // + a "Link existing" button to firm it up.
    await expect(dialog.getByText("verify2b-lease.pdf")).toBeVisible();
    const housingRow = dialog
      .locator("li", { has: page.locator("text=verify2b-lease.pdf") })
      .first();
    await expect(housingRow.getByText(/matched by category/i)).toBeVisible();
    const linkExistingBtn = housingRow.getByRole("button", { name: /^Link existing$/i });
    await expect(linkExistingBtn).toBeVisible();
    await shot(page, "05-housing-matched-by-category");

    // ===== 5. Click Link existing → housing becomes explicitly linked ======
    await linkExistingBtn.click();
    // After PATCH succeeds, the row's matched-by-category text disappears
    // and Unlink shows up. (No counter change — already covered.)
    await expect(housingRow.getByRole("button", { name: /^Unlink$/i })).toBeVisible({ timeout: 10_000 });
    await expect(housingRow.getByText(/matched by category/i)).toHaveCount(0);
    await shot(page, "06-housing-now-explicitly-linked");

    // API: housing doc has TASK_REF in linked_task_keys.
    const apiAfter2 = await page.evaluate(async () => {
      const r = await fetch("/api/vault");
      return await r.json();
    });
    const apiHousing = (apiAfter2.documents as Array<Record<string, unknown>>).find(
      (d) => d.fileName === "verify2b-lease.pdf",
    )!;
    expect((apiHousing.linkedTaskKeys as string[]).includes(TASK_REF)).toBe(true);

    // DB cross-check: linked_task_keys persisted.
    const { data: dbAfter3 } = await a
      .from("relocation_documents")
      .select("file_name, linked_task_keys")
      .eq("user_id", userId);
    const dbHousing2 = dbAfter3!.find((r) => r.file_name === "verify2b-lease.pdf")!;
    expect(dbHousing2.linked_task_keys as string[]).toEqual([TASK_REF]);
    // Canonical task ref is namespaced + matches the seed task_key.
    expect((dbHousing2.linked_task_keys as string[])[0]).toMatch(
      /^settling-in:verify-2b-task$/,
    );

    // ===== 6. Unlink → row reverts to matched-by-category ==================
    await housingRow.getByRole("button", { name: /^Unlink$/i }).click();
    // Row should fall back: "matched by category" italic returns, Link existing button reappears.
    await expect(housingRow.getByText(/matched by category/i)).toBeVisible({ timeout: 10_000 });
    await expect(housingRow.getByRole("button", { name: /^Link existing$/i })).toBeVisible();
    // Counter still 2/2 (lenient: matched-by-category counts as covered).
    await expect(dialog.getByText(/2\/2 covered/)).toBeVisible();
    await shot(page, "07-after-unlink-back-to-matched");

    // DB: linked_task_keys is empty again for housing.
    const { data: dbAfter4 } = await a
      .from("relocation_documents")
      .select("file_name, linked_task_keys")
      .eq("user_id", userId);
    const dbHousing3 = dbAfter4!.find((r) => r.file_name === "verify2b-lease.pdf")!;
    expect(dbHousing3.linked_task_keys as string[]).toHaveLength(0);

    // Passport remains explicitly linked (proves linkage is per-doc, not global).
    const dbPassport2 = dbAfter4!.find((r) => r.file_name === "verify2b-passport.pdf")!;
    expect(dbPassport2.linked_task_keys as string[]).toEqual([TASK_REF]);

    // ===== Extra check: explicit linkage trumps category-only =============
    // Upload a SECOND passport doc to vault → both passports match-by-category,
    // but only the one explicitly linked (verify2b-passport.pdf) should show
    // up in the task's "Already in your vault" list, NOT the unlinked sibling.
    await page.keyboard.press("Escape");
    await page.goto("/vault", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Upload$/i }).first().click();
    await expect(page.getByRole("dialog").first()).toBeVisible({ timeout: 5_000 });
    const passport2Buf = makeTestPdf("Verify2B passport-2");
    await page.locator('input[type="file"]').setInputFiles({
      name: "verify2b-passport-2.pdf",
      mimeType: "application/pdf",
      buffer: passport2Buf,
    });
    // Default category Passport / ID — keep it.
    await page.getByRole("button", { name: /^Upload$/i }).first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });

    await page.goto("/checklist?tab=post-move", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const allTasksBtn3 = page.getByRole("button", { name: /^all tasks$/i }).first();
    if (await allTasksBtn3.isVisible().catch(() => false)) {
      await allTasksBtn3.click();
      await page.waitForTimeout(300);
    }
    await page.getByRole("heading", { name: "Verify2B-TASK" }).first().click();
    dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await waitForSheetSettled(page);
    // verify2b-passport.pdf (explicit) IS in the vault block.
    await expect(dialog.getByText("verify2b-passport.pdf")).toBeVisible();
    // verify2b-passport-2.pdf is NOT in the vault block — explicit beats category.
    await expect(dialog.getByText("verify2b-passport-2.pdf")).toHaveCount(0);
    await shot(page, "08-explicit-trumps-category");
  } finally {
    // ---- Cleanup ----------------------------------------------------------
    const { data: leftover } = await a
      .from("relocation_documents")
      .select("id, storage_path, file_name")
      .eq("user_id", userId)
      .like("file_name", "verify2b%");
    if (leftover && leftover.length > 0) {
      await a.storage.from(STORAGE_BUCKET).remove(leftover.map((r) => r.storage_path as string));
      await a.from("relocation_documents").delete().in("id", leftover.map((r) => r.id as string));
    }
    await a.from("settling_in_tasks").delete().eq("plan_id", planId);
    await a
      .from("relocation_plans")
      .update({
        stage: priorStage,
        arrival_date: priorArrival,
        post_relocation_generated: priorGenerated ?? false,
      })
      .eq("id", planId);
  }
});
