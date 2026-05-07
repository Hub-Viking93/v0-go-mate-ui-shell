/**
 * Frontend mirror of the Phase 2C document-prep guidance authored in
 * lib/agents/src/document-prep.ts. Cross-package imports from
 * @workspace/agents are not allowed in artifacts/gomate, so the prep
 * rules are duplicated here. Keep in sync.
 *
 * If you add a category to the canonical map in @workspace/agents, the
 * compiler will flag an exhaustiveness mismatch via DocumentCategory the
 * next time you reach for it from the frontend — at which point copy the
 * new entry over here.
 */

export type DocumentCategory =
  | "passport_id"
  | "visa_permit"
  | "education"
  | "employment"
  | "financial"
  | "housing"
  | "civil"
  | "health_insurance"
  | "pet"
  | "other";

export interface DocumentPrepGuidance {
  description?: string;
  preparationRules?: string[];
  commonMistakes?: string[];
  validity?: string;
  translationRule?: string;
  apostilleRule?: string;
  originalVsCopy?: string;
}

export const DOCUMENT_PREP_GUIDANCE: Record<DocumentCategory, DocumentPrepGuidance> = {
  passport_id: {
    description:
      "National passport or government-issued photo ID. The single most-used document in the entire relocation flow.",
    preparationRules: [
      "Bring the original. Most registration offices and banks reject a copy.",
      "Validity buffer: many destinations require the passport to stay valid for at least 6 months past your planned exit.",
      "Have a clean digital scan of the photo page on your phone — useful for fast-fill in online applications.",
      "If you have multiple passports, decide which one you'll use for the residence permit and stay consistent across all later tasks.",
    ],
    commonMistakes: [
      "Photo page scan only — many authorities want every visa-stamped page.",
      "Letting the passport expire mid-application: you'd typically need to re-file.",
      "Travelling internationally on a different passport than the one tied to your visa.",
    ],
    validity: "Usually needs to be valid 6+ months past your planned move/exit date.",
    originalVsCopy:
      "Original required at registration, banks, and visa pickup; certified copy occasionally accepted at HR onboarding.",
  },
  visa_permit: {
    description:
      "Visa decision letter, residence-permit card, or any document proving your right to enter and stay legally.",
    preparationRules: [
      "Keep BOTH the digital decision letter AND the physical card on you in the first weeks — different offices ask for different forms.",
      "Photograph the card front + back the day you collect it; store the scan in a separate cloud account from your phone.",
      "Note the card's expiry date on your calendar 90 days before — renewal in-country usually starts then.",
    ],
    commonMistakes: [
      "Uploading the visa sticker page only when authorities want the decision letter (and vice-versa).",
      "Letting the card expire while pre-occupied with day-to-day work — renewal grace periods are short.",
      "Travelling out of the country before the physical card arrives, when re-entry depends on it.",
    ],
    validity: "Card validity is fixed at issuance; renewal flows usually open 90 days before expiry.",
    originalVsCopy: "Authority pickup needs the original card; banks + employers usually accept a high-quality scan.",
  },
  education: {
    description:
      "Diplomas, transcripts, course-completion certificates, and language-proficiency results.",
    preparationRules: [
      "Get a fresh certified copy from your institution if your only original is older than 5 years — some authorities reject worn paper.",
      "Order an official transcript directly to the destination authority where possible; in-hand transcripts are sometimes treated as unofficial.",
      "If your degree is from a non-Hague country, plan for the legalisation chain (notary → ministry → embassy) — it adds 2-4 weeks.",
    ],
    commonMistakes: [
      "Submitting a translated diploma without the original attached.",
      "Forgetting that some skilled-worker visas only accept degrees from a recognised university list (e.g. Germany's anabin).",
      "Apostilling the diploma but not the transcript when both are required.",
    ],
    apostilleRule:
      "Apostille is usually required for skilled-worker, study, and family-reunion permits with non-EU origin documents.",
    translationRule:
      "Sworn / certified translation into the destination language (or English) is typically required if the diploma isn't already in one.",
  },
  employment: {
    description:
      "Employment contract, offer letter, payslips, HR confirmation, and reference letters.",
    preparationRules: [
      "Bring the SIGNED contract, not the offer letter — banks and tax authorities want the executed version.",
      "Have the last 3 months of payslips on file; some authorities ask for 6.",
      "An HR confirmation on company letterhead with your title, salary, and start date is the single most-requested supporting document.",
    ],
    commonMistakes: [
      "Submitting an unsigned contract — common rejection reason.",
      "Payslip in a foreign currency without a converted amount stated — adds a week of clarification.",
      "Reference letter without contact details for the HR signatory.",
    ],
    validity: "Payslips usually accepted if dated within the last 3 months; older requires fresh copies.",
  },
  financial: {
    description:
      "Bank statements, savings proof, sponsorship letters, and proof-of-funds for visa pathways with a financial threshold.",
    preparationRules: [
      "Pull a recent statement (≤30 days old). Same-currency as the destination is preferred but not always required.",
      "If a minimum balance is required, keep it stable for the period the pathway specifies — single-day spikes get flagged.",
      "Sponsor letters need the sponsor's ID + their own bank statement attached; an empty letter rarely counts.",
    ],
    commonMistakes: [
      "Showing a balance just barely above the threshold on the day of submission — many authorities want the balance to have been there for weeks.",
      "Statements from a brokerage or investment account without a separate liquid-cash statement.",
      "Forgetting to redact non-essential transactions; some embassies want full statements to verify income source.",
    ],
    validity: "Bank statements usually need to be issued within 30 days of submission.",
    translationRule:
      "Statements not in the destination language or English typically need a certified translation.",
  },
  housing: {
    description:
      "Lease agreement, sublet contract, hotel booking covering the relevant period, or a host invitation letter.",
    preparationRules: [
      "Lease should be in YOUR name. If you're a co-tenant, attach the master lease + your sublet contract.",
      "Lease term should cover at least the first 90 days post-arrival; short hotel-only stays get pushed back at registration.",
      "Have a copy of the landlord's signed move-in confirmation (Wohnungsgeberbestätigung in DE; landlord letter in SE).",
    ],
    commonMistakes: [
      "Hotel booking only, without a longer-term plan, when the authority wants ≥3 months residence.",
      "Lease signed but not yet started — registration offices want a start date that has already passed or starts within 14 days.",
      "Living-with-friends arrangement without a host letter; informal arrangements get rejected.",
    ],
    originalVsCopy:
      "Original signed lease usually accepted; printout of an e-signed contract is fine in most EU offices.",
  },
  civil: {
    description:
      "Birth certificate, marriage certificate, divorce decree, custody order, name-change records.",
    preparationRules: [
      "Order a FRESH certified copy — many authorities reject a birth certificate older than 6 months.",
      "Apostille (or full legalisation chain for non-Hague origin countries) is usually required for family-reunion + dependent permits.",
      "Get a sworn translation if the certificate isn't in the destination language or English.",
    ],
    commonMistakes: [
      "Apostilling a copy instead of the original — apostille is only valid on the original certificate.",
      "Submitting a marriage certificate without the apostille when sponsoring a spouse.",
      "Using a custody order from one parent only when both parents' consent is required.",
    ],
    apostilleRule:
      "Apostille required for family-reunion, dependent, and many spouse-of-citizen permits when the document is from a non-EU country.",
    translationRule:
      "Sworn translation usually required unless already in the destination language or English.",
    validity: "Re-issuance within the last 6 months is widely preferred over older copies.",
  },
  health_insurance: {
    description:
      "Health-insurance certificate or policy proof. Required by many visa pathways and during residence registration.",
    preparationRules: [
      "Coverage start date must precede your planned arrival — gaps cause registration delays.",
      "Minimum coverage levels vary by pathway: most EU permits require €30k+ medical, study permits often higher.",
      "If you're using employer-provided insurance, get a coverage letter on the insurer's letterhead, not just an HR email.",
    ],
    commonMistakes: [
      "Travel insurance presented as residence insurance — usually rejected because it has trip-length caps.",
      "Coverage that excludes pre-existing conditions when the pathway requires comprehensive cover.",
      "Auto-renew off — registration offices check the renewal date.",
    ],
    validity: "Coverage typically must extend at least 6 months past expected arrival.",
  },
  pet: {
    description:
      "Vet records, microchip ID, rabies certificate, EU pet passport, USDA / equivalent endorsed health certificate.",
    preparationRules: [
      "Microchip ID number must be on every other document — write it on the rabies cert if it's not there.",
      "21-day rabies wait must be visible: vaccination date stamped before the travel date by ≥21 days.",
      "EU pet passport is for EU origin; a USDA / equivalent endorsed certificate is for third-country origin.",
    ],
    commonMistakes: [
      "Rabies vaccination administered before the chip — the cert is invalid for EU travel.",
      "Travelling within the 21-day post-vaccination wait window.",
      "Carrying digital scans only — the airline gate agent usually wants paper originals.",
    ],
    validity: "Rabies booster typically valid for 1-3 years; check your card's expiry against the travel date.",
  },
  other: {
    description: "Anything that doesn't fit the named categories. Use sparingly.",
    preparationRules: [
      "If you find yourself uploading several files into 'Other', that's a hint to suggest a new category — let us know.",
    ],
  },
};
