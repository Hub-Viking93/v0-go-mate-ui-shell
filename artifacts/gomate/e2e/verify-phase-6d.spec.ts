// Phase 6D verification — Rule-change monitoring.
//
// Frontend-first per verify.md. Drives state via service-role admin and
// asserts both DOM and DB. Tight logic-grans on:
//   • Empty state when nothing in the curated feed scopes to the user.
//   • Relevance gating per rule-change predicate (Schengen+non-EU,
//     EU-citizen exemption, UK destination, US-CDC-dog, EU-pet-rabies,
//     Sweden housing, France Visale).
//   • Severity escalation: ETIAS arrival ≤90d → action_required.
//   • Per-user impact text references actual profile state.
//   • Research-trigger flag visible on research_meta-flagged entries
//     and absent on non-flagged entries.
//   • Ack-status workflow: new → reviewed; new → dismissed (moves to
//     fold); new → research_requested. Persisted in
//     `relocation_plans.research_meta.rule_change_acks`.
//   • DOM action-link routes correctly.
//   • No duplication: same scan with same state doesn't proliferate
//     entries.
//   • No newsfeed / partner / 6B drift.
//   • 6D ≠ 6A separation: rule-change UI is its own surface.

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

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-6d");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  await page
    .getByTestId("rule-changes-heading")
    .evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior }))
    .catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

interface RuleChangeAck {
  status: "new" | "reviewed" | "dismissed" | "research_requested";
  at: string;
}
interface RuleChangeRelevant {
  id: string;
  title: string;
  area: string;
  source: { name: string; kind: string; url?: string | null };
  changedAt: string;
  publishedAt: string;
  summary: string;
  shouldTriggerResearch: boolean;
  isRelevant: true;
  relevanceReasons: string[];
  impactSummary: string;
  impactSeverity: "info" | "review" | "action_required";
  recommendedAction: { kind: string; title: string; body: string; targetRoute: string | null };
  ack: RuleChangeAck;
}
interface RuleChangeReport {
  planId: string;
  generatedAt: string;
  relevant: RuleChangeRelevant[];
  totalFeed: number;
  counts: {
    new: number;
    reviewed: number;
    dismissed: number;
    researchRequested: number;
    actionRequired: number;
  };
}

async function readReport(page: import("@playwright/test").Page): Promise<RuleChangeReport> {
  return await page.evaluate(async () => {
    const r = await fetch("/api/rule-changes");
    return await r.json();
  });
}

async function refreshDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("rule-changes-section")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="rule-changes-section"]');
    return el && !el.textContent?.includes("Reading recent rule changes");
  }, null, { timeout: 15_000 });
}

const arrivalAt = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

test("Phase 6D — rule-change monitoring", async ({ page }) => {
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
    .select("id, stage, arrival_date, profile_data, research_meta")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  if (!planRow) throw new Error("Test user has no active plan");
  const planId = planRow.id as string;

  const prior = {
    stage: planRow.stage as string | null,
    arrival: planRow.arrival_date as string | null,
    profile: (planRow.profile_data ?? {}) as Record<string, unknown>,
    researchMeta: (planRow.research_meta ?? {}) as Record<string, unknown>,
  };

  async function patchPlan(updates: Record<string, unknown>) {
    const { error } = await a.from("relocation_plans").update(updates).eq("id", planId);
    if (error) throw error;
  }

  async function readAcks(): Promise<Record<string, RuleChangeAck>> {
    const { data } = await a
      .from("relocation_plans")
      .select("research_meta")
      .eq("id", planId)
      .single();
    const meta = (data?.research_meta ?? {}) as Record<string, unknown>;
    const raw = meta.rule_change_acks;
    return (raw && typeof raw === "object" ? raw : {}) as Record<string, RuleChangeAck>;
  }

  // Reset acks at start of test so prior runs don't bleed in.
  await patchPlan({
    research_meta: { ...(prior.researchMeta ?? {}), rule_change_acks: {} },
  });

  try {
    // ---- Sign in -----------------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL!);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD!);
    await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

    // ===== STATE A — empty state (Mongolia, no pets, study) ==============
    await patchPlan({
      stage: "ready_for_pre_departure",
      arrival_date: arrivalAt(60),
      profile_data: {
        destination: "Mongolia",
        current_location: "Argentina",
        citizenship: "Argentinian",
        purpose: "study",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);

    await expect(page.getByTestId("rule-changes-heading")).toHaveText(/Plan-affecting changes/i);
    await expect(page.getByTestId("rule-changes-section")).toHaveAttribute(
      "data-rule-changes-state",
      "empty",
    );
    const apiA = await readReport(page);
    expect(apiA.totalFeed).toBe(6);
    expect(apiA.relevant.length).toBe(0);
    await shot(page, "01-empty-state");

    // ===== STATE B — Sweden + non-EU citizen → ETIAS + Sweden housing =====
    await patchPlan({
      arrival_date: arrivalAt(120), // > 90 days → review (not action_required)
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiB = await readReport(page);
    const idsB = apiB.relevant.map((r) => r.id);
    expect(idsB).toContain("rc:schengen-etias");
    expect(idsB).toContain("rc:sweden-rental-bostadsbrist");
    // None of the others should fire here
    expect(idsB).not.toContain("rc:uk-evisa-migration");
    expect(idsB).not.toContain("rc:eu-pet-rabies-tightening");
    expect(idsB).not.toContain("rc:us-cdc-dog-import");
    expect(idsB).not.toContain("rc:france-visale-guarantor");

    // Severity at +120d → ETIAS = review, Sweden housing = info
    const etiasB = apiB.relevant.find((r) => r.id === "rc:schengen-etias")!;
    expect(etiasB.impactSeverity).toBe("review");
    const swedenHousingB = apiB.relevant.find((r) => r.id === "rc:sweden-rental-bostadsbrist")!;
    expect(swedenHousingB.impactSeverity).toBe("info");
    // Per-user reasons should reference actual profile state
    expect(etiasB.relevanceReasons.join(" ")).toMatch(/Sweden/);
    expect(etiasB.relevanceReasons.join(" ")).toMatch(/non-EU/i);

    // DOM: card visible, severity attr matches, area attr is set
    const etiasCard = page.locator('[data-testid="rule-change-rc:schengen-etias"]');
    await expect(etiasCard).toBeVisible();
    await expect(etiasCard).toHaveAttribute("data-rule-change-severity", "review");
    await expect(etiasCard).toHaveAttribute("data-rule-change-area", "border_entry");
    // Research-flag visible
    await expect(page.getByTestId("rule-change-rc:schengen-etias-research-flag")).toBeVisible();
    // Ack initially "new"
    await expect(etiasCard).toHaveAttribute("data-rule-change-ack-status", "new");

    // Why-this-affects-you block contains the user's destination
    await expect(page.getByTestId("rule-change-rc:schengen-etias-relevance")).toContainText(/Sweden/);

    // Counts badge: 2 affect you
    await expect(page.getByTestId("rule-changes-section")).toContainText(/6 on file · 2 affect you/);

    await shot(page, "02-sweden-non-eu");

    // ===== STATE C — arrival ≤90d → ETIAS escalates to action_required =====
    await patchPlan({
      arrival_date: arrivalAt(30),
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiC = await readReport(page);
    const etiasC = apiC.relevant.find((r) => r.id === "rc:schengen-etias")!;
    expect(etiasC.impactSeverity).toBe("action_required");
    await expect(
      page.locator('[data-testid="rule-change-rc:schengen-etias"]'),
    ).toHaveAttribute("data-rule-change-severity", "action_required");
    // Action-required count badge appears
    await expect(page.getByTestId("rule-changes-action-count")).toBeVisible();
    await expect(page.getByTestId("rule-changes-action-count")).toContainText(/action required/i);
    await shot(page, "03-etias-action-required");

    // ===== STATE D — EU citizen → ETIAS exemption ==========================
    await patchPlan({
      arrival_date: arrivalAt(120),
      profile_data: {
        destination: "Sweden",
        current_location: "Germany",
        citizenship: "German", // EU citizen → ETIAS not applicable
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiD = await readReport(page);
    expect(
      apiD.relevant.find((r) => r.id === "rc:schengen-etias"),
      "EU citizen → ETIAS should NOT scope",
    ).toBeUndefined();
    // Sweden housing still surfaces
    expect(apiD.relevant.find((r) => r.id === "rc:sweden-rental-bostadsbrist")).toBeTruthy();

    // ===== STATE E — UK destination → UK eVisa (action_required) ==========
    await patchPlan({
      profile_data: {
        destination: "United Kingdom",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiE = await readReport(page);
    const ukIds = apiE.relevant.map((r) => r.id);
    expect(ukIds).toContain("rc:uk-evisa-migration");
    expect(ukIds).not.toContain("rc:schengen-etias"); // UK is not Schengen
    expect(ukIds).not.toContain("rc:sweden-rental-bostadsbrist");
    const uk = apiE.relevant.find((r) => r.id === "rc:uk-evisa-migration")!;
    expect(uk.impactSeverity).toBe("action_required");
    expect(uk.recommendedAction.targetRoute).toBe("/checklist?tab=pre-move");
    // Verify the action-link is present in DOM
    const ukLink = page.getByTestId("rule-change-rc:uk-evisa-migration-action-link");
    await expect(ukLink).toBeVisible();
    await expect(ukLink).toHaveAttribute("href", /\/checklist\?tab=pre-move/);

    // ===== STATE F — pet-import gating: dog vs cat vs none ================
    await patchPlan({
      profile_data: {
        destination: "United States",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
      },
    });
    await refreshDashboard(page);
    const apiF = await readReport(page);
    expect(apiF.relevant.find((r) => r.id === "rc:us-cdc-dog-import")).toBeTruthy();
    expect(apiF.relevant.find((r) => r.id === "rc:us-cdc-dog-import")!.impactSeverity).toBe(
      "action_required",
    );

    // pets=cat → CDC-dog should NOT fire (it's dog-specific)
    await patchPlan({
      profile_data: {
        destination: "United States",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "cat",
      },
    });
    await refreshDashboard(page);
    const apiFcat = await readReport(page);
    expect(
      apiFcat.relevant.find((r) => r.id === "rc:us-cdc-dog-import"),
      "cat → CDC-dog must NOT scope",
    ).toBeUndefined();

    // ===== STATE G — EU pet rabies (Sweden + dog) =========================
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
      },
    });
    await refreshDashboard(page);
    const apiG = await readReport(page);
    expect(apiG.relevant.find((r) => r.id === "rc:eu-pet-rabies-tightening")).toBeTruthy();
    // pets=none → entry disappears
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "none",
      },
    });
    await refreshDashboard(page);
    const apiGnone = await readReport(page);
    expect(apiGnone.relevant.find((r) => r.id === "rc:eu-pet-rabies-tightening")).toBeUndefined();

    // ===== STATE H — France Visale (housing_market, no research-trigger) ==
    await patchPlan({
      profile_data: {
        destination: "France",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiH = await readReport(page);
    const visale = apiH.relevant.find((r) => r.id === "rc:france-visale-guarantor")!;
    expect(visale).toBeTruthy();
    expect(visale.shouldTriggerResearch).toBe(false);
    // Research-flag should NOT appear
    await expect(
      page.getByTestId("rule-change-rc:france-visale-guarantor-research-flag"),
    ).toHaveCount(0);
    // Re-run-research button should NOT appear
    await expect(
      page.getByTestId("rule-change-rc:france-visale-guarantor-rerun-research"),
    ).toHaveCount(0);

    // ===== STATE I — ack workflow: review / dismiss / request_research ===
    // Reset to the rich Sweden-non-EU state to give us multiple cards.
    await patchPlan({
      arrival_date: arrivalAt(30),
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);

    // Mark ETIAS reviewed
    const reviewBtn = page.getByTestId("rule-change-rc:schengen-etias-review");
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();
    await page.waitForTimeout(800);
    await expect(
      page.locator('[data-testid="rule-change-rc:schengen-etias"]'),
    ).toHaveAttribute("data-rule-change-ack-status", "reviewed");
    let acks = await readAcks();
    expect(acks["rc:schengen-etias"]?.status).toBe("reviewed");

    // Refresh page → state persists
    await refreshDashboard(page);
    await expect(
      page.locator('[data-testid="rule-change-rc:schengen-etias"]'),
    ).toHaveAttribute("data-rule-change-ack-status", "reviewed");

    // Trigger research-requested on ETIAS
    const rerunBtn = page.getByTestId("rule-change-rc:schengen-etias-rerun-research");
    await expect(rerunBtn).toBeVisible();
    await rerunBtn.click();
    await page.waitForTimeout(800);
    await expect(
      page.locator('[data-testid="rule-change-rc:schengen-etias"]'),
    ).toHaveAttribute("data-rule-change-ack-status", "research_requested");
    acks = await readAcks();
    expect(acks["rc:schengen-etias"]?.status).toBe("research_requested");
    // Re-run button should be gone after request
    await expect(page.getByTestId("rule-change-rc:schengen-etias-rerun-research")).toHaveCount(0);
    await shot(page, "04-after-research-requested");

    // Dismiss Sweden housing
    const dismissBtn = page.getByTestId("rule-change-rc:sweden-rental-bostadsbrist-dismiss");
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();
    await page.waitForTimeout(800);
    // Should now appear in the dismissed-fold
    const dismissedList = page.getByTestId("rule-changes-dismissed-list");
    await expect(
      dismissedList.locator('[data-testid="rule-change-rc:sweden-rental-bostadsbrist"]'),
    ).toHaveCount(1);
    acks = await readAcks();
    expect(acks["rc:sweden-rental-bostadsbrist"]?.status).toBe("dismissed");
    await shot(page, "05-after-dismiss");

    // ===== STATE J — idempotency =========================================
    // Same state, refresh twice — relevant entries shouldn't proliferate
    // and acks shouldn't get duplicated.
    const before = await readReport(page);
    await refreshDashboard(page);
    const after = await readReport(page);
    expect(after.relevant.length).toBe(before.relevant.length);
    const acksAfter = await readAcks();
    // exactly the keys we set above + nothing else
    expect(Object.keys(acksAfter).sort()).toEqual([
      "rc:schengen-etias",
      "rc:sweden-rental-bostadsbrist",
    ]);

    // ===== STATE K — sort order ==========================================
    // Reset acks so we get a clean ordering test.
    await patchPlan({
      research_meta: { ...(prior.researchMeta ?? {}), rule_change_acks: {} },
      arrival_date: arrivalAt(30),
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        pets: "dog",
      },
    });
    await refreshDashboard(page);
    const apiK = await readReport(page);
    const sevRank: Record<string, number> = { action_required: 0, review: 1, info: 2 };
    for (let i = 1; i < apiK.relevant.length; i++) {
      const a0 = apiK.relevant[i - 1];
      const a1 = apiK.relevant[i];
      const aDismissed = a0.ack.status === "dismissed" ? 1 : 0;
      const bDismissed = a1.ack.status === "dismissed" ? 1 : 0;
      expect(aDismissed).toBeLessThanOrEqual(bDismissed);
      if (aDismissed === bDismissed) {
        expect(
          sevRank[a0.impactSeverity] <= sevRank[a1.impactSeverity],
          `severity sort: ${a0.id}(${a0.impactSeverity}) before ${a1.id}(${a1.impactSeverity})`,
        ).toBe(true);
      }
    }

    // ===== STATE L — anti-newsfeed / partner / 6B drift ==================
    const sectionText = (await page.getByTestId("rule-changes-section").innerText()).toLowerCase();

    const newsfeedBanned = [
      "latest news",
      "breaking news",
      "read more",
      "recent updates from around",
      "worldwide news",
      "trending",
    ];
    for (const phrase of newsfeedBanned) {
      expect(sectionText, `forbidden newsfeed phrase "${phrase}"`).not.toContain(phrase);
    }
    // "news feed" must not appear EXCEPT as the explicit anti-newsfeed
    // disclaimer ("Not a news feed."). Use a negative lookbehind via regex.
    const newsFeedRegex = /(^|[^a-z])(?<!not a )news feed/g;
    expect(
      sectionText,
      "newsfeed phrase 'news feed' should only appear in a 'not a news feed' disclaimer",
    ).not.toMatch(newsFeedRegex);

    const partnerBanned = [
      "affiliate",
      "our partner immigration lawyer",
      "book a consultation through",
      "referral fee",
      "we recommend our",
      "compare lawyers",
      "sponsored update",
      "buy now",
    ];
    for (const phrase of partnerBanned) {
      expect(sectionText, `forbidden partner phrase "${phrase}"`).not.toContain(phrase);
    }

    // 6B (family/dependents) drift
    for (const phrase of [
      "family member affected",
      "dependents impacted",
      "your spouse needs",
      "joint application",
    ]) {
      expect(sectionText, `forbidden 6B phrase "${phrase}"`).not.toContain(phrase);
    }

    // 6A separation — rule-change cards must NOT carry notification testids
    const notifIds = await page.getByTestId("rule-changes-section").locator('[data-testid^="notification-"]').count();
    expect(notifIds, "rule-change section must not host notification components").toBe(0);

    // ===== STATE M — disclaimer + curated framing ========================
    await expect(page.getByTestId("rule-changes-section")).toContainText(/curated/i);
    await expect(page.getByTestId("rule-changes-section")).toContainText(/not a real-time crawl/i);
    await expect(page.getByTestId("rule-changes-section")).toContainText(/verify the latest on the source/i);

    await shot(page, "06-final-render");
  } finally {
    // ---- Cleanup -----------------------------------------------------------
    const ALLOWED = new Set([
      "collecting", "generating", "complete",
      "ready_for_pre_departure", "pre_departure", "arrived",
    ]);
    const safeStage = prior.stage && ALLOWED.has(prior.stage) ? prior.stage : "collecting";
    await a
      .from("relocation_plans")
      .update({
        stage: safeStage,
        arrival_date: prior.arrival,
        profile_data: prior.profile,
        research_meta: prior.researchMeta,
      })
      .eq("id", planId);
  }
});
