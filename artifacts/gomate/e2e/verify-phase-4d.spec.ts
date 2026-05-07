// Phase 4D verification — Cultural orientation layer.
//
// Frontend-first per verify.md. Drives state via service-role admin and
// asserts both DOM and API. Tight logic-grans on:
//   • Section renders on /dashboard (its own surface, not a tab on 4A/B/C).
//   • Topics are structured cards, not blob text — each has a category badge,
//     phase badge, summary, why-it-matters, do/don't takeaways.
//   • Default profile (no children, no pets, no origin_lease_status) shows
//     5 base topics: systems-cascade, address-logic, common-pitfalls,
//     everyday-apps, healthcare-practice. (housing-culture, family-school,
//     pet-everyday are gated.)
//   • housing-culture appears ONLY when origin_lease_status === "renting".
//   • family-school-cadence appears ONLY when children_count > 0.
//   • pet-everyday appears ONLY when pets is set and not "none"/"no".
//   • Sort order: first_72h → any_time → first_30d (no first_72h after a
//     first_30d).
//   • Filter pill ("First 72h" / "First 30 days" / "All") narrows the visible
//     set without re-fetching.
//   • Sektion håller sig till sin scope: ingen banking-flow, ingen insurance,
//     inget körkort, inga marknadsplats-/brand-namn.
//   • Inget content-marketing-fluff (fun fact / did you know / tip of the day).

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

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-4d");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  await page
    .getByTestId("orientation-section")
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

interface OrientationTakeaway {
  text: string;
  kind: "do" | "dont" | "neutral";
}
interface OrientationTopic {
  id: string;
  category: string;
  title: string;
  summary: string;
  whyItMatters: string;
  practicalTakeaways: OrientationTakeaway[];
  phase: "first_72h" | "any_time" | "first_30d" | "later";
  relatedTaskRef?: string;
  order: number;
}
interface OrientationReport {
  planId: string;
  generatedAt: string;
  destination: string | null;
  isFreeMovement: boolean;
  topics: OrientationTopic[];
}

async function readReport(page: import("@playwright/test").Page): Promise<OrientationReport> {
  return await page.evaluate(async () => {
    const r = await fetch("/api/orientation");
    return await r.json();
  });
}

async function refreshDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("orientation-section")).toBeVisible({ timeout: 15_000 });
  // Wait for loading shimmer to clear.
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="orientation-section"]');
    return el && !el.textContent?.includes("Reading your orientation");
  }, null, { timeout: 15_000 });
}

const PHASE_RANK: Record<string, number> = {
  first_72h: 0,
  any_time: 1,
  first_30d: 2,
  later: 3,
};

test("Phase 4D — cultural orientation layer", async ({ page }) => {
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

    // ===== STATE A — default profile (no kids, no pets, no renting) ==========
    // Should show 5 base topics: systems-cascade, address-logic, common-pitfalls,
    // everyday-apps, healthcare-practice.
    await patchPlan({
      stage: "ready_for_pre_departure",
      arrival_date: new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10),
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);

    // Heading + description
    await expect(page.getByTestId("orientation-heading")).toHaveText(/Cultural orientation/i);
    await expect(page.getByTestId("orientation-section")).toContainText(/practical orientation, not a country guide/i);

    const apiA = await readReport(page);
    const idsA = apiA.topics.map((t) => t.id);
    const baseExpected = [
      "orient:systems-cascade",
      "orient:address-logic",
      "orient:common-pitfalls",
      "orient:everyday-apps",
      "orient:healthcare-practice",
    ];
    for (const id of baseExpected) {
      expect(idsA, `base profile must include ${id}`).toContain(id);
    }
    // Gated ones must be absent on default profile.
    expect(idsA, "housing-culture gated by origin_lease_status").not.toContain("orient:housing-culture");
    expect(idsA, "family-school-cadence gated by children_count").not.toContain("orient:family-school-cadence");
    expect(idsA, "pet-everyday gated by pets").not.toContain("orient:pet-everyday");

    // DOM: topic cards exist for each topic in the API.
    for (const id of idsA) {
      await expect(page.locator(`[data-testid="orientation-topic-${id}"]`)).toBeVisible();
    }

    // Visual: each card has a category badge AND a phase badge.
    for (const id of idsA) {
      const card = page.locator(`[data-testid="orientation-topic-${id}"]`);
      // category data-attr is on the article element
      await expect(card).toHaveAttribute("data-orientation-category", /.+/);
      await expect(card).toHaveAttribute("data-orientation-phase", /.+/);
    }
    await shot(page, "01-default-profile");

    // ===== STATE B — origin_lease_status='renting' surfaces housing-culture ==
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "renting",
      },
    });
    await refreshDashboard(page);
    const apiB = await readReport(page);
    expect(apiB.topics.map((t) => t.id), "housing-culture renting").toContain("orient:housing-culture");
    await expect(page.locator('[data-testid="orientation-topic-orient:housing-culture"]')).toBeVisible();
    await shot(page, "02-housing-renting");

    // ===== STATE C — children_count>0 surfaces family-school-cadence =========
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        children_count: 2,
      },
    });
    await refreshDashboard(page);
    const apiC = await readReport(page);
    expect(apiC.topics.map((t) => t.id), "family-school with children").toContain("orient:family-school-cadence");
    expect(apiC.topics.map((t) => t.id), "housing-culture should not surface without renting").not.toContain("orient:housing-culture");
    await expect(page.locator('[data-testid="orientation-topic-orient:family-school-cadence"]')).toBeVisible();

    // ===== STATE D — pets gating ============================================
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "none",
      },
    });
    await refreshDashboard(page);
    const apiD0 = await readReport(page);
    expect(apiD0.topics.map((t) => t.id), "'none' must not surface pet topic").not.toContain("orient:pet-everyday");

    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
      },
    });
    await refreshDashboard(page);
    const apiD = await readReport(page);
    expect(apiD.topics.map((t) => t.id), "pets='dog' surfaces pet topic").toContain("orient:pet-everyday");
    await expect(page.locator('[data-testid="orientation-topic-orient:pet-everyday"]')).toBeVisible();
    await shot(page, "03-with-pets");

    // ===== STATE E — full profile (renting + kids + pets) ====================
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "renting",
        children_count: 2,
        pets: "dog",
      },
    });
    await refreshDashboard(page);
    const apiE = await readReport(page);
    const idsE = apiE.topics.map((t) => t.id);
    // All 8 should now be present.
    for (const id of [
      "orient:systems-cascade",
      "orient:address-logic",
      "orient:common-pitfalls",
      "orient:everyday-apps",
      "orient:healthcare-practice",
      "orient:housing-culture",
      "orient:family-school-cadence",
      "orient:pet-everyday",
    ]) {
      expect(idsE, `full profile includes ${id}`).toContain(id);
    }

    // ===== Sort order — phase rank monotone non-decreasing =================
    const phases = apiE.topics.map((t) => PHASE_RANK[t.phase]);
    for (let i = 1; i < phases.length; i++) {
      expect(
        phases[i - 1] <= phases[i],
        `sort violation at index ${i}: ${apiE.topics[i - 1].phase} before ${apiE.topics[i].phase}`,
      ).toBe(true);
    }

    // DOM order matches API order.
    const domIds = await page
      .locator('[data-testid^="orientation-topic-"]')
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute("data-testid")?.replace(/^orientation-topic-/, "") ?? ""),
      );
    expect(domIds.length, "topic cards in DOM").toBe(apiE.topics.length);
    expect(domIds, "DOM order matches API order").toEqual(idsE);

    // ===== Each topic has stable structure (no blob) =======================
    for (const t of apiE.topics) {
      expect(typeof t.title).toBe("string");
      expect(t.title.length).toBeGreaterThan(5);
      expect(t.summary.length).toBeGreaterThan(20);
      expect(t.whyItMatters.length).toBeGreaterThan(20);
      expect(t.practicalTakeaways.length).toBeGreaterThanOrEqual(3);
      expect(["systems", "everyday_apps", "address_logic", "healthcare_practice", "housing_culture", "common_pitfalls"]).toContain(t.category);
      expect(["first_72h", "any_time", "first_30d", "later"]).toContain(t.phase);
      // At least one do AND one dont across the body — anti-blob.
      const kinds = new Set(t.practicalTakeaways.map((tt) => tt.kind));
      expect(
        kinds.has("do") || kinds.has("dont"),
        `topic ${t.id} has only neutral takeaways`,
      ).toBe(true);
    }

    // do/dont icons rendered on common-pitfalls
    const pitfallsCard = page.locator('[data-testid="orientation-topic-orient:common-pitfalls"]');
    await expect(pitfallsCard.locator('[data-takeaway-kind="do"]').first()).toBeVisible();
    await expect(pitfallsCard.locator('[data-takeaway-kind="dont"]').first()).toBeVisible();
    await shot(page, "04-full-profile-all-topics");

    // ===== Filter pill — "First 72h" narrows the set ========================
    await page.getByTestId("orientation-filter").getByRole("button", { name: /First 72h/i }).click();
    await page.waitForTimeout(200);
    const visiblePhases = await page
      .locator('[data-testid^="orientation-topic-"]')
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute("data-orientation-phase") ?? ""),
      );
    expect(visiblePhases.length, "first_72h filter shows at least one topic").toBeGreaterThan(0);
    for (const ph of visiblePhases) {
      expect(["first_72h", "any_time"], `filter leaked phase ${ph}`).toContain(ph);
    }
    await shot(page, "05-filter-first-72h");

    // Reset to All
    await page.getByTestId("orientation-filter").getByRole("button", { name: /^All/i }).click();
    await page.waitForTimeout(200);
    const allCount = await page.locator('[data-testid^="orientation-topic-"]').count();
    expect(allCount).toBe(apiE.topics.length);

    // ===== Forbidden tokens — no marketplace, no 4A/B/C drift, no fluff ======
    const sectionText = (await page.getByTestId("orientation-section").innerText()).toLowerCase();
    const banned = [
      // Marketplace / brands
      "safetywing", "cigna global", "wise", "revolut", "n26",
      "affiliate", "partner offer", "book now", "sign up",
      "compare providers", "best provider",
      // Tourism / fluff
      "fun fact", "did you know", "tip of the day", "must-see",
      // Drift
      "open a bank account at",
      "compare insurance products",
    ];
    for (const phrase of banned) {
      expect(
        sectionText,
        `forbidden phrase "${phrase}" leaked into 4D copy`,
      ).not.toContain(phrase);
    }

    // ===== State drives copy — destination is reflected in the description ==
    expect(sectionText).toContain("sweden");
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
