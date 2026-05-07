import { Router, type IRouter } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticate } from "../lib/supabase-auth";
import { getUserTier, hasFeatureAccess } from "../lib/gomate/tier";
import { logger } from "../lib/logger";
import {
  generateSettlingInDAG,
  computeUrgency,
  daysUntil,
  compareByUrgency,
  type SettlingInProfile,
  type SettlingTask,
  type DeadlineType,
  type Urgency,
} from "@workspace/agents";

const router: IRouter = Router();

/**
 * Phase 7.2 — settling-in DAG persistence.
 * Triggered automatically when /api/settling-in/arrive flips stage→arrived.
 * Idempotent: deletes prior tasks for the plan, regenerates from profile +
 * arrival_date, persists. Returns the inserted rows.
 */
async function generateAndPersistSettlingInTasks(args: {
  supabase: SupabaseClient;
  userId: string;
  planId: string;
  profile: SettlingInProfile;
  arrivalDate: Date;
}): Promise<{ count: number; legalCount: number; urgentCount: number }> {
  const dag = generateSettlingInDAG(args.profile, args.arrivalDate);

  // Wipe any prior tasks for this plan (regen path).
  await args.supabase
    .from("settling_in_tasks")
    .delete()
    .eq("plan_id", args.planId)
    .eq("user_id", args.userId);

  if (dag.tasks.length === 0) {
    return { count: 0, legalCount: 0, urgentCount: 0 };
  }

  const arrivalMs = args.arrivalDate.getTime();

  // settling_in_tasks.depends_on is uuid[]. Our generator emits string
  // keys ("reg-population") so dependencies are author-friendly. We do a
  // 2-pass write: insert all tasks with empty depends_on (Postgres assigns
  // ids), then map taskKey → assigned uuid and PATCH dep arrays.
  // The taskKey is hidden in `documents_needed[0]` as a "__key:..." sentinel
  // because the table has no spare text column. We strip the sentinel
  // before sending data back to the UI.
  const insertRows = dag.tasks.map((t: SettlingTask) => {
    const deadlineDate = new Date(arrivalMs + t.deadlineDays * 24 * 60 * 60 * 1000);
    return {
      user_id: args.userId,
      plan_id: args.planId,
      title: t.title,
      description: t.description,
      category: t.category,
      depends_on: [],
      deadline_days: t.deadlineDays,
      deadline_at: deadlineDate.toISOString(),
      is_legal_requirement: t.isLegalRequirement,
      deadline_type: t.deadlineType ?? (t.isLegalRequirement ? "legal" : "practical"),
      walkthrough: t.walkthrough ?? null,
      task_key: t.taskKey,
      steps: t.steps,
      documents_needed: [`__key:${t.taskKey}`, ...t.documentsNeeded],
      official_link: t.officialLink,
      estimated_time: t.estimatedTime,
      cost: t.cost,
      status: t.status,
      sort_order: t.sortOrder,
    };
  });
  const { data: inserted, error } = await args.supabase
    .from("settling_in_tasks")
    .insert(insertRows)
    .select("id, documents_needed");
  if (error || !inserted) {
    logger.error({ err: error, planId: args.planId }, "settling-in: persist failed");
    throw error ?? new Error("settling-in insert returned no rows");
  }

  // Build taskKey → UUID map from sentinel.
  const keyToUuid = new Map<string, string>();
  for (const row of inserted as Array<{ id: string; documents_needed: string[] }>) {
    const key = row.documents_needed.find((d) => d.startsWith("__key:"))?.slice("__key:".length);
    if (key) keyToUuid.set(key, row.id);
  }

  // Pass 2 — patch depends_on arrays + strip sentinel.
  const patches: Array<Promise<unknown>> = [];
  for (const t of dag.tasks) {
    const id = keyToUuid.get(t.taskKey);
    if (!id) continue;
    const depUuids = t.dependsOn.map((k) => keyToUuid.get(k)).filter((u): u is string => !!u);
    const cleanDocs = t.documentsNeeded;
    patches.push(
      args.supabase
        .from("settling_in_tasks")
        .update({ depends_on: depUuids, documents_needed: cleanDocs })
        .eq("id", id)
        .then((r) => r),
    );
  }
  await Promise.all(patches);
  // Mark plan as generated.
  await args.supabase
    .from("relocation_plans")
    .update({ post_relocation_generated: true, updated_at: new Date().toISOString() })
    .eq("id", args.planId);

  return {
    count: dag.tasks.length,
    legalCount: dag.legalRequirementsCount,
    urgentCount: dag.urgentDeadlines.length,
  };
}

function isPostArrivalStage(stage: string | null | undefined): boolean {
  return stage === "arrived";
}

router.get("/settling-in", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "settling_in_tasks")) {
      res.status(403).json({ error: "Post-relocation features require Pro" });
      return;
    }
    const { data: plan } = await ctx.supabase
      .from("relocation_plans")
      .select("id, arrival_date, stage, post_relocation_generated")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (!plan) {
      res.status(404).json({ error: "No active plan found" });
      return;
    }
    if (!isPostArrivalStage(plan.stage)) {
      res.json({
        tasks: [], stage: plan.stage, arrivalDate: null,
        generated: false, executionEnabled: false,
        stats: { total: 0, completed: 0, overdue: 0, available: 0, locked: 0, legalTotal: 0, legalCompleted: 0, progressPercent: 0, compliancePercent: 0 },
      });
      return;
    }
    const { data: tasks } = await ctx.supabase
      .from("settling_in_tasks")
      .select("*")
      .eq("plan_id", plan.id)
      .order("sort_order");
    const rawList = tasks || [];

    // Phase 1A — compute server-side urgency from deadline_at vs now and
    // re-sort so that overdue/urgent items rise to the top within each
    // category. Completed/skipped tasks are forced to "normal" so they
    // don't dominate the urgent slots.
    const now = new Date();
    const decorated = rawList.map((t: any) => {
      const due = t.deadline_at ? new Date(t.deadline_at) : null;
      const isClosed = t.status === "completed" || t.status === "skipped";
      const urgency: Urgency = isClosed ? "normal" : computeUrgency(due, now);
      const deadlineType: DeadlineType =
        (t.deadline_type as DeadlineType | undefined) ??
        (t.is_legal_requirement ? "legal" : "practical");
      return {
        ...t,
        deadline_type: deadlineType,
        urgency,
        days_until_deadline: daysUntil(due, now),
      };
    });
    const list = decorated.slice().sort((a, b) => {
      const r = compareByUrgency(
        { urgency: a.urgency, due_at: a.deadline_at },
        { urgency: b.urgency, due_at: b.deadline_at },
      );
      if (r !== 0) return r;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

    const completed = list.filter((t: any) => t.status === "completed").length;
    const legalTotal = list.filter((t: any) => t.is_legal_requirement).length;
    const legalCompleted = list.filter((t: any) => t.is_legal_requirement && t.status === "completed").length;
    res.json({
      tasks: list,
      stage: plan.stage,
      arrivalDate: plan.arrival_date,
      generated: Boolean(plan.post_relocation_generated),
      executionEnabled: true,
      stats: {
        total: list.length,
        completed,
        overdue: list.filter((t: any) => t.urgency === "overdue").length,
        urgent: list.filter((t: any) => t.urgency === "urgent").length,
        approaching: list.filter((t: any) => t.urgency === "approaching").length,
        available: list.filter((t: any) => t.status === "available").length,
        locked: list.filter((t: any) => t.status === "locked").length,
        legalTotal,
        legalCompleted,
        progressPercent: list.length > 0 ? Math.round((completed / list.length) * 100) : 0,
        compliancePercent: legalTotal > 0 ? Math.round((legalCompleted / legalTotal) * 100) : 0,
      },
    });
  } catch (err) {
    logger.error({ err }, "settling-in get error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/settling-in/:id", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "settling_in_tasks")) {
      res.status(403).json({ error: "Pro required" });
      return;
    }
    const newStatus = (req.body as { status?: string })?.status;
    const valid = ["available", "in_progress", "completed", "skipped"];
    if (!newStatus || !valid.includes(newStatus)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    const { data: task } = await ctx.supabase
      .from("settling_in_tasks")
      .select("id, status, plan_id, depends_on")
      .eq("id", req.params.id)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      completed_at: newStatus === "completed" ? new Date().toISOString() : null,
    };
    const { error: updErr } = await ctx.supabase
      .from("settling_in_tasks")
      .update(updates)
      .eq("id", req.params.id)
      .eq("user_id", ctx.user.id);
    if (updErr) {
      res.status(500).json({ error: "Failed to update task" });
      return;
    }
    res.json({ success: true, taskId: req.params.id, status: newStatus });
  } catch (err) {
    logger.error({ err }, "settling-in patch error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/settling-in/arrive", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "settling_in_tasks")) {
      res.status(403).json({ error: "Pro required" });
      return;
    }
    const arrivalDate = (req.body as { arrivalDate?: string })?.arrivalDate || new Date().toISOString().split("T")[0];
    const { data: plan } = await ctx.supabase
      .from("relocation_plans")
      .select("id, stage, profile_data")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (!plan) {
      res.status(404).json({ error: "No active plan" });
      return;
    }
    // v2 Wave 1.3: arrival can be confirmed from any of the post-collection
    // stages. `complete` stays in the allow-list as a v1 backward-compat
    // alias for `ready_for_pre_departure`.
    const allowedSourceStages = new Set([
      "complete",
      "ready_for_pre_departure",
      "pre_departure",
      "arrived",
    ]);
    if (!allowedSourceStages.has(plan.stage as string)) {
      res.status(400).json({
        error:
          "Plan must be at least at the ready-for-pre-departure stage before marking arrival",
        currentStage: plan.stage,
      });
      return;
    }
    const { error: updErr } = await ctx.supabase
      .from("relocation_plans")
      .update({ stage: "arrived", arrival_date: arrivalDate, updated_at: new Date().toISOString() })
      .eq("id", plan.id)
      .eq("user_id", ctx.user.id);
    if (updErr) {
      res.status(500).json({ error: "Failed to update" });
      return;
    }

    // Phase 7.2 — auto-generate settling-in DAG immediately after arrival.
    let generation: { count: number; legalCount: number; urgentCount: number } | null = null;
    try {
      generation = await generateAndPersistSettlingInTasks({
        supabase: ctx.supabase,
        userId: ctx.user.id,
        planId: plan.id,
        profile: (plan.profile_data ?? {}) as SettlingInProfile,
        arrivalDate: new Date(arrivalDate),
      });
    } catch (genErr) {
      // Non-fatal: stage flip succeeded; user can manually re-trigger.
      logger.error({ err: genErr, planId: plan.id }, "settling-in: auto-generation failed (non-fatal)");
    }

    res.json({
      success: true,
      arrivalDate,
      stage: "arrived",
      planId: plan.id,
      ...(generation
        ? { tasksGenerated: generation.count, legalRequirements: generation.legalCount, urgentDeadlines: generation.urgentCount }
        : {}),
    });
  } catch (err) {
    logger.error({ err }, "settling-in arrive error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.all("/settling-in/generate", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  res.status(503).json({
    error: "Settling-in plan generation requires the AI research worker (Firecrawl + OpenAI). This is part of a follow-up integration task.",
  });
});

router.all("/settling-in/:id/why-it-matters", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;
  res.status(503).json({
    error: "AI explanation requires the OpenAI worker. Part of follow-up task.",
  });
});

router.get("/settling-in/export-ical", async (req, res) => {
  try {
    const ctx = await authenticate(req, res);
    if (!ctx) return;
    const tier = await getUserTier(ctx.supabase, ctx.user.id);
    if (!hasFeatureAccess(tier, "compliance_calendar")) {
      res.status(403).json({ error: "Pro required" });
      return;
    }
    const { data: plan } = await ctx.supabase
      .from("relocation_plans")
      .select("id")
      .eq("user_id", ctx.user.id)
      .eq("is_current", true)
      .maybeSingle();
    if (!plan) {
      res.status(404).json({ error: "No plan found" });
      return;
    }
    const { data: tasks } = await ctx.supabase
      .from("settling_in_tasks")
      .select("id, title, description, deadline_at")
      .eq("plan_id", plan.id)
      .not("deadline_at", "is", null);

    const escape = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
    const toICalDate = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
    };
    const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//GoMate//Compliance Calendar//EN"];
    for (const t of tasks || []) {
      if (!t.deadline_at) continue;
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${t.id}@gomate`);
      lines.push(`DTSTAMP:${toICalDate(new Date().toISOString())}`);
      lines.push(`DTSTART:${toICalDate(t.deadline_at)}`);
      lines.push(`DTEND:${toICalDate(new Date(new Date(t.deadline_at).getTime() + 60 * 60 * 1000).toISOString())}`);
      lines.push(`SUMMARY:${escape(t.title)}`);
      if (t.description) lines.push(`DESCRIPTION:${escape(t.description)}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="gomate-deadlines.ics"`);
    res.send(lines.join("\r\n"));
  } catch (err) {
    logger.error({ err }, "ical export error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
