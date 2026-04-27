/**
 * Static visa-option fallback used by the visa-tracker route when live
 * research either failed or returned no options. The fallback is keyed by
 * (destination, purpose) and provides a credible-but-conservative list of
 * common visa pathways for that combination so the user-facing page is never
 * empty.
 *
 * These entries are intentionally hand-curated and prefer "verify with
 * official source" framing over precise numbers. The official_sources
 * library still supplies destination links.
 */

import type { NormalizedVisaOption, VisaResearchResult } from "./research-visa"
import { getAllSources, getSourceUrl } from "./official-sources"

type Purpose = "study" | "work" | "settle" | "digital_nomad" | "other"

interface FallbackVisaOption {
  name: string
  type: NormalizedVisaOption["type"]
  eligibility: NormalizedVisaOption["eligibility"]
  eligibilityReason: string
  requirements: string[]
  processingTime: string
  cost: string
  validity: string
  benefits: string[]
  limitations: string[]
}

// Destination keys are matched case-insensitively against profile.destination.
const FALLBACKS: Record<string, Partial<Record<Purpose, FallbackVisaOption[]>>> = {
  Japan: {
    study: [
      {
        name: "Student Visa (Ryugaku)",
        type: "student",
        eligibility: "high",
        eligibilityReason: "Standard route for university and language-school study, including those on a MEXT scholarship.",
        requirements: [
          "Certificate of Eligibility (CoE) issued by your Japanese institution",
          "Acceptance letter from a Japanese university or school",
          "Proof of funding (scholarship letter or bank statements)",
          "Valid passport with at least 6 months remaining",
        ],
        processingTime: "5–8 weeks after receiving the CoE",
        cost: "≈ JPY 3,000 (single-entry) / JPY 6,000 (multiple-entry)",
        validity: "1–4 years depending on programme length",
        benefits: ["Permission to work part-time (28h/week) with separate authorisation", "Unlimited entry into Japan within validity"],
        limitations: ["Programme dependency — must remain enrolled", "Scholarship visa renewal tied to academic progress"],
      },
    ],
    work: [
      {
        name: "Engineer / Specialist in Humanities Visa",
        type: "work",
        eligibility: "medium",
        eligibilityReason: "Most common work visa for skilled professionals in tech, finance, or engineering with a sponsoring employer.",
        requirements: [
          "Job offer from a Japanese employer",
          "Bachelor's degree or 10+ years of relevant experience",
          "Employer-provided Certificate of Eligibility",
        ],
        processingTime: "1–3 months",
        cost: "≈ JPY 4,000 (single-entry)",
        validity: "1, 3, or 5 years (renewable)",
        benefits: ["Path to permanent residence after 10 years (3 with HSP points)"],
        limitations: ["Must remain employed in qualifying role"],
      },
      {
        name: "Highly Skilled Professional (HSP) Visa",
        type: "work",
        eligibility: "medium",
        eligibilityReason: "Points-based visa for highly qualified workers — fast track to permanent residence.",
        requirements: ["Score 70+ on Japan's HSP point system (education, salary, experience)", "Job offer from a Japanese employer"],
        processingTime: "1–2 months",
        cost: "≈ JPY 4,000",
        validity: "5 years",
        benefits: ["PR eligibility after 1–3 years", "Spouse can work full-time", "Multiple activities allowed"],
        limitations: ["Strict points threshold"],
      },
    ],
    digital_nomad: [
      {
        name: "Digital Nomad Visa (Designated Activities)",
        type: "digital_nomad",
        eligibility: "medium",
        eligibilityReason: "Launched in 2024 for remote workers with high income.",
        requirements: ["Annual income ≥ JPY 10 million (~USD 65k)", "Private health insurance covering Japan", "Eligible passport country"],
        processingTime: "4–6 weeks",
        cost: "≈ JPY 3,000",
        validity: "Up to 6 months (non-renewable)",
        benefits: ["Live in Japan while working remotely for foreign employer/clients"],
        limitations: ["Cannot register as resident", "Not renewable in-country"],
      },
    ],
  },
  Portugal: {
    digital_nomad: [
      {
        name: "Digital Nomad Visa (D8)",
        type: "digital_nomad",
        eligibility: "high",
        eligibilityReason: "Standard route for remote workers earning above the Portuguese minimum threshold.",
        requirements: ["Monthly income ≥ EUR 3,480 (4× Portuguese minimum wage)", "Proof of remote employment or freelance contracts", "Health insurance covering Portugal", "Clean criminal record"],
        processingTime: "60–90 days",
        cost: "≈ EUR 75 application + EUR 90 residence permit",
        validity: "1 year (renewable, leads to long-stay residence)",
        benefits: ["Path to permanent residence after 5 years", "Schengen travel"],
        limitations: ["Must maintain income threshold"],
      },
      {
        name: "D7 Passive Income Visa",
        type: "digital_nomad",
        eligibility: "medium",
        eligibilityReason: "Alternative for nomads with passive income (rental, dividends, pension).",
        requirements: ["Stable passive income above minimum threshold", "Accommodation in Portugal", "Health insurance"],
        processingTime: "60–90 days",
        cost: "≈ EUR 75 + EUR 90",
        validity: "1 year (renewable)",
        benefits: ["Path to PR after 5 years"],
        limitations: ["Lower income threshold but stricter source rules"],
      },
    ],
    study: [
      {
        name: "Student Residence Permit",
        type: "student",
        eligibility: "high",
        eligibilityReason: "Standard route for higher-education students.",
        requirements: ["University acceptance letter", "Proof of funding", "Health insurance"],
        processingTime: "60 days",
        cost: "≈ EUR 75",
        validity: "1 year (renewable)",
        benefits: ["Part-time work allowed"],
        limitations: ["Tied to enrolment"],
      },
    ],
    work: [
      {
        name: "Work Visa (D1)",
        type: "work",
        eligibility: "medium",
        eligibilityReason: "For workers with a Portuguese employer contract.",
        requirements: ["Signed employment contract", "Employer-supplied work-permit application"],
        processingTime: "60–90 days",
        cost: "≈ EUR 90",
        validity: "1 year (renewable)",
        benefits: ["Family reunification"],
        limitations: ["Tied to employer"],
      },
    ],
  },
  Spain: {
    settle: [
      {
        name: "Non-Lucrative Visa",
        type: "settlement",
        eligibility: "high",
        eligibilityReason: "Standard route for retirees and those with passive income who do not plan to work.",
        requirements: ["Passive income ≥ EUR 28,800/year (2024) for primary applicant + EUR 7,200 per dependent", "Private health insurance covering Spain", "Clean criminal record", "Medical certificate"],
        processingTime: "1–3 months",
        cost: "≈ EUR 80",
        validity: "1 year (renewable, leads to PR after 5)",
        benefits: ["Path to permanent residency", "Schengen travel"],
        limitations: ["Cannot work in Spain", "Must spend 183+ days/year to renew"],
      },
      {
        name: "Family Reunification Visa",
        type: "family",
        eligibility: "medium",
        eligibilityReason: "If a spouse, parent or child is already a Spanish resident.",
        requirements: ["Sponsor's residency for at least 1 year", "Adequate housing and income"],
        processingTime: "3–6 months",
        cost: "≈ EUR 80",
        validity: "Linked to sponsor's permit",
        benefits: ["Right to live and work"],
        limitations: ["Sponsor obligations"],
      },
    ],
    work: [
      {
        name: "Highly Qualified Professional Visa",
        type: "work",
        eligibility: "medium",
        eligibilityReason: "For workers with a job offer in qualifying skilled roles.",
        requirements: ["Job offer with salary ≥ EUR 40,000", "Higher education or qualifying experience"],
        processingTime: "20 working days",
        cost: "≈ EUR 80",
        validity: "Up to 3 years",
        benefits: ["Family included", "Path to PR"],
        limitations: ["Tied to employer"],
      },
    ],
    digital_nomad: [
      {
        name: "Digital Nomad Visa",
        type: "digital_nomad",
        eligibility: "medium",
        eligibilityReason: "For remote workers earning above the threshold and working primarily for non-Spanish clients.",
        requirements: ["Monthly income ≥ EUR 2,646 (200% of minimum wage)", "Proof of remote work setup", "Health insurance"],
        processingTime: "20 working days",
        cost: "≈ EUR 80",
        validity: "1 year (renewable up to 5)",
        benefits: ["24% flat tax option (Beckham law variant)"],
        limitations: ["Spanish-source income capped at 20%"],
      },
    ],
  },
  Canada: {
    work: [
      {
        name: "Express Entry — Federal Skilled Worker",
        type: "work",
        eligibility: "high",
        eligibilityReason: "Points-based PR pathway for skilled professionals.",
        requirements: ["CRS score above the cut-off (typically 470+)", "Language test (IELTS/CELPIP)", "Educational Credential Assessment (ECA)", "1+ year skilled work experience"],
        processingTime: "≈ 6 months from invitation",
        cost: "≈ CAD 1,365 + biometrics",
        validity: "Permanent residence",
        benefits: ["Path to citizenship after 3 years", "Healthcare access", "Family included"],
        limitations: ["Highly competitive points system"],
      },
      {
        name: "Work Permit via LMIA",
        type: "work",
        eligibility: "medium",
        eligibilityReason: "For workers with a sponsoring employer who has obtained a positive Labour Market Impact Assessment.",
        requirements: ["Job offer from Canadian employer with positive LMIA", "Qualifications matching the role"],
        processingTime: "8–16 weeks",
        cost: "≈ CAD 155",
        validity: "Up to 3 years",
        benefits: ["Spouse open work permit", "Bridge to PR via Express Entry CEC"],
        limitations: ["Tied to employer"],
      },
    ],
    study: [
      {
        name: "Study Permit",
        type: "student",
        eligibility: "high",
        eligibilityReason: "Standard route for international students at a Designated Learning Institution (DLI).",
        requirements: ["Acceptance letter from a DLI", "Proof of funds (CAD 20,635/year + tuition)", "Provincial Attestation Letter (PAL)"],
        processingTime: "8–12 weeks",
        cost: "≈ CAD 150",
        validity: "Length of programme + 90 days",
        benefits: ["Up to 24h/week off-campus work", "Post-Graduation Work Permit eligibility"],
        limitations: ["Programme dependency"],
      },
    ],
  },
  France: {
    study: [
      {
        name: "Long-Stay Student Visa (VLS-TS)",
        type: "student",
        eligibility: "high",
        eligibilityReason: "Standard route for international students at French higher-education institutions.",
        requirements: ["University acceptance letter", "Proof of funds (≥ EUR 615/month)", "Health insurance", "Pre-enrolment via Campus France for many countries"],
        processingTime: "4–8 weeks",
        cost: "≈ EUR 99",
        validity: "Length of programme",
        benefits: ["964 hours/year part-time work allowed", "Schengen travel"],
        limitations: ["Must validate residence permit within 3 months of arrival"],
      },
      {
        name: "Talent Passport — Researcher",
        type: "student",
        eligibility: "medium",
        eligibilityReason: "For PhD candidates and post-doctoral researchers with a hosting agreement.",
        requirements: ["Hosting agreement with French research institution", "Master's degree or higher"],
        processingTime: "1–2 months",
        cost: "≈ EUR 99",
        validity: "Up to 4 years",
        benefits: ["Family included", "Easier path to permanent residence"],
        limitations: ["Tied to research institution"],
      },
    ],
    work: [
      {
        name: "Talent Passport — Skilled Employee",
        type: "work",
        eligibility: "medium",
        eligibilityReason: "Multi-year visa for skilled professionals with French employer.",
        requirements: ["Job offer with salary ≥ EUR 53,837 (2024)", "Master's-level qualification or equivalent"],
        processingTime: "1–3 months",
        cost: "≈ EUR 99",
        validity: "Up to 4 years",
        benefits: ["Family included", "Multi-year"],
        limitations: ["Salary threshold"],
      },
    ],
  },
  Netherlands: {
    work: [
      {
        name: "Highly Skilled Migrant (Kennismigrant)",
        type: "work",
        eligibility: "high",
        eligibilityReason: "Standard skilled-worker route for those with a recognised sponsor employer.",
        requirements: ["Job offer from IND-recognised sponsor", "Salary ≥ EUR 5,331/month (under 30) or EUR 5,331/month (30+) — verify current threshold"],
        processingTime: "2–4 weeks",
        cost: "≈ EUR 380",
        validity: "Up to 5 years (linked to contract)",
        benefits: ["Family included", "30% ruling tax benefit eligibility"],
        limitations: ["Employer must be recognised sponsor", "Salary threshold"],
      },
      {
        name: "EU Blue Card",
        type: "work",
        eligibility: "medium",
        eligibilityReason: "EU-wide skilled-worker route with similar criteria.",
        requirements: ["Job offer with salary ≥ EUR 6,245/month", "Higher-education qualification"],
        processingTime: "≈ 90 days",
        cost: "≈ EUR 380",
        validity: "Up to 4 years",
        benefits: ["Mobility within EU after 12 months"],
        limitations: ["Higher salary threshold than HSM"],
      },
    ],
    digital_nomad: [
      {
        name: "Self-Employed Visa (DAFT — for Americans only)",
        type: "digital_nomad",
        eligibility: "medium",
        eligibilityReason: "Specifically for U.S. citizens under the Dutch-American Friendship Treaty.",
        requirements: ["Investment of EUR 4,500 in a Dutch business", "Business plan", "U.S. citizenship"],
        processingTime: "8–12 weeks",
        cost: "≈ EUR 1,500 (visa + KvK)",
        validity: "2 years (renewable)",
        benefits: ["Operate own business", "Path to PR"],
        limitations: ["Americans only", "Self-employment only"],
      },
    ],
  },
  Italy: {
    settle: [
      {
        name: "Citizenship by Descent (Jure Sanguinis)",
        type: "settlement",
        eligibility: "high",
        eligibilityReason: "For applicants with documented Italian ancestry — common for South-American applicants of Italian descent.",
        requirements: ["Birth/marriage/death certificates tracing the bloodline", "Apostilled and translated documents", "Confirmation that no ancestor renounced citizenship"],
        processingTime: "Varies — 1–3 years through consulate, faster via residence in Italy",
        cost: "≈ EUR 300+ in fees plus document costs",
        validity: "Permanent — full Italian citizenship",
        benefits: ["EU citizenship", "Right to work and settle anywhere in EU"],
        limitations: ["Requires complete documentary chain"],
      },
      {
        name: "Elective Residence Visa",
        type: "settlement",
        eligibility: "medium",
        eligibilityReason: "For applicants with stable passive income who don't plan to work.",
        requirements: ["Annual passive income ≥ EUR 31,000 (single) or EUR 38,000 (couple)", "Health insurance", "Accommodation in Italy"],
        processingTime: "60–90 days",
        cost: "≈ EUR 116",
        validity: "1 year (renewable)",
        benefits: ["Schengen travel", "Path to PR after 5 years"],
        limitations: ["Cannot work in Italy"],
      },
    ],
    work: [
      {
        name: "EU Blue Card",
        type: "work",
        eligibility: "medium",
        eligibilityReason: "Skilled-worker route for highly qualified professionals.",
        requirements: ["Higher-education qualification", "Job offer with salary ≥ EUR 33,500"],
        processingTime: "1–3 months",
        cost: "≈ EUR 116",
        validity: "Up to 2 years",
        benefits: ["Family reunification", "EU mobility after 18 months"],
        limitations: ["Annual quotas may apply"],
      },
    ],
  },
  "United Kingdom": {
    study: [
      {
        name: "Student Visa (Tier 4)",
        type: "student",
        eligibility: "high",
        eligibilityReason: "Standard route for students with an unconditional offer from a UK licensed sponsor.",
        requirements: ["CAS from a licensed UK sponsor", "Proof of finances (≥ £1,334/month London or £1,023/month outside)", "English-language test", "Tuberculosis test for some countries"],
        processingTime: "3 weeks (priority), 8 weeks standard",
        cost: "£490 + IHS surcharge £776/year",
        validity: "Length of course + 4 months",
        benefits: ["20h/week part-time work in term", "Graduate Route eligibility (2 years post-study)"],
        limitations: ["Tied to sponsor institution"],
      },
    ],
    work: [
      {
        name: "Skilled Worker Visa",
        type: "work",
        eligibility: "medium",
        eligibilityReason: "Main route for sponsored workers in qualifying roles.",
        requirements: ["Job offer from licensed sponsor", "Salary ≥ £38,700 or going rate for occupation", "English-language requirement"],
        processingTime: "3 weeks (priority), 8 weeks standard",
        cost: "£610–1,500 + IHS",
        validity: "Up to 5 years (renewable)",
        benefits: ["Path to ILR after 5 years", "Family included"],
        limitations: ["Tied to sponsor"],
      },
      {
        name: "Global Talent Visa",
        type: "work",
        eligibility: "low",
        eligibilityReason: "For exceptional talent in tech, science, arts, or research — endorsement required.",
        requirements: ["Endorsement by an approved body (Tech Nation, Royal Society, etc.)"],
        processingTime: "8 weeks (after endorsement)",
        cost: "£766 + IHS",
        validity: "Up to 5 years",
        benefits: ["No employer tie", "Path to ILR after 3 years"],
        limitations: ["High bar for endorsement"],
      },
    ],
  },
  Australia: {
    work: [
      {
        name: "Subclass 482 — Temporary Skill Shortage",
        type: "work",
        eligibility: "medium",
        eligibilityReason: "Sponsored employer-nominated visa for skilled occupations.",
        requirements: ["Sponsor employer", "Skill assessment", "English-language test", "Health and character checks"],
        processingTime: "1–4 months",
        cost: "AUD 1,455+",
        validity: "2 or 4 years",
        benefits: ["Family included", "Path to PR via subclass 186"],
        limitations: ["Tied to employer", "Skill list must include occupation"],
      },
      {
        name: "Subclass 189 — Skilled Independent (Points-tested)",
        type: "work",
        eligibility: "medium",
        eligibilityReason: "PR visa for skilled workers without employer sponsorship.",
        requirements: ["Skill assessment", "EOI in SkillSelect", "Score ≥ 65 points (typically much higher)", "Under 45"],
        processingTime: "≈ 8 months from invitation",
        cost: "AUD 4,640+",
        validity: "Permanent",
        benefits: ["Live and work anywhere in Australia", "Path to citizenship"],
        limitations: ["Highly competitive"],
      },
    ],
  },
  Germany: {
    work: [
      {
        name: "EU Blue Card (Germany)",
        type: "work",
        eligibility: "high",
        eligibilityReason: "Main route for highly qualified workers with a German employer.",
        requirements: ["Higher-education qualification", "Job offer with salary ≥ EUR 45,300 (2024) — EUR 41,041 for shortage occupations"],
        processingTime: "1–3 months",
        cost: "≈ EUR 100",
        validity: "Up to 4 years",
        benefits: ["PR eligibility after 21 months (with B1 German) or 33 months", "Family included"],
        limitations: ["Salary threshold"],
      },
      {
        name: "Skilled Worker Visa (Fachkräfte)",
        type: "work",
        eligibility: "medium",
        eligibilityReason: "For workers with recognised vocational/professional qualifications.",
        requirements: ["Recognised qualification", "Job offer", "Recognition of foreign credentials"],
        processingTime: "2–4 months",
        cost: "≈ EUR 75",
        validity: "Up to 4 years (renewable)",
        benefits: ["Family included", "Path to PR after 4 years"],
        limitations: ["Credential recognition can be slow"],
      },
    ],
    study: [
      {
        name: "Student Visa (Studienvisum)",
        type: "student",
        eligibility: "high",
        eligibilityReason: "Standard route for international students at German universities.",
        requirements: ["University admission letter", "Blocked account with EUR 11,208/year", "Health insurance"],
        processingTime: "6–12 weeks",
        cost: "≈ EUR 75",
        validity: "Length of programme",
        benefits: ["120 full / 240 half days work per year"],
        limitations: ["Tied to enrolment"],
      },
    ],
  },
}

const PURPOSE_KEYS: Purpose[] = ["work", "study", "settle", "digital_nomad", "other"]

export function hasFallback(destination: string, purpose: Purpose | string | null | undefined): boolean {
  if (!destination) return false
  const dest = FALLBACKS[destination]
  if (!dest) return false
  const p = (purpose || "other") as Purpose
  return Boolean(dest[p] && dest[p]!.length > 0)
}

/**
 * Build a fallback `VisaResearchResult` for the given (destination, purpose).
 * The shape matches what /api/visa-tracker reads from `plan.visa_research`.
 */
export function buildFallbackVisaResearch(
  destination: string,
  citizenship: string,
  purpose: Purpose | string | null | undefined
): VisaResearchResult | null {
  if (!destination) return null
  const dest = FALLBACKS[destination]
  if (!dest) return null
  const p: Purpose = PURPOSE_KEYS.includes((purpose || "other") as Purpose)
    ? ((purpose || "other") as Purpose)
    : "other"
  const list = dest[p] || dest.work || dest.study || []
  if (!list.length) return null

  const sources = getAllSources(destination)
  const officialSources: { name: string; url: string }[] = []
  if (sources?.immigration) officialSources.push({ name: "Immigration office", url: sources.immigration })
  if (sources?.visa) officialSources.push({ name: "Visa portal", url: sources.visa })

  return {
    destination,
    citizenship,
    purpose: p,
    visaOptions: list.map((v) => ({
      name: v.name,
      type: v.type,
      eligibility: v.eligibility,
      eligibilityReason: v.eligibilityReason,
      requirements: v.requirements,
      processingTime: v.processingTime,
      cost: v.cost,
      validity: v.validity,
      benefits: v.benefits,
      limitations: v.limitations,
      officialLink: getSourceUrl(destination, "immigration") || getSourceUrl(destination, "visa") || undefined,
    })),
    summary: `Common visa pathways to ${destination} for ${p === "digital_nomad" ? "digital nomads" : p}. Live web research was not available for your specific case; numbers below are typical 2024 thresholds and should be verified against the official source.`,
    disclaimer: "GoMate's visa information is general guidance, not legal advice. Always verify the latest requirements with the destination's immigration authority before applying.",
    generalRequirements: [
      "Valid passport (typically 6+ months remaining)",
      "Proof of accommodation in destination",
      "Health insurance covering the destination",
      "Clean criminal-record certificate",
    ],
    importantNotes: [
      "Processing times and fees change. Always check the official source linked above before submitting an application.",
      "Eligibility is indicative — your specific qualifications, age, and timing may push you into a different category.",
    ],
    officialSources,
    researchedAt: new Date().toISOString(),
    confidence: "medium",
    quality: "fallback",
    sourceCount: 0,
  }
}
