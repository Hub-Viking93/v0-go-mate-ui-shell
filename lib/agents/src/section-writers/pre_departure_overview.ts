import { runSectionWriter, type SectionContent, type SpecialistInputForWriter, type SectionWriterOptions } from "./_base.js";

const GUIDANCE = [
  "Focus area: PRE-DEPARTURE OVERVIEW.",
  "Write the prose that frames the pre-departure timeline. Cover the ordering logic (visa first → apostille chain in parallel → housing search closer to move date → flights & shipping last), the time pressure (apostille turnarounds in the user's origin country are the biggest constraint), the typical 'I forgot' items (origin-country lease termination notice, mail forwarding, pet vaccination buffer, prescription medication 90-day buffer), and a calm reassuring close. Cite at least the destination immigration authority + the origin-country apostille authority.",
].join("\n");

export async function writePreDepartureOverviewSection(
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options?: SectionWriterOptions,
): Promise<SectionContent> {
  return runSectionWriter("section_writer_pre_departure_overview", "Pre-departure overview", GUIDANCE, profile, specialistOutput, options);
}
