// Phase 5C verification — Pet relocation.
//
// Frontend-first per verify.md. Drives state via service-role admin and
// asserts both DOM and API. Tight logic-grans on:
//   • Empty state when pets is "none" — small invite, no sub-cards.
//   • Active state when pets is set — five sub-blocks visible.
//   • Microchip + Vaccination state-driven from pet_microchip_status /
//     pet_vaccination_status.
//   • The "microchip BEFORE rabies" ordering rule is visible, not just in
//     data.
//   • Destination profile matching: EU (Sweden), UK, USA, Australia, and
//     unknown fallback ("generic").
//   • Australia-only T-26w timeline phase appears for AU/NZ + rabies-free.
//   • Snub-nosed-breed detection triggers a visible breed warning.
//   • Cabin vs cargo heuristic on pet_size_weight.
//   • Timeline passed/behind reflects arrival_date.
//   • Empty pet-breed string does NOT trigger snub-nosed warning.
//   • No marketplace / affiliate / Phase 6 drift.

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

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-5c");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  await page
    .getByTestId("pet-relocation-heading")
    .evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior }))
    .catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

interface PetRelocationReport {
  planId: string;
  generatedAt: string;
  hasPets: boolean;
  pet: {
    species: string | null;
    breed: string | null;
    size_weight: string | null;
    age: string | null;
    microchip: string;
    vaccination: string;
    isSnubNosedBreed: boolean;
  } | null;
  destination: string | null;
  arrivalDate: string | null;
  weeksUntilDeparture: number | null;
  microchipGuidance: {
    status: string;
    urgency: string;
    message: string;
    recommendedAction: string;
    orderingRule: string;
  };
  vaccinationGuidance: {
    status: string;
    urgency: string;
    message: string;
    recommendedAction: string;
    postVaccineWaitDays: number;
    commonGap: string;
  };
  importRuleGuidance: {
    destinationProfile: string;
    destinationLabel: string;
    keyChecks: string[];
    minimumLeadTimeWeeks: number;
    biggestWatchOut: string;
    authoritativeSource: string;
  };
  transportGuidance: {
    recommendedMode: string;
    modeReasoning: string[];
    airlineConstraints: string[];
    breedWarning: string | null;
    seasonalConsideration: string;
    cratePrep: string;
  };
  timeline: {
    id: string;
    weeksBefore: number;
    label: string;
    whatHappens: string;
    todos: string[];
    passed: boolean;
    behind: boolean;
    watchOut: string | null;
  }[];
  nextStep: string;
}

async function readReport(page: import("@playwright/test").Page): Promise<PetRelocationReport> {
  return await page.evaluate(async () => {
    const r = await fetch("/api/pet-relocation");
    return await r.json();
  });
}

async function refreshDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("pet-relocation-section")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="pet-relocation-section"]');
    return el && !el.textContent?.includes("Reading your pet-relocation plan");
  }, null, { timeout: 15_000 });
}

const arrivalAt = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

test("Phase 5C — pet relocation", async ({ page }) => {
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

    // ===== STATE A — empty (no pets) → invite empty-state =================
    await patchPlan({
      stage: "ready_for_pre_departure",
      arrival_date: arrivalAt(70),
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "none",
      },
    });
    await refreshDashboard(page);

    await expect(page.getByTestId("pet-relocation-section")).toHaveAttribute(
      "data-pet-state",
      "empty",
    );
    await expect(page.getByTestId("pet-relocation-heading")).toBeVisible();
    await expect(page.getByTestId("pet-relocation-section")).toContainText(/No pets on file/i);

    // None of the sub-cards exist in the empty state
    for (const id of [
      "pet-summary-card",
      "pet-microchip-card",
      "pet-vaccination-card",
      "pet-import-card",
      "pet-transport-card",
      "pet-timeline-card",
    ]) {
      await expect(page.getByTestId(id)).toHaveCount(0);
    }

    const apiA = await readReport(page);
    expect(apiA.hasPets).toBe(false);
    expect(apiA.pet).toBeNull();

    await shot(page, "01-empty-state");

    // ===== STATE B — dog, missing chip, starting vaccinations, Sweden ====
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
        pet_microchip_status: "no",
        pet_vaccination_status: "starting",
        pet_breed: "Labrador",
        pet_size_weight: "30 kg",
        pet_age: "4 years",
      },
    });
    await refreshDashboard(page);
    await expect(page.getByTestId("pet-relocation-section")).toHaveAttribute(
      "data-pet-state",
      "active",
    );

    // Five sub-blocks visible
    for (const id of [
      "pet-summary-card",
      "pet-microchip-card",
      "pet-vaccination-card",
      "pet-import-card",
      "pet-transport-card",
      "pet-timeline-card",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }

    const apiB = await readReport(page);
    expect(apiB.hasPets).toBe(true);
    expect(apiB.pet?.microchip).toBe("missing");
    expect(apiB.pet?.vaccination).toBe("starting");
    expect(apiB.pet?.isSnubNosedBreed).toBe(false);

    // Microchip card: missing + now urgency
    await expect(page.getByTestId("pet-microchip-card")).toHaveAttribute(
      "data-microchip-status",
      "missing",
    );
    await expect(page.getByTestId("pet-microchip-card")).toHaveAttribute(
      "data-microchip-urgency",
      "now",
    );

    // Ordering-rule visible in the DOM, not just in API data
    const orderingRule = page.getByTestId("pet-microchip-ordering-rule");
    await expect(orderingRule).toBeVisible();
    await expect(orderingRule).toContainText(/before/i);
    await expect(orderingRule).toContainText(/rabies/i);
    await expect(orderingRule).toContainText(/redone|repeat/i);

    // Vaccination card: starting + now urgency
    await expect(page.getByTestId("pet-vaccination-card")).toHaveAttribute(
      "data-vaccination-status",
      "starting",
    );
    await expect(page.getByTestId("pet-vaccination-card")).toHaveAttribute(
      "data-vaccination-urgency",
      "now",
    );
    expect(apiB.vaccinationGuidance.postVaccineWaitDays).toBe(21); // EU profile

    // Import card: EU profile, contains key check fragments
    await expect(page.getByTestId("pet-import-card")).toHaveAttribute("data-rule-profile", "eu");
    const importChecksB = page.getByTestId("pet-import-checks");
    await expect(importChecksB).toContainText(/ISO 11784/);
    await expect(importChecksB).toContainText(/21-day/);
    await expect(importChecksB).toContainText(/EU pet passport|Pet passport/i);

    // Transport: 30 kg → cargo
    await expect(page.getByTestId("pet-transport-card")).toHaveAttribute(
      "data-transport-mode",
      "cargo",
    );

    // No breed warning for Labrador
    await expect(page.getByTestId("pet-transport-breed-warning")).toHaveCount(0);

    // Timeline T-26w should NOT appear for EU
    await expect(page.locator('[data-testid="pet-timeline-T-26w"]')).toHaveCount(0);
    // Standard EU phases all visible
    for (const id of ["T-12w", "T-8w", "T-4w", "T-2w", "T-1w", "move_day", "post_arrival"]) {
      await expect(page.locator(`[data-testid="pet-timeline-${id}"]`)).toBeVisible();
    }

    await shot(page, "02-dog-missing-chip-sweden");

    // ===== STATE C — chip in_place, vaccination current → complete =======
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
        pet_microchip_status: "yes",
        pet_vaccination_status: "current",
        pet_breed: "Labrador",
        pet_size_weight: "30 kg",
      },
    });
    await refreshDashboard(page);
    const apiC = await readReport(page);
    expect(apiC.microchipGuidance.urgency).toBe("complete");
    expect(apiC.vaccinationGuidance.urgency).toBe("complete");
    await expect(page.getByTestId("pet-microchip-card")).toHaveAttribute(
      "data-microchip-status",
      "in_place",
    );

    // ===== STATE D — UK destination → uk profile + AHC + tapeworm ========
    await patchPlan({
      profile_data: {
        destination: "United Kingdom",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
        pet_microchip_status: "yes",
        pet_vaccination_status: "current",
        pet_breed: "Labrador",
        pet_size_weight: "30 kg",
      },
    });
    await refreshDashboard(page);
    const apiD = await readReport(page);
    expect(apiD.importRuleGuidance.destinationProfile).toBe("uk");
    expect(apiD.importRuleGuidance.keyChecks.join(" ")).toMatch(/AHC|Animal Health Certificate/);
    expect(apiD.importRuleGuidance.keyChecks.join(" ")).toMatch(/tapeworm/i);
    await expect(page.getByTestId("pet-import-card")).toHaveAttribute("data-rule-profile", "uk");

    // ===== STATE E — USA destination → usa profile =======================
    await patchPlan({
      profile_data: {
        destination: "United States",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
        pet_microchip_status: "yes",
        pet_vaccination_status: "current",
        pet_breed: "Labrador",
        pet_size_weight: "30 kg",
      },
    });
    await refreshDashboard(page);
    const apiE = await readReport(page);
    expect(apiE.importRuleGuidance.destinationProfile).toBe("usa");
    expect(apiE.importRuleGuidance.keyChecks.join(" ")).toMatch(/CDC|USDA|APHIS/);

    // ===== STATE F — Australia → australia_nz profile + T-26w + 30-day ===
    await patchPlan({
      arrival_date: arrivalAt(40 * 7), // 40 weeks ahead — AU needs 26+
      profile_data: {
        destination: "Australia",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
        pet_microchip_status: "yes",
        pet_vaccination_status: "current",
        pet_breed: "Labrador",
        pet_size_weight: "30 kg",
      },
    });
    await refreshDashboard(page);
    const apiF = await readReport(page);
    expect(apiF.importRuleGuidance.destinationProfile).toBe("australia_nz");
    expect(apiF.importRuleGuidance.minimumLeadTimeWeeks).toBeGreaterThanOrEqual(26);
    expect(apiF.importRuleGuidance.keyChecks.join(" ")).toMatch(/RNATT|titer/i);
    expect(apiF.importRuleGuidance.keyChecks.join(" ")).toMatch(/180-day|6 month/i);

    // T-26w phase exists for AU and mentions titer
    const t26 = apiF.timeline.find((p) => p.id === "T-26w");
    expect(t26).toBeTruthy();
    expect(t26!.todos.join(" ").toLowerCase()).toMatch(/titer|rnatt|180/);
    await expect(page.locator('[data-testid="pet-timeline-T-26w"]')).toBeVisible();

    // 30-day post-vaccine wait for AU
    expect(apiF.vaccinationGuidance.postVaccineWaitDays).toBe(30);

    await shot(page, "03-australia-titer-cycle");

    // ===== STATE G — unknown destination → generic fallback ==============
    await patchPlan({
      arrival_date: arrivalAt(70),
      profile_data: {
        destination: "Vanuatu",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
        pet_microchip_status: "yes",
        pet_vaccination_status: "current",
        pet_breed: "Labrador",
        pet_size_weight: "30 kg",
      },
    });
    await refreshDashboard(page);
    const apiG = await readReport(page);
    expect(apiG.importRuleGuidance.destinationProfile).toBe("generic");
    // Generic guidance is honest — no false precision
    expect(apiG.importRuleGuidance.keyChecks.join(" ")).toMatch(/Verify|verify/);
    expect(apiG.importRuleGuidance.keyChecks.join(" ").toLowerCase()).not.toMatch(
      /eu pet passport|ahc|cdc|rnatt/,
    );
    // generic profile has a positive lead-time number
    expect(apiG.importRuleGuidance.minimumLeadTimeWeeks).toBeGreaterThan(0);

    // ===== STATE H — snub-nosed breed → breed warning ====================
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
        pet_microchip_status: "yes",
        pet_vaccination_status: "current",
        pet_breed: "French Bulldog",
        pet_size_weight: "10 kg",
      },
    });
    await refreshDashboard(page);
    const apiH = await readReport(page);
    expect(apiH.pet?.isSnubNosedBreed).toBe(true);
    expect(apiH.transportGuidance.breedWarning).not.toBeNull();
    const breedWarn = page.getByTestId("pet-transport-breed-warning");
    await expect(breedWarn).toBeVisible();
    await expect(breedWarn).toContainText(/heat|cargo|refuse/i);
    await shot(page, "04-snub-nosed-breed");

    // ===== STATE I — small pet → cabin mode ==============================
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "cat",
        pet_microchip_status: "yes",
        pet_vaccination_status: "current",
        pet_breed: "Domestic Shorthair",
        pet_size_weight: "5 kg",
      },
    });
    await refreshDashboard(page);
    await expect(page.getByTestId("pet-transport-card")).toHaveAttribute(
      "data-transport-mode",
      "cabin",
    );

    // ===== STATE J — empty breed string → no snub warning, no broken copy
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
        pet_microchip_status: "yes",
        pet_vaccination_status: "current",
        pet_breed: "",
        pet_size_weight: "",
      },
    });
    await refreshDashboard(page);
    const apiJ = await readReport(page);
    expect(apiJ.pet?.isSnubNosedBreed).toBe(false);
    await expect(page.getByTestId("pet-transport-breed-warning")).toHaveCount(0);
    // Mode unconfirmed when size_weight is empty
    await expect(page.getByTestId("pet-transport-card")).toHaveAttribute(
      "data-transport-mode",
      "unknown",
    );
    // No literal "undefined" / "null" leaking into the DOM
    const sectionJ = (await page.getByTestId("pet-relocation-section").innerText()).toLowerCase();
    expect(sectionJ).not.toContain("undefined");
    expect(sectionJ).not.toContain("null kg");

    // ===== STATE K — timeline behind/passed reflects arrival_date ========
    // Ahead by 5 weeks → T-12w / T-8w should be flagged behind
    await patchPlan({
      arrival_date: arrivalAt(5 * 7),
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
        pet_microchip_status: "no",
        pet_vaccination_status: "starting",
        pet_breed: "Labrador",
        pet_size_weight: "30 kg",
      },
    });
    await refreshDashboard(page);
    await expect(page.locator('[data-testid="pet-timeline-T-12w"]')).toHaveAttribute(
      "data-phase-behind",
      "true",
    );
    await expect(page.locator('[data-testid="pet-timeline-T-8w"]')).toHaveAttribute(
      "data-phase-behind",
      "true",
    );
    // T-2w / T-1w / move_day still ahead (current = T-5w)
    await expect(page.locator('[data-testid="pet-timeline-T-2w"]')).toHaveAttribute(
      "data-phase-behind",
      "false",
    );

    // Already arrived → all phases passed
    await patchPlan({
      arrival_date: arrivalAt(-10),
      stage: "arrived",
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
        pet_microchip_status: "yes",
        pet_vaccination_status: "current",
        pet_breed: "Labrador",
        pet_size_weight: "30 kg",
      },
    });
    await refreshDashboard(page);
    const apiArrived = await readReport(page);
    for (const p of apiArrived.timeline) {
      expect(p.passed, `phase ${p.id} should be passed when arrived`).toBe(true);
    }
    await shot(page, "05-arrived-all-passed");

    // ===== Final: visual + forbidden-token / link audit ===================
    // Reset to a clean active state for final audit
    await patchPlan({
      arrival_date: arrivalAt(70),
      stage: "ready_for_pre_departure",
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
        pet_microchip_status: "no",
        pet_vaccination_status: "starting",
        pet_breed: "Labrador",
        pet_size_weight: "30 kg",
        pet_age: "4 years",
      },
    });
    await refreshDashboard(page);

    // ===== Forbidden tokens — marketplace / partner / Phase 6 drift =======
    const sectionText = (await page.getByTestId("pet-relocation-section").innerText()).toLowerCase();
    const banned = [
      // Marketplace / partner / affiliate
      "book a pet mover",
      "compare pet movers",
      "compare carriers",
      "affiliate",
      "partner offer",
      "we partner with",
      "we recommend our",
      "referral fee",
      "commission rate",
      "sponsored",
      "find a vet near you",
      "book a vet through",
      "vets near you",
      "compare vets",
      "pet insurance comparison",
      "buy now",
      "request a quote",
      // Phase 6 drift
      "notification preferences",
      "family reunification",
      "tax overview",
      "rule-change monitoring",
    ];
    for (const phrase of banned) {
      expect(
        sectionText,
        `forbidden phrase "${phrase}" leaked into 5C copy`,
      ).not.toContain(phrase);
    }

    // ===== No outbound vendor links =======================================
    const allLinks = await page.getByTestId("pet-relocation-section").locator("a").count();
    expect(allLinks, "5C section must not render outbound vendor / booking links").toBe(0);

    await shot(page, "06-final-render");
  } finally {
    // ---- Cleanup -----------------------------------------------------------
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
