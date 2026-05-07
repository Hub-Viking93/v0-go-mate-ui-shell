// Phase 1B verification — task detail view + walkthroughs.
//
// Seeds two settling-in tasks via service role:
//   • Verify-AUTHORED  — full walkthrough with all 6 sections + a step
//                        that carries a companion link.
//   • Verify-EMPTY     — walkthrough = null (no authored content).
//
// Then asserts (per verify.md Phase 1B):
//   • Sheet opens from the list-view card.
//   • All 6 walkthrough sections render with the seeded content.
//   • Empty-walkthrough task surfaces the "not yet authored" copy.
//   • Status change in the sheet updates the list view directly.
//   • API + DB persist walkthrough JSON for authored tasks; null for empty.
//
// Cleanup wipes the seed + restores prior plan state.

import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TEST_EMAIL || !TEST_PASSWORD || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing TEST_EMAIL/TEST_PASSWORD/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY");
}

let admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (admin) return admin;
  admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return admin;
}

const DAY = 24 * 60 * 60 * 1000;

const AUTHORED_WALKTHROUGH = {
  whatThisIs: "Verify1B-WHAT-THIS-IS — short definition for the verify task.",
  whyItMatters: "Verify1B-WHY-IT-MATTERS — concrete consequence if missed.",
  beforeYouStart: ["Verify1B-BEFORE-1", "Verify1B-BEFORE-2"],
  steps: [
    {
      text: "Verify1B-STEP-1",
      link: { url: "https://example.com/verify1b", label: "Verify1B-STEP-LINK" },
    },
    { text: "Verify1B-STEP-2" },
  ],
  commonMistakes: ["Verify1B-MISTAKE-1", "Verify1B-MISTAKE-2"],
  whatHappensNext: "Verify1B-WHAT-HAPPENS-NEXT — closing sentence.",
};

test("Phase 1B — task detail view + walkthroughs", async ({ page }) => {
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200));
  });

  // ---- Resolve test user id (paginated listUsers) -------------------------
  const a = adminClient();
  let user: { id: string; email?: string | null } | null = null;
  for (let pageNum = 1; pageNum <= 50; pageNum++) {
    const { data, error } = await a.auth.admin.listUsers({ page: pageNum, perPage: 200 });
    if (error) throw error;
    const found = data.users.find(
      (u) => u.email?.toLowerCase() === TEST_EMAIL!.toLowerCase(),
    );
    if (found) { user = found; break; }
    if (data.users.length < 200) break;
  }
  if (!user) throw new Error(`Test user ${TEST_EMAIL} not found`);
  const userId = user.id;

  // ---- Snapshot prior plan state ------------------------------------------
  const { data: planRow } = await a
    .from("relocation_plans")
    .select("id, stage, arrival_date, post_relocation_generated")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  if (!planRow) throw new Error("Test user has no active plan — onboard first");
  const planId = planRow.id as string;
  const priorStage = planRow.stage as string | null;
  const priorArrival = planRow.arrival_date as string | null;
  const priorGenerated = planRow.post_relocation_generated as boolean | null;

  // ---- Seed plan + 2 tasks -------------------------------------------------
  const now = new Date();
  await a
    .from("relocation_plans")
    .update({
      stage: "arrived",
      arrival_date: new Date(now.getTime() - 2 * DAY).toISOString().slice(0, 10),
      post_relocation_generated: true,
    })
    .eq("id", planId);
  await a.from("settling_in_tasks").delete().eq("plan_id", planId);

  const baseTask = {
    user_id: userId,
    plan_id: planId,
    category: "registration",
    depends_on: [],
    deadline_days: 14,
    deadline_at: new Date(now.getTime() + 14 * DAY).toISOString(),
    is_legal_requirement: false,
    deadline_type: "practical" as const,
    steps: [],
    documents_needed: [],
    official_link: null,
    estimated_time: "30 minutes",
    cost: "Free",
    status: "available",
  };
  const { error: insErrA } = await a.from("settling_in_tasks").insert({
    ...baseTask,
    task_key: "verify-1b-authored",
    title: "Verify1B-AUTHORED",
    description: "Phase 1B verify-fixture (authored walkthrough)",
    sort_order: 200,
    walkthrough: AUTHORED_WALKTHROUGH,
  });
  if (insErrA) throw insErrA;
  const { error: insErrB } = await a.from("settling_in_tasks").insert({
    ...baseTask,
    task_key: "verify-1b-empty",
    title: "Verify1B-EMPTY",
    description: "Phase 1B verify-fixture (empty walkthrough)",
    sort_order: 201,
    walkthrough: null,
  });
  if (insErrB) throw insErrB;

  try {
    // ---- Sign in -----------------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL!);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD!);
    await page
      .locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]')
      .first()
      .click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

    // ===== API/DB persistence: walkthrough flows through GET /settling-in ===
    const apiRes = await page.evaluate(async () => {
      const r = await fetch("/api/settling-in");
      return { status: r.status, body: await r.json() };
    });
    expect(apiRes.status).toBe(200);
    const tasks = apiRes.body.tasks as Array<Record<string, unknown>>;
    const authored = tasks.find((t) => t.title === "Verify1B-AUTHORED")!;
    const empty = tasks.find((t) => t.title === "Verify1B-EMPTY")!;
    expect(authored, "authored task in payload").toBeTruthy();
    expect(empty, "empty task in payload").toBeTruthy();
    // Authored task carries the structured walkthrough.
    const wt = authored.walkthrough as Record<string, unknown> | null;
    expect(wt, "authored.walkthrough non-null").toBeTruthy();
    expect(wt!.whatThisIs).toBe(AUTHORED_WALKTHROUGH.whatThisIs);
    expect(wt!.whyItMatters).toBe(AUTHORED_WALKTHROUGH.whyItMatters);
    expect(wt!.beforeYouStart).toEqual(AUTHORED_WALKTHROUGH.beforeYouStart);
    expect(wt!.steps).toHaveLength(2);
    expect(wt!.commonMistakes).toEqual(AUTHORED_WALKTHROUGH.commonMistakes);
    expect(wt!.whatHappensNext).toBe(AUTHORED_WALKTHROUGH.whatHappensNext);
    // Empty task — backend MUST NOT fabricate content.
    expect(empty.walkthrough, "empty.walkthrough is null").toBeNull();

    // ===== DB persistence — read back the row directly =====================
    const { data: dbRows } = await a
      .from("settling_in_tasks")
      .select("title, walkthrough")
      .eq("plan_id", planId)
      .in("title", ["Verify1B-AUTHORED", "Verify1B-EMPTY"]);
    const dbAuthored = dbRows!.find((r) => r.title === "Verify1B-AUTHORED")!;
    const dbEmpty = dbRows!.find((r) => r.title === "Verify1B-EMPTY")!;
    expect(dbAuthored.walkthrough).not.toBeNull();
    expect((dbAuthored.walkthrough as Record<string, unknown>).whatThisIs).toBe(
      AUTHORED_WALKTHROUGH.whatThisIs,
    );
    expect(dbEmpty.walkthrough).toBeNull();

    // ===== UI: open sheet from list ========================================
    await page.goto("/checklist?tab=post-move", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    // Switch from the default "First 30 Days" filter to "All Tasks" so
    // completed tasks don't get hidden from the list mid-test (which
    // would unmount the card + close the sheet on its own).
    const allTasksBtn = page.getByRole("button", { name: /^all tasks$/i }).first();
    if (await allTasksBtn.isVisible().catch(() => false)) {
      await allTasksBtn.click();
      await page.waitForTimeout(300);
    }
    const authoredHeading = page.getByRole("heading", { name: "Verify1B-AUTHORED" }).first();
    await expect(authoredHeading).toBeVisible({ timeout: 15_000 });

    // Click the heading to open the sheet.
    await authoredHeading.click();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // Title + every authored section render with the seeded content.
    await expect(dialog.getByText("Verify1B-AUTHORED").first()).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "What this is" })).toBeVisible();
    await expect(dialog.getByText(AUTHORED_WALKTHROUGH.whatThisIs)).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Why it matters" })).toBeVisible();
    await expect(dialog.getByText(AUTHORED_WALKTHROUGH.whyItMatters)).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Before you start" })).toBeVisible();
    for (const item of AUTHORED_WALKTHROUGH.beforeYouStart) {
      await expect(dialog.getByText(item)).toBeVisible();
    }
    await expect(dialog.getByRole("heading", { name: "Steps" })).toBeVisible();
    await expect(dialog.getByText("Verify1B-STEP-1")).toBeVisible();
    await expect(dialog.getByText("Verify1B-STEP-2")).toBeVisible();
    // The companion link surface — label rendered as inline-link.
    await expect(dialog.getByText("Verify1B-STEP-LINK")).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Common mistakes" })).toBeVisible();
    for (const m of AUTHORED_WALKTHROUGH.commonMistakes) {
      await expect(dialog.getByText(m)).toBeVisible();
    }
    await expect(dialog.getByRole("heading", { name: "What happens next" })).toBeVisible();
    await expect(dialog.getByText(AUTHORED_WALKTHROUGH.whatHappensNext)).toBeVisible();

    // No fake "not authored" string for an authored task.
    await expect(dialog.getByText(/walkthrough not yet authored/i)).toHaveCount(0);

    // ===== UI: status change in sheet syncs to list view ===================
    const completeBtn = dialog.getByRole("button", { name: /mark complete/i });
    await expect(completeBtn).toBeVisible();
    await completeBtn.click();
    // Either the button text flips to "Completed" inside the sheet
    // (server confirmed) — wait for that as the proxy for sync.
    await expect(dialog.getByRole("button", { name: /^completed$/i })).toBeVisible({ timeout: 10_000 });

    // Close sheet (Esc) and verify list view shows the task as completed.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    // The h4 still renders the title but with line-through styling. We can
    // verify by reading the class on the heading element.
    const completedHeadingClass = await page
      .getByRole("heading", { name: "Verify1B-AUTHORED" })
      .first()
      .getAttribute("class");
    expect(completedHeadingClass ?? "").toMatch(/line-through/);

    // Server confirms via /api/settling-in
    const apiAfter = await page.evaluate(async () => {
      const r = await fetch("/api/settling-in");
      return await r.json();
    });
    const authoredAfter = (apiAfter.tasks as Array<Record<string, unknown>>).find(
      (t) => t.title === "Verify1B-AUTHORED",
    )!;
    expect(authoredAfter.status).toBe("completed");

    // ===== UI: empty-state task shows honest fallback ======================
    const emptyHeading = page.getByRole("heading", { name: "Verify1B-EMPTY" }).first();
    await expect(emptyHeading).toBeVisible();
    await emptyHeading.click();
    const dialog2 = page.getByRole("dialog").first();
    await expect(dialog2).toBeVisible({ timeout: 10_000 });
    // Honest empty-state copy — "Detailed walkthrough not yet authored…".
    // (Quick-steps fallback only when legacySteps[] non-empty; this seed has [].)
    await expect(
      dialog2.getByText(/detailed walkthrough not yet authored/i),
    ).toBeVisible();
    // Authored sections must NOT appear.
    await expect(dialog2.getByRole("heading", { name: "What this is" })).toHaveCount(0);
    await expect(dialog2.getByRole("heading", { name: "Why it matters" })).toHaveCount(0);
    await expect(dialog2.getByRole("heading", { name: "Steps" })).toHaveCount(0);
    await page.keyboard.press("Escape");
  } finally {
    // ---- Cleanup ----------------------------------------------------------
    await a.from("settling_in_tasks").delete().eq("plan_id", planId);
    await a
      .from("relocation_plans")
      .update({
        stage: priorStage,
        arrival_date: priorArrival,
        post_relocation_generated: priorGenerated ?? false,
      })
      .eq("id", planId);
  }
});
