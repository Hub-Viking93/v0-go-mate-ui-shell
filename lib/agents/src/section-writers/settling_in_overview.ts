import { runSectionWriter, type SectionContent, type SpecialistInputForWriter, type SectionWriterOptions } from "./_base.js";

const GUIDANCE = [
  "Focus area: SETTLING-IN OVERVIEW.",
  "Write the prose that frames the post-arrival task graph. Cover the canonical first-week sequence (population registration to get the personal-ID number → bank account → digital ID → healthcare registration → school registration if children → utilities), the dependency chain (you cannot do step N until step N-1 is done — explain why), the realistic timeline (some authorities take 2-4 weeks to mail back the ID number), and a brief note on how the dashboard's task graph tracks blockers. Cite the population registration authority + the digital-ID authority.",
].join("\n");

export async function writeSettlingInOverviewSection(
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options?: SectionWriterOptions,
): Promise<SectionContent> {
  return runSectionWriter("section_writer_settling_in_overview", "Settling-in overview", GUIDANCE, profile, specialistOutput, options);
}
