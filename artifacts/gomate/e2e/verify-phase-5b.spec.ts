// Phase 5B verification — Departure / repatriation flow.
//
// Frontend-first per verify.md. Drives state via service-role admin and
// asserts both DOM and API. Tight logic-grans on:
//   • Section is its own surface on /dashboard with four distinct sub-blocks
//     (timing, cancel, deregister, belongings).
//   • Cancel and Deregister are kept apart — Cancel is private contracts,
//     Deregister is authorities + register changes.
//   • Notifications (e.g. mail forwarding, tax filing) carry a Notification
//     badge instead of being painted as deregistrations.
//   • Timing thresholds behave at 18 / 10 / 6 / 2 / -5 weeks before arrival.
//   • origin_lease_status drives lease-rental vs property-decision.
//   • bringing_vehicle drives auto-insurance + vehicle-deregister + vehicle
//     belongings category.
//   • Cancel items are sorted by whenToAct.
//   • No marketplace / affiliate / partner patterns.
//   • No 5C (pet-relocation) drift.

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

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-5b");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  await page
    .getByTestId("departure-flow-heading")
    .evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior }))
    .catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

interface CancelItem {
  id: string;
  category: string;
  title: string;
  description: string;
  noticeWeeks: number;
  whenToAct: string;
  watchOut: string | null;
}
interface DeregisterItem {
  id: string;
  category: string;
  title: string;
  description: string;
  whenToAct: string;
  legalConsequence: string;
  isDeregistration: boolean;
}
interface BelongingsCategoryItem {
  id: string;
  label: string;
  recommendedActions: string[];
  guidance: string;
  examples: string[];
  watchOut: string | null;
}
interface DepartureFlowReport {
  planId: string;
  generatedAt: string;
  direction: string;
  closingFrom: string | null;
  goingTo: string | null;
  stage: string | null;
  timing: {
    departureDate: string | null;
    weeksUntilDeparture: number | null;
    urgency: string;
    message: string;
    nextStep: string;
    milestones: { weeksBefore: number; label: string }[];
  };
  cancelItems: CancelItem[];
  deregisterItems: DeregisterItem[];
  belongings: BelongingsCategoryItem[];
  nextStep: string;
}

async function readReport(page: import("@playwright/test").Page): Promise<DepartureFlowReport> {
  return await page.evaluate(async () => {
    const r = await fetch("/api/departure-flow");
    return await r.json();
  });
}

async function refreshDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("departure-flow-section")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="departure-flow-section"]');
    return el && !el.textContent?.includes("Reading your departure plan");
  }, null, { timeout: 15_000 });
}

const arrivalAt = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

const WHEN_RANK: Record<string, number> = {
  now: 0,
  "8w_before": 1,
  "4w_before": 2,
  "2w_before": 3,
  "1w_before": 4,
  move_day: 5,
  after_move: 6,
};

test("Phase 5B — departure / repatriation flow", async ({ page }) => {
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

    // ===== STATE A — renting, no vehicle, on_track timing =================
    await patchPlan({
      stage: "ready_for_pre_departure",
      arrival_date: arrivalAt(70), // 10 weeks → on_track
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "renting",
      },
    });
    await refreshDashboard(page);

    // Heading + description
    await expect(page.getByTestId("departure-flow-heading")).toContainText(/Closing down/i);
    await expect(page.getByTestId("departure-flow-section")).toContainText(
      /Cancel, deregister, and decide what to do with your stuff/i,
    );

    // Four sub-blocks
    for (const id of [
      "departure-timing-card",
      "departure-cancel-card",
      "departure-deregister-card",
      "departure-belongings-card",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }

    const apiA = await readReport(page);

    // Direction always leaving_origin in v1
    expect(apiA.direction).toBe("leaving_origin");

    // Timing: ~10 weeks → on_track
    expect(apiA.timing.urgency).toBe("on_track");
    expect(apiA.timing.weeksUntilDeparture).toBeGreaterThanOrEqual(9);
    expect(apiA.timing.weeksUntilDeparture).toBeLessThanOrEqual(11);
    await expect(page.getByTestId("departure-timing-card")).toHaveAttribute(
      "data-departure-urgency",
      "on_track",
    );

    // Lease items: rental present, property absent
    const cancelIdsA = apiA.cancelItems.map((c) => c.id);
    expect(cancelIdsA, "renting → lease-rental").toContain("cancel:lease-rental");
    expect(cancelIdsA, "renting → property-decision absent").not.toContain("cancel:property-decision");

    // No vehicle → no auto-insurance + no vehicle-deregister + no vehicles belongings
    expect(cancelIdsA).not.toContain("cancel:auto-insurance");
    const deregIdsA = apiA.deregisterItems.map((d) => d.id);
    expect(deregIdsA).not.toContain("dereg:vehicle");
    const belIdsA = apiA.belongings.map((b) => b.id);
    expect(belIdsA, "no vehicle profile → no vehicles category").not.toContain("bel:vehicles");

    // Belongings ≥6 (vehicles is gated, others always shown)
    expect(belIdsA.length).toBeGreaterThanOrEqual(6);

    // Cancel items sorted by whenToAct
    const whens = apiA.cancelItems.map((c) => c.whenToAct);
    for (let i = 1; i < whens.length; i++) {
      expect(
        WHEN_RANK[whens[i - 1]] <= WHEN_RANK[whens[i]],
        `cancel sort violation at ${i}: ${whens[i - 1]} before ${whens[i]}`,
      ).toBe(true);
    }

    // mail-forwarding marked as Notification (not deregistration)
    const mailFwd = apiA.deregisterItems.find((d) => d.id === "dereg:mail-forwarding");
    expect(mailFwd?.isDeregistration, "mail forwarding is NOT a deregistration").toBe(false);
    // population-register IS a deregistration
    const popReg = apiA.deregisterItems.find((d) => d.id === "dereg:population-register");
    expect(popReg?.isDeregistration).toBe(true);

    // DOM: rental-lease item visible inside Cancel card
    await expect(
      page.getByTestId("departure-cancel-card").locator('[data-testid="departure-cancel-cancel:lease-rental"]'),
    ).toBeVisible();

    // DOM: mail-forwarding has Notification badge
    const mailFwdEl = page.locator('[data-testid="departure-deregister-dereg:mail-forwarding"]');
    await expect(mailFwdEl).toBeVisible();
    await expect(mailFwdEl.getByText(/Notification/)).toBeVisible();
    // population-register card does NOT carry the Notification badge
    const popRegEl = page.locator('[data-testid="departure-deregister-dereg:population-register"]');
    await expect(popRegEl).toBeVisible();
    await expect(popRegEl.getByText(/Notification/)).toHaveCount(0);

    await shot(page, "01-renting-on-track");

    // ===== STATE B — owning, with vehicle, early timing ===================
    await patchPlan({
      arrival_date: arrivalAt(18 * 7), // 18 weeks → early
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "owning",
        bringing_vehicle: "yes",
      },
    });
    await refreshDashboard(page);
    const apiB = await readReport(page);
    expect(apiB.timing.urgency).toBe("early");
    await expect(page.getByTestId("departure-timing-card")).toHaveAttribute(
      "data-departure-urgency",
      "early",
    );

    const cancelIdsB = apiB.cancelItems.map((c) => c.id);
    // Owning → property-decision; renting absent
    expect(cancelIdsB, "owning → property-decision").toContain("cancel:property-decision");
    expect(cancelIdsB, "owning → lease-rental absent").not.toContain("cancel:lease-rental");
    // Vehicle items present
    expect(cancelIdsB).toContain("cancel:auto-insurance");
    const deregIdsB = apiB.deregisterItems.map((d) => d.id);
    expect(deregIdsB).toContain("dereg:vehicle");
    const belIdsB = apiB.belongings.map((b) => b.id);
    expect(belIdsB).toContain("bel:vehicles");

    await expect(
      page.locator('[data-testid="departure-belongings-bel:vehicles"]'),
    ).toBeVisible();

    await shot(page, "02-owning-vehicle-early");

    // ===== STATE C — compressed timing (6 weeks ahead) ====================
    await patchPlan({
      arrival_date: arrivalAt(6 * 7),
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "renting",
      },
    });
    await refreshDashboard(page);
    const apiC = await readReport(page);
    expect(apiC.timing.urgency).toBe("compressed");
    expect(apiC.timing.message.toLowerCase()).toMatch(/lease-notice|past the typical/);
    await shot(page, "03-compressed");

    // ===== STATE D — very_late timing (2 weeks) ===========================
    await patchPlan({
      arrival_date: arrivalAt(14),
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "renting",
      },
    });
    await refreshDashboard(page);
    const apiD = await readReport(page);
    expect(apiD.timing.urgency).toBe("very_late");
    expect(apiD.timing.nextStep.toLowerCase()).toMatch(/triage|population-register|utility/);
    await expect(page.getByTestId("departure-timing-card")).toHaveAttribute(
      "data-departure-urgency",
      "very_late",
    );
    await shot(page, "04-very-late");

    // ===== STATE E — post_departure (already arrived) ======================
    await patchPlan({
      arrival_date: arrivalAt(-5),
      stage: "arrived",
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "renting",
      },
    });
    await refreshDashboard(page);
    const apiE = await readReport(page);
    expect(apiE.timing.urgency).toBe("post_departure");
    expect(apiE.timing.message.toLowerCase()).toMatch(/already left|tax filing|mail forwarding/);
    await shot(page, "05-post-departure");

    // ===== STATE F — no departure date set (surrogate handling) ============
    await patchPlan({
      arrival_date: null,
      stage: "collecting",
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "renting",
      },
    });
    await refreshDashboard(page);
    const apiF = await readReport(page);
    expect(apiF.timing.weeksUntilDeparture).toBeNull();
    expect(apiF.timing.message.toLowerCase()).toMatch(/isn't set yet|set your departure/i);
    expect(apiF.timing.nextStep.toLowerCase()).toMatch(/set your departure|set your arrival/i);
    // Section still renders — no crash, no error state
    await expect(page.getByTestId("departure-timing-card")).toBeVisible();
    await expect(page.getByTestId("departure-cancel-card")).toBeVisible();
    await expect(page.getByTestId("departure-deregister-card")).toBeVisible();
    await expect(page.getByTestId("departure-belongings-card")).toBeVisible();
    // Cancel/deregister/belongings still authored even without a date
    expect(apiF.cancelItems.length).toBeGreaterThan(0);
    expect(apiF.deregisterItems.length).toBeGreaterThan(0);
    expect(apiF.belongings.length).toBeGreaterThanOrEqual(6);
    await shot(page, "06-no-departure-date");

    // ===== STATE G — neither (no lease) ====================================
    await patchPlan({
      arrival_date: arrivalAt(70),
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "neither",
      },
    });
    await refreshDashboard(page);
    const apiG = await readReport(page);
    const cancelIdsG = apiG.cancelItems.map((c) => c.id);
    expect(cancelIdsG).not.toContain("cancel:lease-rental");
    expect(cancelIdsG).not.toContain("cancel:property-decision");
    // Other cancel items remain
    expect(cancelIdsG).toContain("cancel:internet");

    // ===== STATE H — tax filing not required ===============================
    await patchPlan({
      arrival_date: arrivalAt(70),
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "renting",
        departure_tax_filing_required: "no",
      },
    });
    await refreshDashboard(page);
    const apiH = await readReport(page);
    const deregIdsH = apiH.deregisterItems.map((d) => d.id);
    expect(deregIdsH).not.toContain("dereg:tax-authority");

    // ===== Final state for visual + content checks =========================
    await patchPlan({
      arrival_date: arrivalAt(70),
      stage: "ready_for_pre_departure",
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "renting",
      },
    });
    await refreshDashboard(page);

    // Belongings: documents → "take"; furniture → "sell"; sentimental → take|store
    const apiFinal = await readReport(page);
    const docs = apiFinal.belongings.find((b) => b.id === "bel:documents")!;
    expect(docs.recommendedActions[0]).toBe("take");
    const furniture = apiFinal.belongings.find((b) => b.id === "bel:furniture")!;
    expect(furniture.recommendedActions[0]).toBe("sell");
    const sentimental = apiFinal.belongings.find((b) => b.id === "bel:sentimental")!;
    expect(["take", "store"]).toContain(sentimental.recommendedActions[0]);

    // Cancel + Deregister kept apart in the DOM (separate cards, separate
    // testid prefixes inside)
    const cancelInsideDereg = await page
      .getByTestId("departure-deregister-card")
      .locator('[data-testid^="departure-cancel-cancel:"]')
      .count();
    expect(cancelInsideDereg, "cancel items must not bleed into deregister card").toBe(0);

    const deregInsideCancel = await page
      .getByTestId("departure-cancel-card")
      .locator('[data-testid^="departure-deregister-dereg:"]')
      .count();
    expect(deregInsideCancel, "deregister items must not bleed into cancel card").toBe(0);

    // ===== Forbidden tokens — marketplace / partner / 5C drift ============
    const sectionText = (await page.getByTestId("departure-flow-section").innerText()).toLowerCase();
    const banned = [
      // Marketplace / partner / affiliate
      "affiliate",
      "partner offer",
      "sponsored",
      "book a mover",
      "request a quote",
      "we partner with",
      "we recommend our",
      "referral fee",
      "commission rate",
      "buy now",
      "compare movers",
      // 5C pet-relocation drift
      "microchip",
      "rabies titer",
      "pet passport",
      "pet quarantine",
      "iata cargo crate",
    ];
    for (const phrase of banned) {
      expect(
        sectionText,
        `forbidden phrase "${phrase}" leaked into 5B copy`,
      ).not.toContain(phrase);
    }

    // ===== No clickable mover/storage links =================================
    const allLinks = await page.getByTestId("departure-flow-section").locator("a").count();
    expect(allLinks, "5B section must not render outbound vendor links").toBe(0);

    await shot(page, "07-final-render");
  } finally {
    // ---- Cleanup -----------------------------------------------------------
    // The DB enforces a check constraint on stage; if the prior stage value
    // is from older test data and no longer in the allowed set, fall back
    // to a safe stage instead of failing the cleanup.
    const ALLOWED = new Set([
      "collecting",
      "generating",
      "complete",
      "ready_for_pre_departure",
      "pre_departure",
      "arrived",
    ]);
    const safeStage = prior.stage && ALLOWED.has(prior.stage) ? prior.stage : "collecting";
    await a
      .from("relocation_plans")
      .update({
        stage: safeStage,
        arrival_date: prior.arrival,
        profile_data: prior.profile,
        post_relocation_generated: prior.generated ?? false,
        research_meta: prior.researchMeta,
      })
      .eq("id", planId);
  }
});
