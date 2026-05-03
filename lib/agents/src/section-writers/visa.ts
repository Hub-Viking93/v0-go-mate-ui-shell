import { runSectionWriter, type SectionContent, type SpecialistInputForWriter, type SectionWriterOptions } from "./_base.js";

const GUIDANCE = [
  "Focus area: VISA & RESIDENCE PATHWAY.",
  "Cover the recommended visa type for this profile, the official local name (e.g., 'Uppehållstillstånd för anhöriga' for Sweden), the eligibility logic, the application steps in order, every supporting document the destination's immigration authority lists, and realistic processing times. Compare 1-2 alternative pathways briefly when relevant. Always cite the official immigration authority (Migrationsverket, Bundesamt für Migration, etc.).",
].join("\n");

export async function writeVisaSection(
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options?: SectionWriterOptions,
): Promise<SectionContent> {
  return runSectionWriter("section_writer_visa", "Visa pathway", GUIDANCE, profile, specialistOutput, options);
}
