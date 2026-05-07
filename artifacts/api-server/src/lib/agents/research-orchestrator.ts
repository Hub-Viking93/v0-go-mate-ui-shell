/**
 * Research Orchestrator (Wave 2.x Prompt 3.5)
 *
 * Runs the full research pipeline for a relocation profile:
 *
 *   1. Coordinator.decideDispatch(profile) → list of specialists
 *   2. Promise.allSettled(specialists)         (parallel, 90s budget)
 *   3. Synthesizer (always; degrades gracefully on failure)
 *   4. Critic     (always; degrades gracefully on failure)
 *   5. ONE optional re-dispatch round if Critic returns gaps with
 *      suggestedSpecialist names that haven't been run yet (cap=1
 *      to prevent infinite loops).
 *   6. Finalize: update relocation_plans (research_status,
 *      research_completed_at, stage).
 *
 * The whole thing runs ASYNC in the api-server process — the trigger
 * HTTP request returns 202 immediately and the work continues in the
 * background. Live status is exposed via:
 *
 *   - in-memory `Map<profileId, ResearchRunState>` for SSE clients
 *   - audit rows persisted to Supabase (agent_run_log + agent_audit)
 *     via the standard LogWriter, for replay/debugging.
 *
 * Per-spec live status is DERIVED from the audit-row stream that the
 * specialists already write — we tap the LogWriter so we don't have
 * to modify any specialist code:
 *
 *   {name}.start     → researching
 *   {name}.synthesis → drafting
 *   {name}.complete  → complete   (quality + citations from `value`)
 *                        (or `failed` if quality === "fallback")
 *
 * Phase-level status (synthesizing, critiquing, redispatching) is
 * tracked at run level and pushed when transitions happen.
 *
 * Granularity caveat: per-source-URL progress ("3 of 5 read") is NOT
 * surfaced because the specialists don't currently emit per-URL audit
 * rows. After completion, citations and source counts come from the
 * specialist output. This is honest about what the underlying agents
 * report rather than faking finer granularity than exists.
 */

import { EventEmitter } from "node:events";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  // Always-run
  visaSpecialist,
  taxSpecialist,
  costSpecialist,
  housingSpecialist,
  culturalSpecialist,
  documentsSpecialist,
  healthcareSpecialist,
  bankingSpecialist,
  // Conditional
  schoolsSpecialist,
  studyProgramSpecialist,
  petSpecialist,
  postedWorkerSpecialist,
  digitalNomadComplianceSpecialist,
  jobComplianceSpecialist,
  familyReunionSpecialist,
  departureTaxSpecialist,
  vehicleImportSpecialist,
  propertyPurchaseSpecialist,
  trailingSpouseCareerSpecialist,
  pensionContinuitySpecialist,
  // Synth + critic
  synthesize,
  critique,
  // Adapter
  createSupabaseLogWriter,
  // Helpers
  trimParagraphsToWordCap,
  // Types
  type LogWriter,
  type SpecialistContext,
  type SpecialistOutput,
  type SpecialistProfile,
  type SynthesizerInput,
  type UnifiedGuide,
  type CriticOutput,
  type AgentAuditRow,
  type AgentRunLogRow,
} from "@workspace/agents";

import { buildInvocation, decideDispatch, type DispatchDecision } from "./coordinator";
import {
  buildVisaResearchPayload,
  buildLocalRequirementsPayload,
} from "./research-persistence";
import type { Profile } from "../gomate/profile-schema-snapshot";
import { logger } from "../logger";
// Guide composition retired — the live workspaces replace the PDF-style guide.
// import { composeAndPersistGuide } from "../gomate/guide-pipeline";

// ---------------------------------------------------------------------------
// Specialist registry
// ---------------------------------------------------------------------------

type SpecialistFn = (
  p: SpecialistProfile,
  ctx: SpecialistContext,
) => Promise<SpecialistOutput>;

const SPECIALIST_FNS: Record<string, SpecialistFn> = {
  visa_specialist: visaSpecialist,
  tax_strategist: taxSpecialist,
  cost_specialist: costSpecialist,
  housing_specialist: housingSpecialist,
  cultural_adapter: culturalSpecialist,
  documents_specialist: documentsSpecialist,
  healthcare_navigator: healthcareSpecialist,
  banking_helper: bankingSpecialist,
  schools_specialist: schoolsSpecialist,
  study_program_specialist: studyProgramSpecialist,
  pet_specialist: petSpecialist,
  posted_worker_specialist: postedWorkerSpecialist,
  digital_nomad_compliance: digitalNomadComplianceSpecialist,
  job_compliance_specialist: jobComplianceSpecialist,
  family_reunion_specialist: familyReunionSpecialist,
  departure_tax_specialist: departureTaxSpecialist,
  vehicle_import_specialist: vehicleImportSpecialist,
  property_purchase_specialist: propertyPurchaseSpecialist,
  trailing_spouse_career_specialist: trailingSpouseCareerSpecialist,
  pension_continuity_specialist: pensionContinuitySpecialist,
};

// ---------------------------------------------------------------------------
// Public types — also consumed by the SSE route + the frontend hook.
// Keep these stable; downstream code parses JSON straight into them.
// ---------------------------------------------------------------------------

export type AgentLiveStatus =
  | "idle"
  | "researching"
  | "drafting"
  | "validating"
  | "complete"
  | "failed";

export interface AgentLiveState {
  /** Coordinator key (snake_case). */
  name: string;
  status: AgentLiveStatus;
  /** Plain-English description of what the agent is doing right now. */
  currentActivity: string;
  /** Quality bucket once complete. */
  quality?: "full" | "partial" | "fallback";
  /** Source URLs after completion (from output.citations). */
  sourceUrls?: { url: string; label: string; scraped: boolean }[];
  /** Count of sources actually scraped this run. */
  sourcesScraped?: number;
  /** Total sources cited (scraped + whitelist-only). */
  sourcesTotal?: number;
  /** 1-2 line plain-English summary once complete. */
  summary?: string;
  /** Full prose paragraphs (lazy-loaded into the expandable detail panel). */
  draftParagraphs?: string[];
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  /** True if dispatched by Critic re-dispatch (not by initial Coordinator). */
  redispatched?: boolean;
}

export type RunStatus =
  | "pending"
  | "researching"
  | "synthesizing"
  | "critiquing"
  | "redispatching"
  | "completed"
  | "partial"
  | "failed";

export interface CoordinatorRationaleEntry {
  specialist: string;
  reason: string;
}

export interface ResearchRunState {
  profileId: string;
  rationale: CoordinatorRationaleEntry[];
  /** name → live state. Map for ergonomic mutation; serialized to plain object. */
  agents: Map<string, AgentLiveState>;
  runStatus: RunStatus;
  startedAt: string;
  completedAt?: string;
  /** Synthesizer summary (set once synth completes). */
  synth?: {
    sectionCount: number;
    consistencyIssues: string[];
    unresolvedIssues: string[];
    wallClockMs: number;
    tokensUsed: number;
    modelUsed: string;
  };
  /** Critic summary (set once critic completes). */
  critic?: {
    gapCount: number;
    weakClaimCount: number;
    missingForUserCount: number;
    wallClockMs: number;
    tokensUsed: number;
    modelUsed: string;
  };
  /** True if a re-dispatch round was triggered. */
  redispatchRoundsRun: number;
  /** Run-level error if the whole pipeline crashed. */
  errorMessage?: string;
}

/** Wire format pushed over SSE — `agents` becomes a plain object. */
export interface ResearchRunSnapshot {
  profileId: string;
  rationale: CoordinatorRationaleEntry[];
  agents: Record<string, AgentLiveState>;
  runStatus: RunStatus;
  startedAt: string;
  completedAt?: string;
  synth?: ResearchRunState["synth"];
  critic?: ResearchRunState["critic"];
  redispatchRoundsRun: number;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const RUNS = new Map<string, ResearchRunState>();
const EMITTERS = new Map<string, EventEmitter>();
/** Track in-flight runs to enforce idempotency on re-trigger. */
const IN_FLIGHT = new Set<string>();

/** TTL after which terminal runs are evicted from memory. */
const TERMINAL_RUN_TTL_MS = 5 * 60 * 1000;

function getEmitter(profileId: string): EventEmitter {
  let em = EMITTERS.get(profileId);
  if (!em) {
    em = new EventEmitter();
    em.setMaxListeners(64); // permissive — multiple SSE tabs allowed
    EMITTERS.set(profileId, em);
  }
  return em;
}

function snapshot(state: ResearchRunState): ResearchRunSnapshot {
  const agents: Record<string, AgentLiveState> = {};
  for (const [k, v] of state.agents) agents[k] = { ...v };
  return {
    profileId: state.profileId,
    rationale: state.rationale,
    agents,
    runStatus: state.runStatus,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    synth: state.synth,
    critic: state.critic,
    redispatchRoundsRun: state.redispatchRoundsRun,
    errorMessage: state.errorMessage,
  };
}

function emit(profileId: string): void {
  const state = RUNS.get(profileId);
  if (!state) return;
  const em = EMITTERS.get(profileId);
  if (!em) return;
  em.emit("change", snapshot(state));
}

export function getRunState(profileId: string): ResearchRunSnapshot | null {
  const s = RUNS.get(profileId);
  return s ? snapshot(s) : null;
}

export function isRunInFlight(profileId: string): boolean {
  return IN_FLIGHT.has(profileId);
}

export type RunListener = (snap: ResearchRunSnapshot) => void;

export function subscribeToRun(
  profileId: string,
  listener: RunListener,
): () => void {
  const em = getEmitter(profileId);
  em.on("change", listener);
  return () => em.off("change", listener);
}

function evictAfterTTL(profileId: string): void {
  setTimeout(() => {
    RUNS.delete(profileId);
    EMITTERS.delete(profileId);
  }, TERMINAL_RUN_TTL_MS);
}

// ---------------------------------------------------------------------------
// LogWriter that derives live status from audit rows
// ---------------------------------------------------------------------------

/**
 * Wraps the persistence LogWriter. For every audit row the specialists,
 * synth or critic write, we ALSO update the in-memory ResearchRunState
 * and emit a change event. Persistence failures are swallowed (logged)
 * so the live UI keeps working even if Supabase rejects an insert.
 */
function makeLiveLogWriter(
  profileId: string,
  base: LogWriter,
): LogWriter {
  return {
    async insertRunLog(row: AgentRunLogRow): Promise<void> {
      try {
        await base.insertRunLog(row);
      } catch (err) {
        logger.warn(
          { err, profileId, agent: row.agent_name, phase: row.phase },
          "[research-orchestrator] run_log persistence failed (continuing)",
        );
      }
    },
    async insertAudit(row: AgentAuditRow): Promise<void> {
      // 1) update in-memory state from the row
      try {
        applyAuditToLiveState(profileId, row);
      } catch (err) {
        logger.warn(
          { err, profileId, agent: row.agent_name },
          "[research-orchestrator] live-state update failed",
        );
      }
      // 2) persist (best-effort)
      try {
        await base.insertAudit(row);
      } catch (err) {
        logger.warn(
          { err, profileId, agent: row.agent_name, key: row.field_or_output_key },
          "[research-orchestrator] audit persistence failed (continuing)",
        );
      }
    },
  };
}

interface AuditValue {
  specialist?: string;
  status?: string;
  quality?: "full" | "partial" | "fallback";
  /** Count of URLs actually scraped (matches _base.ts `summaryValue`). */
  source_count?: number;
  /** Total citations advertised (scraped + whitelist-only). */
  citation_count?: number;
  fallback_reason?: string | null;
}

function applyAuditToLiveState(
  profileId: string,
  row: AgentAuditRow,
): void {
  const state = RUNS.get(profileId);
  if (!state) return;
  const key = row.field_or_output_key ?? "";
  // Run-level audit rows (synthesizer, critic) — handled separately.
  if (
    key.startsWith("synthesizer.") ||
    key.startsWith("critic.")
  ) {
    return;
  }
  // Specialist audit rows are shaped `${specialist}.{start|synthesis|complete}`.
  const dot = key.indexOf(".");
  if (dot <= 0) return;
  const specialistKey = key.slice(0, dot);
  const phase = key.slice(dot + 1);
  const live = state.agents.get(specialistKey);
  if (!live) {
    // Unknown specialist (e.g. agent_name doesn't match the panel key).
    // Don't create panels at random — the Coordinator decides the panel set.
    return;
  }
  const value = (row.value ?? null) as AuditValue | null;

  if (phase === "start") {
    live.status = "researching";
    live.currentActivity = "Reading official sources…";
    live.startedAt = new Date().toISOString();
  } else if (phase === "synthesis") {
    live.status = "drafting";
    live.currentActivity = "Synthesizing findings into a structured answer…";
  } else if (phase === "complete") {
    const quality = value?.quality;
    const fallbackReason = value?.fallback_reason ?? undefined;
    live.quality = quality;
    live.sourcesScraped = value?.source_count;
    live.sourcesTotal = value?.citation_count;
    live.completedAt = new Date().toISOString();
    if (quality === "fallback") {
      // Fallback ≠ failed. The specialist still produced an answer using its
      // training-knowledge — we just don't have citation URLs to surface. Mark
      // the panel as complete-with-caveat so the user doesn't see a scary
      // "Failed" badge for a section that has perfectly readable content.
      live.status = "complete";
      live.quality = "fallback";
      live.currentActivity = fallbackReason
        ? `Working from embedded knowledge — ${fallbackReason}`
        : "Working from embedded knowledge — no live sources to scrape for this destination.";
    } else {
      live.status = "complete";
      const scraped = value?.source_count ?? 0;
      const total = value?.citation_count ?? scraped;
      const qualityLabel = quality === "partial" ? " (partial)" : "";
      live.currentActivity = `Complete — used ${scraped} of ${total} sources${qualityLabel}.`;
    }
  }
  emit(profileId);
}

// ---------------------------------------------------------------------------
// Activity labels per agent — used for the initial "idle" state and as
// a fallback when audit rows haven't fired yet.
// ---------------------------------------------------------------------------

const AGENT_TITLES: Record<string, string> = {
  visa_specialist: "Visa Specialist",
  tax_strategist: "Tax Strategist",
  cost_specialist: "Cost Specialist",
  housing_specialist: "Housing Specialist",
  cultural_adapter: "Cultural Adapter",
  documents_specialist: "Documents Specialist",
  healthcare_navigator: "Healthcare Navigator",
  banking_helper: "Banking Helper",
  schools_specialist: "Schools Specialist",
  pet_specialist: "Pet Specialist",
  posted_worker_specialist: "Posted Worker Specialist",
  digital_nomad_compliance: "Digital-Nomad Compliance",
  job_compliance_specialist: "Job-Compliance Specialist",
  family_reunion_specialist: "Family-Reunion Specialist",
  departure_tax_specialist: "Departure-Tax Specialist",
  vehicle_import_specialist: "Vehicle-Import Specialist",
  property_purchase_specialist: "Property-Purchase Specialist",
  trailing_spouse_career_specialist: "Trailing-Spouse Career Specialist",
  pension_continuity_specialist: "Pension-Continuity Specialist",
};

export function getAgentTitle(name: string): string {
  return AGENT_TITLES[name] ?? name.replace(/_/g, " ");
}

// ---------------------------------------------------------------------------
// kickoffResearch — the public entry point
// ---------------------------------------------------------------------------

export interface KickoffResearchArgs {
  profileId: string;
  profile: Profile;
  /**
   * Authenticated supabase client (RLS-scoped to the user). Used both
   * for audit-row writes and for the final relocation_plans update.
   */
  supabase: SupabaseClient;
  /**
   * Database row id of relocation_plans (for the finalize update).
   * profileId may differ from this — the audit rows key on profileId
   * but the DB row id is needed to update relocation_plans.
   */
  planId: string;
  /** Optional master timeout (default 90s for specialist batch). */
  specialistBudgetMs?: number;
}

export interface KickoffResearchResult {
  /** Snapshot of the run state immediately after kickoff. */
  snapshot: ResearchRunSnapshot;
  /** Promise that resolves when the run finishes (terminal status). */
  runPromise: Promise<void>;
  /** True if this kickoff was a no-op because a run was already in flight. */
  alreadyRunning: boolean;
}

export function kickoffResearch(
  args: KickoffResearchArgs,
): KickoffResearchResult {
  const { profileId, profile, supabase, planId } = args;

  // Idempotency: if a run is already in flight for this profile, return
  // the existing snapshot rather than starting a duplicate run.
  if (IN_FLIGHT.has(profileId)) {
    const existing = RUNS.get(profileId);
    if (existing) {
      return {
        snapshot: snapshot(existing),
        runPromise: Promise.resolve(),
        alreadyRunning: true,
      };
    }
  }

  const dispatch: DispatchDecision = decideDispatch(profile);

  // Initialize state with all dispatched agents in `idle`.
  const agents = new Map<string, AgentLiveState>();
  for (const s of dispatch.specialists) {
    agents.set(s.name, {
      name: s.name,
      status: "idle",
      currentActivity: "Waiting to start…",
    });
  }

  const state: ResearchRunState = {
    profileId,
    rationale: dispatch.rationale,
    agents,
    runStatus: "pending",
    startedAt: new Date().toISOString(),
    redispatchRoundsRun: 0,
  };
  RUNS.set(profileId, state);
  IN_FLIGHT.add(profileId);

  const baseWriter = createSupabaseLogWriter(supabase);
  const liveWriter = makeLiveLogWriter(profileId, baseWriter);

  const runPromise = runPipeline({
    profileId,
    planId,
    profile,
    supabase,
    dispatch,
    liveWriter,
    specialistBudgetMs: args.specialistBudgetMs ?? 90_000,
  })
    .catch((err) => {
      logger.error(
        { err, profileId },
        "[research-orchestrator] pipeline crashed",
      );
      const s = RUNS.get(profileId);
      if (s) {
        s.runStatus = "failed";
        s.errorMessage = err instanceof Error ? err.message : String(err);
        s.completedAt = new Date().toISOString();
        emit(profileId);
      }
    })
    .finally(() => {
      IN_FLIGHT.delete(profileId);
      evictAfterTTL(profileId);
    });

  // Move from pending → researching immediately so SSE clients see the
  // first transition right after subscription.
  state.runStatus = "researching";
  emit(profileId);

  return { snapshot: snapshot(state), runPromise, alreadyRunning: false };
}

// ---------------------------------------------------------------------------
// Pipeline body
// ---------------------------------------------------------------------------

interface RunPipelineArgs {
  profileId: string;
  planId: string;
  profile: Profile;
  supabase: SupabaseClient;
  dispatch: DispatchDecision;
  liveWriter: LogWriter;
  specialistBudgetMs: number;
}

async function runPipeline(args: RunPipelineArgs): Promise<void> {
  const { profileId, planId, profile, supabase, dispatch, liveWriter } = args;

  // Accumulate every successful specialist output across the initial
  // batch and any re-dispatch round so finalize() can build the
  // persisted card payloads from the full picture.
  const allOutputs: SynthesizerInput[] = [];

  // ---- 1. Run all specialists in parallel ---------------------------
  const specialistOutputs = await runSpecialistBatch({
    profileId,
    invocations: dispatch.specialists,
    liveWriter,
    budgetMs: args.specialistBudgetMs,
  });
  allOutputs.push(...specialistOutputs);

  // ---- 2. Synthesize ------------------------------------------------
  const state = RUNS.get(profileId);
  if (!state) return; // Should never happen — defensive.
  state.runStatus = "synthesizing";
  emit(profileId);

  let guide: UnifiedGuide;
  try {
    guide = await synthesize(specialistOutputs, {
      profileId,
      logWriter: liveWriter,
    });
  } catch (err) {
    // synthesize() is meant to never throw, but be defensive.
    logger.error({ err, profileId }, "[research-orchestrator] synthesize threw");
    guide = {
      sections: [],
      consistencyIssues: [],
      unresolvedIssues: [
        `Synthesizer crashed: ${err instanceof Error ? err.message : String(err)}`,
      ],
      wallClockMs: 0,
      tokensUsed: 0,
      modelUsed: "(crashed)",
    };
  }
  state.synth = {
    sectionCount: guide.sections.length,
    consistencyIssues: guide.consistencyIssues,
    unresolvedIssues: guide.unresolvedIssues,
    wallClockMs: guide.wallClockMs,
    tokensUsed: guide.tokensUsed,
    modelUsed: guide.modelUsed,
  };
  // Annotate each agent panel with its draft paragraphs from the unified
  // guide so the expandable details show "what this agent produced".
  for (const sec of guide.sections) {
    const live = state.agents.get(sec.key);
    if (live) {
      live.draftParagraphs = sec.paragraphs;
      // For agents that completed without a per-spec audit row (degraded),
      // fall back to citation count from the section.
      if (!live.sourceUrls && sec.citations.length > 0) {
        live.sourceUrls = sec.citations.map((c) => ({
          url: c.url,
          label: c.label,
          scraped: c.scraped,
        }));
      }
      // Brief 1-2 line summary = first paragraph trimmed.
      if (!live.summary && sec.paragraphs.length > 0) {
        const first = sec.paragraphs[0];
        live.summary = first.length > 240 ? first.slice(0, 237) + "…" : first;
      }
    }
  }
  emit(profileId);

  // ---- 3. Critique --------------------------------------------------
  state.runStatus = "critiquing";
  emit(profileId);

  let critic: CriticOutput;
  try {
    critic = await critique(
      profile as Record<string, string | number | null | undefined>,
      guide,
      { profileId, logWriter: liveWriter },
    );
  } catch (err) {
    logger.error({ err, profileId }, "[research-orchestrator] critique threw");
    critic = {
      gaps: [],
      weakClaims: [],
      missingForUserSituation: [],
      wallClockMs: 0,
      tokensUsed: 0,
      modelUsed: "(crashed)",
    };
  }
  state.critic = {
    gapCount: critic.gaps.length,
    weakClaimCount: critic.weakClaims.length,
    missingForUserCount: critic.missingForUserSituation.length,
    wallClockMs: critic.wallClockMs,
    tokensUsed: critic.tokensUsed,
    modelUsed: critic.modelUsed,
  };
  emit(profileId);

  // ---- 4. Optional re-dispatch (cap at 1 round) ---------------------
  const redispatchTargets = pickRedispatchTargets(
    critic,
    dispatch,
    profile,
  );
  if (redispatchTargets.length > 0 && state.redispatchRoundsRun < 1) {
    state.runStatus = "redispatching";
    state.redispatchRoundsRun = 1;
    // Add new panels for the re-dispatched specialists (or reset existing
    // ones if Critic asked to re-run an already-run specialist — shouldn't
    // happen because pickRedispatchTargets filters those out).
    for (const inv of redispatchTargets) {
      state.agents.set(inv.name, {
        name: inv.name,
        status: "idle",
        currentActivity: "Re-dispatched by Critic — waiting to start…",
        redispatched: true,
      });
    }
    emit(profileId);
    const redispatchOutputs = await runSpecialistBatch({
      profileId,
      invocations: redispatchTargets,
      liveWriter,
      budgetMs: args.specialistBudgetMs,
    });
    allOutputs.push(...redispatchOutputs);
  }

  // ---- 5. Finalize --------------------------------------------------
  await finalize({ supabase, planId, profileId, profile, outputs: allOutputs });
}

// ---------------------------------------------------------------------------
// Specialist batch runner (used both for the initial dispatch and the
// optional re-dispatch round).
// ---------------------------------------------------------------------------

interface RunBatchArgs {
  profileId: string;
  invocations: DispatchDecision["specialists"];
  liveWriter: LogWriter;
  budgetMs: number;
}

async function runSpecialistBatch(
  args: RunBatchArgs,
): Promise<SynthesizerInput[]> {
  const { profileId, invocations, liveWriter, budgetMs } = args;

  const masterController = new AbortController();
  const timer = setTimeout(
    () => masterController.abort(new Error("master-budget-exceeded")),
    budgetMs,
  );

  const ctx: SpecialistContext = {
    profileId,
    logWriter: liveWriter,
    signal: masterController.signal,
  };

  try {
    const settled = await Promise.allSettled(
      invocations.map(async (s) => {
        const fn = SPECIALIST_FNS[s.name];
        if (!fn) {
          throw new Error(
            `[research-orchestrator] No implementation for specialist '${s.name}'`,
          );
        }
        const out = await fn(s.inputs as SpecialistProfile, ctx);
        return { name: s.name, output: out };
      }),
    );

    const outputs: SynthesizerInput[] = [];
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      const inv = invocations[i];
      if (r.status === "fulfilled") {
        outputs.push(r.value);
      } else {
        const reason = r.reason instanceof Error ? r.reason.message : String(r.reason);
        logger.warn(
          { profileId, specialist: inv.name, reason },
          "[research-orchestrator] specialist rejected (Promise.allSettled)",
        );
        // Mark the panel as failed if it isn't already.
        const state = RUNS.get(profileId);
        const live = state?.agents.get(inv.name);
        if (live && live.status !== "complete") {
          live.status = "failed";
          live.currentActivity = `Failed — ${reason}`;
          live.errorMessage = reason;
          live.completedAt = new Date().toISOString();
          emit(profileId);
        }
      }
    }
    return outputs;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Critic gap → re-dispatch translation
// ---------------------------------------------------------------------------

function pickRedispatchTargets(
  critic: CriticOutput,
  initial: DispatchDecision,
  profile: Profile,
): DispatchDecision["specialists"] {
  const alreadyRun = new Set(initial.specialists.map((s) => s.name));
  const seen = new Set<string>();
  const targets: DispatchDecision["specialists"] = [];
  for (const gap of critic.gaps) {
    const name = gap.suggestedSpecialist?.trim();
    if (!name) continue;
    if (alreadyRun.has(name)) continue; // Don't re-run a specialist that already ran.
    if (seen.has(name)) continue;
    if (!SPECIALIST_FNS[name]) continue; // Unknown specialist name — skip.
    // Build the proper profile slice the specialist consumes, using the
    // single source of truth in coordinator.ts. Returns null when the
    // coordinator has no field-list registered for `name` — in which
    // case we skip rather than fall back to an empty slice (which would
    // force the specialist into quality="fallback").
    const inv = buildInvocation(profile, name);
    if (!inv) {
      logger.warn(
        { profileId: undefined, specialist: name },
        "[research-orchestrator] Critic suggested specialist with no registered input fields — skipping re-dispatch",
      );
      continue;
    }
    seen.add(name);
    targets.push(inv);
  }
  return targets;
}

// ---------------------------------------------------------------------------
// Finalize — update relocation_plans with terminal status + stage.
// ---------------------------------------------------------------------------

/**
 * Fetch ECB daily reference rates from Frankfurter using the user's
 * preferred_currency as base. Returns a map of currency code → rate
 * (multiplier). Falls back to USD-base if preferred_currency isn't
 * ECB-supported. Returns null on total failure (no network, etc.) so
 * the caller can persist `null` and let the dashboard fall through.
 */
async function fetchFxRatesForPlan(
  profile: Profile,
): Promise<{ base: string; rates: Record<string, number>; fetchedAt: string } | null> {
  const candidates: string[] = [];
  if (typeof profile.preferred_currency === "string" && profile.preferred_currency) {
    candidates.push(profile.preferred_currency.toUpperCase());
  }
  candidates.push("USD"); // hard fallback

  for (const base of candidates) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 8000);
      const res = await fetch(
        `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`,
        { signal: ctl.signal },
      );
      clearTimeout(t);
      if (!res.ok) {
        logger.warn(
          { base, status: res.status },
          "[research-orchestrator] FX fetch non-200, trying fallback",
        );
        continue;
      }
      const data = (await res.json()) as { base?: string; rates?: Record<string, number> };
      if (!data?.rates || typeof data.rates !== "object") continue;
      // Frankfurter never returns the base in `rates` — add it as 1.
      const rates = { ...data.rates, [base]: 1 };
      return { base, rates, fetchedAt: new Date().toISOString() };
    } catch (err) {
      logger.warn(
        { base, err },
        "[research-orchestrator] FX fetch errored, trying fallback",
      );
    }
  }
  return null;
}

async function finalize(args: {
  supabase: SupabaseClient;
  planId: string;
  profileId: string;
  profile: Profile;
  outputs: SynthesizerInput[];
}): Promise<void> {
  const state = RUNS.get(args.profileId);
  if (!state) return;

  // Compute terminal run status from per-agent states.
  let anyFailed = false;
  let allFailed = true;
  for (const live of state.agents.values()) {
    if (live.status === "failed") anyFailed = true;
    if (live.status === "complete") allFailed = false;
  }
  // If we have no panels at all (defensive), call it failed.
  if (state.agents.size === 0) allFailed = true;

  const finalStatus: RunStatus = allFailed
    ? "failed"
    : anyFailed
      ? "partial"
      : "completed";

  const now = new Date().toISOString();
  state.runStatus = finalStatus;
  state.completedAt = now;
  emit(args.profileId);

  // Build the per-card persisted payloads from the in-memory specialist
  // outputs. These map structurally to the JSON columns the dashboard
  // cards (`VisaResearchCard`, `LocalRequirementsCard`) read directly,
  // so they survive process restarts and are visible without SSE.
  let visaResearch: ReturnType<typeof buildVisaResearchPayload> | null = null;
  let localRequirementsResearch: ReturnType<typeof buildLocalRequirementsPayload> | null = null;
  if (finalStatus !== "failed") {
    try {
      visaResearch = buildVisaResearchPayload(args.outputs, args.profile);
    } catch (err) {
      logger.warn(
        { err, profileId: args.profileId },
        "[research-orchestrator] buildVisaResearchPayload failed (non-fatal)",
      );
    }
    try {
      localRequirementsResearch = buildLocalRequirementsPayload(args.outputs, args.profile);
    } catch (err) {
      logger.warn(
        { err, profileId: args.profileId },
        "[research-orchestrator] buildLocalRequirementsPayload failed (non-fatal)",
      );
    }
  }

  // Guard against silent persistence failure: if the visa specialist was
  // dispatched but no payload was produced (build threw, or specialist
  // returned malformed data), downgrade to "partial". Otherwise the user
  // would land on a "ready" plan with an empty visa card and no way to
  // re-trigger research.
  const visaSpecialistAttempted = args.outputs.some(
    (o) => o.name === "visa_specialist",
  );
  let effectiveStatus: RunStatus = finalStatus;
  if (effectiveStatus === "completed" && visaSpecialistAttempted && !visaResearch) {
    logger.warn(
      { profileId: args.profileId },
      "[research-orchestrator] visa_specialist ran but no visa_research payload built — downgrading status to partial",
    );
    effectiveStatus = "partial";
    state.runStatus = effectiveStatus;
  }

  // Persist a slim per-specialist payload alongside the existing visa /
  // local_requirements columns so the dashboard's "Tailored to your move"
  // cards (departure-tax, pet, banking, cultural, etc.) can render real
  // research instead of the "Coming soon" placeholder. Stored under
  // research_meta.specialists keyed by specialist name.
  const specialistsByName: Record<string, unknown> = {};
  for (const item of args.outputs) {
    const out = item.output;
    // Hard word-cap each paragraph at 200 words at sentence boundary so
    // chatty LLM output never blows past the prompt's 180-word target.
    // Trims at the last complete sentence that fits — never mid-sentence.
    const cappedParagraphs = trimParagraphsToWordCap(out.contentParagraphs ?? [], 200);
    specialistsByName[item.name] = {
      contentParagraphs: cappedParagraphs,
      citations: out.citations ?? [],
      domainSpecificData: out.domainSpecificData ?? {},
      quality: out.quality,
      retrievedAt: out.retrievedAt,
      fallbackReason: out.fallbackReason,
    };
  }

  // Bake FX rates against the user's preferred_currency into the plan
  // so the dashboard can convert any cost-of-living / budget number
  // without round-tripping the live FX API. Single fetch from
  // Frankfurter (ECB daily rates) — gracefully degrades to null if the
  // call fails or the user's currency isn't ECB-supported.
  const fxRates = await fetchFxRatesForPlan(args.profile);

  // Persist to relocation_plans. Only advance the stage on a fully clean
  // run — partial runs leave the user on the research stage so they can
  // re-trigger and fill in missing pieces (esp. visa).
  const { data: priorPlan } = await args.supabase
    .from("relocation_plans")
    .select("research_meta")
    .eq("id", args.planId)
    .maybeSingle<{ research_meta: Record<string, unknown> | null }>();
  const updates: Record<string, unknown> = {
    research_status: effectiveStatus === "failed" ? "failed" : effectiveStatus,
    research_completed_at: now,
    updated_at: now,
    research_meta: {
      ...(priorPlan?.research_meta ?? {}),
      specialists: specialistsByName,
      ...(fxRates ? { fx_rates: fxRates } : {}),
    },
  };
  if (visaResearch) updates.visa_research = visaResearch;
  if (localRequirementsResearch) updates.local_requirements_research = localRequirementsResearch;
  if (effectiveStatus === "completed") {
    updates.stage = "ready_for_pre_departure";
  }
  const { data: planRow, error } = await args.supabase
    .from("relocation_plans")
    .update(updates)
    .eq("id", args.planId)
    .select("user_id")
    .single();
  if (error) {
    logger.error(
      { err: error, planId: args.planId, profileId: args.profileId },
      "[research-orchestrator] failed to update relocation_plans on finalize",
    );
    // Don't crash the run — the in-memory state already reflects the
    // terminal status; the SSE client will show completion. The DB write
    // can be reconciled by a re-trigger or a background job.
  }

  // Guide composition retired — the live state-driven workspaces
  // (Immigration / Pre-move / Post-move / Documents / Plan & Guidance)
  // replace the generated-PDF-style guide. Specialist outputs still
  // populate research_meta.specialists.* for those sections to consume.
  void planRow;
  void effectiveStatus;
}
