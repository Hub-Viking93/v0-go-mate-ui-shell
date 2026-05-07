// =============================================================
// @workspace/agents — specialists barrel
// =============================================================
// Re-exports the 6 always-run specialists + the 13 conditional
// specialists, plus the shared types/helpers callers need to wire
// them up. The dispatch coordinator in artifacts/api-server consumes
// these via `import { ... } from "@workspace/agents"`.
// =============================================================

export {
  type Citation,
  type PriorSpecialistOutputs,
  type SpecialistContext,
  type SpecialistOutput,
  type SpecialistProfile,
  type SpecialistQuality,
} from "./types.js";

export { runSpecialist, SPECIALIST_BUDGET_MS } from "./_base.js";
export { trimParagraphToWordCap, trimParagraphsToWordCap } from "./_prompt-helpers.js";

// Always-run (Wave 2.x)
export { visaSpecialist } from "./visa.js";
export { taxSpecialist } from "./tax.js";
export { costSpecialist } from "./cost.js";
export { housingSpecialist } from "./housing.js";
export { culturalSpecialist } from "./cultural.js";
export { documentsSpecialist } from "./documents.js";

// Conditional (Wave 2.y)
export { schoolsSpecialist } from "./schools.js";
export { studyProgramSpecialist } from "./study_program.js";
export { healthcareSpecialist } from "./healthcare.js";
export { bankingSpecialist } from "./banking.js";
export { petSpecialist } from "./pet.js";
export { postedWorkerSpecialist } from "./posted_worker.js";
export { digitalNomadComplianceSpecialist } from "./digital_nomad_compliance.js";
export { jobComplianceSpecialist } from "./job_compliance.js";
export { familyReunionSpecialist } from "./family_reunion.js";
export { departureTaxSpecialist } from "./departure_tax.js";
export { vehicleImportSpecialist } from "./vehicle_import.js";
export { propertyPurchaseSpecialist } from "./property_purchase.js";
export { trailingSpouseCareerSpecialist } from "./trailing_spouse_career.js";
export { pensionContinuitySpecialist } from "./pension_continuity.js";

// Phase B1 — researched-contract specialists. Return ResearchedSteps
// under _contracts.ts (not legacy SpecialistOutput). Audit logging
// is built into the specialist body and fires when input.profileId +
// input.logWriter are both provided.
export { registrationSpecialist } from "./registration.js";
export { bankingSpecialistV2 } from "./banking_v2.js";

// Phase B2 — researched-contract specialists for documents + housing.
// Same contract + hardening as B1.
export { documentsSpecialistV2 } from "./documents_v2.js";
export { housingSpecialistV2 } from "./housing_v2.js";

// Phase B3 — researched-contract specialist for healthcare.
// Same contract + hardening as B1/B2. Will be wired into the post-move
// researched cache by Phase C2 (mirroring how registration + banking
// landed in C1).
export { healthcareSpecialistV2 } from "./healthcare_v2.js";

export {
  scrapeOfficialSource,
  searchAndScrape,
  type ScrapeResult,
  type SearchAndScrapeResult,
} from "../scraping/firecrawl.js";

export { getAllSources, COUNTRY_DATA } from "../sources/index.js";
