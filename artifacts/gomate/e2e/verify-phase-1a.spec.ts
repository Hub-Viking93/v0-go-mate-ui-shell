// Phase 1A verification spec — verify.md compliance.
//
// Strategy: seed a deterministic 4-task fixture (overdue / urgent /
// approaching / normal) into both the settling_in_tasks table and the
// pre-departure JSONB store via the service-role admin, then assert:
//
//   1. /api/settling-in payload has the right field shape + sort
//   2. /api/pre-departure payload has the right field shape + sort
//   3. UI renders the same order with badges that match the urgency bucket
//
// Cleanup wipes the seed at the end so the test user's plan returns to
// whatever it was before. We also restore the prior plan stage if we
// flipped it to "arrived".

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

test("Phase 1A — deadline model + urgency", async ({ page }) => {
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200));
  });

  // ---- Resolve test user id ------------------------------------------------

  const a = adminClient();
  // listUsers paginates 50 per page by default; walk through pages.
  let user: { id: string; email?: string | null } | null = null;
  for (let pageNum = 1; pageNum <= 50; pageNum++) {
    const { data: usersData, error: usersErr } = await a.auth.admin.listUsers({
      page: pageNum,
      perPage: 200,
    });
    if (usersErr) throw usersErr;
    const found = usersData.users.find(
      (u) => u.email?.toLowerCase() === TEST_EMAIL!.toLowerCase(),
    );
    if (found) {
      user = found;
      break;
    }
    if (usersData.users.length < 200) break;
  }
  if (!user) throw new Error(`Test user ${TEST_EMAIL} not found`);
  const userId = user.id;

  // ---- Find or create the active plan -------------------------------------

  const { data: planRow } = await a
    .from("relocation_plans")
    .select("id, stage, profile_data, research_meta, arrival_date, post_relocation_generated")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  if (!planRow) throw new Error("Test user has no active plan — onboard first");
  const planId = planRow.id as string;
  const priorStage = planRow.stage as string | null;
  const priorResearchMeta = (planRow.research_meta ?? {}) as Record<string, unknown>;
  const priorArrival = planRow.arrival_date as string | null;
  const priorGenerated = planRow.post_relocation_generated as boolean | null;

  // ---- Seed plan to "arrived" + a known arrival_date ----------------------

  // Use a fixed reference time so deadline buckets are deterministic.
  const now = new Date();
  await a
    .from("relocation_plans")
    .update({
      stage: "arrived",
      arrival_date: new Date(now.getTime() - 2 * DAY).toISOString().slice(0, 10),
      post_relocation_generated: true,
    })
    .eq("id", planId);

  // ---- Seed 4 settling-in tasks (one per urgency bucket) -----------------

  await a.from("settling_in_tasks").delete().eq("plan_id", planId);
  const seedRows = [
    {
      label: "OVERDUE",
      task_key: "verify-overdue",
      deadline_at: new Date(now.getTime() - 5 * DAY).toISOString(),
      sort_order: 100,
      deadline_type: "legal" as const,
    },
    {
      label: "URGENT",
      task_key: "verify-urgent",
      deadline_at: new Date(now.getTime() + 2 * DAY).toISOString(),
      sort_order: 101,
      deadline_type: "practical" as const,
    },
    {
      label: "APPROACHING",
      task_key: "verify-approaching",
      deadline_at: new Date(now.getTime() + 10 * DAY).toISOString(),
      sort_order: 102,
      deadline_type: "practical" as const,
    },
    {
      label: "NORMAL",
      task_key: "verify-normal",
      deadline_at: new Date(now.getTime() + 60 * DAY).toISOString(),
      sort_order: 103,
      deadline_type: "recommended" as const,
    },
  ];
  for (const seed of seedRows) {
    const { error: insErr } = await a.from("settling_in_tasks").insert({
      user_id: userId,
      plan_id: planId,
      task_key: seed.task_key,
      title: `Verify-${seed.label}`,
      description: `Phase 1A verify-fixture (${seed.label})`,
      category: "registration",
      depends_on: [],
      deadline_days: 7,
      deadline_at: seed.deadline_at,
      is_legal_requirement: seed.deadline_type === "legal",
      deadline_type: seed.deadline_type,
      steps: [],
      documents_needed: [],
      official_link: null,
      estimated_time: null,
      cost: null,
      status: "available",
      sort_order: seed.sort_order,
      walkthrough: null,
    });
    if (insErr) throw insErr;
  }

  // ---- Seed a pre-departure timeline blob (4 actions, same buckets) -------

  const moveDateMs = now.getTime() + 60 * DAY;
  const fakePreDeparture = {
    generatedAt: now.toISOString(),
    moveDateIso: new Date(moveDateMs).toISOString(),
    longestLeadTimeWeeks: 12,
    criticalPath: ["verify-pm-overdue"],
    actions: [
      {
        id: "verify-pm-overdue",
        title: "Verify PM Overdue",
        description: "Phase 1A verify pre-move overdue",
        category: "logistics",
        weeksBeforeMoveStart: 14,
        weeksBeforeMoveDeadline: 13,
        estimatedDurationDays: 1,
        dependsOn: [],
        documentsNeeded: [],
        officialSourceUrl: null,
        preFilledFormUrl: null,
        agentWhoAddedIt: "verify",
        legalConsequenceIfMissed: "Test fixture",
        deadlineType: "legal",
        status: "not_started",
        sortOrder: 0,
        deadlineIso: new Date(now.getTime() - 5 * DAY).toISOString().slice(0, 10),
      },
      {
        id: "verify-pm-urgent",
        title: "Verify PM Urgent",
        description: "Phase 1A verify pre-move urgent",
        category: "admin",
        weeksBeforeMoveStart: 9,
        weeksBeforeMoveDeadline: 8,
        estimatedDurationDays: 1,
        dependsOn: [],
        documentsNeeded: [],
        officialSourceUrl: null,
        preFilledFormUrl: null,
        agentWhoAddedIt: "verify",
        legalConsequenceIfMissed: "Test fixture",
        deadlineType: "practical",
        status: "not_started",
        sortOrder: 1,
        deadlineIso: new Date(now.getTime() + 2 * DAY).toISOString().slice(0, 10),
      },
      {
        id: "verify-pm-approaching",
        title: "Verify PM Approaching",
        description: "Phase 1A verify pre-move approaching",
        category: "admin",
        weeksBeforeMoveStart: 8,
        weeksBeforeMoveDeadline: 7,
        estimatedDurationDays: 1,
        dependsOn: [],
        documentsNeeded: [],
        officialSourceUrl: null,
        preFilledFormUrl: null,
        agentWhoAddedIt: "verify",
        legalConsequenceIfMissed: "Test fixture",
        deadlineType: "practical",
        status: "not_started",
        sortOrder: 2,
        deadlineIso: new Date(now.getTime() + 10 * DAY).toISOString().slice(0, 10),
      },
      {
        id: "verify-pm-normal",
        title: "Verify PM Normal",
        description: "Phase 1A verify pre-move normal",
        category: "logistics",
        weeksBeforeMoveStart: 4,
        weeksBeforeMoveDeadline: 1,
        estimatedDurationDays: 1,
        dependsOn: [],
        documentsNeeded: [],
        officialSourceUrl: null,
        preFilledFormUrl: null,
        agentWhoAddedIt: "verify",
        legalConsequenceIfMissed: "Test fixture",
        deadlineType: "recommended",
        status: "not_started",
        sortOrder: 3,
        deadlineIso: new Date(now.getTime() + 60 * DAY).toISOString().slice(0, 10),
      },
    ],
  };
  await a
    .from("relocation_plans")
    .update({ research_meta: { ...priorResearchMeta, preDeparture: fakePreDeparture } })
    .eq("id", planId);

  try {
    // ---- Sign in -----------------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page
      .locator('input[type="email"], input[name="email"]')
      .first()
      .fill(TEST_EMAIL!);
    await page
      .locator('input[type="password"], input[name="password"]')
      .first()
      .fill(TEST_PASSWORD!);
    await page
      .locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]')
      .first()
      .click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

    // ===== API contract: settling-in =======================================
    const settlingApi = await page.evaluate(async () => {
      const r = await fetch("/api/settling-in");
      return { status: r.status, body: await r.json() };
    });
    expect(settlingApi.status, "GET /api/settling-in").toBe(200);
    const settlingTasks = (settlingApi.body.tasks as Array<Record<string, unknown>>).filter(
      (t) => typeof t.title === "string" && t.title.startsWith("Verify-"),
    );
    expect(settlingTasks.length, "4 seed tasks present").toBe(4);

    // Field shape — every task must carry deadline_at, deadline_type,
    // urgency, days_until_deadline as separate fields.
    for (const t of settlingTasks) {
      expect(typeof t.deadline_at, `${t.title}.deadline_at`).toBe("string");
      expect(t.deadline_type, `${t.title}.deadline_type`).toMatch(/^(legal|practical|recommended)$/);
      expect(t.urgency, `${t.title}.urgency`).toMatch(/^(overdue|urgent|approaching|normal)$/);
      expect(typeof t.days_until_deadline, `${t.title}.days_until_deadline`).toBe("number");
    }

    // Each labelled task lands in the right urgency bucket.
    const byLabel = Object.fromEntries(settlingTasks.map((t) => [t.title as string, t]));
    expect(byLabel["Verify-OVERDUE"].urgency).toBe("overdue");
    expect(byLabel["Verify-URGENT"].urgency).toBe("urgent");
    expect(byLabel["Verify-APPROACHING"].urgency).toBe("approaching");
    expect(byLabel["Verify-NORMAL"].urgency).toBe("normal");

    // days_until_deadline sign matches bucket
    expect(byLabel["Verify-OVERDUE"].days_until_deadline).toBeLessThan(0);
    expect(byLabel["Verify-URGENT"].days_until_deadline).toBeGreaterThan(0);
    expect(byLabel["Verify-URGENT"].days_until_deadline).toBeLessThanOrEqual(3);

    // Deadline-type kept distinct from urgency
    expect(byLabel["Verify-OVERDUE"].deadline_type).toBe("legal");
    expect(byLabel["Verify-NORMAL"].deadline_type).toBe("recommended");

    // Sort order in payload: overdue → urgent → approaching → normal
    const orderRank: Record<string, number> = { overdue: 0, urgent: 1, approaching: 2, normal: 3 };
    const apiOrder = settlingTasks.map((t) => t.urgency as string);
    for (let i = 1; i < apiOrder.length; i++) {
      expect(
        orderRank[apiOrder[i - 1]] <= orderRank[apiOrder[i]],
        `settling-in API sort: ${apiOrder.join(",")}`,
      ).toBe(true);
    }
    // Stats has urgent/overdue/approaching counts
    const stats = settlingApi.body.stats;
    expect(stats.overdue).toBe(1);
    expect(stats.urgent).toBe(1);
    expect(stats.approaching).toBe(1);

    // ===== API contract: pre-departure =====================================
    const pdApi = await page.evaluate(async () => {
      const r = await fetch("/api/pre-departure");
      return { status: r.status, body: await r.json() };
    });
    expect(pdApi.status, "GET /api/pre-departure").toBe(200);
    const pdActions = (pdApi.body.actions as Array<Record<string, unknown>>).filter((a) =>
      typeof a.title === "string" && a.title.startsWith("Verify PM"),
    );
    expect(pdActions.length, "4 pre-move seed actions present").toBe(4);
    for (const act of pdActions) {
      expect(typeof act.deadlineIso, `${act.title}.deadlineIso`).toBe("string");
      expect(act.deadlineType, `${act.title}.deadlineType`).toMatch(/^(legal|practical|recommended)$/);
      expect(act.urgency, `${act.title}.urgency`).toMatch(/^(overdue|urgent|approaching|normal)$/);
      expect(typeof act.daysUntilDeadline, `${act.title}.daysUntilDeadline`).toBe("number");
    }
    const pdByLabel = Object.fromEntries(pdActions.map((a) => [a.title as string, a]));
    expect(pdByLabel["Verify PM Overdue"].urgency).toBe("overdue");
    expect(pdByLabel["Verify PM Urgent"].urgency).toBe("urgent");
    expect(pdByLabel["Verify PM Approaching"].urgency).toBe("approaching");
    expect(pdByLabel["Verify PM Normal"].urgency).toBe("normal");
    const pdOrder = pdActions.map((a) => a.urgency as string);
    for (let i = 1; i < pdOrder.length; i++) {
      expect(
        orderRank[pdOrder[i - 1]] <= orderRank[pdOrder[i]],
        `pre-departure API sort: ${pdOrder.join(",")}`,
      ).toBe(true);
    }

    // ===== UI: post-move tab ==============================================
    await page.goto("/checklist?tab=post-move", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await expect(page.getByRole("heading", { name: /Verify-OVERDUE/ })).toBeVisible({ timeout: 15_000 });

    // Bucket the badges that show up next to each card. Scope tightly to
    // the *one* card that owns the heading — otherwise the test sees
    // badges of sibling cards too.
    async function badgeFor(taskTitle: string): Promise<string> {
      // The badge sits in a sibling div right after the heading-button.
      // Going up to the card root via the .relative.p-4 ancestor isolates
      // exactly one card.
      const heading = page.getByRole("heading", { name: taskTitle }).first();
      const card = heading.locator(
        "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' relative ') and contains(concat(' ', normalize-space(@class), ' '), ' p-4 ')][1]",
      );
      const html = (await card.innerHTML()).toLowerCase();
      if (/overdue by \d+d/.test(html) || /\boverdue\b/.test(html)) return "overdue";
      if (/due today/.test(html)) return "due_today";
      if (/due tomorrow/.test(html)) return "due_tomorrow";
      if (/due in \d+d/.test(html)) return "due_in_x";
      if (/due this week/.test(html)) return "due_this_week";
      return "none";
    }

    const overdueBadge = await badgeFor("Verify-OVERDUE");
    const urgentBadge = await badgeFor("Verify-URGENT");
    const approachingBadge = await badgeFor("Verify-APPROACHING");
    const normalBadge = await badgeFor("Verify-NORMAL");

    expect(overdueBadge, "OVERDUE badge").toBe("overdue");
    expect(["due_today", "due_tomorrow", "due_in_x"]).toContain(urgentBadge);
    expect(["due_this_week", "due_in_x"]).toContain(approachingBadge);
    expect(normalBadge).toBe("none");

    // UI sort order for the seed tasks: overdue first, normal last.
    const seedTitles = ["Verify-OVERDUE", "Verify-URGENT", "Verify-APPROACHING", "Verify-NORMAL"];
    const seedYs: number[] = [];
    for (const title of seedTitles) {
      const heading = page.getByRole("heading", { name: title }).first();
      const box = await heading.boundingBox();
      if (!box) throw new Error(`No bounding box for ${title}`);
      seedYs.push(box.y);
    }
    for (let i = 1; i < seedYs.length; i++) {
      expect(seedYs[i - 1], `UI sort settling: ${seedTitles.join(",")} → ys ${seedYs.join(",")}`).toBeLessThan(seedYs[i]);
    }

    // ===== UI: pre-move tab ===============================================
    await page.goto("/checklist?tab=pre-move", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    await expect(page.getByText(/Verify PM Overdue/).first()).toBeVisible({ timeout: 15_000 });

    const pmTitles = [
      "Verify PM Overdue",
      "Verify PM Urgent",
      "Verify PM Approaching",
      "Verify PM Normal",
    ];
    const pmYs: number[] = [];
    for (const title of pmTitles) {
      const node = page.getByText(title).first();
      const box = await node.boundingBox();
      if (!box) throw new Error(`No bounding box for ${title}`);
      pmYs.push(box.y);
    }
    for (let i = 1; i < pmYs.length; i++) {
      expect(pmYs[i - 1], `UI sort pre-move: ${pmTitles.join(",")} → ys ${pmYs.join(",")}`).toBeLessThan(pmYs[i]);
    }
  } finally {
    // ---- Cleanup ----------------------------------------------------------
    await a.from("settling_in_tasks").delete().eq("plan_id", planId);
    await a
      .from("relocation_plans")
      .update({
        stage: priorStage,
        arrival_date: priorArrival,
        research_meta: priorResearchMeta,
        post_relocation_generated: priorGenerated ?? false,
      })
      .eq("id", planId);
  }
});
