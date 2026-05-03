// =============================================================
// @workspace/agents — sources barrel
// =============================================================
// Re-exports the verbatim official-sources moat and the
// COUNTRY_DATA seed for downstream specialists.
// =============================================================

export {
  EMBASSY_PATTERNS,
  getOfficialSources,
  getOfficialSourcesArray,
  type CountrySources,
  type EmbassyPattern,
  type OfficialSource,
  type CountryOfficialSources,
} from "./official-sources.js";

export {
  getAllSources,
  getSourceUrl,
} from "./official-sources.js";

export { COUNTRY_DATA } from "./country-data.js";
