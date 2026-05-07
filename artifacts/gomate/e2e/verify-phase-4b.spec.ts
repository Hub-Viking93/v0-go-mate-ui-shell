// Phase 4B verification — banking + healthcare setup flows.
//
// Frontend-first per verify.md. Drives the user through state mutations
// and verifies that the two flows are real prerequisite-aware setups,
// not blob-text or repackaged checklists.
//
// Logic-grans:
//   • prerequisite-gating: blocked steps surface a concrete reason that
//     names earlier titles
//   • vault-coverage doesn't mark steps "completed" for free
//   • task-completion advances "Current step"
//   • free-movement state doesn't get told to bring a "permit"
//   • conditional healthcare items (prescription / pediatric) appear
//     and disappear with profile flags
//   • no 4C/4D drift (no insurance / cultural copy)
//   • manual-only step doesn't block flow rollup unfairly

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

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-4b");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  await page
    .getByTestId("setup-flows-section")
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

interface FlowStep {
  id: string;
  title: string;
  whyThisStepMatters: string;
  prerequisites: string[];
  status: "blocked" | "ready" | "in_progress" | "completed" | "not_applicable";
  blockedReason?: string;
  relatedTaskRef?: string;
  nextAction?: string;
}
interface Flow {
  id: "banking" | "healthcare";
  label: string;
  goal: string;
  status: "blocked" | "ready" | "in_progress" | "completed";
  currentStepId: string | null;
  steps: FlowStep[];
}
interface FlowsReport {
  planId: string;
  generatedAt: string;
  banking: Flow;
  healthcare: Flow;
}

async function readFlows(page: import("@playwright/test").Page): Promise<FlowsReport> {
  return await page.evaluate(async () => {
    const r = await fetch("/api/flows");
    return await r.json();
  });
}

async function refreshDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("setup-flows-section")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="setup-flows-section"]');
    return el && !el.textContent?.includes("Reading your setup flows");
  }, null, { timeout: 15_000 });
}

test("Phase 4B — banking + healthcare setup flows", async ({ page }) => {
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
  async function insertSettling(row: { task_key: string; title: string; status?: string }) {
    await a.from("settling_in_tasks").insert({
      user_id: userId, plan_id: planId,
      task_key: row.task_key, title: row.title,
      description: "Phase 4B verify fixture",
      category: "registration", depends_on: [],
      deadline_days: 14, deadline_at: new Date(Date.now() + 14 * DAY).toISOString(),
      is_legal_requirement: false, deadline_type: "practical",
      steps: [], documents_needed: [], official_link: null,
      estimated_time: "30 minutes", cost: "Free",
      status: row.status ?? "available", sort_order: 0, walkthrough: null,
    });
  }
  async function uploadDoc(category: string, fileName: string) {
    const buf = Buffer.from(`%PDF verify4b ${fileName}\n%%EOF`, "utf8");
    const sp = `${userId}/${planId}/verify4b-${Date.now()}-${fileName}`;
    await a.storage.from(STORAGE_BUCKET).upload(sp, buf, {
      contentType: "application/pdf", upsert: true,
    });
    await a.from("relocation_documents").insert({
      user_id: userId, plan_id: planId,
      file_name: fileName, storage_path: sp,
      mime_type: "application/pdf", size_bytes: buf.length, category,
    });
  }

  try {
    // ---- Sign in -----------------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL!);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD!);
    await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

    // ===== STATE A — empty baseline → blocked / ready cascade ==============
    await patchPlan({
      stage: "ready_for_pre_departure",
      arrival_date: null,
      post_relocation_generated: false,
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    await expect(page.getByTestId("setup-flows-heading")).toHaveText(/Banking & healthcare setup/i);
    const apiA = await readFlows(page);

    // ----- Two distinct flows render -------------------------------------
    expect(apiA.banking.id).toBe("banking");
    expect(apiA.healthcare.id).toBe("healthcare");
    expect(apiA.banking.steps.length).toBeGreaterThan(0);
    expect(apiA.healthcare.steps.length).toBeGreaterThan(0);
    await expect(page.getByTestId("flow-banking")).toBeVisible();
    await expect(page.getByTestId("flow-healthcare")).toBeVisible();

    // ----- Each step has goal, status, prerequisites, why ----------------
    for (const f of [apiA.banking, apiA.healthcare]) {
      expect(typeof f.label).toBe("string");
      expect(typeof f.goal).toBe("string");
      expect(["blocked", "ready", "in_progress", "completed"]).toContain(f.status);
      for (const s of f.steps) {
        expect(typeof s.id).toBe("string");
        expect(typeof s.title).toBe("string");
        expect(s.whyThisStepMatters.length).toBeGreaterThan(20);
        expect(["blocked", "ready", "in_progress", "completed", "not_applicable"]).toContain(s.status);
        expect(Array.isArray(s.prerequisites)).toBe(true);
      }
    }

    // ----- Prerequisite gating: address-registered ready, id-ready blocked
    const bankingSteps = new Map(apiA.banking.steps.map((s) => [s.id, s]));
    expect(bankingSteps.get("address-registered")?.status).toBe("ready");
    expect(bankingSteps.get("id-ready")?.status).toBe("blocked");
    expect(bankingSteps.get("id-ready")?.blockedReason).toMatch(
      /Complete first.*address registration/i,
    );
    expect(bankingSteps.get("bank-account-open")?.status).toBe("blocked");
    // ----- Current step is the first non-completed --------------------
    expect(apiA.banking.currentStepId).toBe("address-registered");
    await shot(page, "01-baseline-blocked-cascade");

    // ===== Permit-mention is free-movement-safe ============================
    // Baseline non-EU user: copy mentions "residence-permit decision" only as
    // an OPTIONAL "for non-EU citizens" qualifier — never as a hard requirement
    // on the step title.
    const idReadyTitle = bankingSteps.get("id-ready")?.title.toLowerCase() ?? "";
    expect(idReadyTitle, "id-ready title must not hard-mandate permit").not.toMatch(/\bpermit\b/);
    const idReadyWhy = bankingSteps.get("id-ready")?.whyThisStepMatters ?? "";
    // Allowed to mention permit, but it must be qualified ("for non-EU citizens").
    if (/permit/i.test(idReadyWhy)) {
      expect(idReadyWhy.toLowerCase()).toMatch(/non-eu|non eu|if you|when applicable/);
    }

    // ===== STATE B — address-registered task completed → cascade unlocks ==
    await insertSettling({
      task_key: "reg-population",
      title: "Register at population authority",
      status: "completed",
    });
    await refreshDashboard(page);
    const apiB = await readFlows(page);
    const bankingB = new Map(apiB.banking.steps.map((s) => [s.id, s]));
    expect(bankingB.get("address-registered")?.status).toBe("completed");
    // id-ready still ready (no passport in vault yet)
    expect(bankingB.get("id-ready")?.status).toBe("ready");
    // bank-account-open still blocked (id-ready isn't completed; employment isn't either)
    expect(bankingB.get("bank-account-open")?.status).toBe("blocked");
    // Current step advanced past address-registered.
    expect(apiB.banking.currentStepId).not.toBe("address-registered");

    // Healthcare — address-registered also completes there.
    const hcB = new Map(apiB.healthcare.steps.map((s) => [s.id, s]));
    expect(hcB.get("address-registered")?.status).toBe("completed");
    // health-card now ready (was blocked).
    expect(hcB.get("health-card")?.status).toMatch(/^ready|in_progress|pending$/);
    expect(hcB.get("primary-care-clinic")?.status).toMatch(/^ready|in_progress|pending$/);
    await shot(page, "02-address-registered-cascade");

    // ===== STATE C — vault: passport + employment uploaded → 2 more done ==
    await uploadDoc("passport_id", "passport.pdf");
    await uploadDoc("employment", "contract.pdf");
    await refreshDashboard(page);
    const apiC = await readFlows(page);
    const bankingC = new Map(apiC.banking.steps.map((s) => [s.id, s]));
    expect(bankingC.get("id-ready")?.status).toBe("completed");
    expect(bankingC.get("employment-doc-ready")?.status).toBe("completed");
    // bank-account-open finally ready.
    expect(bankingC.get("bank-account-open")?.status).toBe("ready");
    expect(apiC.banking.currentStepId).toBe("bank-account-open");
    await shot(page, "03-vault-unlocks-bank-account-open");

    // ===== STATE D — bank-account-open task completed → BankID + payroll ===
    await insertSettling({
      task_key: "bank-account-open",
      title: "Open Swedish bank account",
      status: "completed",
    });
    await refreshDashboard(page);
    const apiD = await readFlows(page);
    const bankingD = new Map(apiD.banking.steps.map((s) => [s.id, s]));
    expect(bankingD.get("bank-account-open")?.status).toBe("completed");
    // BankID + payroll now ready (their prereq is bank-account-open).
    expect(bankingD.get("digital-id")?.status).toBe("ready");
    expect(bankingD.get("payroll-routing")?.status).toBe("ready");
    expect(apiD.banking.currentStepId).toBe("digital-id");
    expect(apiD.banking.status).toBe("in_progress");
    await shot(page, "04-bank-account-completed-bankid-ready");

    // ===== STATE E — conditional healthcare items appear/disappear ========
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        prescription_medications: "Adderall 10mg daily",
        children_count: 2,
      },
    });
    await refreshDashboard(page);
    const apiE = await readFlows(page);
    const hcE_ids = apiE.healthcare.steps.map((s) => s.id);
    expect(hcE_ids).toContain("prescription-transfer");
    expect(hcE_ids).toContain("pediatric-registration");

    // Drop the conditionals.
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiE2 = await readFlows(page);
    const hcE2_ids = apiE2.healthcare.steps.map((s) => s.id);
    expect(hcE2_ids).not.toContain("prescription-transfer");
    expect(hcE2_ids).not.toContain("pediatric-registration");
    await shot(page, "05-conditional-healthcare-removed");

    // ===== STATE F — free-movement: id-ready copy must be permit-safe =====
    await patchPlan({
      profile_data: {
        destination: "Germany",
        citizenship: "Swedish",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiF = await readFlows(page);
    const bankingF = new Map(apiF.banking.steps.map((s) => [s.id, s]));
    const idReadyF = bankingF.get("id-ready")!;
    expect(idReadyF.title.toLowerCase()).not.toMatch(/\bpermit\b/);
    // Banking still has prerequisite gating — that's a fundamental
    // mechanism, not a Sweden-specific assumption.
    expect(["ready", "in_progress", "completed"]).toContain(idReadyF.status);
    await shot(page, "06-free-movement-banking");

    // ===== Logic-grans: prerequisites are acyclic ==========================
    // For each step S, every prereq P appears at an earlier index in steps[].
    for (const flow of [apiF.banking, apiF.healthcare]) {
      const order: Record<string, number> = {};
      flow.steps.forEach((s, i) => { order[s.id] = i; });
      for (const s of flow.steps) {
        for (const p of s.prerequisites) {
          expect(
            (order[p] ?? -1) < order[s.id],
            `flow ${flow.id}: step ${s.id} has cyclic/forward-referencing prereq ${p}`,
          ).toBe(true);
        }
      }
    }

    // ===== Logic-grans: blocked steps surface a CONCRETE reason ==========
    for (const flow of [apiF.banking, apiF.healthcare]) {
      for (const s of flow.steps) {
        if (s.status === "blocked") {
          expect(s.blockedReason, `${flow.id}/${s.id}: blocked but no reason`).toBeTruthy();
          expect(s.blockedReason!.length).toBeGreaterThan(10);
        }
      }
    }

    // ===== Logic-grans: vault doesn't mark tasks "completed" arbitrarily ==
    // The bank-account-open step has NO vaultCoverageOf — it depends on the
    // settling-task. Even if we have employment-doc + passport in vault,
    // bank-account-open should NOT auto-complete from vault.
    const apiG = apiF; // reuse — current state has both vault docs.
    const bankAcc = apiG.banking.steps.find((s) => s.id === "bank-account-open")!;
    if (bankAcc.relatedTaskRef) {
      // It was task-driven; if no settling-task row exists, status should be
      // ready or blocked — never "completed" from vault alone.
      const taskCompleted = false; // we did NOT insert bank-account-open in this state.
      // Reset state ensures task is gone.
      await a.from("settling_in_tasks").delete().eq("plan_id", planId).eq("task_key", "bank-account-open");
      await refreshDashboard(page);
      const apiG2 = await readFlows(page);
      const bankAcc2 = apiG2.banking.steps.find((s) => s.id === "bank-account-open")!;
      expect(bankAcc2.status, "vault alone must not mark bank-account-open completed").not.toBe("completed");
      void taskCompleted;
    }

    // ===== Logic-grans: manual-only step doesn't unfairly block rollup ===
    // Healthcare's emergency-numbers step is manualOnly + prerequisites=[].
    // It surfaces as ready but should NEVER cause flow.status === "blocked"
    // for the whole flow.
    const hc = apiF.healthcare;
    const emerg = hc.steps.find((s) => s.id === "emergency-numbers")!;
    expect(emerg).toBeTruthy();
    expect(emerg.prerequisites).toHaveLength(0);
    expect(emerg.status).toMatch(/^(ready|completed|not_applicable)$/);
    // Emergency-numbers must never appear in another step's blockedReason.
    for (const s of hc.steps) {
      if (s.blockedReason) {
        expect(s.blockedReason, `manual-only step shouldn't block rollup`).not.toMatch(/Save emergency/);
      }
    }

    // ===== UI: "Current step" pill renders on the right card ==============
    // Refetch — earlier mutations may have shifted the current step.
    const apiCurrent = await readFlows(page);
    const currentStepId = apiCurrent.banking.currentStepId;
    if (currentStepId) {
      const currentCard = page.getByTestId(`flow-step-${currentStepId}`);
      await expect(currentCard).toHaveAttribute("data-step-current", "true");
      await expect(currentCard).toContainText(/Current step/i);
    }

    // ===== Forbidden tokens: no 4C insurance / 4D cultural drift ==========
    const sectionText = (await page.getByTestId("setup-flows-section").innerText()).toLowerCase();
    for (const phrase of [
      "compare insurance providers",
      "supplementary insurance plans",
      "cultural integration",
      "deep-dive into culture",
      "banking products comparison",
    ]) {
      expect(sectionText, `forbidden 4C/4D phrase "${phrase}" in 4B section`).not.toContain(phrase);
    }
  } finally {
    // ---- Cleanup -----------------------------------------------------------
    const { data: leftoverDocs } = await a
      .from("relocation_documents")
      .select("id, storage_path, file_name")
      .eq("user_id", userId)
      .like("file_name", "%passport.pdf")
      .or("file_name.like.%contract.pdf,file_name.like.%verify4b%");
    if (leftoverDocs && leftoverDocs.length > 0) {
      await a.storage.from(STORAGE_BUCKET).remove(leftoverDocs.map((r) => r.storage_path as string));
      await a.from("relocation_documents").delete().in("id", leftoverDocs.map((r) => r.id as string));
    }
    await a.from("settling_in_tasks").delete().eq("plan_id", planId);
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
