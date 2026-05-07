// Phase 6C verification — Year-1 tax overview.
//
// Frontend-first per verify.md. Drives state via service-role admin and
// asserts both DOM and API. Tight logic-grans on:
//   • Section visible on dashboard with four distinct sub-blocks
//     (summary, next-step, checkpoints, watchouts) + always-on disclaimer.
//   • Regime detection per destination: EU (Sweden), UK, Canada, AU,
//     unknown → generic. The australia-substring-bug fix (≤3 char alias
//     exact-match) is exercised explicitly.
//   • Profile-gated checkpoints + watchouts:
//       — purpose=work → employer-withholding checkpoint
//       — posting=yes → social-security-continuity (A1/CoC) checkpoint + watchout
//       — citizenship US → us-citizenship-based-taxation watchout (high)
//       — purpose=digital_nomad → tax-residence-trap escalates to high
//       — departure_tax_filing_required="no" → departure checkpoint + watchout absent
//   • State-driven nextStep based on stage + arrival date.
//   • NO numeric drift (no "%" rates, no "€"/$ amounts, no "tax bracket").
//   • NO calculator/engine drift.
//   • NO marketplace drift.
//   • Disclaimer always visible.

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

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-6c");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  await page
    .getByTestId("tax-overview-heading")
    .evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior }))
    .catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

interface TaxCheckpoint {
  id: string;
  kind: string;
  timing: string;
  title: string;
  description: string;
  whyItMatters: string;
}
interface TaxWatchout {
  id: string;
  kind: string;
  severity: string;
  title: string;
  description: string;
  whatToDo: string;
}
interface TaxNextStep {
  kind: string;
  title: string;
  body: string;
  targetRoute: string | null;
}
interface TaxOverviewReport {
  planId: string;
  destination: string | null;
  origin: string | null;
  regimeProfile: string;
  regimeLabel: string;
  yearOneSummary: string;
  checkpoints: TaxCheckpoint[];
  watchouts: TaxWatchout[];
  nextStep: TaxNextStep;
  disclaimer: string;
}

async function readReport(page: import("@playwright/test").Page): Promise<TaxOverviewReport> {
  return await page.evaluate(async () => {
    const r = await fetch("/api/tax-overview");
    return await r.json();
  });
}

async function refreshDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("tax-overview-section")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="tax-overview-section"]');
    return el && !el.textContent?.includes("Reading your year-1 tax overview");
  }, null, { timeout: 15_000 });
}

const arrivalAt = (days: number) =>
  new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

test("Phase 6C — year-1 tax overview", async ({ page }) => {
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
  if (!planRow) throw new Error("Test user has no active plan");
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
    // ---- Sign in -----------------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL!);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD!);
    await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

    // ===== STATE A — Sweden, work, ready_for_pre_departure ================
    await patchPlan({
      stage: "ready_for_pre_departure",
      arrival_date: arrivalAt(60),
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);

    // Section + heading + description framing
    await expect(page.getByTestId("tax-overview-heading")).toHaveText(/Year-1 tax overview/i);
    await expect(page.getByTestId("tax-overview-section")).toContainText(/orientation/i);
    await expect(page.getByTestId("tax-overview-section")).toContainText(/Not tax advice/i);

    // Four sub-blocks present
    for (const id of [
      "tax-summary-card",
      "tax-next-step-card",
      "tax-checkpoints-card",
      "tax-watchouts-card",
      "tax-disclaimer",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }

    const apiA = await readReport(page);
    expect(apiA.regimeProfile).toBe("eu_residency_based");
    await expect(page.getByTestId("tax-summary-card")).toHaveAttribute(
      "data-regime-profile",
      "eu_residency_based",
    );
    expect(apiA.yearOneSummary).toMatch(/183-day/i);

    // EU + work → employer-withholding + dual-residency-check + departure-origin
    const idsA = apiA.checkpoints.map((c) => c.id);
    expect(idsA).toContain("ck:tax-registration");
    expect(idsA).toContain("ck:residency-clock");
    expect(idsA).toContain("ck:employer-withholding");
    expect(idsA).toContain("ck:dual-residency-check");
    expect(idsA).toContain("ck:year-one-declaration");
    expect(idsA).toContain("ck:departure-origin");
    // Posting-only checkpoint is NOT present
    expect(idsA).not.toContain("ck:social-security-continuity");

    // Watchouts (no posting / no US citizenship): trap=warning, no us-cbt, no posting watchout
    const trapA = apiA.watchouts.find((w) => w.id === "wo:tax-residence-trap");
    expect(trapA).toBeTruthy();
    expect(trapA!.severity).toBe("warning");
    expect(apiA.watchouts.find((w) => w.id === "wo:us-citizenship-based-taxation")).toBeUndefined();
    expect(apiA.watchouts.find((w) => w.id === "wo:social-security-continuity")).toBeUndefined();

    // NextStep at +60d / ready_for_pre_departure → talk_to_accountant
    expect(apiA.nextStep.kind).toBe("talk_to_accountant");
    await expect(page.getByTestId("tax-next-step-card")).toHaveAttribute(
      "data-next-step-kind",
      "talk_to_accountant",
    );

    // Disclaimer alltid synlig
    await expect(page.getByTestId("tax-disclaimer")).toContainText(/orientation, not tax advice/i);
    await expect(page.getByTestId("tax-disclaimer")).toContainText(/qualified.*professional/i);

    await shot(page, "01-sweden-work-pre-departure");

    // ===== STATE B — UK destination → SRT regime ==========================
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
    const apiB = await readReport(page);
    expect(apiB.regimeProfile).toBe("uk_srt");
    expect(apiB.yearOneSummary).toMatch(/Statutory Residence Test|SRT/);
    expect(apiB.yearOneSummary).toMatch(/split-year/i);
    // SRT regime checkpoint title reflects regime
    const residencyClockB = apiB.checkpoints.find((c) => c.kind === "residency_clock")!;
    expect(residencyClockB.title).toMatch(/SRT|day count/i);

    // ===== STATE C — Canada → ties-test regime ============================
    await patchPlan({
      profile_data: {
        destination: "Canada",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiC = await readReport(page);
    expect(apiC.regimeProfile).toBe("canada_residency_based");
    expect(apiC.yearOneSummary).toMatch(/ties-test|ties/i);

    // ===== STATE D — Australia → AUNZ regime (substring bug regression) ===
    // "australia" contains "us" — exact-match-for-≤3-char-aliases must hold.
    await patchPlan({
      profile_data: {
        destination: "Australia",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiD = await readReport(page);
    expect(
      apiD.regimeProfile,
      "Australia must NOT be misclassified as us_citizenship_based",
    ).toBe("aunz_residency_based");

    // ===== STATE E — unknown destination → generic fallback ===============
    await patchPlan({
      profile_data: {
        destination: "Mongolia",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiE = await readReport(page);
    expect(apiE.regimeProfile).toBe("generic");
    // Honest fallback — explicit acknowledgement of missing destination framing.
    expect(apiE.yearOneSummary).toMatch(/don't have|verify the local/i);

    // ===== STATE F — posting=yes → A1/CoC checkpoint + watchout ===========
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        posting_or_secondment: "yes",
      },
    });
    await refreshDashboard(page);
    const apiF = await readReport(page);
    const idsF = apiF.checkpoints.map((c) => c.id);
    expect(idsF).toContain("ck:social-security-continuity");
    const ssWatchout = apiF.watchouts.find((w) => w.id === "wo:social-security-continuity");
    expect(ssWatchout).toBeTruthy();
    expect(ssWatchout!.severity).toBe("warning");

    // DOM check
    await expect(
      page.locator('[data-testid="tax-checkpoint-ck:social-security-continuity"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="tax-watchout-wo:social-security-continuity"]'),
    ).toBeVisible();
    await shot(page, "02-posting-a1coc");

    // ===== STATE G — citizenship=American → US-CBT watchout (high) ========
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "American",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiG = await readReport(page);
    const usCbt = apiG.watchouts.find((w) => w.id === "wo:us-citizenship-based-taxation");
    expect(usCbt, "American citizenship → US-CBT watchout").toBeTruthy();
    expect(usCbt!.severity).toBe("high");
    await expect(
      page.locator('[data-testid="tax-watchout-wo:us-citizenship-based-taxation"]'),
    ).toHaveAttribute("data-watchout-severity", "high");
    await shot(page, "03-us-citizen-cbt");

    // Test other US-citizenship aliases parse correctly
    for (const c of ["US", "USA", "United States", "us"]) {
      await patchPlan({
        profile_data: {
          destination: "Sweden",
          current_location: "Philippines",
          citizenship: c,
          purpose: "work",
          visa_role: "primary",
        },
      });
      const apiVar = await readReport(page);
      expect(
        apiVar.watchouts.find((w) => w.id === "wo:us-citizenship-based-taxation"),
        `citizenship "${c}" should trigger US-CBT watchout`,
      ).toBeTruthy();
    }

    // ===== STATE H — purpose=digital_nomad → trap escalates to high =======
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "digital_nomad",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiH = await readReport(page);
    const trapH = apiH.watchouts.find((w) => w.id === "wo:tax-residence-trap")!;
    expect(trapH.severity).toBe("high");
    await expect(
      page.locator('[data-testid="tax-watchout-wo:tax-residence-trap"]'),
    ).toHaveAttribute("data-watchout-severity", "high");
    expect(apiH.yearOneSummary).toMatch(/digital-nomad|nomadic/i);
    await shot(page, "04-digital-nomad-high");

    // ===== STATE I — departure_tax_filing_required="no" → both removed ====
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        departure_tax_filing_required: "no",
      },
    });
    await refreshDashboard(page);
    const apiI = await readReport(page);
    const idsI = apiI.checkpoints.map((c) => c.id);
    expect(idsI).not.toContain("ck:departure-origin");
    expect(apiI.watchouts.find((w) => w.id === "wo:departure-tax")).toBeUndefined();

    // ===== STATE J — purpose=study (not work) → no employer-withholding ===
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "study",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiJ = await readReport(page);
    const idsJ = apiJ.checkpoints.map((c) => c.id);
    expect(idsJ).not.toContain("ck:employer-withholding");
    expect(idsJ).toContain("ck:tax-registration");
    expect(idsJ).toContain("ck:year-one-declaration");

    // ===== STATE K — nextStep changes per stage ============================
    // Stage = arrived → register_destination with /checklist?tab=post-move
    await patchPlan({
      stage: "arrived",
      arrival_date: arrivalAt(-3),
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiK = await readReport(page);
    expect(apiK.nextStep.kind).toBe("register_destination");
    expect(apiK.nextStep.targetRoute).toBe("/checklist?tab=post-move");
    // The next-step card should be wrapped in a link to that route
    const nextStepLink = page.getByTestId("tax-next-step-link");
    await expect(nextStepLink).toBeVisible();
    await expect(nextStepLink).toHaveAttribute("href", /\/checklist\?tab=post-move/);

    // Stage = settling_in → track_residency_days
    await patchPlan({
      stage: "complete",
      arrival_date: arrivalAt(-30),
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "settle",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiSettling = await readReport(page);
    expect(apiSettling.nextStep.kind).toBe("track_residency_days");

    await shot(page, "05-arrived-register");

    // ===== STATE L — Verify no numeric tax-rate / engine / marketplace drift
    // Reset to a clean live state
    await patchPlan({
      stage: "ready_for_pre_departure",
      arrival_date: arrivalAt(60),
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "American", // adds US-CBT watchout
        purpose: "work",
        visa_role: "primary",
        posting_or_secondment: "yes",
      },
    });
    await refreshDashboard(page);

    const sectionText = await page.getByTestId("tax-overview-section").innerText();
    const lower = sectionText.toLowerCase();

    // ----- No numeric tax-rate / amount drift -----
    // Allow "first 30d" / "first 90d" / "183-day" / "21-day" / "1040" / "A1" /
    // "30-min" / "first 30 days" since they're factual orientation, not rates.
    // Forbid percent rates, currency amounts, and rate-language.
    expect(sectionText, "no percent-rate claims").not.toMatch(/\d+(\.\d+)?%/);
    expect(sectionText, "no euro amounts").not.toMatch(/€\s?\d/);
    expect(sectionText, "no dollar amounts").not.toMatch(/\$\s?\d/);
    expect(lower).not.toContain("tax bracket");
    expect(lower).not.toContain("marginal rate");
    expect(lower).not.toContain("effective rate");
    expect(lower).not.toContain("tax rate of");
    expect(lower).not.toContain("you will pay");
    expect(lower).not.toContain("you'll pay €");
    expect(lower).not.toContain("you'll pay $");

    // ----- No calculator / engine / filing drift -----
    for (const phrase of [
      "calculate your tax",
      "our calculator",
      "submit your return",
      "e-file with us",
      "download your return",
      "tax engine",
      "complete the form",
      "start filing",
      "file directly",
    ]) {
      expect(lower, `forbidden phrase "${phrase}"`).not.toContain(phrase);
    }

    // ----- No marketplace / partner drift -----
    for (const phrase of [
      "our partner accountant",
      "book through us",
      "affiliate",
      "referral fee",
      "we recommend our",
      "compare accountants",
      "hire via us",
      "sponsored",
      "buy now",
    ]) {
      expect(lower, `forbidden phrase "${phrase}"`).not.toContain(phrase);
    }

    // ----- No 6B/6D drift -----
    for (const phrase of [
      "family reunification",
      "rule changed",
      "rule update notification",
      "rule-change watcher",
      "monitor rules",
    ]) {
      expect(lower, `forbidden phrase "${phrase}"`).not.toContain(phrase);
    }

    // ===== Final visual snapshot ==========================================
    await shot(page, "06-final-render");

    // ===== Check that link click navigates =================================
    // (only fires when stage maps to register_destination — flip back)
    await patchPlan({
      stage: "arrived",
      arrival_date: arrivalAt(-2),
      profile_data: {
        destination: "Sweden",
        current_location: "Philippines",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    await page
      .getByTestId("tax-overview-heading")
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.getByTestId("tax-next-step-link").click();
    await page.waitForURL(/\/checklist\?tab=post-move/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/checklist\?tab=post-move/);
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
        post_relocation_generated: prior.generated ?? false,
        research_meta: prior.researchMeta,
      })
      .eq("id", planId);
  }
});
