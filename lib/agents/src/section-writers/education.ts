import { runSectionWriter, type SectionContent, type SpecialistInputForWriter, type SectionWriterOptions } from "./_base.js";

const GUIDANCE = [
  "Focus area: EDUCATION (included when purpose is 'study' OR there are children moving).",
  "Cover the school-system overview (public / private / international / bilingual), admission process and timing (deadlines that close 6+ months before move are the main risk), tuition / fee bands, language considerations for the children's level, recognition of foreign qualifications, and university admission for adult learners when relevant. Cite the national education ministry + at least one international-school directory.",
].join("\n");

export async function writeEducationSection(
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options?: SectionWriterOptions,
): Promise<SectionContent> {
  return runSectionWriter("section_writer_education", "Education", GUIDANCE, profile, specialistOutput, options);
}
