import { runSectionWriter, type SectionContent, type SpecialistInputForWriter, type SectionWriterOptions } from "./_base.js";

const GUIDANCE = [
  "Focus area: BANKING & DIGITAL ID.",
  "Cover what's needed to open an account for this nationality (personnummer / steuerliche-IdNr / NIE / etc.), the most foreigner-friendly banks (with names — SEB, ICA, Deutsche Bank, BBVA, etc.), the digital-bank options (Wise, Revolut, N26 — local equivalents), and how to set up the country's BankID equivalent (BankID, Verimi, Cl@ve) which everything else depends on. Cite each bank's official onboarding page.",
].join("\n");

export async function writeBankingSection(
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options?: SectionWriterOptions,
): Promise<SectionContent> {
  return runSectionWriter("section_writer_banking", "Banking & digital ID", GUIDANCE, profile, specialistOutput, options);
}
