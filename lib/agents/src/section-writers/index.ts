// =============================================================
// @workspace/agents — section-writers barrel
// =============================================================
// One re-export per section so the composer can wire them up by
// section key without per-import boilerplate.
// =============================================================

export { writeVisaSection } from "./visa.js";
export { writeBudgetSection } from "./budget.js";
export { writeHousingSection } from "./housing.js";
export { writeBankingSection } from "./banking.js";
export { writeHealthcareSection } from "./healthcare.js";
export { writeCultureSection } from "./culture.js";
export { writeJobsSection } from "./jobs.js";
export { writeEducationSection } from "./education.js";
export { writeDocumentsSection } from "./documents.js";
export { writePostedWorkerSection } from "./posted_worker.js";
export { writePreDepartureOverviewSection } from "./pre_departure_overview.js";
export { writeSettlingInOverviewSection } from "./settling_in_overview.js";

export type {
  SectionContent,
  SectionCitation,
  SpecialistInputForWriter,
  SectionWriterOptions,
} from "./_base.js";
