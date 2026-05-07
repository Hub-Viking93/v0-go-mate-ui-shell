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
export { getDateContext, getDateContextLine, type DateContext } from "./date-context.js";

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
  studyProgramSpecialist,
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
  trimParagraphToWordCap,
  trimParagraphsToWordCap,
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

// Phase 1B — task walkthrough shape (used by both pre-departure + settling-in).
// Phase 1C — structured action-link model (TaskActionLink) lives in the same
// module since it's authored alongside walkthroughs.
// Phase 2B — DocumentCategory + task-ref helpers for vault↔task linkage.
// Phase 2C — ProofGuidance + per-category prep rules.
export {
  hasWalkthroughContent,
  pickPrimaryLink,
  taskRefKey,
  parseTaskRefKey,
  type TaskWalkthrough,
  type WalkthroughStep,
  type TaskActionLink,
  type TaskActionLinkType,
  type DocumentCategory,
  type TaskOrigin,
  type ProofGuidance,
  type ProofGoal,
  type AcceptableEvidence,
} from "./walkthrough.js";

export {
  DOCUMENT_PREP_GUIDANCE,
  type DocumentPrepGuidance,
} from "./document-prep.js";

// Phase 4D — cultural orientation layer.
export {
  deriveOrientation,
  type OrientationReport,
  type OrientationInputs,
  type OrientationProfileInputs,
  type OrientationTopic,
  type OrientationCategory,
  type OrientationPhase,
  type OrientationTakeaway,
  type TakeawayKind,
} from "./orientation.js";

// Phase 6D — rule-change monitoring.
export {
  deriveRuleChanges,
  listAuthoredRuleChanges,
  type RuleChange,
  type RuleChangeRelevant,
  type RuleChangeReport,
  type RuleChangeInputs,
  type RuleChangeProfileInputs,
  type RuleChangeVisaInputs,
  type RuleChangeAck,
  type RuleChangeAckStatus,
  type RuleChangeRecommendedAction,
  type RuleChangeRecommendedActionKind,
  type RuleChangeImpactSeverity,
  type RuleChangeAreaKind,
  type RuleChangeSource,
  type RuleChangeSourceKind,
} from "./rule-changes.js";

// Phase 6C — tax overview layer.
export {
  deriveTaxOverview,
  type TaxOverviewReport,
  type TaxOverviewInputs,
  type TaxProfileInputs,
  type TaxRegimeProfile,
  type TaxCheckpoint,
  type CheckpointTiming,
  type CheckpointKind,
  type TaxWatchout,
  type WatchoutSeverity,
  type WatchoutKind,
  type TaxNextStep,
  type TaxNextStepKind,
} from "./tax-overview.js";

// Phase 6A — notifications layer.
export {
  computeNotifications,
  mergeNotifications,
  countNotifications,
  type Notification,
  type NotificationStored,
  type NotificationInputs,
  type NotificationProfileInputs,
  type NotificationTaskInput,
  type NotificationDocumentInput,
  type NotificationRiskInput,
  type NotificationType,
  type NotificationSeverity,
  type NotificationChannel,
  type NotificationStatus,
  type NotificationDeliveryRecord,
  type NotificationTargetRef,
  type NotificationCounts,
  type MergeResult as NotificationMergeResult,
} from "./notifications.js";

// Phase 5C — pet relocation layer.
export {
  derivePetRelocation,
  type PetRelocationReport,
  type PetRelocationInputs,
  type PetProfileInputs,
  type PetRelocationDirection,
  type PetSummary,
  type MicrochipStatus,
  type VaccinationStatus,
  type GuidanceUrgency as PetGuidanceUrgency,
  type DestinationRuleProfile,
  type TransportMode,
  type MicrochipGuidance,
  type VaccinationGuidance,
  type ImportRuleGuidance,
  type TransportGuidance,
  type TimelinePhase as PetTimelinePhase,
  type TimelinePhaseKey as PetTimelinePhaseKey,
} from "./pet-relocation.js";

// Phase 5B — departure / repatriation flow.
export {
  deriveDepartureFlow,
  WHEN_RANK,
  type DepartureFlowReport,
  type DepartureFlowInputs,
  type DepartureProfileInputs,
  type DepartureDirection,
  type DepartureTiming,
  type DepartureUrgency,
  type TimingMilestone as DepartureTimingMilestone,
  type CancelItem,
  type CancelCategory,
  type DeregisterItem,
  type DeregisterCategory,
  type BelongingsCategory,
  type BelongingsAction,
  type WhenToAct,
} from "./departure-flow.js";

// Phase 5A — housing support layer.
export {
  deriveHousingSupport,
  type HousingSupportReport,
  type HousingSupportInputs,
  type HousingProfileInputs,
  type SearchGuidance,
  type SearchSourceCategory,
  type PriceExpectations,
  type PriceBand,
  type BudgetAmount,
  type BudgetVerdict,
  type Currency,
  type ProcessStep,
  type ScamWarning,
  type ScamSeverity,
  type TimingGuidance,
  type TimingMilestone,
  type TimingUrgency,
} from "./housing-support.js";

// Phase 4C — driver's licence + insurance guidance.
export {
  deriveLicenseAndInsuranceGuidance,
  deriveDriversLicenseGuidance,
  deriveInsuranceGuidance,
  type Phase4cReport,
  type Phase4cInputs,
  type Phase4cProfileInputs,
  type Phase4cSettlingTask,
  type DriversLicenseGuidance,
  type InsuranceGuidance,
  type InsuranceItem,
  type GuidanceUrgency,
  type LicenceStatus,
} from "./phase4c-guidance.js";

// Phase 4B — banking + healthcare setup flows.
export {
  deriveFlows,
  type Flow,
  type FlowsReport,
  type FlowKey,
  type FlowStatus,
  type FlowStep,
  type FlowStepStatus,
  type FlowInputs,
  type FlowProfileInputs,
  type FlowSettlingTask,
} from "./flows.js";

// Phase 4A — arrival playbook (First 72h + First 30d).
export {
  deriveArrivalPlaybook,
  buildFirst72Hours,
  buildFirst30Days,
  type ArrivalPlaybook,
  type PlaybookItem,
  type PlaybookItemStatus,
  type PlaybookPhase,
  type PlaybookInputs,
  type PlaybookProfileInputs,
  type PlaybookSettlingTask,
} from "./arrival-playbook.js";

// Phase 3C — pathway plan + Plan B + denied/delayed scenario guidance.
export {
  derivePathwayPlan,
  deriveWorkPrimary,
  deriveStudyPrimary,
  deriveDigitalNomadPrimary,
  deriveSettlePrimary,
  deriveWorkAlternatives,
  deriveStudyAlternatives,
  deriveDigitalNomadAlternatives,
  deriveSettleAlternatives,
  deriveScenarioGuidance,
  type PathwayPlan,
  type PrimaryPath,
  type AlternativePath,
  type ScenarioGuidance,
  type PathwayInputs,
  type PathwayProfileInputs,
  type PathwayVisaInputs,
  type PathwayVaultInputs,
  type PurposeKey,
} from "./pathways.js";

// Phase 3B — risks + blockers.
export {
  deriveRisks,
  deriveVisaRisks,
  deriveMoneyRisks,
  deriveDocumentRisks,
  deriveTimingRisks,
  deriveSpecialCircumstanceRisks,
  type Risk,
  type RiskReport,
  type RiskInputs,
  type RiskOpenTask,
  type RiskProfileInputs,
  type RiskVisaInputs,
  type RiskVaultInputs,
  type RiskDomain,
  type RiskSeverity,
} from "./risks.js";

// Phase 3A — readiness model.
export {
  deriveReadiness,
  deriveVisaReadiness,
  deriveMoneyReadiness,
  deriveDocumentReadiness,
  deriveMoveReadiness,
  detectFreeMovement,
  type ReadinessLevel,
  type ReadinessDomain,
  type ReadinessSignal,
  type ReadinessReport,
  type ReadinessInputs,
  type ReadinessProfileInputs,
  type ReadinessVisaInputs,
  type ReadinessVaultInputs,
  type ReadinessTaskInputs,
} from "./readiness.js";

// Phase 1A — unified deadline + urgency model.
export {
  computeDueAt,
  computeUrgency,
  daysUntil,
  compareByUrgency,
  inferDeadlineTypeFromConsequence,
  urgencyBadgeLabel,
  URGENCY_RANK,
  type DeadlineType,
  type DeadlineRule,
  type DeadlineRelativeTo,
  type DeadlineRefDates,
  type Urgency,
} from "./deadline-model.js";

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
