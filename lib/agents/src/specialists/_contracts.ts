// =============================================================
// @workspace/agents — researched specialist output contracts
// =============================================================
// Phase 0 lock for the research-backed pipeline. New specialists
// (and old ones, when they are refactored in Phase A/C) MUST
// return shapes that conform to one of the two top-level types
// here:
//
//   • ResearchedSteps    — actionable domains
//                          (visa, documents, registration,
//                          banking, healthcare, pet, ...).
//                          Returns steps[] + documents[].
//   • ResearchedAdvisory — orientation / cultural / explanatory
//                          domains. Returns topics[].
//
// The two shapes are discriminated by `kind` so composers can
// narrow without instanceof.
//
// IMPORTANT — naming
// ------------------
// Existing types in ./types.ts (`SpecialistOutput`, `Citation`)
// describe the OLD content-paragraphs-style output that legacy
// specialists still return. They are intentionally NOT renamed.
// New code uses the names exported from this file
// (`ResearchedOutput`, `ResearchedSource`); old specialists keep
// using the legacy names until each is refactored in Phase A/C.
//
// Adding a new specialist
// -----------------------
//   1. Pick the closest shape — `ResearchedSteps` is the default
//      for action-producing domains; `ResearchedAdvisory` is for
//      orientation / cultural / explanatory domains.
//   2. If your domain genuinely doesn't fit either, add a new
//      shape here rather than drifting an existing one.
//
// Adding a field to an existing shape
// -----------------------------------
//   Make it optional. Composers may not yet be ready to read it.
//
// Renaming a field
// ----------------
//   Don't. Add the new name, deprecate the old in a follow-up.
//
// Document + step ids
// -------------------
//   RULE: every `DocumentRequirement.id` and `ResearchedStep.id`
//   MUST be domain-prefixed ("docs:police-clearance",
//   "registration:proof-of-address"). Composers de-dup by exact
//   id; cross-specialist overlap is by design.
//
// =============================================================

import type { LogWriter } from "../types.js";
import type { SpecialistProfile } from "./types.js";

// ---- Sources + quality ------------------------------------------------

export type SpecialistQuality = "full" | "partial" | "fallback";

export type SpecialistFallbackReason =
  | "no_sources_found"
  | "scrape_failed"
  | "llm_parse_failed"
  | "rate_limited"
  | "timeout"
  | "manual_skip";

/**
 * Source kind — describes what kind of source this URL is.
 * Trust / confidence is intentionally NOT modelled here; we'll add
 * a separate confidence field if we ever need it. Mixing source-
 * type and trust-level into one enum was the failure mode we
 * avoided in the v1 lock.
 */
export type SourceKind = "authority" | "institution" | "reference";

export interface ResearchedSource {
  /** Canonical URL — no fragments, no tracking params. */
  url: string;
  /** Bare host, no scheme/www. ("migrationsverket.se") */
  domain: string;
  title?: string;
  /** ISO 8601 UTC of the actual fetch. */
  retrievedAt: string;
  /** Authority = government / regulator / official agency.
   *  Institution = university / hospital / public-service operator.
   *  Reference = encyclopedia / explainer / aggregator. */
  kind: SourceKind;
}

// ---- Profile predicate -----------------------------------------------
//
// Structured, not natural language. Composers evaluate predicates
// against the user's profile in pure code (no LLM). Operators are
// deliberately kept small for v1; numeric / date comparators will
// be added when a composer demands one, not before.

export type ProfilePredicate =
  | { always: true }
  | { eq: { field: string; value: string | number | boolean } }
  | { in: { field: string; values: ReadonlyArray<string | number> } }
  | { set: { field: string } }
  | { unset: { field: string } }
  | { all: ProfilePredicate[] }
  | { any: ProfilePredicate[] }
  | { not: ProfilePredicate };

// ---- Time windows -----------------------------------------------------

export type DeadlinePhase =
  | "before_move"      // pre-departure
  | "move_day"
  | "first_72h"        // immediate post-arrival
  | "first_30d"
  | "first_90d"
  | "first_year_end"
  | "ongoing";

export interface DeadlineWindow {
  phase: DeadlinePhase;
  /** Pre-arrival steps: weeks before move-date when known. */
  weeksBeforeMove?: number;
  /** Post-arrival steps: days after arrival when known. */
  daysAfterArrival?: number;
  /**
   * Hard legal deadline if any (e.g. "must register within 14 days
   * of arrival").
   *
   * PRECEDENCE — composers MUST treat `legalDeadlineDays` as
   * authoritative when it is set, even if it conflicts with the
   * phase or with `weeksBeforeMove` / `daysAfterArrival`. The
   * phase remains the bucketing signal; the legal deadline is the
   * absolute ordering signal.
   */
  legalDeadlineDays?: number;
}

// ---- Document requirement --------------------------------------------

export type DocumentApostilleNeed = "needed" | "not_needed" | "varies";
export type DocumentTranslationNeed =
  | "needed"
  | "not_needed"
  | "destination_language_only"
  | "varies";

export type DocumentCategory =
  | "civil_status"      // birth, marriage
  | "education"         // diplomas, transcripts
  | "professional"      // employment letters, references, CV
  | "criminal"          // police clearance
  | "medical"
  | "financial"         // bank statements, tax returns, sponsor declaration
  | "identity"          // passport, residence card, biometric ID
  | "housing"           // lease, address proof
  | "other";

export interface DocumentRequirement {
  /**
   * Domain-namespaced id. RULE: must include the producing-domain
   * as a prefix ("docs:police-clearance",
   * "registration:proof-of-address"). Composers de-dup by exact id.
   */
  id: string;
  /** Short user-facing label. */
  label: string;
  category: DocumentCategory;
  apostille: DocumentApostilleNeed;
  translation: DocumentTranslationNeed;
  /** Estimated calendar days to obtain end-to-end. */
  leadTimeDays: number;
  /** URL refs into the parent output's sources[] (string-only for
   *  dedupe + payload size). */
  sources: string[];
}

// ---- Researched step (workhorse shape) -------------------------------

export interface ResearchedStep {
  /**
   * Domain-namespaced id. RULE: must include the producing-domain
   * as a prefix ("registration:population-register",
   * "banking:bankid-enrolment").
   */
  id: string;
  /** Short imperative title. */
  title: string;
  /** 1-2 sentence destination-aware description. */
  description: string;
  /** When the step is meaningful. Composers use this for phase gating. */
  deadlineWindow: DeadlineWindow;
  /** Conditional surfacing. Defaults to { always: true } when omitted. */
  appliesWhen: ProfilePredicate;
  /** Step ids that must be complete before this is actionable. */
  prerequisites: string[];
  /** Document ids referenced. Composers cross-resolve against
   *  the specialist's documents[] (or other specialists' docs by
   *  exact id match). */
  documentIds: string[];
  /**
   * Optional walkthrough — max 5 short bullets, no prose.
   *
   * UI-adjacent and non-authoritative. Composers MUST NOT depend
   * on walkthrough bullets existing; they are content for the
   * detail sheet, not data for sequencing or gating.
   */
  walkthrough?: string[];
  /** Common bottleneck or watch-out, when known. */
  bottleneck?: string;
  /** URL refs into the parent output's sources[] (string-only). */
  sources: string[];
}

// ---- Researched topic (advisory shape) -------------------------------

export interface ResearchedTopic {
  id: string;
  title: string;
  /** 1-3 short paragraphs, ≤200 words total. */
  body: string;
  /** Single sentence — why an outsider needs this. */
  whyItMatters: string;
  /** 3-5 bullets. */
  takeaways: string[];
  /** URL refs into the parent output's sources[] (string-only). */
  sources: string[];
}

// ---- Top-level output shapes -----------------------------------------

interface ResearchedOutputBase {
  domain: SpecialistDomain;
  /** ISO 8601 UTC. */
  retrievedAt: string;
  quality: SpecialistQuality;
  fallbackReason?: SpecialistFallbackReason;
  /** Every URL the specialist consulted. Per-step / per-doc
   *  attribution lives in their own `sources` arrays as URL refs. */
  sources: ResearchedSource[];
  /** One-line section description for the composer. No prose
   *  narrative — that's the synthesizer's job. */
  summary: string;
}

export interface ResearchedSteps extends ResearchedOutputBase {
  kind: "steps";
  steps: ResearchedStep[];
  documents: DocumentRequirement[];
  /**
   * Domain-specific escape hatch for structured facts that don't
   * fit steps[] / documents[] (e.g. typical rental deposit,
   * registration fee, tax-residency day count). Loosely typed
   * because each domain defines its own keys.
   *
   * Use sparingly. The main reusable contract is steps[] +
   * documents[]; this exists so we don't force every domain's
   * facts into a step that isn't really a step.
   */
  structuredFacts?: Record<string, unknown>;
}

export interface ResearchedAdvisory extends ResearchedOutputBase {
  kind: "advisory";
  topics: ResearchedTopic[];
}

export type ResearchedOutput = ResearchedSteps | ResearchedAdvisory;

// ---- Domain enum -----------------------------------------------------

export type SpecialistDomain =
  // Existing 10 (will be migrated to this contract in Phase A/C)
  | "visa"
  | "documents"
  | "tax"
  | "cost"
  | "housing"
  | "cultural"
  | "banking"
  | "healthcare"
  | "pet"
  | "departure_tax"
  // Phase B new specialists. local_proof was folded into
  // registration's documents[] (proof_of_address) — not its own
  // specialist.
  | "registration"
  | "transport_id";

// ---- Specialist function signature -----------------------------------

export interface ResearchedSpecialistInput {
  /** Same shape every legacy specialist receives today. */
  profile: SpecialistProfile;
  /** Wall-clock cap. Specialist enforces this end-to-end (scrape +
   *  LLM synthesis + parsing) via Promise.race; on timeout it
   *  returns ResearchedSteps with quality:"fallback" and
   *  fallbackReason:"timeout". */
  budgetMs: number;
  /**
   * Audit logging. When BOTH profileId and logWriter are provided,
   * the specialist writes an `agent_audit` row at synthesis end via
   * writeResearchedAudit. When either is missing the audit is
   * silently skipped — used by the dry-run harness.
   */
  profileId?: string;
  logWriter?: LogWriter;
  /**
   * Optional prior run's output for this domain.
   *
   * NOTE — Phase 0 rule: specialists must NOT silently short-
   * circuit based on their own freshness heuristics. Whether a
   * run is fresh / stale / partial-refresh is the orchestrator's
   * call. The cachedOutput field is provided so a specialist can
   * surface stable structured ids across runs (e.g. the same
   * step.id), not so it can decide on its own that there's
   * "nothing to do".
   */
  cachedOutput?: ResearchedOutput;
  /**
   * Optional prior outputs from other specialists in this run
   * (e.g. documents-specialist reads visa's recommendation).
   * Keyed by domain.
   */
  priorOutputs?: Partial<Record<SpecialistDomain, ResearchedOutput>>;
}

/** Every researched specialist exports a function with this signature. */
export type ResearchedSpecialistFn = (
  input: ResearchedSpecialistInput,
) => Promise<ResearchedOutput>;
