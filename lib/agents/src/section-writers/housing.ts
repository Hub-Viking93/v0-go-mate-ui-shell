import { runSectionWriter, type SectionContent, type SpecialistInputForWriter, type SectionWriterOptions } from "./_base.js";

const GUIDANCE = [
  "Focus area: HOUSING.",
  "Cover the rental-market overview (first-hand vs second-hand, queue systems, how far in advance to search), neighborhood orientation for the target city, deposit norms (months of rent, escrow rules), the contract review checklist (notice periods, utilities included, sublet rules), and the local rental platforms with URLs (Hemnet, Blocket, ImmobilienScout24, Idealista, etc.). Cite the official rental authority + the platforms used.",
].join("\n");

export async function writeHousingSection(
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options?: SectionWriterOptions,
): Promise<SectionContent> {
  return runSectionWriter("section_writer_housing", "Housing", GUIDANCE, profile, specialistOutput, options);
}
