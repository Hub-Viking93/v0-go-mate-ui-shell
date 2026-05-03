import { runSectionWriter, type SectionContent, type SpecialistInputForWriter, type SectionWriterOptions } from "./_base.js";

const GUIDANCE = [
  "Focus area: DOCUMENT PIPELINE.",
  "Cover the exact list of documents the destination's immigration authority requires for this profile's visa pathway, the apostille chain (which documents need an apostille, what authority issues it in the user's origin country, current cost and turnaround), the certified-translation requirement (which target language, sworn-translator vs apostille-translator), and the submission portal (eForm name, embassy walk-in vs online submission). Cite the immigration authority's checklist URL + the apostille issuing authority.",
].join("\n");

export async function writeDocumentsSection(
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options?: SectionWriterOptions,
): Promise<SectionContent> {
  return runSectionWriter("section_writer_documents", "Document pipeline", GUIDANCE, profile, specialistOutput, options);
}
