import { runSectionWriter, type SectionContent, type SpecialistInputForWriter, type SectionWriterOptions } from "./_base.js";

const GUIDANCE = [
  "Focus area: CULTURE & WORKING LIFE.",
  "Cover the social etiquette that surprises newcomers from the user's origin (greeting norms, punctuality expectations, directness levels, drinking culture, fika / aperitivo / Feierabend), the working culture (hierarchy, meeting style, email vs chat, parental leave norms, vacation expectations), dining culture (tipping, table manners, paying), and origin-pair-specific gotchas (e.g., 'Filipino warmth meets Swedish reserve — how to read silence as comfort, not rejection'). Cite respected cultural sources (Hofstede, Country Reports, expat associations).",
].join("\n");

export async function writeCultureSection(
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options?: SectionWriterOptions,
): Promise<SectionContent> {
  return runSectionWriter("section_writer_culture", "Culture & daily life", GUIDANCE, profile, specialistOutput, options);
}
