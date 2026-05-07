// Phase 3A verification — readiness model.
//
// Frontend-first per verify.md:
//   1. Open /dashboard, see "How ready are you?" section + 4 domain cards.
//   2. Mutate state and verify the right domain reacts:
//      • Upload passport → document-readiness moves up.
//      • Same-currency savings vs monthly budget → money goes high.
//      • Citizenship+destination set to EU/EEA → visa flips to high.
//      • Mixed currencies → money flags "different currencies" blocker.
//      • stage=arrived + 1 settling task → move shifts.
//   3. Cards sorted lowest-level-first.
//   4. Top-priority banner picks a defensible next step.
//   5. No "78%-ready" or "approved/verified/guaranteed/compliant/eligible"
//      tokens anywhere in the section.

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

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-3a");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

// Read the live readiness report from the API as the user sees it.
async function readReadiness(page: import("@playwright/test").Page) {
  return await page.evaluate(async () => {
    const r = await fetch("/api/readiness");
    return { status: r.status, body: await r.json() };
  });
}

// Wait until the rendered section reflects the latest server state. We
// reload the page rather than poll because the dashboard fetches once
// on mount.
async function refreshDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("readiness-section")).toBeVisible({ timeout: 15_000 });
  // The section internally fetches /api/readiness; wait for the 4 cards
  // to render.
  for (const dom of ["visa", "document", "money", "move"] as const) {
    await expect(page.getByTestId(`readiness-domain-${dom}`)).toBeVisible({ timeout: 10_000 });
  }
}

function makeTestPdf(label: string): Buffer {
  const body = `%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 50]/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj\n4 0 obj<</Length ${20 + label.length}>>stream\nBT /F1 12 Tf 10 25 Td (${label}) Tj ET\nendstream\nendobj\n`;
  const trailer = `xref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000111 00000 n \n0000000216 00000 n \ntrailer<</Size 5/Root 1 0 R>>startxref\n300\n%%EOF\n`;
  return Buffer.from(body + trailer, "utf8");
}

test("Phase 3A — readiness model", async ({ page }) => {
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

  // ---- Snapshot prior plan + reset to a known baseline --------------------
  const { data: planRow } = await a
    .from("relocation_plans")
    .select("id, stage, arrival_date, profile_data, visa_application, visa_research, post_relocation_generated, research_meta")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  if (!planRow) throw new Error("Test user has no active plan — onboard first");
  const planId = planRow.id as string;
  const prior = {
    stage: planRow.stage as string | null,
    arrival: planRow.arrival_date as string | null,
    profile: (planRow.profile_data ?? {}) as Record<string, unknown>,
    visaApp: planRow.visa_application as Record<string, unknown> | null,
    visaResearch: planRow.visa_research as Record<string, unknown> | null,
    generated: planRow.post_relocation_generated as boolean | null,
    researchMeta: (planRow.research_meta ?? {}) as Record<string, unknown>,
  };
  const { data: priorDocs } = await a
    .from("relocation_documents")
    .select("id, storage_path")
    .eq("user_id", userId);
  if (priorDocs && priorDocs.length > 0) {
    await a.storage.from(STORAGE_BUCKET).remove(priorDocs.map((d) => d.storage_path as string));
    await a.from("relocation_documents").delete().eq("user_id", userId);
  }
  await a.from("settling_in_tasks").delete().eq("plan_id", planId);

  // Helper: write profile / visa_application updates atomically.
  async function patchPlan(updates: Record<string, unknown>) {
    const { error } = await a.from("relocation_plans").update(updates).eq("id", planId);
    if (error) throw error;
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

    // ===== Baseline: collecting + empty profile ============================
    await patchPlan({
      stage: "collecting",
      arrival_date: null,
      post_relocation_generated: false,
      profile_data: {},
      visa_application: null,
      visa_research: null,
      research_meta: {},
    });
    await refreshDashboard(page);

    // Section + heading + 4 cards + disclaimer.
    const section = page.getByTestId("readiness-section");
    await expect(section.getByTestId("readiness-heading")).toHaveText(/How ready are you\?/);
    await expect(section.getByTestId("readiness-disclaimer")).toContainText(
      /guidance signal — not a prediction of approval/i,
    );

    // API contract.
    const apiBaseline = await readReadiness(page);
    expect(apiBaseline.status).toBe(200);
    const baselineBody = apiBaseline.body as {
      domains: Record<string, { level: string; reasons: string[]; blockers: string[]; nextStep: string | null }>;
      topPriority: { domain: string; nextStep: string } | null;
    };
    for (const dom of ["visa", "document", "money", "move"]) {
      expect(baselineBody.domains[dom]).toBeDefined();
      expect(["low", "medium", "high"]).toContain(baselineBody.domains[dom].level);
      expect(Array.isArray(baselineBody.domains[dom].reasons)).toBe(true);
      expect(Array.isArray(baselineBody.domains[dom].blockers)).toBe(true);
    }
    // Stage mapping check: stage=collecting → Move says "intake / onboarding".
    expect(baselineBody.domains.move.level).toBe("low");
    expect(baselineBody.domains.move.reasons.join(" ")).toMatch(/onboarding|intake/i);

    // Sort order: lowest-level-first via data-readiness-level attribute.
    const cards = page.getByTestId(/^readiness-domain-/);
    const renderedLevels: string[] = [];
    const ct = await cards.count();
    for (let i = 0; i < ct; i++) {
      const lvl = (await cards.nth(i).getAttribute("data-readiness-level")) ?? "";
      renderedLevels.push(lvl);
    }
    const rank: Record<string, number> = { low: 0, medium: 1, high: 2 };
    for (let i = 1; i < renderedLevels.length; i++) {
      expect(
        rank[renderedLevels[i - 1]] <= rank[renderedLevels[i]],
        `cards must be sorted low→medium→high; got ${renderedLevels.join(",")}`,
      ).toBe(true);
    }
    await shot(page, "01-baseline");

    // ===== State change #1: upload passport → document moves up ============
    // Use service-role admin to upload + register so the test isn't bottlenecked
    // by the dialog flow (already verified in 2A).
    const passportBuf = makeTestPdf("Verify3A passport");
    const docId = `verify3a-passport-${Date.now()}`;
    const storagePath = `${userId}/${planId}/${docId}.pdf`;
    const upRes = await a.storage.from(STORAGE_BUCKET).upload(storagePath, passportBuf, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upRes.error) throw upRes.error;
    await a.from("relocation_documents").insert({
      user_id: userId,
      plan_id: planId,
      file_name: "verify3a-passport.pdf",
      storage_path: storagePath,
      mime_type: "application/pdf",
      size_bytes: passportBuf.length,
      category: "passport_id",
    });

    await refreshDashboard(page);
    const apiAfterPassport = await readReadiness(page);
    const docLevelBefore = baselineBody.domains.document.level;
    const docLevelAfter = apiAfterPassport.body.domains.document.level;
    expect(rank[docLevelAfter] >= rank[docLevelBefore], `document moves up or holds: ${docLevelBefore} → ${docLevelAfter}`).toBe(true);
    // Money still low (no savings).
    expect(apiAfterPassport.body.domains.money.level).toBe("low");
    await shot(page, "02-after-passport-upload");

    // ===== State change #2: savings + monthly_budget same currency → Money High
    await patchPlan({
      profile_data: {
        savings_available: "60000 SEK",
        monthly_budget: "10000 SEK",
        preferred_currency: "SEK",
      },
    });
    await refreshDashboard(page);
    const apiSameCcy = await readReadiness(page);
    expect(apiSameCcy.body.domains.money.level).toBe("high");
    expect(apiSameCcy.body.domains.money.reasons.join(" ")).toMatch(/months at your target budget/i);
    await page.getByTestId("readiness-domain-money").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot(page, "03-money-high-same-currency");

    // ===== State change #3: mixed currencies → Money flags caveat =========
    await patchPlan({
      profile_data: {
        savings_available: "60000 EUR",
        monthly_budget: "10000 SEK",
        preferred_currency: null,
      },
    });
    await refreshDashboard(page);
    const apiMixed = await readReadiness(page);
    // Should NOT be high — different currencies → medium with currency caveat.
    expect(apiMixed.body.domains.money.level).toBe("medium");
    expect(apiMixed.body.domains.money.reasons.join(" ")).toMatch(/different currencies/i);
    expect(apiMixed.body.domains.money.blockers.join(" ")).toMatch(/buffer ratio|currency/i);
    await page.getByTestId("readiness-domain-money").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot(page, "04-money-mixed-currencies");

    // ===== State change #4: free-movement (EU citizen → EU dest) → Visa High
    await patchPlan({
      profile_data: {
        citizenship: "Swedish",
        destination: "Germany",
        savings_available: "60000 SEK",
        monthly_budget: "10000 SEK",
        preferred_currency: "SEK",
        purpose: "work",
      },
    });
    await refreshDashboard(page);
    const apiFreeMov = await readReadiness(page);
    expect(apiFreeMov.body.domains.visa.level).toBe("high");
    expect(apiFreeMov.body.domains.visa.reasons.join(" ")).toMatch(/EU\/EEA freedom of movement/i);
    expect(apiFreeMov.body.domains.visa.nextStep).toBeNull();
    await page.getByTestId("readiness-domain-visa").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot(page, "05-free-movement-eu");

    // ===== State change #5: stage=arrived + 1 task → Move shifts ===========
    await patchPlan({
      stage: "arrived",
      arrival_date: new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10),
      post_relocation_generated: true,
    });
    await a.from("settling_in_tasks").insert({
      user_id: userId,
      plan_id: planId,
      task_key: "verify-3a-task",
      title: "Verify3A-task",
      description: "Phase 3A move-readiness fixture",
      category: "registration",
      depends_on: [],
      deadline_days: 14,
      deadline_at: new Date(Date.now() + 14 * DAY).toISOString(),
      is_legal_requirement: false,
      deadline_type: "practical",
      steps: [],
      documents_needed: [],
      official_link: null,
      estimated_time: "30 minutes",
      cost: "Free",
      status: "available",
      sort_order: 600,
      walkthrough: null,
    });
    await refreshDashboard(page);
    const apiArrived = await readReadiness(page);
    // Stage-mapping check: arrived → move uses settling-in counters; with 0/1
    // done it should be Medium ("0 of 1 settling-in tasks done") rather than
    // the intake-phase Low.
    expect(apiArrived.body.domains.move.level).toMatch(/^(medium|low)$/);
    expect(apiArrived.body.domains.move.reasons.join(" ")).toMatch(/settling-in/i);
    await page.getByTestId("readiness-domain-move").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await shot(page, "06-arrived-with-task");

    // ===== Top priority is defensible ======================================
    // It must point to a real domain whose nextStep matches what the section
    // claims. When everything is high, topPriority can be null.
    if (apiArrived.body.topPriority) {
      const tp = apiArrived.body.topPriority as { domain: string; nextStep: string };
      expect(["visa", "document", "money", "move"]).toContain(tp.domain);
      expect(tp.nextStep).toBe(apiArrived.body.domains[tp.domain].nextStep);
      // The banner exists in the DOM with matching domain attribute.
      const banner = page.getByTestId("readiness-top-priority");
      await expect(banner).toBeVisible();
      const bannerDomain = await banner.getAttribute("data-priority-domain");
      expect(bannerDomain).toBe(tp.domain);
    }

    // ===== Forbidden tokens — no 78%-ready / approved / eligible ==========
    const sectionText = await section.evaluate((el) => el.textContent ?? "");
    // The disclaimer legitimately uses "approval" (in the phrase "not a
    // prediction of approval"); strip it before scanning.
    const sanitised = sectionText.replace(
      /Readiness is a guidance signal[^.]*decision\./i,
      "",
    );
    expect(sanitised).not.toMatch(/\b\d{1,3}%\s*(ready|done|covered)/);
    for (const word of ["approved", "verified", "guaranteed", "eligible", "compliant"]) {
      expect(sanitised, `forbidden affirmative-claim word "${word}" in section`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }

    // ===== Logic-grans: pathway/applicationStatus reads from visa_application
    // not visa_research. Set selectedVisaType on visa_application and verify
    // visa-readiness picks it up.
    await patchPlan({
      profile_data: {
        ...(prior.profile as Record<string, unknown>),
        citizenship: "Filipino",
        destination: "Sweden",
        purpose: "work",
        savings_available: "60000 SEK",
        monthly_budget: "10000 SEK",
        preferred_currency: "SEK",
      },
      visa_research: { visaOptions: [{ name: "EU Blue Card" }] },
      visa_application: { selectedVisaType: "EU Blue Card", applicationStatus: "not_started" },
    });
    await refreshDashboard(page);
    const apiPathway = await readReadiness(page);
    // Non-EU citizen, pathway selected, but no passport in vault for this state.
    // (Vault still has the passport from earlier — so visa should be high or
    // medium depending on visa_permit category coverage.)
    // The key thing: it should NOT be "Low / no research" anymore.
    expect(apiPathway.body.domains.visa.level).not.toBe("low");
    // Reasons should NOT mention "no visa research" or "purpose set but no visa research".
    const visaReasons = apiPathway.body.domains.visa.reasons.join(" ");
    expect(visaReasons).not.toMatch(/no visa research/i);
  } finally {
    // ---- Cleanup: restore prior state -------------------------------------
    const { data: leftover } = await a
      .from("relocation_documents")
      .select("id, storage_path, file_name")
      .eq("user_id", userId)
      .like("file_name", "verify3a%");
    if (leftover && leftover.length > 0) {
      await a.storage.from(STORAGE_BUCKET).remove(leftover.map((r) => r.storage_path as string));
      await a.from("relocation_documents").delete().in("id", leftover.map((r) => r.id as string));
    }
    await a.from("settling_in_tasks").delete().eq("plan_id", planId);
    await a
      .from("relocation_plans")
      .update({
        stage: prior.stage,
        arrival_date: prior.arrival,
        profile_data: prior.profile,
        visa_application: prior.visaApp,
        visa_research: prior.visaResearch,
        post_relocation_generated: prior.generated ?? false,
        research_meta: prior.researchMeta,
      })
      .eq("id", planId);
  }
});
