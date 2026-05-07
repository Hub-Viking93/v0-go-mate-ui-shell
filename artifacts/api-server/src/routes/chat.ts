// =============================================================
// POST /api/chat — plan-state-aware advisory chat
// =============================================================
// The wizard at /onboarding is the only intake path now. /chat
// is always advisory: it routes by the canonical stage of the
// user's current relocation plan and seeds the system prompt
// with profile + (post-arrival) settling-in tasks.
//
//   • arrived  → settling-in coach (post-arrival prompt +
//                OpenAI streaming, baked-in tasks)
//   • else     → free-form advisory chat seeded with profile +
//                stage hint, never an intake re-entry
//
// SSE contract — backwards-compatible with the chat page
// consumer (artifacts/gomate/src/pages/chat/index.tsx):
//
//   data: {"type":"text-delta","delta":"<chunk>"}
//   ...repeated...
//   data: {"type":"message-end","metadata":{...}}
//   data: [DONE]
//
// X-GoMate-* response headers are also set up-front for clients
// that don't parse the SSE stream.
// =============================================================

import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { AGENTS_PACKAGE_VERSION } from "@workspace/agents";

import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";
import { deriveCanonicalStageServer } from "../lib/gomate/core-state";
import {
  buildPostArrivalSystemPrompt,
  type SettlingTask,
} from "../lib/gomate/post-arrival-prompt";
import type { Profile } from "../lib/gomate/profile-schema-snapshot";

const router: IRouter = Router();

interface IncomingMessagePart {
  type?: string;
  text?: string;
}
interface IncomingMessage {
  role: string;
  content?: string;
  parts?: IncomingMessagePart[];
}
interface ChatRequestBody {
  messages?: IncomingMessage[];
  profile?: Profile;
  pendingField?: string;
  /** Legacy field — present in some clients, ignored here. */
  confirmed?: boolean;
}

router.post("/chat", async (req, res) => {
  const ctx = await authenticate(req, res);
  if (!ctx) return;

  const body = (req.body ?? {}) as ChatRequestBody;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastUserMessage = extractLastUserText(messages);
  const lastAssistantMessage = findLastAssistantText(messages);

  // 1. Fetch the active plan. We need stage + profile_data + the
  // research/pre-departure timestamps so deriveCanonicalStageServer
  // gives us an authoritative routing decision.
  const { data: plan, error: planErr } = await ctx.supabase
    .from("relocation_plans")
    .select(
      "id, stage, locked, profile_data, research_status, user_triggered_research_at, user_triggered_pre_departure_at, arrival_date, onboarding_completed",
    )
    .eq("user_id", ctx.user.id)
    .eq("is_current", true)
    .maybeSingle();

  if (planErr) {
    logger.error({ err: planErr, userId: ctx.user.id }, "chat: plan fetch failed");
    res.status(500).json({ error: "Failed to fetch plan" });
    return;
  }
  if (!plan) {
    res.status(404).json({ error: "No active plan found. Create a plan first." });
    return;
  }

  // Persist the inbound user message immediately so chat_messages is
  // the durable source-of-truth (request body can be tampered with /
  // stale across tabs). Best-effort: persistence failure must NOT
  // block the orchestration response.
  if (lastUserMessage.trim().length > 0) {
    try {
      await ctx.supabase.from("chat_messages").insert({
        plan_id: plan.id,
        user_id: ctx.user.id,
        role: "user",
        content: lastUserMessage,
      });
    } catch (err) {
      logger.warn(
        { err, planId: plan.id },
        "chat: failed to persist user message (non-fatal)",
      );
    }
  }

  const profile: Profile =
    plan.profile_data && typeof plan.profile_data === "object"
      ? (plan.profile_data as Profile)
      : {};

  const stage = deriveCanonicalStageServer({
    stage: plan.stage,
    profile_data: plan.profile_data,
    research_status: plan.research_status,
    user_triggered_research_at: plan.user_triggered_research_at,
    user_triggered_pre_departure_at: plan.user_triggered_pre_departure_at,
  });

  try {
    if (stage === "arrived") {
      // Post-arrival: settling-in tasks are loaded server-side and
      // baked into the system prompt for action-oriented answers.
      await handleArrivedStage(
        ctx.supabase,
        ctx.user.id,
        plan.id,
        profile,
        messages,
        res,
      );
      return;
    }

    // All other stages — including "collecting" — get the plan-state-
    // aware free-form chat. The wizard onboarding lives at /onboarding;
    // /chat is always advisory chat now, never an intake re-entry.
    void lastUserMessage; // (no longer drives field-extraction here)
    void lastAssistantMessage;
    await handlePostIntakeFreeForm(
      ctx.supabase,
      ctx.user.id,
      plan.id,
      profile,
      stage,
      plan.arrival_date,
      messages,
      res,
    );
    return;
  } catch (err) {
    logger.error(
      { err, userId: ctx.user.id, planId: plan.id, stage, agentsVersion: AGENTS_PACKAGE_VERSION },
      "chat orchestration failed",
    );
    if (!res.headersSent) {
      res.status(500).json({
        error: "Chat orchestration failed",
        detail: err instanceof Error ? err.message : "unknown",
      });
      return;
    }
    // Headers already flushed (mid-stream). Try to surface a final
    // message-end + DONE so the client unblocks.
    safeStreamError(res, err);
  }
});

// ---------------------------------------------------------------
// Stage handlers
// ---------------------------------------------------------------

async function persistAssistantMessage(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  planId: string,
  userId: string,
  content: string,
): Promise<void> {
  if (!content || content.trim().length === 0) return;
  try {
    await supabase.from("chat_messages").insert({
      plan_id: planId,
      user_id: userId,
      role: "assistant",
      content,
    });
  } catch (err) {
    logger.warn(
      { err, planId },
      "chat: failed to persist assistant message (non-fatal)",
    );
  }
}

async function handleArrivedStage(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  planId: string,
  profile: Profile,
  messages: IncomingMessage[],
  res: import("express").Response,
): Promise<void> {
  // Pull settling-in tasks for the post-arrival system prompt.
  const { data: tasks, error: tasksErr } = await supabase
    .from("settling_in_tasks")
    .select("title, category, status, deadline_days, is_legal_requirement")
    .eq("plan_id", planId);

  if (tasksErr) {
    logger.warn({ err: tasksErr, planId }, "chat: settling task fetch failed (non-fatal)");
  }

  const settlingTasks: SettlingTask[] = Array.isArray(tasks)
    ? (tasks as SettlingTask[])
    : [];

  const systemPrompt = buildPostArrivalSystemPrompt(
    {
      destination:
        typeof profile.destination === "string" ? profile.destination : null,
      nationality:
        typeof profile.citizenship === "string" ? profile.citizenship : null,
      occupation: typeof profile.job_field === "string" ? profile.job_field : null,
      arrivalDate: null,
    },
    settlingTasks,
  );

  prepareSseHeaders(res);

  const openaiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: messageText(m),
      }))
      .filter((m) => m.content.length > 0),
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 2048,
    messages: openaiMessages,
  });

  const text = completion.choices[0]?.message?.content ?? "";
  await streamTextDeltas(res, text);
  await persistAssistantMessage(supabase, planId, userId, text);

  writeSse(res, {
    type: "message-end",
    metadata: {
      profile,
      state: "complete",
      pendingField: null,
      filledFields: [],
      requiredFields: [],
      planLocked: true,
      onboardingCompleted: true,
      stage: "arrived",
      agentsVersion: AGENTS_PACKAGE_VERSION,
    },
  });
  res.write("data: [DONE]\n\n");
  res.end();
}

/**
 * Translate the canonical lifecycle stage into a short phrase + a
 * behavioral cue for the LLM. /chat is always free advisory chat now —
 * the wizard handles onboarding — but the AI's tone + suggestions
 * should still adjust based on where the user is in their move.
 */
function describeStageForPrompt(
  stage: string,
  arrivalDate: string | null,
): { lifecyclePhrase: string; behavioralCue: string } {
  const daysUntilArrival = arrivalDate
    ? Math.round(
        (new Date(arrivalDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      )
    : null;
  switch (stage) {
    case "collecting":
      return {
        lifecyclePhrase:
          "The user has not yet committed to a destination, purpose or timeline.",
        behavioralCue:
          "Help them think things through — comparing options, what to research before they decide. Never ask them for personal profile data; never act like an intake form. Just be an advisor.",
      };
    case "generating":
    case "ready_for_pre_departure":
    case "pre_departure":
    case "complete":
    default:
      return {
        lifecyclePhrase: arrivalDate
          ? `The user is in the pre-move phase. Arrival date is ${arrivalDate} (${daysUntilArrival} days away).`
          : "The user is in the pre-move phase but hasn't pinned an arrival date yet.",
        behavioralCue:
          "Mode: pre-move helper. Focus on visa, documents, budget, housing search, lease termination at origin, banking/insurance, timing. Don't ask the user for profile details — use what's in the profile context. Be concise + actionable.",
      };
  }
}

async function handlePostIntakeFreeForm(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  planId: string,
  profile: Profile,
  stage: string,
  arrivalDate: string | null,
  messages: IncomingMessage[],
  res: import("express").Response,
): Promise<void> {
  const profileSummary = JSON.stringify(profile);
  const phaseGuidance = describeStageForPrompt(stage, arrivalDate);
  const systemPrompt =
    `You are GoMate, a knowledgeable AI relocation assistant. ${phaseGuidance.lifecyclePhrase}\n\n` +
    `${phaseGuidance.behavioralCue}\n\n` +
    `Profile context (JSON): ${profileSummary}\n` +
    (arrivalDate ? `Arrival / move date: ${arrivalDate}\n` : "Arrival date: not set yet\n") +
    `\n` +
    `Be concise, practical, warm. Cite official sources whenever possible. Answer questions about visas, cost of living, banking, taxes, healthcare, settling in, documents, and timelines. Tailor depth to the user's current phase.`;

  prepareSseHeaders(res);

  const openaiMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: messageText(m),
      }))
      .filter((m) => m.content.length > 0),
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 2048,
    messages: openaiMessages,
  });

  const text = completion.choices[0]?.message?.content ?? "";
  await streamTextDeltas(res, text);
  await persistAssistantMessage(supabase, planId, userId, text);

  writeSse(res, {
    type: "message-end",
    metadata: {
      profile,
      state: "complete",
      pendingField: null,
      filledFields: [],
      requiredFields: [],
      planLocked: true,
      onboardingCompleted: true,
      stage,
      agentsVersion: AGENTS_PACKAGE_VERSION,
    },
  });
  res.write("data: [DONE]\n\n");
  res.end();
}

// ---------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------

function prepareSseHeaders(res: import("express").Response): void {
  if (res.headersSent) return;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

function writeSse(res: import("express").Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

async function streamTextDeltas(
  res: import("express").Response,
  text: string,
): Promise<void> {
  // Emit the text in word-sized chunks so the UI gets a typewriter feel.
  // Avoid a single fat chunk, but also don't shred at the codepoint level.
  if (!text) return;
  const tokens = text.match(/\S+\s*|\s+/g) ?? [text];
  for (const tok of tokens) {
    writeSse(res, { type: "text-delta", delta: tok });
  }
}

function safeStreamError(res: import("express").Response, err: unknown): void {
  try {
    writeSse(res, {
      type: "message-end",
      metadata: {
        error: true,
        message: err instanceof Error ? err.message : "unknown",
      },
    });
    res.write("data: [DONE]\n\n");
    res.end();
  } catch {
    try {
      res.end();
    } catch {
      // give up
    }
  }
}

// ---------------------------------------------------------------
// Message helpers
// ---------------------------------------------------------------

function messageText(m: IncomingMessage): string {
  if (typeof m.content === "string" && m.content.trim().length > 0) {
    return m.content;
  }
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter((p) => p?.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
  }
  return "";
}

function extractLastUserText(messages: IncomingMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role === "user") {
      const t = messageText(m);
      if (t.trim().length > 0) return t;
    }
  }
  return "";
}

function findLastAssistantText(messages: IncomingMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role === "assistant") {
      const t = messageText(m);
      if (t.trim().length > 0) return t;
    }
  }
  return null;
}

export default router;
