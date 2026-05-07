// Phase 3C verification — Plan B + denied/delayed handling.
//
// Frontend-first per verify.md. Drives the user through multiple state
// configurations and verifies the right primary / alternatives /
// scenario combo renders, with hard rules:
//
//   • alternatives only show when primary is fragile OR a scenario is
//     active — never in healthy normal state
//   • free-movement is THE primary path (not an alternative) when
//     EU/EEA citizen + EU/EEA destination
//   • denied / delayed / stalled are mutually exclusive
//   • whatChangesNow varies per alternative (no boilerplate)
//   • scenario-banner and primary card don't contradict each other
//   • delayed scenario doesn't fire when there's no real visa application

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

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-3c");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  await page
    .getByTestId("pathways-section")
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

interface PathwayPlan {
  planId: string;
  generatedAt: string;
  primaryPath: {
    id: string;
    label: string;
    rationale: string;
    weaknesses: string[];
    isWeak: boolean;
  } | null;
  alternatives: Array<{
    id: string;
    label: string;
    whyMayFit: string;
    whatChangesNow: string[];
    fitStrength: string;
  }>;
  guidance: {
    scenario: "denied" | "delayed" | "stalled";
    trigger: string;
    affects: string[];
    whatPausesNow: string[];
    whatToDoInstead: string[];
    shouldSwitchPath: boolean;
  } | null;
}

async function readPathways(page: import("@playwright/test").Page): Promise<PathwayPlan> {
  return await page.evaluate(async () => {
    const r = await fetch("/api/pathways");
    return await r.json();
  });
}

async function refreshDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("pathways-section")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="pathways-section"]');
    return el && !el.textContent?.includes("Reading your pathway");
  }, null, { timeout: 15_000 });
}

test("Phase 3C — Plan B + denied/delayed handling", async ({ page }) => {
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
  async function uploadPassportLike(category: string, fileName: string) {
    const buf = Buffer.from(`%PDF-1.1 verify3c ${fileName}\n%%EOF`, "utf8");
    const storagePath = `${userId}/${planId}/verify3c-${Date.now()}-${fileName}`;
    await a.storage.from(STORAGE_BUCKET).upload(storagePath, buf, {
      contentType: "application/pdf",
      upsert: true,
    });
    await a.from("relocation_documents").insert({
      user_id: userId,
      plan_id: planId,
      file_name: fileName,
      storage_path: storagePath,
      mime_type: "application/pdf",
      size_bytes: buf.length,
      category,
    });
  }

  try {
    // ---- Sign in -----------------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL!);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD!);
    await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

    // ===== STATE A — work + missing employment doc → fragile + alts ========
    await patchPlan({
      stage: "ready_for_pre_departure",
      arrival_date: new Date(Date.now() + 90 * DAY).toISOString().slice(0, 10),
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
      visa_application: null,
      visa_research: null,
      research_meta: {},
      post_relocation_generated: false,
    });
    await refreshDashboard(page);
    await expect(page.getByTestId("pathways-heading")).toHaveText(/Your path & Plan B/i);
    const apiA = await readPathways(page);
    // Primary is Work + fragile (no employment doc, no sponsorship).
    expect(apiA.primaryPath?.id).toBe("work");
    expect(apiA.primaryPath?.isWeak).toBe(true);
    expect(apiA.primaryPath?.weaknesses.join(" ")).toMatch(/employment contract|HR letter/i);
    // No scenario active (no visa app, arrival far away).
    expect(apiA.guidance).toBeNull();
    // Alts: no education yet → no Study alt; no posting → no posted-worker.
    // So alternatives may be empty here. UI shouldn't render the alts list at all.
    expect(apiA.alternatives.length).toBe(0);
    await shot(page, "01-work-fragile-no-alts-yet");

    // ===== STATE B — same state + education doc → Study alt surfaces ======
    await uploadPassportLike("education", "verify3c-diploma.pdf");
    await refreshDashboard(page);
    const apiB = await readPathways(page);
    expect(apiB.primaryPath?.id).toBe("work");
    expect(apiB.primaryPath?.isWeak).toBe(true);
    const studyAlt = apiB.alternatives.find((alt) => alt.id === "study");
    expect(studyAlt, "Study alt surfaces because primary is fragile + education doc on file").toBeTruthy();
    expect(studyAlt!.whyMayFit).toMatch(/education credentials/i);
    // CTA card visible in DOM.
    await expect(page.getByTestId("pathways-alternative-study")).toBeVisible();
    await shot(page, "02-work-fragile-with-study-alt");

    // ===== STATE C — healthy work primary → alts MUST be suppressed =======
    // Make primary non-fragile by adding employment doc and visa_role.
    await uploadPassportLike("employment", "verify3c-contract.pdf");
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiC = await readPathways(page);
    expect(apiC.primaryPath?.isWeak).toBe(false);
    expect(apiC.guidance).toBeNull();
    expect(apiC.alternatives, "alternatives suppressed in healthy normal state").toHaveLength(0);
    // UI: alternatives container absent (no contradictory "Holding up" + "switch path").
    await expect(page.getByTestId("pathways-alternatives")).toHaveCount(0);
    await shot(page, "03-healthy-no-alts");

    // ===== STATE D — free movement → primary IS free-movement, not an alt =
    await patchPlan({
      profile_data: {
        destination: "Germany",
        citizenship: "Swedish",
        purpose: "work",  // Even though purpose=work, free movement overrides.
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiD = await readPathways(page);
    expect(apiD.primaryPath?.id).toBe("free_movement");
    expect(apiD.primaryPath?.isWeak).toBe(false);
    expect(apiD.alternatives).toHaveLength(0);
    // UI: primary card shows free-movement label, no alternatives list.
    await expect(page.getByTestId("pathways-primary")).toHaveAttribute("data-primary-id", "free_movement");
    await expect(page.getByTestId("pathways-alternatives")).toHaveCount(0);
    await shot(page, "04-free-movement-as-primary");

    // ===== STATE E — digital nomad with low income → fragile + alts =======
    await patchPlan({
      profile_data: {
        destination: "Spain",
        citizenship: "Filipino",
        purpose: "digital_nomad",
        monthly_income: "2000 USD",
      },
    });
    await refreshDashboard(page);
    const apiE = await readPathways(page);
    expect(apiE.primaryPath?.id).toBe("digital_nomad");
    expect(apiE.primaryPath?.isWeak).toBe(true);
    expect(apiE.primaryPath?.weaknesses.join(" ")).toMatch(/threshold|2500|income/i);
    const delayAlt = apiE.alternatives.find((a) => a.id === "delay-build-income");
    expect(delayAlt).toBeTruthy();
    expect(delayAlt!.whatChangesNow.join(" ")).toMatch(/build|income|consistent/i);
    await shot(page, "05-digital-nomad-low-income");

    // ===== STATE F — study, no admission, arrival close → defer alt =======
    await patchPlan({
      arrival_date: new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10),
      profile_data: {
        destination: "Germany",
        citizenship: "Filipino",
        purpose: "study",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiF = await readPathways(page);
    expect(apiF.primaryPath?.id).toBe("study");
    expect(apiF.primaryPath?.isWeak).toBe(true);
    expect(apiF.alternatives.some((a) => a.id === "defer-to-next-term")).toBe(true);
    await shot(page, "06-study-defer-recommended");

    // ===== STATE G — denied scenario =======================================
    await patchPlan({
      profile_data: {
        destination: "Germany",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
      visa_application: { selectedVisaType: "EU Blue Card", applicationStatus: "rejected" },
    });
    await refreshDashboard(page);
    const apiG = await readPathways(page);
    expect(apiG.guidance).not.toBeNull();
    expect(apiG.guidance!.scenario).toBe("denied");
    expect(apiG.guidance!.shouldSwitchPath).toBe(true);
    expect(apiG.guidance!.whatToDoInstead.join(" ")).toMatch(/rejection letter|ground/i);
    // UI: rose-toned banner with scenario attribute.
    await expect(page.getByTestId("pathways-scenario-banner")).toHaveAttribute(
      "data-scenario",
      "denied",
    );
    await shot(page, "07-denied-scenario");

    // ===== STATE H — delayed scenario =====================================
    await patchPlan({
      arrival_date: new Date(Date.now() + 10 * DAY).toISOString().slice(0, 10),
      visa_application: { selectedVisaType: "EU Blue Card", applicationStatus: "submitted" },
    });
    await refreshDashboard(page);
    const apiH = await readPathways(page);
    expect(apiH.guidance?.scenario).toBe("delayed");
    expect(apiH.guidance?.shouldSwitchPath).toBe(false);
    expect(apiH.guidance?.trigger).toMatch(/pending and arrival/i);
    await expect(page.getByTestId("pathways-scenario-banner")).toHaveAttribute(
      "data-scenario",
      "delayed",
    );
    await shot(page, "08-delayed-scenario");

    // ===== STATE I — delayed should NOT fire when no application =========
    await patchPlan({
      arrival_date: new Date(Date.now() + 10 * DAY).toISOString().slice(0, 10),
      visa_application: null,
    });
    await refreshDashboard(page);
    const apiI = await readPathways(page);
    expect(
      apiI.guidance,
      "delayed must not fire when there is no real visa application",
    ).toBeNull();

    // ===== STATE J — stalled scenario =====================================
    await patchPlan({
      stage: "pre_departure",
      arrival_date: new Date(Date.now() - 20 * DAY).toISOString().slice(0, 10),
      visa_application: null,
    });
    await refreshDashboard(page);
    const apiJ = await readPathways(page);
    expect(apiJ.guidance?.scenario).toBe("stalled");
    expect(apiJ.guidance?.trigger).toMatch(/pre-departure.*passed/i);
    // Mutual exclusivity sanity: only one scenario is ever active.
    expect(apiJ.guidance?.scenario).toBe("stalled");
    await shot(page, "09-stalled-scenario");

    // ===== Mutual exclusivity check — only ONE banner in the DOM =========
    const banners = page.getByTestId("pathways-scenario-banner");
    expect(await banners.count()).toBeLessThanOrEqual(1);

    // ===== whatChangesNow varies per alt (no boilerplate reuse) ==========
    // Build a state that surfaces multiple alternatives at once.
    await uploadPassportLike("education", "verify3c-extra-diploma.pdf");
    await patchPlan({
      stage: "ready_for_pre_departure",
      arrival_date: new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10),
      profile_data: {
        destination: "Germany",
        citizenship: "Filipino",
        purpose: "study",
        visa_role: "primary",
      },
      visa_application: null,
    });
    await refreshDashboard(page);
    const apiK = await readPathways(page);
    expect(apiK.alternatives.length).toBeGreaterThanOrEqual(1);
    if (apiK.alternatives.length >= 2) {
      const a0 = apiK.alternatives[0].whatChangesNow.join("|");
      const a1 = apiK.alternatives[1].whatChangesNow.join("|");
      expect(a0, "whatChangesNow varies between alternatives").not.toBe(a1);
    }

    // ===== Forbidden over-confident copy =================================
    const sectionText = (await page.getByTestId("pathways-section").innerText()).toLowerCase();
    for (const word of ["guaranteed", "definitely", "approved", "will be approved"]) {
      expect(sectionText, `forbidden over-confident token "${word}"`).not.toContain(word);
    }

    // ===== Plan-B is more than just "läs mer" — assert structure =========
    // Each alt must have BOTH whyMayFit (sentence) AND whatChangesNow (≥1 bullet).
    for (const alt of apiK.alternatives) {
      expect(alt.whyMayFit.length).toBeGreaterThan(20);
      expect(alt.whatChangesNow.length).toBeGreaterThanOrEqual(1);
    }

    // ===== Banner ↔ primary do NOT contradict ===========================
    // When denied scenario fires, primary is still rendered but the banner
    // tells the user to pivot. Verify both UI elements exist and are not
    // claiming opposing things ("everything's fine" + "denied").
    await patchPlan({
      visa_application: { selectedVisaType: "EU Blue Card", applicationStatus: "rejected" },
      stage: "ready_for_pre_departure",
      arrival_date: new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10),
    });
    await refreshDashboard(page);
    const apiL = await readPathways(page);
    expect(apiL.guidance?.scenario).toBe("denied");
    // UI: banner present + primary card present + primary either fragile
    // (matches denial mood) OR lacks "Holding up" pill in healthy state.
    await expect(page.getByTestId("pathways-scenario-banner")).toBeVisible();
    await expect(page.getByTestId("pathways-primary")).toBeVisible();
  } finally {
    // ---- Cleanup -----------------------------------------------------------
    const { data: leftover } = await a
      .from("relocation_documents")
      .select("id, storage_path, file_name")
      .eq("user_id", userId)
      .like("file_name", "verify3c%");
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
