import { runSectionWriter, type SectionContent, type SpecialistInputForWriter, type SectionWriterOptions } from "./_base.js";

const GUIDANCE = [
  "Focus area: JOB MARKET (only included when purpose is 'work').",
  "Cover the labor-market outlook for the user's job_field, networking platforms (LinkedIn presence in the destination, local equivalents like XING in DACH or Reka in Hungary), realistic salary norms with currency, employment-contract structure (probation periods, notice, 13th-month, mandatory benefits), and union / sector-agreement considerations. Cite the national statistics agency for salary data + the platforms named.",
].join("\n");

export async function writeJobsSection(
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options?: SectionWriterOptions,
): Promise<SectionContent> {
  return runSectionWriter("section_writer_jobs", "Jobs & labor market", GUIDANCE, profile, specialistOutput, options);
}
