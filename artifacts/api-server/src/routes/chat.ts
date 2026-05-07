// =============================================================
// POST /api/chat — Wave 2.3 Multi-Agent Onboarding Orchestration
// =============================================================
// Replaces the Wave 2.2 503 placeholder. Routes by the canonical
// stage of the user's current relocation plan:
//
//   • arrived            → settling-in coach (post-arrival prompt
//                          + OpenAI streaming)
//   • collecting         → multi-agent intake chain
//                          (Extractor → Validator → ProfileWriter →
//                          QuestionDirector). When the chain
//                          reports isOnboardingComplete=true we
//                          atomically lock the plan
//                          (locked=true, stage='complete'). The
//                          `user_triggered_research_at` timestamp
//                          is intentionally untouched — that's the
//                          user's own button (POST
//                          /api/plans/trigger-research).
//   • locked / generating /
//     ready_for_pre_departure /
//     pre_departure       → legacy free-form chat (OpenAI) seeded
//                          with the profile so the assistant has
//                          context. The user has graduated past
//                          intake; we never re-run the intake
//                          chain on these stages.
//
// SSE contract — backwards-compatible with the existing chat
// page consumer (artifacts/gomate/src/pages/chat/index.tsx):
//
//   data: {"type":"text-delta","delta":"<chunk>"}
//   ...repeated...
//   data: {"type":"mascot","kind":"thinking_start"}
//   data: {"type":"mascot","kind":"extraction_complete",...}
//   data: {"type":"mascot","kind":"validation_complete",...}
//   data: {"type":"mascot","kind":"profile_updated",...}
//   data: {"type":"mascot","kind":"question_ready","animationCue":"..."}
//   data: {"type":"message-end","metadata":{...}}
//   data: [DONE]
//
// X-GoMate-* response headers are also set up-front for clients
// that don't parse the SSE stream.
// =============================================================

import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  AGENTS_PACKAGE_VERSION,
  createSupabaseLogWriter,
  createSupabaseProfileStore,
  type LogWriter,
  type QuestionDirectorMessage,
} from "@workspace/agents";

import { authenticate } from "../lib/supabase-auth";
import { logger } from "../lib/logger";
import { deriveCanonicalStageServer } from "../lib/gomate/core-state";
import {
  orchestrateCollecting,
  type OrchestrateCollectingResult,
  type MascotEvent,
} from "../lib/gomate/orchestrate-collecting";
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

  // Read the canonical conversation history from chat_messages
  // (cap last 50 turns) instead of trusting the request body. This
  // closes the gap where chat_history was always 0 even though
  // onboarding had advanced for many turns.
  const conversationHistory = await loadConversationHistory(
    ctx.supabase,
    plan.id,
  );

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
    void conversationHistory;
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

interface HandleCollectingArgs {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
  planId: string;
  profile: Profile;
  hintedPendingField: string | null;
  userMessage: string;
  conversationHistory: QuestionDirectorMessage[];
  lastAssistantMessage: string | null;
  currentStage: string;
  res: import("express").Response;
}

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

async function loadConversationHistory(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  planId: string,
): Promise<QuestionDirectorMessage[]> {
  try {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("plan_id", planId)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) {
      logger.warn({ err: error, planId }, "chat: load history failed (non-fatal)");
      return [];
    }
    const out: QuestionDirectorMessage[] = [];
    for (const row of (data ?? []) as Array<{ role: string; content: string }>) {
      if (row.role !== "user" && row.role !== "assistant" && row.role !== "system") continue;
      if (typeof row.content !== "string" || row.content.trim().length === 0) continue;
      out.push({
        role: row.role as QuestionDirectorMessage["role"],
        content: row.content,
      });
    }
    return out;
  } catch (err) {
    logger.warn({ err, planId }, "chat: load history threw (non-fatal)");
    return [];
  }
}

async function handleCollectingStage(args: HandleCollectingArgs): Promise<void> {
  const store = createSupabaseProfileStore(args.supabase);
  // Wrap the log writer so audit/run-log insert failures NEVER bubble
  // up and 500 the user — by the time we're writing audit rows we may
  // already have committed a profile_data merge and cannot roll it
  // back. Errors are logged to stderr for ops visibility.
  const writer = wrapWriterSafe(createSupabaseLogWriter(args.supabase));

  const result = await orchestrateCollecting({
    profileId: args.planId,
    profile: args.profile,
    hintedPendingField: args.hintedPendingField as Parameters<
      typeof orchestrateCollecting
    >[0]["hintedPendingField"],
    userMessage: args.userMessage,
    conversationHistory: args.conversationHistory,
    lastAssistantMessage: args.lastAssistantMessage,
    store,
    writer,
  });

  // 2. Mark onboarding complete when all required fields land. We
  // DO NOT lock the plan here — locking is the user's explicit
  // action via the Generate-my-plan button (handled by
  // POST /api/plans/trigger-research). Locking here meant the
  // client jumped straight into the post-onboarding free-chat the
  // moment the last field was extracted, hiding the Generate CTA.
  //
  // Recovery property: if the UPDATE fails we report
  // onboardingCompleted=false, which keeps the client's view
  // consistent with the DB. The client will send another turn (or
  // refresh), at which point getRequiredFields() still returns []
  // (the profile didn't change), so isOnboardingComplete fires
  // again and the update is re-attempted.
  let planLocked = false;
  let onboardingCompleted = false;
  let lockError: string | undefined;
  if (result.isOnboardingComplete) {
    const now = new Date().toISOString();
    const { error: updErr } = await args.supabase
      .from("relocation_plans")
      .update({
        stage: "complete",
        onboarding_completed: true,
        updated_at: now,
      })
      .eq("id", args.planId)
      .eq("user_id", args.userId);
    if (updErr) {
      lockError = updErr.message;
      logger.error({ err: updErr, planId: args.planId }, "chat: failed to mark onboarding complete");
      // Non-fatal — see recovery property comment above.
    } else {
      onboardingCompleted = true;
      // planLocked stays false. The trigger-research route is what
      // actually flips locked=true.
    }
  }

  // 3. Pre-stream headers (legacy compat).
  const interviewState: "interview" | "complete" = result.isOnboardingComplete
    ? "complete"
    : "interview";

  setGoMateHeaders(args.res, {
    profile: result.profileAfter,
    state: interviewState,
    pendingField: result.nextPendingField,
    filledFields: result.filledFields,
  });
  prepareSseHeaders(args.res);

  // 4. Stream mascot events FIRST so the UI can sequence its
  // animations while the question text is rendering.
  for (const ev of result.mascotEvents) {
    writeSse(args.res, { type: "mascot", ...stripUndef(ev as unknown as Record<string, unknown>) });
  }

  // 5. Stream the question text in word-sized chunks.
  await streamTextDeltas(args.res, result.questionText);

  // 5b. Persist the assistant question to chat_messages so future
  // turns can read the canonical history straight from the DB
  // (loadConversationHistory above) instead of trusting the client.
  await persistAssistantMessage(
    args.supabase,
    args.planId,
    args.userId,
    result.questionText,
  );

  // 6. Final message-end with metadata.
  writeSse(args.res, {
    type: "message-end",
    metadata: {
      profile: result.profileAfter,
      state: interviewState,
      pendingField: result.nextPendingField,
      filledFields: result.filledFields,
      requiredFields: result.requiredFields,
      planLocked,
      onboardingCompleted,
      animationCue: result.animationCue,
      ...(result.retryHint ? { retryHint: result.retryHint } : {}),
      ...(lockError ? { lockError } : {}),
      stage: args.currentStage,
      agentsVersion: AGENTS_PACKAGE_VERSION,
    },
  });
  args.res.write("data: [DONE]\n\n");
  args.res.end();
}

/**
 * Wrap a LogWriter so insert failures are logged but never thrown.
 * Audit/run-log inserts are best-effort observability — they MUST NOT
 * cascade as a 500 after a profile_data merge has already committed
 * (cannot be rolled back from this layer). Failure visibility is
 * preserved through `logger.warn`.
 */
function wrapWriterSafe(inner: LogWriter): LogWriter {
  return {
    async insertRunLog(row) {
      try {
        await inner.insertRunLog(row);
      } catch (err) {
        logger.warn(
          { err, agent: row.agent_name, profile_id: row.profile_id },
          "chat: agent_run_log insert failed (non-fatal)",
        );
      }
    },
    async insertAudit(row) {
      try {
        await inner.insertAudit(row);
      } catch (err) {
        logger.warn(
          { err, agent: row.agent_name, profile_id: row.profile_id },
          "chat: agent_audit insert failed (non-fatal)",
        );
      }
    },
  };
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

interface GoMateHeaderState {
  profile: Profile;
  state: "interview" | "complete";
  pendingField: string | null;
  filledFields: string[];
}

function setGoMateHeaders(
  res: import("express").Response,
  s: GoMateHeaderState,
): void {
  if (res.headersSent) return;
  try {
    res.setHeader("X-GoMate-Profile", JSON.stringify(s.profile));
  } catch {
    // ignore
  }
  res.setHeader("X-GoMate-State", s.state);
  if (s.pendingField) {
    res.setHeader("X-GoMate-Pending-Field", s.pendingField);
  }
  res.setHeader("X-GoMate-Filled-Fields", JSON.stringify(s.filledFields));
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

function stripUndef<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// Surface the result type so unit tests can import the shape.
export type { OrchestrateCollectingResult, MascotEvent };

export default router;
