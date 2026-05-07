// Phase 5A verification — Housing support.
//
// Frontend-first per verify.md. Drives state via service-role admin and
// asserts both DOM and API. Tight logic-grans on:
//   • Section is its own surface on /dashboard with five distinct sub-blocks
//     (budget, timing, search, process, scams).
//   • State-driven: destination, arrival_date, monthly_budget all visibly
//     change content.
//   • Budget parser handles "2500", "2500 EUR", "€2500".
//   • Timing thresholds behave at 2 / 4 / 10 / 14 weeks before arrival.
//   • Known destination (Sweden, Germany) populates destination-typical
//     examples + bottlenecks; unknown destination falls back gracefully
//     without brand names.
//   • No marketplace / affiliate / partner patterns.
//   • No 4D cultural-orientation drift, no 5B/5C drift.

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

const DAY = 24 * 60 * 60 * 1000;

let admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (admin) return admin;
  admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return admin;
}

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-5a");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  // Pull the section heading to the top of the viewport so the budget +
  // timing cards (and the section header) are captured in-frame.
  await page
    .getByTestId("housing-support-heading")
    .evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior }))
    .catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

async function shotFull(page: import("@playwright/test").Page, name: string) {
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: true });
}

interface SearchGuidance {
  id: string;
  category: string;
  label: string;
  whyUseful: string;
  watchOuts: string;
  examples: string[];
  applicability: "primary" | "secondary";
}
interface PriceBand {
  kind: "shared_room" | "studio" | "one_bed" | "two_bed";
  min: number;
  max: number;
  currency: string;
  primary: boolean;
}
interface PriceExpectations {
  hasUserBudget: boolean;
  userBudget: { amount: number; currency: string } | null;
  destination: string | null;
  realisticBands: PriceBand[];
  userBudgetEurEquivalent: number | null;
  budgetVerdict: string;
  verdictReasoning: string[];
  notes: string[];
}
interface ProcessStep {
  id: string;
  order: number;
  title: string;
  whatHappens: string;
  whatYouNeed: string[];
  commonBottleneck: string | null;
}
interface ScamWarning {
  id: string;
  severity: "high" | "medium";
  signal: string;
  whyDangerous: string;
  whatToDo: string;
}
interface TimingGuidance {
  arrivalDate: string | null;
  weeksUntilArrival: number | null;
  recommendedStartWeeksBefore: number;
  urgency: string;
  message: string;
  milestones: { weeksBefore: number; label: string }[];
  nextStep: string;
}
interface HousingSupportReport {
  planId: string;
  generatedAt: string;
  destination: string | null;
  targetCity: string | null;
  searchGuidance: SearchGuidance[];
  priceExpectations: PriceExpectations;
  processSteps: ProcessStep[];
  scamWarnings: ScamWarning[];
  timingGuidance: TimingGuidance;
}

async function readReport(page: import("@playwright/test").Page): Promise<HousingSupportReport> {
  return await page.evaluate(async () => {
    const r = await fetch("/api/housing-support");
    return await r.json();
  });
}

async function refreshDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("housing-support-section")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="housing-support-section"]');
    return el && !el.textContent?.includes("Reading your housing-support");
  }, null, { timeout: 15_000 });
}

const arrivalAt = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

test("Phase 5A — housing support", async ({ page }) => {
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
    .select("id, stage, arrival_date, profile_data, post_relocation_generated, research_meta")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  if (!planRow) throw new Error("Test user has no active plan — onboard first");
  const planId = planRow.id as string;
  const prior = {
    stage: planRow.stage as string | null,
    arrival: planRow.arrival_date as string | null,
    profile: (planRow.profile_data ?? {}) as Record<string, unknown>,
    generated: planRow.post_relocation_generated as boolean | null,
    researchMeta: (planRow.research_meta ?? {}) as Record<string, unknown>,
  };

  async function patchPlan(updates: Record<string, unknown>) {
    const { error } = await a.from("relocation_plans").update(updates).eq("id", planId);
    if (error) throw error;
  }

  try {
    // ---- Sign in ------------------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL!);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD!);
    await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

    // ===== STATE A — Sweden, on-track timing, comfortable budget ===========
    await patchPlan({
      stage: "ready_for_pre_departure",
      arrival_date: arrivalAt(70), // ~10 weeks → on_track for Sweden (rec=10)
      profile_data: {
        destination: "Sweden",
        target_city: "Stockholm",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        monthly_budget: "1700 EUR",
      },
    });
    await refreshDashboard(page);

    // Heading + description present
    await expect(page.getByTestId("housing-support-heading")).toHaveText(/Housing support/i);
    await expect(page.getByTestId("housing-support-section")).toContainText(/decision support/i);

    // Five sub-blocks
    for (const id of [
      "housing-budget-card",
      "housing-timing-card",
      "housing-search-card",
      "housing-process-card",
      "housing-scams-card",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }

    const apiA = await readReport(page);

    // Budget verdict: comfortable or tight (1700 EUR is right inside Sweden 1300-2000 band)
    expect(["comfortable", "tight"]).toContain(apiA.priceExpectations.budgetVerdict);
    expect(apiA.priceExpectations.userBudget).toEqual({ amount: 1700, currency: "EUR" });
    await expect(page.getByTestId("housing-budget-card")).toHaveAttribute(
      "data-budget-verdict",
      /comfortable|tight/,
    );

    // Timing: ~10 weeks → on_track or ahead
    expect(["on_track", "ahead"]).toContain(apiA.timingGuidance.urgency);
    expect(apiA.timingGuidance.recommendedStartWeeksBefore).toBe(10); // Sweden override
    expect(apiA.timingGuidance.weeksUntilArrival).toBeGreaterThanOrEqual(9);
    expect(apiA.timingGuidance.weeksUntilArrival).toBeLessThanOrEqual(11);

    // Search guidance: Sweden-specific brand names should be present
    const allExamplesA = apiA.searchGuidance.flatMap((g) => g.examples).join(" ");
    expect(allExamplesA).toMatch(/Hemnet/);
    expect(allExamplesA).toMatch(/Blocket Bostad/);
    expect(allExamplesA).toMatch(/Hyresgästföreningen/);

    // Process steps: 6 with destination-aware Swedish bottleneck
    expect(apiA.processSteps).toHaveLength(6);
    const swedenBottleneck = apiA.processSteps.find((s) => s.id === "search-and-shortlist")!.commonBottleneck!;
    expect(swedenBottleneck.toLowerCase()).toMatch(/first-hand|andrahand|second-hand/);

    // Scam warnings: ≥ 6 with at least 3 high
    expect(apiA.scamWarnings.length).toBeGreaterThanOrEqual(6);
    const highSeverity = apiA.scamWarnings.filter((w) => w.severity === "high");
    expect(highSeverity.length).toBeGreaterThanOrEqual(3);
    const scamsCard = page.getByTestId("housing-scams-card");
    await expect(scamsCard.getByText(/refuses an in-person/i)).toBeVisible();
    await expect(scamsCard.getByText(/Western Union|crypto/i)).toBeVisible();

    await shot(page, "01-sweden-on-track");

    // ===== STATE B — Germany + tight budget + start_now timing =============
    await patchPlan({
      arrival_date: arrivalAt(28), // 4 weeks → start_now (rec=8)
      profile_data: {
        destination: "Germany",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        monthly_budget: "€1000", // below Germany 1-bed 1100-1800 → tight
      },
    });
    await refreshDashboard(page);
    const apiB = await readReport(page);

    // Currency parser: € symbol → EUR
    expect(apiB.priceExpectations.userBudget).toEqual({ amount: 1000, currency: "EUR" });
    expect(["tight", "unrealistic"]).toContain(apiB.priceExpectations.budgetVerdict);
    await expect(page.getByTestId("housing-budget-card")).toHaveAttribute(
      "data-budget-verdict",
      /tight|unrealistic/,
    );

    // Timing: 4 weeks ahead → start_now
    expect(apiB.timingGuidance.urgency).toBe("start_now");
    await expect(page.getByTestId("housing-timing-card")).toHaveAttribute(
      "data-timing-urgency",
      "start_now",
    );

    // Germany-specific brand names + SCHUFA bottleneck
    const allExamplesB = apiB.searchGuidance.flatMap((g) => g.examples).join(" ");
    expect(allExamplesB).toMatch(/ImmobilienScout24|Immowelt/);
    expect(allExamplesB).toMatch(/WG-Gesucht/);
    const germanBgCheck = apiB.processSteps.find((s) => s.id === "background-check")!.commonBottleneck!;
    expect(germanBgCheck).toMatch(/SCHUFA/);

    await shot(page, "02-germany-start-now-tight");

    // ===== STATE C — bare number "2500" (no currency) → defaults to EUR ====
    await patchPlan({
      arrival_date: arrivalAt(70),
      profile_data: {
        destination: "Germany",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        monthly_budget: "2500",
      },
    });
    await refreshDashboard(page);
    const apiC = await readReport(page);
    expect(apiC.priceExpectations.userBudget).toEqual({ amount: 2500, currency: "EUR" });
    // 2500 EUR in Germany 1-bed 1100-1800 → comfortable (above max)
    expect(apiC.priceExpectations.budgetVerdict).toBe("comfortable");

    // ===== STATE D — unrealistic budget (€500 in Sweden) ===================
    await patchPlan({
      arrival_date: arrivalAt(70),
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        monthly_budget: "500 EUR",
      },
    });
    await refreshDashboard(page);
    const apiD = await readReport(page);
    expect(apiD.priceExpectations.budgetVerdict).toBe("unrealistic");
    expect(apiD.priceExpectations.verdictReasoning.join(" ")).toMatch(/well below|below the typical/i);
    await expect(page.getByTestId("housing-budget-card")).toHaveAttribute(
      "data-budget-verdict",
      "unrealistic",
    );
    await shot(page, "03-sweden-unrealistic-budget");

    // ===== STATE E — no budget set → no_user_budget verdict ================
    await patchPlan({
      arrival_date: arrivalAt(70),
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        // no monthly_budget, no rental_budget_max
      },
    });
    await refreshDashboard(page);
    const apiE = await readReport(page);
    expect(apiE.priceExpectations.hasUserBudget).toBe(false);
    expect(apiE.priceExpectations.budgetVerdict).toBe("no_user_budget");
    expect(apiE.priceExpectations.verdictReasoning.join(" ")).toMatch(/Add a monthly budget/i);

    // ===== STATE F — unknown destination → graceful fallback ===============
    await patchPlan({
      arrival_date: arrivalAt(70),
      profile_data: {
        destination: "Vanuatu",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        monthly_budget: "1000 EUR",
      },
    });
    await refreshDashboard(page);
    const apiF = await readReport(page);

    // Budget parsed but no band → no_data
    expect(apiF.priceExpectations.hasUserBudget).toBe(true);
    expect(apiF.priceExpectations.budgetVerdict).toBe("no_data");
    expect(apiF.priceExpectations.realisticBands).toEqual([]);
    expect(apiF.priceExpectations.notes.join(" ")).toMatch(/no.*price band|don't have a price band/i);

    // Search guidance still shows ≥4 generic source categories
    expect(apiF.searchGuidance.length).toBeGreaterThanOrEqual(4);
    // No country-specific brand names should leak from the lookup table
    const fallbackText = apiF.searchGuidance.flatMap((g) => g.examples).join(" ").toLowerCase();
    for (const brand of ["hemnet", "immobilienscout", "idealista", "rightmove", "funda", "seloger", "boligportal", "daft.ie"]) {
      expect(fallbackText, `unknown destination must not surface ${brand}`).not.toContain(brand);
    }

    // Timing: default 8-week recommendation
    expect(apiF.timingGuidance.recommendedStartWeeksBefore).toBe(8);

    await shot(page, "04-unknown-destination-fallback");

    // ===== STATE G — 14 weeks → ahead ======================================
    await patchPlan({
      arrival_date: arrivalAt(14 * 7),
      profile_data: {
        destination: "Spain",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        monthly_budget: "1100 EUR",
      },
    });
    await refreshDashboard(page);
    const apiG = await readReport(page);
    expect(apiG.timingGuidance.recommendedStartWeeksBefore).toBe(6); // Spain override
    expect(["ahead"]).toContain(apiG.timingGuidance.urgency);

    // ===== STATE H — 2 weeks → behind ======================================
    await patchPlan({
      arrival_date: arrivalAt(14),
      profile_data: {
        destination: "Germany",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        monthly_budget: "1500 EUR",
      },
    });
    await refreshDashboard(page);
    const apiH = await readReport(page);
    expect(apiH.timingGuidance.urgency).toBe("behind");
    expect(apiH.timingGuidance.message.toLowerCase()).toMatch(/sublet|mid-term|behind/);
    await expect(page.getByTestId("housing-timing-card")).toHaveAttribute(
      "data-timing-urgency",
      "behind",
    );
    await shot(page, "05-behind-timing");

    // ===== STATE I — already arrived → post_arrival ========================
    await patchPlan({
      arrival_date: arrivalAt(-5),
      stage: "arrived",
      profile_data: {
        destination: "Germany",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        monthly_budget: "1500 EUR",
      },
    });
    await refreshDashboard(page);
    const apiI = await readReport(page);
    expect(apiI.timingGuidance.urgency).toBe("post_arrival");

    // ===== Visual / scam-card check (final state) ==========================
    // Scam list rendering
    const scamItems = page.locator('[data-testid^="housing-scam-"]');
    const scamCount = await scamItems.count();
    expect(scamCount).toBeGreaterThanOrEqual(6);

    // Each scam has signal, whyDangerous, whatToDo (verify on first one)
    const firstScam = scamItems.first();
    await expect(firstScam.getByText(/Why dangerous/i)).toBeVisible();
    await expect(firstScam.getByText(/What to do/i)).toBeVisible();

    // ===== Forbidden tokens — no marketplace, no affiliate, no 4D drift =====
    const sectionText = (await page.getByTestId("housing-support-section").innerText()).toLowerCase();
    const banned = [
      // Marketplace / partner / affiliate
      "affiliate",
      "partner offer",
      "sponsored listing",
      "book now",
      "apply via us",
      "we recommend",
      "we partner with",
      "referral fee",
      "commission",
      "buy now",
      // Pseudo-listings: amount + descriptor like "1-bed 12 sq m available"
      "available immediately at",
      // 4D cultural drift
      "national digital-id app",
      "peer-payment app",
      "out-of-hours line",
      // 5B/5C drift
      "repatriation",
      "pet relocation",
      "microchip",
      "unregister yourself",
    ];
    for (const phrase of banned) {
      expect(
        sectionText,
        `forbidden phrase "${phrase}" leaked into 5A copy`,
      ).not.toContain(phrase);
    }

    // ===== Examples are NOT rendered as clickable links ====================
    // SearchCard examples render as plain text inside .examples — there must
    // be no <a> tags inside the search-card pointing to listing platforms.
    const searchLinks = await page.getByTestId("housing-search-card").locator("a").count();
    expect(searchLinks, "search card must not render brand examples as links").toBe(0);

    // ===== Visual: ProcessCard renders a numbered ordered list ==============
    // Count <li> children inside the ordered-step list, not all elements
    // matching the housing-process- prefix (which would also pick up the
    // card and steps containers).
    const processStepItems = page.getByTestId("housing-process-steps").locator("> li");
    const stepCount = await processStepItems.count();
    expect(stepCount).toBe(6);

    await shot(page, "06-final-render");
    await shotFull(page, "07-full-page");
  } finally {
    // ---- Cleanup -----------------------------------------------------------
    await a
      .from("relocation_plans")
      .update({
        stage: prior.stage,
        arrival_date: prior.arrival,
        profile_data: prior.profile,
        post_relocation_generated: prior.generated ?? false,
        research_meta: prior.researchMeta,
      })
      .eq("id", planId);
  }
});
