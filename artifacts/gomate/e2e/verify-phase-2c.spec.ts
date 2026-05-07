// Phase 2C verification — proof-of-eligibility coach + prep guidance.
//
// Frontend-first per verify.md:
//   1. Open task with proofGuidance → render "What you're proving",
//      "How to prepare", disclaimer.
//   2. Initially both proof-goals are "Still uncertain".
//   3. Upload passport from goal CTA → identity goal flips to "Covered".
//   4. Other goal stays "Still uncertain".
//   5. Expand "Common mistakes" — bullets appear.
//   6. Disclaimer is the explicit "Preparation guide, not approval" copy.
//   7. Forbidden tokens (approved/verified/guaranteed/compliant) MUST NOT
//      appear as affirmative claims in the documents section (excluding
//      the disclaimer paragraph itself, which legitimately says
//      "not approval").

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

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-2c");
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

const PROOF_GUIDANCE = {
  proofGoals: [
    {
      id: "identity",
      label: "Verify2C-IDENTITY",
      description: "Authorities need to know who you are before they file anything.",
      acceptableEvidence: [
        { category: "passport_id", description: "National passport (original)" },
      ],
      uncoveredHint: "No passport on file yet — start with this.",
    },
    {
      id: "address",
      label: "Verify2C-ADDRESS",
      description: "Where you live in the destination — drives kommun + tax-table.",
      acceptableEvidence: [
        { category: "housing", description: "Signed local lease" },
        { category: "housing", description: "Landlord confirmation form" },
      ],
      uncoveredHint: "No housing proof yet — registration usually fails without it.",
    },
  ],
};

test("Phase 2C — proof-of-eligibility coach + prep guidance", async ({ page }) => {
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

  // Wipe vault for clean slate.
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

  const TASK_KEY = "verify-2c-proof";
  const TASK_REF = `settling-in:${TASK_KEY}`;
  await a.from("settling_in_tasks").insert({
    user_id: userId,
    plan_id: planId,
    task_key: TASK_KEY,
    title: "Verify2C-PROOF-TASK",
    description: "Phase 2C verify: proofGuidance + prep guidance",
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
    sort_order: 500,
    walkthrough: {
      whatThisIs: "Verify2C — proof-guidance + prep-guidance verify task.",
      requiredDocumentCategories: ["passport_id", "housing"],
      proofGuidance: PROOF_GUIDANCE,
    },
  });

  try {
    // ---- Sign in -----------------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL!);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD!);
    await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

    // ===== 1. Open task — initial state ====================================
    await page.goto("/checklist?tab=post-move", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const allTasksBtn = page.getByRole("button", { name: /^all tasks$/i }).first();
    if (await allTasksBtn.isVisible().catch(() => false)) {
      await allTasksBtn.click();
      await page.waitForTimeout(300);
    }
    await page.getByRole("heading", { name: "Verify2C-PROOF-TASK" }).first().click();
    let dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await waitForSheetSettled(page);

    // ===== 2. Sections render: "What you're proving", proof goals ==========
    await expect(dialog.getByText(/^What you're proving$/i)).toBeVisible();
    // Both goals visible with their seeded labels.
    await expect(dialog.getByText("Verify2C-IDENTITY")).toBeVisible();
    await expect(dialog.getByText("Verify2C-ADDRESS")).toBeVisible();
    // Both goals show "Still uncertain" pill initially.
    const identityCard = dialog.locator("li", { has: page.locator("text=Verify2C-IDENTITY") }).first();
    const addressCard = dialog.locator("li", { has: page.locator("text=Verify2C-ADDRESS") }).first();
    await expect(identityCard.getByText(/^Still uncertain$/i)).toBeVisible();
    await expect(addressCard.getByText(/^Still uncertain$/i)).toBeVisible();
    // "Usually accepted" subhead with evidence chips.
    await expect(identityCard.getByText(/^Usually accepted$/i)).toBeVisible();
    await expect(identityCard.getByText("National passport (original)")).toBeVisible();
    await expect(addressCard.getByText("Signed local lease")).toBeVisible();
    await expect(addressCard.getByText("Landlord confirmation form")).toBeVisible();
    // Per-goal uncoveredHint surfaces on the Still-uncertain card.
    await expect(identityCard.getByText(/No passport on file yet/)).toBeVisible();
    await shot(page, "01-task-opened-both-uncertain");

    // ===== 3. Prep guidance section ========================================
    await expect(dialog.getByText(/^How to prepare$/)).toBeVisible();
    // One card per required category.
    const passportPrepCard = dialog.locator("li", { has: page.locator("text=Passport / ID") }).filter({
      hasText: /How to prepare|prepare/i,
    }).last();
    // Just check the prep block has Passport / ID + Housing as labels.
    const prepArea = dialog.locator("p", { hasText: /^How to prepare$/ }).locator("..");
    await expect(prepArea.getByText(/^Passport \/ ID$/).first()).toBeVisible();
    await expect(prepArea.getByText(/^Housing$/).first()).toBeVisible();

    // ===== 4. Disclaimer present ===========================================
    const disclaimer = dialog.getByText(/Preparation guide, not approval/i).first();
    await expect(disclaimer).toBeVisible();
    await expect(
      dialog.getByText(/We can't promise the authority will accept any specific upload/i),
    ).toBeVisible();
    // Scroll the disclaimer into view inside the dialog so the screenshot
    // captures the prep section + disclaimer (otherwise they're below
    // the fold).
    await disclaimer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot(page, "02-prep-and-disclaimer");

    // ===== 5. Forbidden tokens NOT present (excl. disclaimer) ==============
    // Read the entire documents section's text content but cut out the
    // disclaimer paragraph itself (which legitimately uses "approval").
    const sectionText = await dialog.evaluate((dialogEl) => {
      const block = dialogEl.querySelector("h3, h2, h1");
      // Walk up to the documents section ancestor that contains "Documents for this task" heading
      const h = Array.from(dialogEl.querySelectorAll("h3")).find((el) =>
        /Documents for this task/i.test(el.textContent ?? ""),
      );
      if (!h) return "";
      const root = h.parentElement?.parentElement ?? h.parentElement;
      if (!root) return "";
      const clone = root.cloneNode(true) as HTMLElement;
      // Strip the disclaimer block (it's the last rounded box mentioning "Preparation guide").
      clone.querySelectorAll("*").forEach((el) => {
        if (/Preparation guide, not approval/i.test(el.textContent ?? "")) {
          el.remove();
        }
      });
      return clone.textContent ?? "";
    });
    for (const word of ["approved", "verified", "guaranteed", "compliant", "eligible"]) {
      const re = new RegExp(`\\b${word}\\b`, "i");
      expect(sectionText, `forbidden affirmative-claim word "${word}" must not appear in documents section`).not.toMatch(re);
    }

    // ===== 6. Upload passport from identity-goal CTA → goal flips ==========
    // The goal card has its own Upload button (from ProofGoalsBlock).
    await identityCard.getByRole("button", { name: /^Upload$/i }).click();
    const uploadDialogHeading = page.getByRole("heading", { name: /Upload document/i });
    await expect(uploadDialogHeading).toBeVisible({ timeout: 5_000 });
    const uploadDialog = uploadDialogHeading.locator("xpath=ancestor::*[@role='dialog'][1]");
    const passportBuf = makeTestPdf("Verify2C passport");
    await page.locator('input[type="file"]').setInputFiles({
      name: "verify2c-passport.pdf",
      mimeType: "application/pdf",
      buffer: passportBuf,
    });
    await uploadDialog.getByRole("button", { name: /^Upload$/i }).click();
    await expect(uploadDialogHeading).toHaveCount(0, { timeout: 15_000 });

    // Re-grab the dialog (sheet) — identity card now Covered, address still uncertain.
    dialog = page.getByRole("dialog").first();
    const identityCard2 = dialog.locator("li", { has: page.locator("text=Verify2C-IDENTITY") }).first();
    const addressCard2 = dialog.locator("li", { has: page.locator("text=Verify2C-ADDRESS") }).first();
    await expect(identityCard2.getByText(/^Covered$/i)).toBeVisible({ timeout: 10_000 });
    await expect(addressCard2.getByText(/^Still uncertain$/i)).toBeVisible();
    // Matched-doc reference appears under the now-covered identity card.
    await expect(identityCard2.getByText(/Matched: verify2c-passport.pdf/)).toBeVisible();
    await shot(page, "03-identity-covered-address-uncertain");

    // ===== 7. Common mistakes accordion ====================================
    // Find the passport prep card (containing the prep description) and its
    // collapsed details/summary "Common mistakes".
    const passportSummary = dialog.getByRole("group").filter({
      has: page.locator("summary", { hasText: /Common mistakes/i }),
    }).filter({
      has: page.locator("text=Passport / ID"),
    });
    // Fallback: take the first <summary> with "Common mistakes" inside the prep section.
    const firstCommonMistakes = dialog
      .locator("summary", { hasText: /Common mistakes/i })
      .first();
    await expect(firstCommonMistakes).toBeVisible();
    // Before click — bullets hidden.
    await firstCommonMistakes.click();
    // After click — at least one mistake bullet appears.
    // The authored prep guidance for passport_id includes:
    //   "Photo page scan only — many authorities want every visa-stamped page."
    // (from artifacts/gomate/src/lib/gomate/document-prep-mirror.ts)
    await expect(
      dialog.getByText(/Photo page scan only/i).first(),
    ).toBeVisible({ timeout: 5_000 });
    await dialog.getByText(/Photo page scan only/i).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot(page, "04-common-mistakes-expanded");

    // ===== API contract — proofGuidance + prep guidance availability =======
    const apiBody = await page.evaluate(async () => {
      const r = await fetch("/api/settling-in");
      return await r.json();
    });
    const taskApi = (apiBody.tasks as Array<Record<string, unknown>>).find(
      (t) => t.title === "Verify2C-PROOF-TASK",
    )!;
    const wt = taskApi.walkthrough as { proofGuidance?: { proofGoals?: unknown[] } };
    expect(Array.isArray(wt.proofGuidance?.proofGoals)).toBe(true);
    expect(wt.proofGuidance!.proofGoals!.length).toBe(2);
    // Each goal carries the structured fields.
    for (const goal of wt.proofGuidance!.proofGoals as Array<Record<string, unknown>>) {
      expect(typeof goal.id).toBe("string");
      expect(typeof goal.label).toBe("string");
      expect(Array.isArray(goal.acceptableEvidence)).toBe(true);
    }
  } finally {
    const { data: leftover } = await a
      .from("relocation_documents")
      .select("id, storage_path, file_name")
      .eq("user_id", userId)
      .like("file_name", "verify2c%");
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
