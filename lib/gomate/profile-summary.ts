import { type Profile, FIELD_CONFIG, getRequiredFields, type AllFieldKey } from "./profile-schema"
import { getVisaStatus } from "./visa-checker"

/**
 * Generates a human-readable summary of the user's relocation profile
 */
export function generateProfileSummary(profile: Profile): string {
  const sections: string[] = []

  // Identity section
  const identityParts: string[] = []
  if (profile.name) identityParts.push(`**Name:** ${profile.name}`)
  if (profile.citizenship) identityParts.push(`**Citizenship:** ${profile.citizenship}`)
  if (profile.current_location) identityParts.push(`**Currently in:** ${profile.current_location}`)
  if (profile.age_range) identityParts.push(`**Age range:** ${profile.age_range}`)
  
  if (identityParts.length > 0) {
    sections.push(`### About You\n${identityParts.join("\n")}`)
  }

  // Destination section
  const destParts: string[] = []
  if (profile.destination) destParts.push(`**Country:** ${profile.destination}`)
  if (profile.target_city) destParts.push(`**City:** ${profile.target_city}`)
  if (profile.timeline) destParts.push(`**When:** ${profile.timeline}`)
  if (profile.duration) destParts.push(`**Duration:** ${profile.duration}`)
  
  if (destParts.length > 0) {
    sections.push(`### Your Move\n${destParts.join("\n")}`)
  }

  // Purpose section
  const purposeParts: string[] = []
  if (profile.purpose) {
    const purposeLabels: Record<string, string> = {
      study: "Study",
      work: "Work",
      settle: "Permanent Settlement",
      digital_nomad: "Digital Nomad / Remote Work",
      other: "Other"
    }
    purposeParts.push(`**Main purpose:** ${purposeLabels[profile.purpose] || profile.purpose}`)
  }
  
  // Study-specific
  if (profile.purpose === "study") {
    if (profile.study_type) purposeParts.push(`**Study type:** ${profile.study_type}`)
    if (profile.study_field) purposeParts.push(`**Field of study:** ${profile.study_field}`)
    if (profile.study_institution) purposeParts.push(`**Institution:** ${profile.study_institution}`)
    if (profile.study_admission) purposeParts.push(`**Admission status:** ${profile.study_admission}`)
  }
  
  // Work-specific
  if (profile.purpose === "work") {
    if (profile.job_offer) purposeParts.push(`**Job offer:** ${profile.job_offer}`)
    if (profile.job_industry) purposeParts.push(`**Industry:** ${profile.job_industry}`)
    if (profile.job_title) purposeParts.push(`**Role:** ${profile.job_title}`)
    if (profile.employer_sponsor) purposeParts.push(`**Employer sponsorship:** ${profile.employer_sponsor}`)
    if (profile.skilled_worker) purposeParts.push(`**Skilled worker visa eligible:** ${profile.skilled_worker}`)
  }
  
  // Digital nomad specific
  if (profile.purpose === "digital_nomad") {
    if (profile.remote_income) purposeParts.push(`**Remote income:** ${profile.remote_income}`)
    if (profile.monthly_income) purposeParts.push(`**Monthly income:** ${profile.monthly_income}`)
  }
  
  if (purposeParts.length > 0) {
    sections.push(`### Purpose & Plans\n${purposeParts.join("\n")}`)
  }

  // Family section
  const familyParts: string[] = []
  if (profile.moving_alone) {
    familyParts.push(`**Moving alone:** ${profile.moving_alone === "yes" ? "Yes" : "No"}`)
  }
  if (profile.moving_alone === "no") {
    if (profile.partner_moving) familyParts.push(`**Partner joining:** ${profile.partner_moving}`)
    if (profile.num_children) familyParts.push(`**Children:** ${profile.num_children}`)
    if (profile.children_ages) familyParts.push(`**Children's ages:** ${profile.children_ages}`)
    if (profile.children_schooling) familyParts.push(`**Schooling needs:** ${profile.children_schooling}`)
  }
  if (profile.pets) familyParts.push(`**Pets:** ${profile.pets}`)
  
  if (familyParts.length > 0) {
    sections.push(`### Family & Companions\n${familyParts.join("\n")}`)
  }

  // Financial section
  const financeParts: string[] = []
  if (profile.savings_range) financeParts.push(`**Savings:** ${profile.savings_range}`)
  if (profile.monthly_budget) financeParts.push(`**Monthly budget:** ${profile.monthly_budget}`)
  if (profile.need_budget_help) financeParts.push(`**Needs budget guidance:** ${profile.need_budget_help}`)
  if (profile.funding_source) financeParts.push(`**Funding source:** ${profile.funding_source}`)
  
  if (financeParts.length > 0) {
    sections.push(`### Finances\n${financeParts.join("\n")}`)
  }

  // Background section
  const bgParts: string[] = []
  if (profile.education_level) bgParts.push(`**Education:** ${profile.education_level}`)
  if (profile.language_destination) bgParts.push(`**Destination language:** ${profile.language_destination}`)
  if (profile.language_english) bgParts.push(`**English level:** ${profile.language_english}`)
  if (profile.work_experience) bgParts.push(`**Work experience:** ${profile.work_experience}`)
  
  if (bgParts.length > 0) {
    sections.push(`### Background\n${bgParts.join("\n")}`)
  }

  // Practical needs
  const practicalParts: string[] = []
  if (profile.healthcare_needs) practicalParts.push(`**Healthcare needs:** ${profile.healthcare_needs}`)
  if (profile.housing_preference) practicalParts.push(`**Housing preference:** ${profile.housing_preference}`)
  
  if (practicalParts.length > 0) {
    sections.push(`### Practical Needs\n${practicalParts.join("\n")}`)
  }

  // Legal section
  const legalParts: string[] = []
  if (profile.prior_visa) legalParts.push(`**Prior visa to destination:** ${profile.prior_visa}`)
  if (profile.visa_rejections) legalParts.push(`**Visa rejections:** ${profile.visa_rejections}`)
  if (profile.criminal_record) legalParts.push(`**Criminal record:** ${profile.criminal_record}`)
  
  if (legalParts.length > 0) {
    sections.push(`### Legal History\n${legalParts.join("\n")}`)
  }

  return sections.join("\n\n")
}

/**
 * Generates a visa recommendation based on the profile
 */
export interface VisaRecommendation {
  primaryVisa: string
  alternativeVisas: string[]
  processingTime: string
  requirements: string[]
  tips: string[]
  visaFreeStatus: {
    visaFree: boolean
    reason: string
  } | null
}

export function generateVisaRecommendation(profile: Profile): VisaRecommendation | null {
  if (!profile.destination || !profile.citizenship || !profile.purpose) {
    return null
  }

  // Check visa-free status first
  const visaStatus = profile.citizenship && profile.destination 
    ? getVisaStatus(profile.citizenship, profile.destination)
    : null

  const recommendation: VisaRecommendation = {
    primaryVisa: "",
    alternativeVisas: [],
    processingTime: "",
    requirements: [],
    tips: [],
    visaFreeStatus: visaStatus
  }

  // If EU citizen moving within EU/EEA
  if (visaStatus?.visaFree) {
    recommendation.primaryVisa = "Freedom of Movement (No visa required)"
    recommendation.processingTime = "Immediate - registration may be required within 3 months"
    recommendation.requirements = [
      "Valid passport or national ID",
      "Register with local authorities after arrival",
      "Proof of health insurance (varies by country)"
    ]
    recommendation.tips = [
      "Register with the municipality within 3 months of arrival",
      "Apply for a residence certificate if staying long-term",
      "Open a local bank account for easier transactions"
    ]
    return recommendation
  }

  // Purpose-based recommendations
  const dest = profile.destination.toLowerCase()
  
  if (profile.purpose === "study") {
    recommendation.primaryVisa = getStudyVisa(dest)
    recommendation.alternativeVisas = ["Language course visa", "Student exchange visa"]
    recommendation.processingTime = "4-12 weeks (varies by country and institution)"
    recommendation.requirements = [
      "Acceptance letter from accredited institution",
      "Proof of sufficient funds",
      "Health insurance coverage",
      "Language proficiency (if required)"
    ]
    if (profile.study_admission === "no" || profile.study_admission === "applying") {
      recommendation.tips.push("Apply to institutions early - admission letters are required for visa applications")
    }
    recommendation.tips.push(
      "Check if your institution offers visa assistance",
      "Start the application at least 3 months before your course begins"
    )
  } else if (profile.purpose === "work") {
    if (profile.job_offer === "yes" && profile.employer_sponsor === "yes") {
      recommendation.primaryVisa = getWorkVisa(dest)
      recommendation.processingTime = "2-8 weeks (employer-sponsored visas are typically faster)"
      recommendation.requirements = [
        "Employment contract",
        "Employer sponsorship letter",
        "Proof of qualifications",
        "Background check"
      ]
      recommendation.tips.push(
        "Let your employer handle the visa process where possible",
        "Gather all documents before your employer submits the application"
      )
    } else if (profile.skilled_worker === "yes") {
      recommendation.primaryVisa = getSkilledWorkerVisa(dest)
      recommendation.alternativeVisas = [getJobSeekerVisa(dest), "Entrepreneur visa"]
      recommendation.processingTime = "4-16 weeks"
      recommendation.requirements = [
        "Proof of qualifications in shortage occupation",
        "Professional experience documentation",
        "Financial self-sufficiency proof",
        "Language skills (varies by country)"
      ]
      recommendation.tips.push(
        "Check if your profession is on the skilled occupation list",
        "Consider a job seeker visa to find employment on-site"
      )
    } else {
      recommendation.primaryVisa = getJobSeekerVisa(dest)
      recommendation.alternativeVisas = [getWorkVisa(dest), "Freelance visa"]
      recommendation.processingTime = "4-12 weeks"
      recommendation.requirements = [
        "Proof of qualifications",
        "Sufficient funds for job search period",
        "Health insurance",
        "Return ticket or proof of travel funds"
      ]
      recommendation.tips.push(
        "Network actively during your job seeker visa period",
        "Consider working with recruitment agencies specializing in expats"
      )
    }
  } else if (profile.purpose === "digital_nomad") {
    recommendation.primaryVisa = getDigitalNomadVisa(dest)
    recommendation.alternativeVisas = ["Freelance visa", "Self-employment visa", "Tourist visa (short stays)"]
    recommendation.processingTime = "2-8 weeks"
    recommendation.requirements = [
      "Proof of remote employment or clients",
      `Minimum income requirement (typically €2,000-4,000/month)`,
      "Health insurance with coverage in destination",
      "Clean criminal record"
    ]
    recommendation.tips.push(
      "Document your income sources clearly",
      "Some countries require income from outside the destination country",
      "Consider tax implications in both countries"
    )
  } else if (profile.purpose === "settle") {
    recommendation.primaryVisa = getSettlementVisa(dest)
    recommendation.alternativeVisas = ["Long-term residence visa", "Retirement visa (if applicable)"]
    recommendation.processingTime = "3-12 months (settlement visas have longer processing times)"
    recommendation.requirements = [
      "Proof of stable income or pension",
      "Comprehensive health insurance",
      "Clean criminal record",
      "Language proficiency (often required)"
    ]
    recommendation.tips.push(
      "Settlement visas often require a pathway (work, study, family)",
      "Consider starting with a temporary visa and transitioning to permanent residence",
      "Language integration may be required for permanent residence"
    )
  }

  // Add family-related tips
  if (profile.moving_alone === "no" && profile.partner_moving === "yes") {
    recommendation.requirements.push("Partner documentation (marriage certificate, etc.)")
    recommendation.tips.push("Apply for family visas together when possible")
  }
  
  if (profile.num_children && parseInt(profile.num_children) > 0) {
    recommendation.requirements.push("Children's birth certificates", "School enrollment letters (if applicable)")
    recommendation.tips.push("Research international schools early - waiting lists can be long")
  }

  return recommendation
}

// Helper functions for country-specific visa names
function getStudyVisa(country: string): string {
  const visas: Record<string, string> = {
    germany: "Student Visa (Visum zu Studienzwecken)",
    france: "Long-stay Student Visa (VLS-TS étudiant)",
    spain: "Student Visa (Visado de estudiante)",
    netherlands: "Student Residence Permit (MVV)",
    sweden: "Residence Permit for Studies",
    portugal: "Student Visa (Visto de Estudante)",
    italy: "Student Visa (Visto per Studio)",
    usa: "F-1 Student Visa",
    uk: "Student Visa (Tier 4)",
    canada: "Study Permit",
    australia: "Student Visa (subclass 500)",
    japan: "Student Visa (留学)",
  }
  return visas[country] || "Student Visa"
}

function getWorkVisa(country: string): string {
  const visas: Record<string, string> = {
    germany: "EU Blue Card or Employment Visa",
    france: "Talent Passport or Work Visa",
    spain: "Work Visa (Visado de trabajo)",
    netherlands: "Highly Skilled Migrant Permit",
    sweden: "Work Permit",
    portugal: "Work Visa or Tech Visa",
    italy: "Work Visa (Visto per Lavoro)",
    usa: "H-1B Work Visa",
    uk: "Skilled Worker Visa",
    canada: "Work Permit",
    australia: "Skilled Worker Visa (subclass 482)",
    japan: "Work Visa (就労ビザ)",
  }
  return visas[country] || "Work Visa"
}

function getSkilledWorkerVisa(country: string): string {
  const visas: Record<string, string> = {
    germany: "EU Blue Card",
    france: "Talent Passport (Passeport Talent)",
    netherlands: "Highly Skilled Migrant Visa (Kennismigrant)",
    uk: "Skilled Worker Visa (Points-based)",
    canada: "Express Entry",
    australia: "Skilled Independent Visa (subclass 189)",
  }
  return visas[country] || "Skilled Worker Visa"
}

function getJobSeekerVisa(country: string): string {
  const visas: Record<string, string> = {
    germany: "Job Seeker Visa (§20 AufenthG)",
    austria: "Job Seeker Visa (Rot-Weiß-Rot Karte)",
    portugal: "Job Seeker Visa",
    sweden: "Job Seeker Permit (after studies)",
  }
  return visas[country] || "Job Seeker Visa (check availability)"
}

function getDigitalNomadVisa(country: string): string {
  const visas: Record<string, string> = {
    germany: "Freelance Visa (Freiberufler Visum)",
    portugal: "Digital Nomad Visa (D8)",
    spain: "Digital Nomad Visa",
    croatia: "Digital Nomad Visa",
    estonia: "Digital Nomad Visa",
    greece: "Digital Nomad Visa",
    italy: "Digital Nomad Visa",
    malta: "Nomad Residence Permit",
    netherlands: "Self-Employment Visa",
    czechia: "Zivno Visa (Trade License)",
  }
  return visas[country] || "Digital Nomad / Freelance Visa (check availability)"
}

function getSettlementVisa(country: string): string {
  const visas: Record<string, string> = {
    germany: "Settlement Permit (Niederlassungserlaubnis)",
    france: "Long-term Resident Card",
    spain: "Long-term Residence Permit",
    netherlands: "Permanent Residence Permit",
    uk: "Indefinite Leave to Remain (ILR)",
    usa: "Green Card (Permanent Residence)",
    canada: "Permanent Residence",
    australia: "Permanent Residence Visa",
  }
  return visas[country] || "Permanent Residence Visa"
}

/**
 * Format visa recommendation as markdown for chat display
 */
export function formatVisaRecommendation(rec: VisaRecommendation): string {
  const parts: string[] = []

  if (rec.visaFreeStatus?.visaFree) {
    parts.push(`**Great news!** ${rec.visaFreeStatus.reason}\n`)
  }

  parts.push(`**Recommended visa:** ${rec.primaryVisa}`)
  
  if (rec.alternativeVisas.length > 0) {
    parts.push(`**Alternatives:** ${rec.alternativeVisas.join(", ")}`)
  }
  
  parts.push(`**Typical processing time:** ${rec.processingTime}`)
  
  if (rec.requirements.length > 0) {
    parts.push(`\n**Key requirements:**\n${rec.requirements.map(r => `- ${r}`).join("\n")}`)
  }
  
  if (rec.tips.length > 0) {
    parts.push(`\n**Tips:**\n${rec.tips.map(t => `- ${t}`).join("\n")}`)
  }

  return parts.join("\n")
}
