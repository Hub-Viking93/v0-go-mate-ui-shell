import { runSectionWriter, type SectionContent, type SpecialistInputForWriter, type SectionWriterOptions } from "./_base.js";

const GUIDANCE = [
  "Focus area: HEALTHCARE.",
  "Cover how the public system works for residents, the registration steps after arrival (Försäkringskassan, AOK, Carte Vitale, etc.), private/expat insurance options if relevant, finding English-speaking doctors (with platform names — Doctolib, Kry, Doctena), and prescription continuity for any chronic medications including which destinations restrict specific drugs. Cite the public health authority + each insurance/platform mentioned.",
].join("\n");

export async function writeHealthcareSection(
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options?: SectionWriterOptions,
): Promise<SectionContent> {
  return runSectionWriter("section_writer_healthcare", "Healthcare", GUIDANCE, profile, specialistOutput, options);
}
