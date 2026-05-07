// Phase 4A verification — First 72 hours / First 30 days arrival playbook.
//
// Frontend-first per verify.md. State-driven verification across multiple
// arrival_date / profile / completion states, with screenshots and
// payload/DOM cross-checks. Logic-grans:
//
//   • First 72h items are immediate-landing only (keys, SIM, photo
//     originals, essentials), never "Apply for local ID card" /
//     "Open bank account" / etc.
//   • First 30 days does NOT duplicate every 72h item — id sets
//     are disjoint.
//   • Task-completion flips an item with relatedTaskRef to "completed"
//     status without manual ticking.
//   • Phase pill follows arrival_date through pre-arrival → first_72h →
//     first_30d → post_30d.
//   • No 4B/4C/4D drift — copy stays at "open a bank account" rather
//     than "compare banking products" / "insurance providers" /
//     "cultural integration deep-dive".
//   • Pre-arrival and post-arrival advice not mixed (no item carries a
//     pre-departure:* ref).

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
const STORAGE_BUCKET = "relocation-documents";

let admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (admin) return admin;
  admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return admin;
}

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-4a");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  await page
    .getByTestId("arrival-playbook-section")
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

interface PlaybookItem {
  id: string;
  title: string;
  whyNow: string;
  relatedTaskRef?: string;
  status: "completed" | "pending" | "not_applicable";
  order: number;
}
interface ArrivalPlaybook {
  planId: string;
  generatedAt: string;
  arrivalDate: string | null;
  daysSinceArrival: number | null;
  phase: "pre_arrival" | "first_72h" | "first_30d" | "post_30d";
  first72Hours: PlaybookItem[];
  first30Days: PlaybookItem[];
}

async function readPlaybook(
  page: import("@playwright/test").Page,
): Promise<ArrivalPlaybook> {
  return await page.evaluate(async () => {
    const r = await fetch("/api/arrival-playbook");
    return await r.json();
  });
}

async function refreshDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("arrival-playbook-section")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="arrival-playbook-section"]');
    return el && !el.textContent?.includes("Reading your arrival playbook");
  }, null, { timeout: 15_000 });
}

test("Phase 4A — arrival playbook (First 72h + First 30d)", async ({ page }) => {
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

  /** Insert one settling-in row matching what the route expects. */
  async function insertSettling(row: { task_key: string; title: string; status?: string }) {
    await a.from("settling_in_tasks").insert({
      user_id: userId,
      plan_id: planId,
      task_key: row.task_key,
      title: row.title,
      description: "Phase 4A verify fixture",
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
      status: row.status ?? "available",
      sort_order: 0,
      walkthrough: null,
    });
  }

  try {
    // ---- Sign in -----------------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL!);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD!);
    await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]').first().click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

    // ===== STATE A — pre-arrival (no arrival_date) =========================
    await patchPlan({
      stage: "ready_for_pre_departure",
      arrival_date: null,
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
      post_relocation_generated: false,
    });
    await refreshDashboard(page);
    await expect(page.getByTestId("arrival-playbook-heading")).toHaveText(/Arrival playbook/i);
    const apiA = await readPlaybook(page);
    expect(apiA.phase).toBe("pre_arrival");
    expect(apiA.daysSinceArrival).toBeNull();
    // Phase pill UI matches.
    const phasePill = page.getByTestId("arrival-playbook-phase");
    await expect(phasePill).toHaveAttribute("data-phase", "pre_arrival");
    await expect(phasePill).toContainText(/Pre-arrival preview/i);
    await shot(page, "01-pre-arrival");

    // ----- Two distinct buckets -----------------------------------------
    await expect(page.getByTestId("arrival-playbook-bucket-first72Hours")).toBeVisible();
    await expect(page.getByTestId("arrival-playbook-bucket-first30Days")).toBeVisible();
    expect(apiA.first72Hours.length).toBeGreaterThan(0);
    expect(apiA.first30Days.length).toBeGreaterThan(0);

    // ----- Disjoint id sets (no duplicates between buckets) --------------
    const ids72 = new Set(apiA.first72Hours.map((i) => i.id));
    const ids30 = new Set(apiA.first30Days.map((i) => i.id));
    for (const id of ids72) {
      expect(ids30.has(id), `id "${id}" duplicated across buckets`).toBe(false);
    }

    // ----- 72h items are landing-mode, NOT operational setup -------------
    // Operational items (registration, bank, BankID, primary care, payroll,
    // ID-card, license conversion, tax-residency) MUST NOT appear in 72h.
    const forbiddenIn72 = [
      "playbook:population-registration",
      "playbook:bank-account",
      "playbook:digital-id",
      "playbook:id-card",
      "playbook:primary-care",
      "playbook:payroll-setup",
      "playbook:transit-pass",
      "playbook:license-conversion",
      "playbook:tax-residency",
    ];
    for (const id of forbiddenIn72) {
      expect(ids72.has(id), `operational item "${id}" leaked into 72h bucket`).toBe(false);
    }

    // ----- 72h includes immediate-landing items -------------------------
    const expected72 = [
      "playbook:locate-keys",
      "playbook:essentials-on-you",
      "playbook:destination-sim",
      "playbook:photo-originals",
      "playbook:essentials-shop",
      "playbook:nearest-emergency",
    ];
    for (const id of expected72) {
      expect(ids72.has(id), `expected 72h item "${id}" missing`).toBe(true);
    }

    // ----- 30d includes operational items --------------------------------
    const expected30 = [
      "playbook:population-registration",
      "playbook:bank-account",
      "playbook:digital-id",
      "playbook:id-card",
      "playbook:primary-care",
      "playbook:payroll-setup",
      "playbook:transit-pass",
      "playbook:tax-residency",
    ];
    for (const id of expected30) {
      expect(ids30.has(id), `expected 30d item "${id}" missing`).toBe(true);
    }

    // ----- Field shape per item ------------------------------------------
    for (const item of [...apiA.first72Hours, ...apiA.first30Days]) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.whyNow).toBe("string");
      expect(item.whyNow.length).toBeGreaterThan(20);
      expect(["completed", "pending", "not_applicable"]).toContain(item.status);
      expect(typeof item.order).toBe("number");
    }

    // ----- Pre-arrival items NOT in playbook (no pre-departure:* refs) ---
    for (const item of [...apiA.first72Hours, ...apiA.first30Days]) {
      if (item.relatedTaskRef) {
        expect(item.relatedTaskRef.startsWith("settling-in:")).toBe(true);
        expect(item.relatedTaskRef.startsWith("pre-departure:")).toBe(false);
      }
    }

    // ----- Items in 72h with NO task ref are the majority (proves NOT
    //       just a checklist re-skin) ------------------------------------
    const ref72Count = apiA.first72Hours.filter((i) => i.relatedTaskRef).length;
    const noref72Count = apiA.first72Hours.filter((i) => !i.relatedTaskRef).length;
    expect(noref72Count, "first72Hours should have items WITHOUT task refs").toBeGreaterThan(ref72Count);

    // ----- whyNow refers to time-anchored language (sample check) --------
    const why72 = apiA.first72Hours.map((i) => i.whyNow.toLowerCase()).join(" || ");
    // At least one item references the time window concretely.
    expect(why72).toMatch(/(first 72 hours|day 0|day-1|day one|first day)/);
    // No generic "this is required" language.
    expect(why72).not.toMatch(/this is required someday/);

    // ----- No 4B/4C/4D drift (banking products / insurance / cultural) ---
    const allText = (
      [...apiA.first72Hours, ...apiA.first30Days]
        .map((i) => `${i.title} ${i.whyNow}`)
        .join(" || ")
    ).toLowerCase();
    for (const phrase of [
      "compare banking products",
      "insurance providers",
      "cultural integration",
      "deep-dive into culture",
      "loan products",
    ]) {
      expect(allText, `4B/4C/4D drift: "${phrase}" in 4A copy`).not.toContain(phrase);
    }

    // ===== STATE B — arrival 1 day ago → first_72h ========================
    await patchPlan({
      stage: "arrived",
      arrival_date: new Date(Date.now() - 1 * DAY).toISOString().slice(0, 10),
      post_relocation_generated: true,
    });
    await refreshDashboard(page);
    const apiB = await readPlaybook(page);
    expect(apiB.phase).toBe("first_72h");
    expect(apiB.daysSinceArrival).toBe(1);
    await expect(page.getByTestId("arrival-playbook-phase")).toContainText(/Day 1.*first 72 hours/i);
    await shot(page, "02-first-72h");

    // ===== STATE C — arrival 14 days ago → first_30d ======================
    await patchPlan({
      arrival_date: new Date(Date.now() - 14 * DAY).toISOString().slice(0, 10),
    });
    await refreshDashboard(page);
    const apiC = await readPlaybook(page);
    expect(apiC.phase).toBe("first_30d");
    expect(apiC.daysSinceArrival).toBe(14);
    await expect(page.getByTestId("arrival-playbook-phase")).toContainText(/Day 14.*first 30 days/i);
    await shot(page, "03-first-30d");

    // ===== STATE D — arrival 60 days ago → post_30d =======================
    await patchPlan({
      arrival_date: new Date(Date.now() - 60 * DAY).toISOString().slice(0, 10),
    });
    await refreshDashboard(page);
    const apiD = await readPlaybook(page);
    expect(apiD.phase).toBe("post_30d");
    expect(apiD.daysSinceArrival).toBe(60);
    await expect(page.getByTestId("arrival-playbook-phase")).toContainText(/Beyond first 30 days/i);
    await shot(page, "04-post-30d");

    // ===== STATE E — task completion flips status ==========================
    await patchPlan({
      arrival_date: new Date(Date.now() - 5 * DAY).toISOString().slice(0, 10),
    });
    // Insert reg-population as completed.
    await a.from("settling_in_tasks").delete().eq("plan_id", planId);
    await insertSettling({
      task_key: "reg-population",
      title: "Register at Skatteverket",
      status: "completed",
    });
    await refreshDashboard(page);
    const apiE = await readPlaybook(page);
    const popReg = apiE.first30Days.find((i) => i.id === "playbook:population-registration");
    expect(popReg, "population-registration item still present").toBeTruthy();
    expect(popReg!.status).toBe("completed");
    expect(popReg!.relatedTaskRef).toBe("settling-in:reg-population");
    // UI: item card has data-item-status=completed.
    await expect(
      page.getByTestId("arrival-playbook-item-playbook:population-registration"),
    ).toHaveAttribute("data-item-status", "completed");
    // UI: bucket counter "X / Y done" reflects the completion.
    const bucket30 = page.getByTestId("arrival-playbook-bucket-first30Days");
    await expect(bucket30).toContainText(/1 \/ \d+ done/);
    await shot(page, "05-task-completion-flips-status");

    // ===== STATE F — conditional items based on profile ====================
    // posting=yes → 72h gets posting-a1-handover.
    // children > 0 → 72h has school-locate; 30d has school-confirm.
    // bringing_vehicle=yes → 30d has license-conversion.
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        posting_or_secondment: "yes",
        children_count: 2,
        bringing_vehicle: "yes",
      },
    });
    await refreshDashboard(page);
    const apiF = await readPlaybook(page);
    const ids72F = new Set(apiF.first72Hours.map((i) => i.id));
    const ids30F = new Set(apiF.first30Days.map((i) => i.id));
    expect(ids72F.has("playbook:posting-a1-handover")).toBe(true);
    expect(ids72F.has("playbook:school-locate")).toBe(true);
    expect(ids30F.has("playbook:school-confirm")).toBe(true);
    expect(ids30F.has("playbook:license-conversion")).toBe(true);

    // Non-applicable conditionals are absent: no pets / no prescription meds.
    expect(ids72F.has("playbook:pet-bedding")).toBe(false);
    expect(ids72F.has("playbook:prescription-handoff")).toBe(false);

    // ----- Same state without those flags removes the items --------------
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiF2 = await readPlaybook(page);
    expect(apiF2.first72Hours.some((i) => i.id === "playbook:posting-a1-handover")).toBe(false);
    expect(apiF2.first72Hours.some((i) => i.id === "playbook:school-locate")).toBe(false);
    expect(apiF2.first30Days.some((i) => i.id === "playbook:school-confirm")).toBe(false);
    expect(apiF2.first30Days.some((i) => i.id === "playbook:license-conversion")).toBe(false);

    // ===== STATE G — destination change keeps structure stable ============
    // Destination is generic-by-design in the playbook; switching it shouldn't
    // change the order or remove core items.
    const order72BeforeBerlin = apiF2.first72Hours.map((i) => i.id);
    await patchPlan({
      profile_data: {
        destination: "Germany",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
      },
    });
    await refreshDashboard(page);
    const apiG = await readPlaybook(page);
    const order72AfterBerlin = apiG.first72Hours.map((i) => i.id);
    expect(order72AfterBerlin).toEqual(order72BeforeBerlin);

    // ===== Sort stability — same state called twice produces same order ===
    const apiH1 = await readPlaybook(page);
    const apiH2 = await readPlaybook(page);
    expect(apiH1.first72Hours.map((i) => i.id)).toEqual(apiH2.first72Hours.map((i) => i.id));
    expect(apiH1.first30Days.map((i) => i.id)).toEqual(apiH2.first30Days.map((i) => i.id));

    // ===== UI: numbering is monotone within each bucket ===================
    // The first rendered item in each bucket starts with "1." prefix.
    const firstItemBucket72 = page
      .getByTestId("arrival-playbook-bucket-first72Hours")
      .getByTestId(/^arrival-playbook-item-/)
      .first();
    const firstItemBucket30 = page
      .getByTestId("arrival-playbook-bucket-first30Days")
      .getByTestId(/^arrival-playbook-item-/)
      .first();
    await expect(firstItemBucket72).toContainText(/\b1\./);
    await expect(firstItemBucket30).toContainText(/\b1\./);

    // ===== Forbidden tokens — no 4B/4C/4D-style overreach in DOM =========
    const sectionText = (
      await page.getByTestId("arrival-playbook-section").innerText()
    ).toLowerCase();
    for (const phrase of [
      "compare banking products",
      "insurance providers",
      "cultural integration",
      "deep-dive into culture",
    ]) {
      expect(sectionText, `4B/4C/4D phrase "${phrase}" leaked into 4A`).not.toContain(phrase);
    }
  } finally {
    // ---- Cleanup -----------------------------------------------------------
    await a.from("settling_in_tasks").delete().eq("plan_id", planId);
    const { data: leftoverDocs } = await a
      .from("relocation_documents")
      .select("id, storage_path")
      .eq("user_id", userId);
    if (leftoverDocs && leftoverDocs.length > 0) {
      await a.storage.from(STORAGE_BUCKET).remove(leftoverDocs.map((r) => r.storage_path as string));
      await a.from("relocation_documents").delete().in("id", leftoverDocs.map((r) => r.id as string));
    }
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
