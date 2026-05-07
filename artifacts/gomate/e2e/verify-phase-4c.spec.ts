// Phase 4C verification — Driver's licence + insurance guidance.
//
// Frontend-first per verify.md. Tight logic-grans on:
//   • driver_license_origin=no → not_required, no recommendedAction, no taskRef
//   • free-movement → likely_carries_over BUT urgency is NOT "no action"
//     (we still tell user to verify destination notification)
//   • non-EU + has licence → needed + first_30d + transit-license link
//   • transit-license=completed → likely_carries_over
//   • travel/bridge insurance disappears once health-card lands
//   • home/contents NOT shown when origin_lease_status is unknown
//   • insurance top-priority is the actual first item by sort, and uses
//     real urgency (not just first-in-array)
//   • no concrete provider names that look marketplace-y
//   • no 4D cultural drift

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

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-4c");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
async function shot(page: import("@playwright/test").Page, name: string) {
  await page
    .getByTestId("license-insurance-section")
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

interface DriversLicenseGuidance {
  status: string;
  summary: string;
  reasoning: string[];
  recommendedAction: string | null;
  urgency: string;
  relatedTaskRef?: string;
}
interface InsuranceItem {
  id: string;
  label: string;
  whyItMatters: string;
  recommendedAction: string;
  urgency: string;
  priority: string;
  relatedTaskRef?: string;
}
interface InsuranceGuidance {
  items: InsuranceItem[];
  topPriority: InsuranceItem | null;
}
interface Phase4cReport {
  planId: string;
  generatedAt: string;
  driversLicense: DriversLicenseGuidance;
  insurance: InsuranceGuidance;
}

async function readGuidance(page: import("@playwright/test").Page): Promise<Phase4cReport> {
  return await page.evaluate(async () => {
    const r = await fetch("/api/license-insurance");
    return await r.json();
  });
}

async function refreshDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("license-insurance-section")).toBeVisible({ timeout: 15_000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="license-insurance-section"]');
    return el && !el.textContent?.includes("Reading your licence");
  }, null, { timeout: 15_000 });
}

const URGENCY_RANK: Record<string, number> = {
  now: 0,
  first_30d: 1,
  later: 2,
  not_required: 3,
};
const PRIORITY_RANK: Record<string, number> = {
  must_have: 0,
  recommended: 1,
  optional: 2,
};

test("Phase 4C — driver's licence + insurance guidance", async ({ page }) => {
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
      description: "Phase 4C verify fixture",
      category: "registration", depends_on: [],
      deadline_days: 14, deadline_at: new Date(Date.now() + 14 * DAY).toISOString(),
      is_legal_requirement: false, deadline_type: "practical",
      steps: [], documents_needed: [], official_link: null,
      estimated_time: "30 minutes", cost: "Free",
      status: row.status ?? "available", sort_order: 0, walkthrough: null,
    });
  }
  async function uploadDoc(category: string, fileName: string) {
    const buf = Buffer.from(`%PDF verify4c ${fileName}\n%%EOF`, "utf8");
    const sp = `${userId}/${planId}/verify4c-${Date.now()}-${fileName}`;
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

    // ===== STATE A — driver_license_origin=no → not_required, no taskRef ===
    await patchPlan({
      stage: "ready_for_pre_departure",
      arrival_date: new Date(Date.now() + 60 * DAY).toISOString().slice(0, 10),
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        driver_license_origin: "no",
        bringing_vehicle: "no",
      },
    });
    await refreshDashboard(page);
    await expect(page.getByTestId("license-insurance-heading")).toHaveText(/Driver's licence & insurance/i);
    const apiA = await readGuidance(page);
    expect(apiA.driversLicense.status).toBe("not_required");
    expect(apiA.driversLicense.urgency).toBe("not_required");
    expect(
      apiA.driversLicense.recommendedAction,
      "no action when not required",
    ).toBeNull();
    expect(
      apiA.driversLicense.relatedTaskRef,
      "no task link when not required",
    ).toBeUndefined();
    // UI: card has data-licence-status=not_required, no "View task" link.
    await expect(page.getByTestId("drivers-license-card")).toHaveAttribute(
      "data-licence-status",
      "not_required",
    );
    const noActionLink = page.getByTestId("drivers-license-card").getByRole("link", { name: /View task/i });
    await expect(noActionLink).toHaveCount(0);
    await shot(page, "01-licence-not-required");

    // ===== STATE B — non-EU + has licence → needed / first_30d / taskRef ==
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        driver_license_origin: "yes",
      },
    });
    await refreshDashboard(page);
    const apiB = await readGuidance(page);
    expect(apiB.driversLicense.status).toBe("needed");
    expect(apiB.driversLicense.urgency).toBe("first_30d");
    expect(apiB.driversLicense.relatedTaskRef).toBe("settling-in:transit-license");
    expect(apiB.driversLicense.recommendedAction).toMatch(/transit-license|exchange/i);
    expect(apiB.driversLicense.reasoning.length).toBeGreaterThan(0);
    await expect(page.getByTestId("drivers-license-card")).toHaveAttribute(
      "data-licence-urgency",
      "first_30d",
    );
    await shot(page, "02-licence-needed-non-eu");

    // ===== STATE C — free-movement → likely_carries_over BUT urgency=later
    await patchPlan({
      profile_data: {
        destination: "Germany",
        citizenship: "Swedish",
        purpose: "work",
        visa_role: "primary",
        driver_license_origin: "yes",
      },
    });
    await refreshDashboard(page);
    const apiC = await readGuidance(page);
    expect(apiC.driversLicense.status).toBe("likely_carries_over");
    // Per verify.md: don't be too aggressive — mention notification rules.
    expect(apiC.driversLicense.urgency).toBe("later");
    expect(apiC.driversLicense.recommendedAction).toBeTruthy();
    expect(apiC.driversLicense.recommendedAction!.toLowerCase()).toMatch(/notification|portal|verify/);
    // Reasoning still surfaces the "some destinations need a notification" caveat.
    const reasoningC = apiC.driversLicense.reasoning.join(" ").toLowerCase();
    expect(reasoningC).toMatch(/notification|notify|portal/);
    await shot(page, "03-licence-free-movement");

    // ===== STATE D — transit-license task=completed → likely_carries_over ==
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        driver_license_origin: "yes",
      },
    });
    await insertSettling({
      task_key: "transit-license",
      title: "Convert / exchange driver's licence",
      status: "completed",
    });
    await refreshDashboard(page);
    const apiD = await readGuidance(page);
    expect(apiD.driversLicense.status).toBe("likely_carries_over");
    expect(apiD.driversLicense.urgency).toBe("not_required");
    expect(apiD.driversLicense.recommendedAction).toBeNull();
    expect(apiD.driversLicense.reasoning.join(" ")).toMatch(/marked completed|completed/i);

    // Logic-grans: transit-license completion doesn't mask other guidance —
    // INSURANCE guidance must still derive normally.
    expect(apiD.insurance).toBeTruthy();
    expect(Array.isArray(apiD.insurance.items)).toBe(true);
    await shot(page, "04-licence-transit-completed");

    // Cleanup the transit-license task so subsequent states are clean.
    await a.from("settling_in_tasks").delete().eq("plan_id", planId).eq("task_key", "transit-license");

    // ===== STATE E — insurance ITEMS appear/disappear with state ==========
    await patchPlan({
      stage: "pre_departure",
      arrival_date: new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10),
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        driver_license_origin: "no",
        // No origin_lease_status → home/contents must NOT auto-default.
      },
    });
    await refreshDashboard(page);
    const apiE = await readGuidance(page);
    const idsE = apiE.insurance.items.map((i) => i.id);
    // Pre-arrival → travel/bridge present.
    expect(idsE).toContain("insurance:travel-bridge");
    // origin_lease_status unknown → home/contents NOT default.
    expect(
      idsE.includes("insurance:home-contents"),
      "home/contents must not be a default item when origin_lease_status is unknown",
    ).toBe(false);
    // No vehicle / pet → no items.
    expect(idsE.includes("insurance:vehicle")).toBe(false);
    expect(idsE.includes("insurance:pet")).toBe(false);
    // Public health card (post-arrival item) not present pre-arrival.
    expect(idsE.includes("insurance:public-health-card")).toBe(false);

    // ===== STATE F — explicit renting → home/contents surfaces ============
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
    const apiF = await readGuidance(page);
    expect(
      apiF.insurance.items.some((i) => i.id === "insurance:home-contents"),
      "home/contents surfaces when origin_lease_status='renting'",
    ).toBe(true);
    await shot(page, "05-insurance-renting");

    // ===== STATE G — bringing_vehicle + pets → both items appear ==========
    await patchPlan({
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "renting",
        bringing_vehicle: "yes",
        pets: "cat",
      },
    });
    await refreshDashboard(page);
    const apiG = await readGuidance(page);
    const idsG = apiG.insurance.items.map((i) => i.id);
    expect(idsG).toContain("insurance:vehicle");
    expect(idsG).toContain("insurance:pet");
    await shot(page, "06-insurance-vehicle-pet");

    // ===== Sort: urgency desc, priority desc =============================
    const items = apiG.insurance.items;
    for (let i = 1; i < items.length; i++) {
      const a0 = items[i - 1];
      const a1 = items[i];
      const u0 = URGENCY_RANK[a0.urgency];
      const u1 = URGENCY_RANK[a1.urgency];
      expect(
        u0 <= u1,
        `urgency sort violated: ${a0.id}(${a0.urgency}) before ${a1.id}(${a1.urgency})`,
      ).toBe(true);
      if (u0 === u1) {
        expect(
          PRIORITY_RANK[a0.priority] <= PRIORITY_RANK[a1.priority],
          `priority sort violated within ${a0.urgency}: ${a0.id} before ${a1.id}`,
        ).toBe(true);
      }
    }

    // ===== topPriority is the FIRST sorted item, not just first authored ==
    expect(apiG.insurance.topPriority).toBeTruthy();
    expect(apiG.insurance.topPriority!.id).toBe(items[0].id);
    // And it's a real "now" or "first_30d" — not a low-urgency item.
    expect(["now", "first_30d"]).toContain(apiG.insurance.topPriority!.urgency);

    // ===== Each item has stable rendering structure =======================
    for (const item of items) {
      expect(typeof item.id).toBe("string");
      expect(typeof item.label).toBe("string");
      expect(item.whyItMatters.length).toBeGreaterThan(20);
      expect(item.recommendedAction.length).toBeGreaterThan(20);
      expect(["now", "first_30d", "later", "not_required"]).toContain(item.urgency);
      expect(["must_have", "recommended", "optional"]).toContain(item.priority);
    }

    // ===== STATE H — health-card task=completed → travel/bridge gone ======
    await patchPlan({
      stage: "arrived",
      arrival_date: new Date(Date.now() - 5 * DAY).toISOString().slice(0, 10),
      post_relocation_generated: true,
      profile_data: {
        destination: "Sweden",
        citizenship: "Filipino",
        purpose: "work",
        visa_role: "primary",
        origin_lease_status: "renting",
      },
    });
    await insertSettling({
      task_key: "health-card",
      title: "Receive Försäkringskassan health card",
      status: "completed",
    });
    await uploadDoc("health_insurance", "verify4c-health-card.pdf");
    await refreshDashboard(page);
    const apiH = await readGuidance(page);
    const idsH = apiH.insurance.items.map((i) => i.id);
    expect(
      idsH.includes("insurance:travel-bridge"),
      "travel/bridge must disappear once arrival + health card on file",
    ).toBe(false);
    expect(
      idsH.includes("insurance:public-health-card"),
      "public-health-card item gone when its underlying task is completed",
    ).toBe(false);
    await shot(page, "07-insurance-health-coverage-in-place");

    // ===== Forbidden tokens — no marketplace / 4D drift / specific brands =
    const sectionText = (await page.getByTestId("license-insurance-section").innerText()).toLowerCase();
    for (const phrase of [
      "compare insurance products",
      "best provider",
      "find the cheapest",
      "affiliate",
      "cultural integration",
      "deep-dive into culture",
      "safetywing",
      "cigna global",
      "cigna",
    ]) {
      expect(
        sectionText,
        `forbidden phrase/brand "${phrase}" leaked into 4C copy`,
      ).not.toContain(phrase);
    }
  } finally {
    // ---- Cleanup -----------------------------------------------------------
    await a.from("settling_in_tasks").delete().eq("plan_id", planId);
    const { data: leftoverDocs } = await a
      .from("relocation_documents")
      .select("id, storage_path, file_name")
      .eq("user_id", userId)
      .like("file_name", "verify4c%");
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
