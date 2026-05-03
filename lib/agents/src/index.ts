export const AGENTS_PACKAGE_VERSION = "0.0.0-wave2.3";

export type AgentRole = "coordinator" | "specialist";

export {
  DEFAULT_AGENT_MODEL,
  EXTRACTOR_MODEL,
  HEALTH_PROBE_MODEL,
  type AgentModelId,
} from "./_kernel/models.js";

// Wave 1.5 — shared types
export type {
  AgentName,
  AgentPhase,
  ConfidenceLevel,
  AgentOutput,
  AgentRunContext,
  AgentInvocation,
  AgentGroup,
  AgentRunStatus,
  AgentRunLogRow,
  AgentAuditRow,
  LogWriter,
  AgentInvocationResult,
  AgentPipelineResult,
} from "./types.js";

// Wave 1.5 — model router + LLM caller
export {
  AGENT_MODEL_ROUTING,
  callLLM,
  type ModelId,
  type CallLLMOptions,
  type CallLLMResult,
} from "./router.js";

// Wave 1.5 — audit writer
export {
  writeAuditRow,
  type WriteAuditRowArgs,
  type WriteAuditRowOptions,
} from "./audit.js";

// Wave 1.5 — pipeline orchestrator
export {
  runAgentPipeline,
  type RunAgentPipelineArgs,
} from "./orchestrator.js";

// Wave 1.5 — Supabase adapter for the LogWriter interface
export { createSupabaseLogWriter } from "./log-writer-supabase.js";

// Wave 2.0 — intake-field registry (snapshot of profile-schema.ts)
export {
  ALL_FIELDS,
  FIELD_INFO,
  type AllFieldKey,
  type FieldType,
  type FieldConfig,
} from "./intake-fields.js";

// Wave 2.0 — Extractor agent
export {
  extractField,
  type ExtractionResult,
  type ExtractionConfidence,
  type ExtractFieldOptions,
} from "./extractor.js";

// Wave 2.1 — country/city normalizer (snapshot of country-name-normalizer.ts)
export {
  normalizeCountryName,
  normalizeCityName,
} from "./country-normalizer.js";

// Wave 2.1 — Validator agent (pure code, no LLM)
export { validate, type ValidationResult } from "./validator.js";
export {
  getValidationRule,
  type ValidationRule,
} from "./validation-rules.js";

// Wave 2.1 — Profile Writer agent (pure code, no LLM)
export {
  writeProfileField,
  type WriteProfileFieldOptions,
  type WriteProfileFieldResult,
} from "./profile-writer.js";
export {
  createSupabaseProfileStore,
  singleFieldPatch,
  type ProfileStore,
} from "./profile-store.js";

// Wave 2.2 — Question Director agent (Sonnet 4.6, warm conversational)
export {
  askNext,
  type AskNextOptions,
  type QuestionDirectorOutput,
  type AnimationCue,
  type Profile as QuestionDirectorProfile,
  type Message as QuestionDirectorMessage,
} from "./question-director.js";

// Wave 2.x — 6 always-run specialists (visa, tax, cost, housing,
// cultural, documents) + Wave 2.y 13 conditional specialists +
// scraping wrapper + sources moat.
export {
  // Always-run
  visaSpecialist,
  taxSpecialist,
  costSpecialist,
  housingSpecialist,
  culturalSpecialist,
  documentsSpecialist,
  // Conditional
  schoolsSpecialist,
  healthcareSpecialist,
  bankingSpecialist,
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
  // Infra
  runSpecialist,
  SPECIALIST_BUDGET_MS,
  scrapeOfficialSource,
  searchAndScrape,
  getAllSources,
  COUNTRY_DATA,
  type Citation,
  type PriorSpecialistOutputs,
  type SpecialistContext,
  type SpecialistOutput,
  type SpecialistProfile,
  type SpecialistQuality,
  type ScrapeResult,
  type SearchAndScrapeResult,
} from "./specialists/index.js";

// Wave 2.x Prompt 3.4 — Synthesizer + Critic
export {
  synthesize,
  type UnifiedGuide,
  type SynthesizerSection,
  type SynthesizerInput,
  type SynthesizerContext,
} from "./synthesizer.js";
export {
  critique,
  type CriticOutput,
  type CriticGap,
  type CriticWeakClaim,
  type CriticContext,
  type CriticProfile,
} from "./critic.js";

// Re-exported for the api-server cost-of-living route — gives the UI a
// consistent NumbeoData shape even when no real per-city scrape is
// available. See artifacts/api-server/src/routes/cost-of-living.ts.
export {
  getGenericFallbackData,
  type NumbeoData,
} from "./research-helpers/numbeo-data.js";

// Phase 7 — settling-in DAG generator (pure code).
export {
  generateSettlingInDAG,
  type SettlingInProfile,
  type SettlingTask,
  type SettlingTaskGroup,
  type SettlingDAGResult,
  type SettlingDomain,
  type SettlingTaskStatus,
} from "./settling-in.js";

// Phase 5.1 — pre-departure timeline lib (pure code).
export {
  generatePreDepartureTimeline,
  type PreDepartureTimeline,
  type PreDepartureAction,
  type PreDepartureProfile,
  type PreDepartureSpecialistOutput,
  type VisaPathwayLite,
  type ActionStatus,
} from "./pre-departure.js";

// Wave 6 — Guide Composer + section writers.
export {
  composeGuide,
  pickSectionsForProfile,
  COMPOSER_AGENT,
  type ComposedGuide,
  type GuideSection,
  type GuideSectionKey,
  type GuideCitation,
  type SpecialistInputs,
  type ComposeGuideOptions,
} from "./guide-composer.js";
export {
  writeVisaSection,
  writeBudgetSection,
  writeHousingSection,
  writeBankingSection,
  writeHealthcareSection,
  writeCultureSection,
  writeJobsSection,
  writeEducationSection,
  writeDocumentsSection,
  writePostedWorkerSection,
  writePreDepartureOverviewSection,
  writeSettlingInOverviewSection,
  type SectionContent,
  type SectionCitation,
  type SpecialistInputForWriter,
  type SectionWriterOptions,
} from "./section-writers/index.js";
