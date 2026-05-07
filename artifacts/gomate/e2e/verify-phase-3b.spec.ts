// Phase 3B verification — risks + blockers + explanations.
//
// Frontend-first per verify.md. State-driven: we mutate plan state via
// the service-role admin between phases of the test and verify the
// risks render reflects exactly that state. Screenshots at every key
// transition for visual review.
//
// Logic-grans points (verify.md):
//   • Determinism — same inputs → same risks.
//   • Money + Document do not double-report the same underlying gap.
//   • Free movement only removes visa-domain risks, not other blockers.
//   • blockedTaskRef points at the right checklist tab.
//   • Currency mismatch fires only on real currency conflict.
//   • Vault-empty + arrival-near not over-triggered (only fires within
//     ±30 days of arrival, not when arrival_date is null).

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

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-3b");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  // Risks-section ligger under fold-linjen på dashboarden — scroll in
  // den i viewport innan vi snappar för meaningful visual review.
  await page
    .getByTestId("risks-section")
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

interface Risk {
  id: string;
  domain: string;
  severity: string;
  title: string;
  explanation: string;
  consequence: string;
  isBlocker: boolean;
  blockedTaskRef?: string;
}
interface RiskReport {
  planId: string;
  generatedAt: string;
  risks: Risk[];
  riskCount: number;
  blockerCount: number;
  countsBySeverity: Record<string, number>;
}

async function readRisks(page: import("@playwright/test").Page): Promise<RiskReport> {
  return await page.evaluate(async () => {
    const r = await fetch("/api/risks");
    return await r.json();
  });
}

async function refreshDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("risks-section")).toBeVisible({ timeout: 15_000 });
  // Wait until /api/risks has been fetched at least once.
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="risks-section"]');
    return el && !el.textContent?.includes("Reading your risks");
  }, null, { timeout: 15_000 });
}

test("Phase 3B — risks + blockers + explanations", async ({ page }) => {
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

  // Wipe vault + tasks for clean slate.
  const { data: priorDocs } = await a
    .from("relocation_documents")
    .select("id, storage_path")
    .eq("user_id", userId);
  if (priorDocs && priorDocs.length > 0) {
    await a.storage.from(STORAGE_BUCKET).remove(priorDocs.map((d) => d.storage_path as string));
    await a.from("relocation_documents").delete().eq("user_id", userId);
  }
  await a.from("settling_in_tasks").delete().eq("plan_id", planId);

  async function patchPlan(updates: Record<string, unknown>) {
    const { error } = await a.from("relocation_plans").update(updates).eq("id", planId);
    if (error) throw error;
  }

  try {
    // ---- Sign in -----------------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL!);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD!);
    await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

    // ===== STATE A — minimal baseline =======================================
    await patchPlan({
      stage: "collecting",
      arrival_date: null,
      post_relocation_generated: false,
      profile_data: { destination: "Sweden", citizenship: "Filipino", purpose: "work" },
      visa_application: null,
      visa_research: null,
      research_meta: {},
    });
    await refreshDashboard(page);
    await expect(page.getByTestId("risks-heading")).toHaveText(/Risks & blockers/i);
    const apiA = await readRisks(page);
    // Visa research not run + purpose set → risk:visa-no-research present.
    expect(apiA.risks.some((r) => r.id === "risk:visa-no-research")).toBe(true);
    // Money: no savings figure → present.
    expect(apiA.risks.some((r) => r.id === "risk:money-no-savings-figure")).toBe(true);
    // No arrival_date → vault-empty risk should NOT fire (over-trigger guard).
    expect(apiA.risks.some((r) => r.id === "risk:document-empty-vault-near-arrival")).toBe(false);
    // No currency mismatch — neither side has a value yet.
    expect(apiA.risks.some((r) => r.id === "risk:money-currency-mismatch")).toBe(false);
    await shot(page, "01-baseline");

    // ===== Determinism: call again, same state, same response =============
    const apiA2 = await readRisks(page);
    expect(apiA2.risks.map((r) => r.id).sort()).toEqual(apiA.risks.map((r) => r.id).sort());

    // ===== STATE B — savings = 0 → critical zero-savings risk =============
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        savings_available: "0 SEK",
      },
    });
    await refreshDashboard(page);
    const apiB = await readRisks(page);
    expect(apiB.risks.some((r) => r.id === "risk:money-zero-savings")).toBe(true);
    // The "no savings figure" risk should be GONE (we now have a figure, just zero).
    expect(apiB.risks.some((r) => r.id === "risk:money-no-savings-figure")).toBe(false);
    await shot(page, "02-zero-savings");

    // ===== STATE C — thin runway (ratio 2.5× < 3) =========================
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        savings_available: "25000 SEK",
        monthly_budget: "10000 SEK",
        preferred_currency: "SEK",
      },
    });
    await refreshDashboard(page);
    const apiC = await readRisks(page);
    const thinRisk = apiC.risks.find((r) => r.id === "risk:money-thin-runway");
    expect(thinRisk, "thin-runway risk fires at ratio < 3").toBeTruthy();
    expect(thinRisk!.title).toMatch(/2\.5 months/);
    // Boundary check: at exactly 3.0× ratio, the thin-runway risk should NOT fire.
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        savings_available: "30000 SEK",
        monthly_budget: "10000 SEK",
        preferred_currency: "SEK",
      },
    });
    await refreshDashboard(page);
    const apiC2 = await readRisks(page);
    expect(apiC2.risks.some((r) => r.id === "risk:money-thin-runway")).toBe(false);

    // ===== STATE D — currency mismatch =====================================
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        savings_available: "60000 EUR",
        monthly_budget: "10000 SEK",
        preferred_currency: null,
      },
    });
    await refreshDashboard(page);
    const apiD = await readRisks(page);
    expect(apiD.risks.some((r) => r.id === "risk:money-currency-mismatch")).toBe(true);
    // Sanity: doesn't trigger on nonsense state — already verified by State A
    // (no values present, no risk fired).
    await shot(page, "03-currency-mismatch");

    // ===== STATE E — open task w/ missing categories → blocker =============
    // Set sensible savings that don't fire a money risk on their own.
    await patchPlan({
      stage: "arrived",
      arrival_date: new Date(Date.now() - 2 * DAY).toISOString().slice(0, 10),
      post_relocation_generated: true,
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        savings_available: "120000 SEK",
        monthly_budget: "10000 SEK",
        preferred_currency: "SEK",
      },
    });
    const TASK_KEY = "verify-3b-multi-cat";
    const TASK_REF = `settling-in:${TASK_KEY}`;
    await a.from("settling_in_tasks").insert({
      user_id: userId,
      plan_id: planId,
      task_key: TASK_KEY,
      title: "Verify3B-MULTI-CAT",
      description: "Phase 3B verify — task with multiple required cats incl. financial",
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
      sort_order: 700,
      walkthrough: { requiredDocumentCategories: ["passport_id", "housing", "financial"] },
    });
    await refreshDashboard(page);
    const apiE = await readRisks(page);

    // ----- Money + Document do NOT double-report the same financial gap ----
    const moneyFinancial = apiE.risks.find(
      (r) => r.id === `risk:money-financial-proof-missing:${TASK_REF}`,
    );
    const docRiskForTask = apiE.risks.find(
      (r) => r.id === `risk:document-missing-for-task:${TASK_REF}`,
    );
    expect(moneyFinancial, "money domain owns the financial-proof gap").toBeTruthy();
    expect(docRiskForTask, "document domain still surfaces non-financial gaps").toBeTruthy();
    // The doc risk's explanation must NOT mention "Financial" — it should
    // only list the non-financial categories (passport_id + housing).
    expect(docRiskForTask!.explanation).not.toMatch(/financial/i);
    expect(docRiskForTask!.explanation).toMatch(/Passport \/ ID/i);
    expect(docRiskForTask!.explanation).toMatch(/Housing/i);
    expect(moneyFinancial!.isBlocker).toBe(true);
    expect(docRiskForTask!.isBlocker).toBe(true);
    expect(moneyFinancial!.blockedTaskRef).toBe(TASK_REF);
    expect(docRiskForTask!.blockedTaskRef).toBe(TASK_REF);
    await shot(page, "04-blockers-multi-cat");

    // ----- blockedTaskRef → correct checklist tab -------------------------
    // Click "View blocked task" on the document risk → settling-in goes to
    // ?tab=post-move; pre-departure refs would go to ?tab=pre-move.
    const docCard = page.getByTestId(`risk-card-${docRiskForTask!.id}`);
    const viewLink = docCard.getByRole("link", { name: /View blocked task/i });
    await expect(viewLink).toBeVisible();
    const href = await viewLink.getAttribute("href");
    expect(href).toContain("/checklist?tab=post-move");

    // ===== STATE F — overdue + prior rejection + special circumstance =====
    // Add an overdue task; flag prior rejection; add posted-worker.
    await a.from("settling_in_tasks").insert({
      user_id: userId,
      plan_id: planId,
      task_key: "verify-3b-overdue",
      title: "Verify3B-OVERDUE",
      description: "Phase 3B verify — overdue fixture",
      category: "registration",
      depends_on: [],
      deadline_days: 7,
      deadline_at: new Date(Date.now() - 5 * DAY).toISOString(),
      is_legal_requirement: false,
      deadline_type: "practical",
      steps: [],
      documents_needed: [],
      official_link: null,
      estimated_time: "30 minutes",
      cost: "Free",
      status: "available",
      sort_order: 701,
      walkthrough: null,
    });
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        savings_available: "120000 SEK",
        monthly_budget: "10000 SEK",
        preferred_currency: "SEK",
        prior_visa_rejection: "yes",
        posting_or_secondment: "yes",
      },
    });
    await refreshDashboard(page);
    const apiF = await readRisks(page);
    expect(apiF.risks.some((r) => r.id === "risk:timing-overdue-tasks")).toBe(true);
    expect(apiF.risks.some((r) => r.id === "risk:special-prior-rejection")).toBe(true);
    expect(apiF.risks.some((r) => r.id === "risk:special-posted-no-a1")).toBe(true);
    await shot(page, "05-timing-and-special");

    // ===== STATE G — free movement: visa-domain risks gone, others stay ===
    // Switch to Swedish→Germany while keeping a doc-blocker scenario.
    await patchPlan({
      profile_data: {
        destination: "Germany",
        citizenship: "Swedish",
        purpose: "work",
        savings_available: "120000 SEK",
        monthly_budget: "10000 SEK",
        preferred_currency: "SEK",
      },
      visa_application: null,
      visa_research: null,
    });
    await refreshDashboard(page);
    const apiG = await readRisks(page);
    // No visa-domain risks at all.
    expect(apiG.risks.some((r) => r.domain === "visa")).toBe(false);
    // But the document blocker for the multi-cat task should remain.
    expect(apiG.risks.some((r) => r.id === `risk:document-missing-for-task:${TASK_REF}`)).toBe(true);
    await shot(page, "06-free-movement");

    // ===== STATE H — vault-empty + arrival close (over-trigger guard) ====
    // Already arrival_date set within ±30 days; vault is empty → fires.
    expect(apiG.risks.some((r) => r.id === "risk:document-empty-vault-near-arrival")).toBe(true);
    // Compare to State A (no arrival_date) where it did NOT fire — that
    // already proved the under-fire side.

    // ===== Counters in UI match API =======================================
    await page.waitForTimeout(300);
    const subtitle = await page.getByTestId("risks-subtitle").innerText();
    if (apiG.blockerCount > 0) {
      expect(subtitle).toContain(`${apiG.blockerCount} blocker`);
    }

    // ===== Filter "Blockers" hides non-blockers ===========================
    const filterBtns = page.getByTestId("risks-filter").getByRole("button");
    const blockersBtn = filterBtns.filter({ hasText: /^Blockers/i });
    await blockersBtn.click();
    await page.waitForTimeout(200);
    // After filter: every visible card has data-risk-blocker=true.
    const visibleCards = page.locator('[data-testid^="risk-card-"]');
    const visibleCount = await visibleCards.count();
    for (let i = 0; i < visibleCount; i++) {
      const blocker = await visibleCards.nth(i).getAttribute("data-risk-blocker");
      expect(blocker).toBe("true");
    }
    expect(visibleCount).toBe(apiG.blockerCount);
    await shot(page, "07-blockers-filter");
    // Switch back to All so the next state's cards are all visible.
    await filterBtns.filter({ hasText: /^All/ }).click();
    await page.waitForTimeout(200);

    // ===== Risks distinct from readiness ==================================
    // The risks section should not just re-skin readiness card titles. We
    // assert that risk titles are concrete state references (filenames,
    // counts, currency tokens) — never "Visa readiness" / "Move readiness".
    const allTitles = apiG.risks.map((r) => r.title.toLowerCase()).join(" || ");
    expect(allTitles).not.toMatch(/\bvisa readiness\b/);
    expect(allTitles).not.toMatch(/\bdocument readiness\b/);
    expect(allTitles).not.toMatch(/\bmoney readiness\b/);
    expect(allTitles).not.toMatch(/\bmove readiness\b/);

    // ===== Forbidden tokens: no Plan-B / 3C-style copy =====================
    const sectionText = (await page.getByTestId("risks-section").innerText()).toLowerCase();
    for (const phrase of [
      "plan b",
      "alternative pathway",
      "if denied",
      "if rejected, do",
      "fallback pathway",
    ]) {
      expect(sectionText, `forbidden 3C-style phrase "${phrase}" in 3B section`).not.toContain(phrase);
    }
  } finally {
    // ---- Cleanup ----------------------------------------------------------
    await a.from("settling_in_tasks").delete().eq("plan_id", planId);
    const { data: leftover } = await a
      .from("relocation_documents")
      .select("id, storage_path")
      .eq("user_id", userId);
    if (leftover && leftover.length > 0) {
      await a.storage.from(STORAGE_BUCKET).remove(leftover.map((r) => r.storage_path as string));
      await a.from("relocation_documents").delete().in("id", leftover.map((r) => r.id as string));
    }
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
