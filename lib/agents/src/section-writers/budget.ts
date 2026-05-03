import { runSectionWriter, type SectionContent, type SpecialistInputForWriter, type SectionWriterOptions } from "./_base.js";

const GUIDANCE = [
  "Focus area: BUDGET & COST OF LIVING.",
  "Cover realistic monthly cost ranges for the destination city (rent, utilities, groceries, transport, healthcare), a minimum vs comfortable budget tier sized to this household (single / couple / family), savings target before move (emergency fund + moving costs + visa fees + first-month deposits), and any salary thresholds the visa requires. Cite Numbeo / official statistics offices / immigration salary minimums where applicable.",
].join("\n");

export async function writeBudgetSection(
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options?: SectionWriterOptions,
): Promise<SectionContent> {
  return runSectionWriter("section_writer_budget", "Budget & cost of living", GUIDANCE, profile, specialistOutput, options);
}
