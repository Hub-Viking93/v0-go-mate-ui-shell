// =============================================================
// @workspace/agents — Wave 1.5 shared types
// =============================================================
// Pure type module. No runtime imports. Consumed by router.ts,
// audit.ts, orchestrator.ts, and the supabase log-writer adapter.
// =============================================================

export type ConfidenceLevel =
  | "explicit"
  | "inferred"
  | "assumed"
  | "full"
  | "partial"
  | "fallback";

export type AgentPhase =
  | "extraction"
  | "validation"
  | "research"
  | "enrichment"
  | "settling-in"
  | "chat"
  | "pre-departure";

// AgentName — the canonical union of every agent that may appear in the
// model-routing table or in an AgentInvocation. New agents must be added
// here AND to AGENT_MODEL_ROUTING in router.ts (the `satisfies` constraint
// in router.ts will fail typecheck otherwise).
export type AgentName =
  // ---- foundation (extraction / validation / chat router) ----
  | "extractor"
  | "validator"
  | "profile_writer"
  | "question_director"
  // ---- coordinators ----
  | "coordinator"
  | "settling_in_coordinator"
  | "pre_departure_coordinator"
  // ---- domain specialists ----
  | "visa_specialist"
  | "tax_strategist"
  | "cost_specialist"
  | "housing_specialist"
  | "schools_specialist"
  | "study_program_specialist"
  | "healthcare_navigator"
  | "banking_helper"
  | "documents_specialist"
  | "cultural_adapter"
  | "pet_specialist"
  | "posted_worker_specialist"
  | "digital_nomad_compliance"
  | "job_compliance_specialist"
  | "family_reunion_specialist"
  | "departure_tax_specialist"
  | "vehicle_import_specialist"
  | "property_purchase_specialist"
  | "trailing_spouse_career_specialist"
  | "pension_continuity_specialist"
  // ---- composition ----
  | "synthesizer"
  | "critic"
  | "guide_composer"
  // ---- guide section writers ----
  | "section_writer_visa"
  | "section_writer_budget"
  | "section_writer_housing"
  | "section_writer_banking"
  | "section_writer_healthcare"
  | "section_writer_culture"
  | "section_writer_jobs"
  | "section_writer_education"
  | "section_writer_documents"
  | "section_writer_posted_worker"
  | "section_writer_pre_departure_overview"
  | "section_writer_settling_in_overview"
  // ---- settling-in workers ----
  | "settling_in_registration"
  | "settling_in_banking"
  | "settling_in_housing"
  | "settling_in_healthcare"
  | "settling_in_employment"
  | "settling_in_transport"
  | "settling_in_family"
  | "settling_in_tax";

// ---- Per-invocation output shape ----
export interface AgentOutput<T = unknown> {
  content: T;
  confidence: ConfidenceLevel;
  source?: string;
  retrieved_at: string; // ISO 8601 UTC
  wall_clock_ms: number;
  tokens_used?: number;
}

// ---- Run context handed to every agent's `run` function ----
export interface AgentRunContext {
  profile_id: string;
  // forward-compat: callers may attach extra context (extracted profile,
  // current stage, parent run_id, etc). Agents should read defensively.
  [key: string]: unknown;
}

export interface AgentInvocation<T = unknown> {
  name: AgentName;
  phase: AgentPhase;
  run: (context: AgentRunContext) => Promise<AgentOutput<T>>;
  fallback?: () => AgentOutput<T>;
  retries?: number;
}

// Pipelines are ordered lists of groups. Sequential groups await each
// invocation in order. Parallel groups Promise.all them. Mix freely.
export type AgentGroup =
  | { mode: "sequential"; invocations: AgentInvocation[] }
  | { mode: "parallel"; invocations: AgentInvocation[] };

// =============================================================
// Persistence shapes — mirror the columns from migration 120400
// =============================================================

export type AgentRunStatus = "started" | "completed" | "failed" | "retry";

// Mirrors public.agent_run_log (Wave 1.4 schema).
export interface AgentRunLogRow {
  profile_id: string;
  agent_name: AgentName;
  phase: AgentPhase;
  status: AgentRunStatus;
  prompt_summary?: string | null;
  response_summary?: string | null;
  tools_called?: string[] | null;
  validation_passed?: boolean | null;
  retry_count?: number;
  tokens_used?: number | null;
  wall_clock_ms?: number | null;
  error_message?: string | null;
}

// Mirrors public.agent_audit (Wave 1.4 schema). prompt_hash and
// response_hash are SHA-256 hex strings produced by writeAuditRow.
export interface AgentAuditRow {
  profile_id: string;
  agent_name: AgentName;
  model_used?: string | null;
  phase: AgentPhase;
  field_or_output_key?: string | null;
  value?: unknown; // jsonb
  confidence?: ConfidenceLevel | null;
  source_user_message?: string | null;
  source_url?: string | null;
  prompt_hash?: string | null;
  response_hash?: string | null;
  validation_rules_applied?: unknown | null; // jsonb
  wall_clock_ms?: number | null;
  tokens_used?: number | null;
  retry_count?: number;
}

// Dependency-injected log writer. lib/agents/ never reaches into a
// concrete database; callers wire one in. The default Supabase adapter
// lives in log-writer-supabase.ts.
export interface LogWriter {
  insertRunLog(row: AgentRunLogRow): Promise<void>;
  insertAudit(row: AgentAuditRow): Promise<void>;
}

// ---- Pipeline result shapes ----
export interface AgentInvocationResult<T = unknown> {
  name: AgentName;
  phase: AgentPhase;
  status: "completed" | "failed" | "fallback";
  output?: AgentOutput<T>;
  error?: string;
  retries: number;
  wall_clock_ms: number;
}

export interface AgentPipelineResult {
  results: AgentInvocationResult[];
  total_wall_clock_ms: number;
}
