import { runSectionWriter, type SectionContent, type SpecialistInputForWriter, type SectionWriterOptions } from "./_base.js";

const GUIDANCE = [
  "Focus area: POSTED-WORKER COMPLIANCE (only when posting_or_secondment is 'yes').",
  "Cover the A1 certificate process (origin-country social-security authority — Försäkringskassan, DRV, URSSAF — issuance time, max 24 months in EU), the Posted Worker Declaration filing in the destination (Arbetsmiljöverket SE, ZOLL DE, SIPSI FR — pre-arrival deadline), the employer's local-registration obligations, the social-security continuity rule (CoC for non-EU bilateral treaties — US, India, Korea, Japan), and the consequences of missing each filing. Cite the EU posted-worker portal + each named authority.",
].join("\n");

export async function writePostedWorkerSection(
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options?: SectionWriterOptions,
): Promise<SectionContent> {
  return runSectionWriter("section_writer_posted_worker", "Posted-worker compliance", GUIDANCE, profile, specialistOutput, options);
}
