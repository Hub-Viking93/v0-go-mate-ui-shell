import type { Profile } from "./profile-schema"

// Legacy field names referenced below that aren't on the current Profile schema.
// They're read defensively (truthy guards) so missing values fall through. A
// later cleanup can add the fields back to Profile or drop these reads.
type VisaRecProfile = Profile & {
  job_title?: string | null
  remote_work_type?: string | null
  income_proof?: string | null
  partner_coming?: string | null
  savings_range?: string | null
  english_level?: string | null
  accepted_to_school?: string | null
  field_of_study?: string | null
  industry?: string | null
}

export interface VisaRecommendation {
  name: string
  type: "primary" | "alternative"
  description: string
  processingTime: string
  estimatedCost: string
  requirements: string[]
  pros: string[]
  cons: string[]
  likelihood: "high" | "medium" | "low"
}

export interface ProfileSummary {
  sections: {
    title: string
    items: { label: string; value: string }[]
  }[]
  completionPercentage: number
  missingFields: string[]
}

// Generate a structured profile summary for the AI to present
export function generateProfileSummary(profile: VisaRecProfile): ProfileSummary {
  const sections: ProfileSummary["sections"] = []
  
  // Personal Info
  const personalItems: { label: string; value: string }[] = []
  if (profile.name) personalItems.push({ label: "Name", value: profile.name })
  if (profile.citizenship) personalItems.push({ label: "Citizenship", value: profile.citizenship })
  if (profile.current_location) personalItems.push({ label: "Currently in", value: profile.current_location })
  if (personalItems.length > 0) {
    sections.push({ title: "Personal Information", items: personalItems })
  }
  
  // Destination & Purpose
  const destItems: { label: string; value: string }[] = []
  if (profile.destination) destItems.push({ label: "Destination", value: profile.destination })
  if (profile.target_city) destItems.push({ label: "Target City", value: profile.target_city })
  if (profile.purpose) {
    const purposeMap: Record<string, string> = {
      study: "Study",
      work: "Work",
      settle: "Settle Permanently",
      digital_nomad: "Digital Nomad / Remote Work",
      other: "Other"
    }
    destItems.push({ label: "Purpose", value: purposeMap[profile.purpose] || profile.purpose })
  }
  if (profile.timeline) destItems.push({ label: "Timeline", value: profile.timeline })
  if (profile.duration) destItems.push({ label: "Planned Duration", value: profile.duration })
  if (destItems.length > 0) {
    sections.push({ title: "Relocation Details", items: destItems })
  }
  
  // Study-specific
  if (profile.purpose === "study") {
    const studyItems: { label: string; value: string }[] = []
    if (profile.study_type) {
      const studyTypes: Record<string, string> = {
        university: "University Degree",
        language_school: "Language School",
        vocational: "Vocational Training",
        exchange: "Exchange Program",
        other: "Other Studies"
      }
      studyItems.push({ label: "Study Type", value: studyTypes[profile.study_type] || profile.study_type })
    }
    if (profile.field_of_study) studyItems.push({ label: "Field of Study", value: profile.field_of_study })
    if (profile.study_funding) studyItems.push({ label: "Funding", value: profile.study_funding })
    if (profile.accepted_to_school) {
      studyItems.push({ label: "Accepted to School", value: profile.accepted_to_school === "yes" ? "Yes" : "Not yet" })
    }
    if (studyItems.length > 0) {
      sections.push({ title: "Study Details", items: studyItems })
    }
  }
  
  // Work-specific
  if (profile.purpose === "work") {
    const workItems: { label: string; value: string }[] = []
    if (profile.job_offer) {
      workItems.push({ label: "Job Offer", value: profile.job_offer === "yes" ? "Yes" : "Not yet" })
    }
    if (profile.industry) workItems.push({ label: "Industry", value: profile.industry })
    if (profile.job_title) workItems.push({ label: "Job Title", value: profile.job_title })
    if (profile.employer_sponsorship) {
      workItems.push({ label: "Employer Sponsorship", value: profile.employer_sponsorship === "yes" ? "Yes" : "No" })
    }
    if (profile.highly_skilled) {
      workItems.push({ label: "Highly Skilled", value: profile.highly_skilled === "yes" ? "Yes" : "No" })
    }
    if (profile.years_experience) workItems.push({ label: "Years of Experience", value: profile.years_experience })
    if (profile.education_level) workItems.push({ label: "Education Level", value: profile.education_level })
    if (workItems.length > 0) {
      sections.push({ title: "Work Details", items: workItems })
    }
  }
  
  // Digital Nomad specific
  if (profile.purpose === "digital_nomad") {
    const nomadItems: { label: string; value: string }[] = []
    if (profile.remote_work_type) nomadItems.push({ label: "Work Type", value: profile.remote_work_type })
    if (profile.monthly_income) nomadItems.push({ label: "Monthly Income", value: profile.monthly_income })
    if (profile.income_proof) {
      nomadItems.push({ label: "Can Prove Income", value: profile.income_proof === "yes" ? "Yes" : "No" })
    }
    if (nomadItems.length > 0) {
      sections.push({ title: "Remote Work Details", items: nomadItems })
    }
  }
  
  // Settlement specific
  if (profile.purpose === "settle") {
    const settleItems: { label: string; value: string }[] = []
    if (profile.settlement_reason) {
      const reasons: Record<string, string> = {
        retirement: "Retirement",
        family_reunion: "Family Reunion",
        investment: "Investment",
        ancestry: "Ancestry/Heritage",
        other: "Other"
      }
      settleItems.push({ label: "Reason", value: reasons[profile.settlement_reason] || profile.settlement_reason })
    }
    if (profile.family_ties) {
      settleItems.push({ label: "Family in Destination", value: profile.family_ties === "yes" ? "Yes" : "No" })
    }
    if (settleItems.length > 0) {
      sections.push({ title: "Settlement Details", items: settleItems })
    }
  }
  
  // Family
  const familyItems: { label: string; value: string }[] = []
  if (profile.moving_alone) {
    familyItems.push({ label: "Moving Alone", value: profile.moving_alone === "yes" ? "Yes" : "No" })
  }
  if (profile.partner_coming === "yes") {
    familyItems.push({ label: "Partner Coming", value: "Yes" })
  }
  if (profile.children_count && profile.children_count !== "0") {
    familyItems.push({ label: "Children", value: profile.children_count })
  }
  if (profile.pets && profile.pets !== "none") {
    familyItems.push({ label: "Pets", value: profile.pets })
  }
  if (familyItems.length > 0) {
    sections.push({ title: "Family & Companions", items: familyItems })
  }
  
  // Financial
  const financeItems: { label: string; value: string }[] = []
  if (profile.savings_range) financeItems.push({ label: "Savings", value: profile.savings_range })
  if (profile.monthly_budget) financeItems.push({ label: "Monthly Budget", value: profile.monthly_budget })
  if (financeItems.length > 0) {
    sections.push({ title: "Financial Situation", items: financeItems })
  }
  
  // Language & Skills
  const skillsItems: { label: string; value: string }[] = []
  if (profile.language_skill) skillsItems.push({ label: "Destination Language", value: profile.language_skill })
  if (profile.english_level) skillsItems.push({ label: "English Level", value: profile.english_level })
  if (skillsItems.length > 0) {
    sections.push({ title: "Language Skills", items: skillsItems })
  }
  
  // Healthcare & Special Needs
  const healthItems: { label: string; value: string }[] = []
  if (profile.healthcare_needs && profile.healthcare_needs !== "none") {
    healthItems.push({ label: "Healthcare Needs", value: profile.healthcare_needs })
  }
  if (healthItems.length > 0) {
    sections.push({ title: "Healthcare", items: healthItems })
  }

  return {
    sections,
    completionPercentage: 100, // Called when profile is complete
    missingFields: [],
  }
}

// Generate visa recommendations based on profile
export function generateVisaRecommendations(profile: VisaRecProfile): VisaRecommendation[] {
  const recommendations: VisaRecommendation[] = []
  
  if (!profile.destination || !profile.purpose) {
    return recommendations
  }

  const destination = profile.destination.toLowerCase()
  
  // Germany-specific recommendations
  if (destination.includes("germany")) {
    if (profile.purpose === "study") {
      recommendations.push({
        name: "German Student Visa (Visum zu Studienzwecken)",
        type: "primary",
        description: "Standard student visa for studying at German universities or language schools.",
        processingTime: "6-12 weeks",
        estimatedCost: "€75 visa fee + ~€11,208/year blocked account",
        requirements: [
          "University admission letter or language school enrollment",
          "Proof of financial resources (blocked account with €934/month)",
          "Health insurance valid in Germany",
          "Language proficiency proof (if required by program)",
          "Valid passport"
        ],
        pros: [
          "Can work 120 full days or 240 half days per year",
          "Path to residence permit after graduation",
          "Access to student discounts and benefits"
        ],
        cons: [
          "Must prove sufficient funds upfront",
          "Limited work hours during studies",
          "Need to maintain student status"
        ],
        likelihood: profile.accepted_to_school === "yes" ? "high" : "medium"
      })
    } else if (profile.purpose === "work") {
      if (profile.job_offer === "yes" && profile.employer_sponsorship === "yes") {
        recommendations.push({
          name: "EU Blue Card",
          type: "primary",
          description: "Premium work permit for highly qualified professionals with job offers.",
          processingTime: "4-8 weeks",
          estimatedCost: "€100-140 + €100 residence permit",
          requirements: [
            "Job offer with minimum salary threshold (€45,300 or €41,042 for shortage occupations)",
            "University degree or equivalent qualification",
            "Employment contract or binding job offer",
            "Valid passport and health insurance"
          ],
          pros: [
            "Fast track to permanent residency (21-33 months)",
            "Family reunification rights",
            "Freedom to change jobs after 12 months",
            "EU-wide mobility after 18 months"
          ],
          cons: [
            "Salary threshold requirements",
            "Need recognized qualification",
            "Initial job change restrictions"
          ],
          likelihood: profile.highly_skilled === "yes" ? "high" : "medium"
        })
      } else {
        recommendations.push({
          name: "Job Seeker Visa",
          type: "primary",
          description: "6-month visa to search for qualified employment in Germany.",
          processingTime: "4-8 weeks",
          estimatedCost: "€75 visa fee",
          requirements: [
            "University degree recognized in Germany",
            "Proof of sufficient funds (~€1,027/month)",
            "Health insurance coverage",
            "CV and qualification documents"
          ],
          pros: [
            "6 months to find employment",
            "Can attend interviews and network",
            "Convert to work permit once employed"
          ],
          cons: [
            "Cannot work during job search",
            "Must find job within 6 months",
            "Need to leave if unsuccessful"
          ],
          likelihood: "medium"
        })
      }
    } else if (profile.purpose === "digital_nomad") {
      recommendations.push({
        name: "Freelance Visa (Freiberufler)",
        type: "primary",
        description: "Self-employment visa for freelancers and remote workers.",
        processingTime: "8-12 weeks",
        estimatedCost: "€100-140",
        requirements: [
          "Business plan or client contracts",
          "Proof of professional qualifications",
          "Financial sustainability proof",
          "Health insurance (public or private)",
          "Letters of intent from German clients (helpful)"
        ],
        pros: [
          "Work legally as freelancer in Germany",
          "Path to permanent residence",
          "No employer dependency"
        ],
        cons: [
          "Must demonstrate benefit to German economy",
          "Complex application process",
          "Need to show local client interest"
        ],
        likelihood: profile.monthly_income ? "medium" : "low"
      })
    }
  }
  
  // Spain-specific
  if (destination.includes("spain")) {
    if (profile.purpose === "digital_nomad") {
      recommendations.push({
        name: "Spain Digital Nomad Visa",
        type: "primary",
        description: "New visa for remote workers and digital nomads (available since 2023).",
        processingTime: "4-8 weeks",
        estimatedCost: "€80 visa fee",
        requirements: [
          "Proof of remote work for non-Spanish company",
          "Minimum income of ~€2,334/month",
          "Health insurance coverage",
          "Clean criminal record",
          "3+ years of work experience or relevant degree"
        ],
        pros: [
          "Legal residence for up to 5 years",
          "Can bring family members",
          "Only 15% income tax for first 4 years",
          "Access to Spanish healthcare system"
        ],
        cons: [
          "Cannot work for Spanish clients >20%",
          "Income documentation requirements",
          "Must maintain remote work status"
        ],
        likelihood: profile.income_proof === "yes" ? "high" : "medium"
      })
    }
  }
  
  // Portugal-specific
  if (destination.includes("portugal")) {
    if (profile.purpose === "digital_nomad") {
      recommendations.push({
        name: "Portugal Digital Nomad Visa (D8)",
        type: "primary",
        description: "Temporary residence visa for remote workers with passive income.",
        processingTime: "4-8 weeks",
        estimatedCost: "€90 visa fee + €83 residence permit",
        requirements: [
          "Proof of remote work or passive income",
          "Minimum income of 4x Portuguese minimum wage (~€3,040/month)",
          "Health insurance",
          "Clean criminal record",
          "Proof of accommodation"
        ],
        pros: [
          "Initial 1-year residence, renewable",
          "Path to permanent residency after 5 years",
          "NHR tax regime benefits possible",
          "Access to Schengen area"
        ],
        cons: [
          "Higher income threshold than some countries",
          "Must maintain income requirements",
          "Bureaucratic renewal process"
        ],
        likelihood: "medium"
      })
    }
  }
  
  // Generic fallbacks if no specific match
  if (recommendations.length === 0) {
    if (profile.purpose === "study") {
      recommendations.push({
        name: "Student Visa",
        type: "primary",
        description: `Standard student visa for studying in ${profile.destination}.`,
        processingTime: "4-12 weeks (varies by country)",
        estimatedCost: "Varies by country",
        requirements: [
          "Acceptance letter from educational institution",
          "Proof of financial support",
          "Health insurance",
          "Valid passport"
        ],
        pros: ["Legal study authorization", "Often allows part-time work", "Path to post-study options"],
        cons: ["Limited work hours", "Must maintain enrollment", "May need to leave after completion"],
        likelihood: profile.accepted_to_school === "yes" ? "high" : "medium"
      })
    } else if (profile.purpose === "work") {
      recommendations.push({
        name: "Work Visa",
        type: "primary",
        description: `Work authorization for employment in ${profile.destination}.`,
        processingTime: "4-12 weeks (varies by country)",
        estimatedCost: "Varies by country",
        requirements: [
          "Job offer from employer",
          "Employment contract",
          "Relevant qualifications",
          "Health insurance",
          "Clean criminal record"
        ],
        pros: ["Legal work authorization", "Path to longer residence", "Family reunification options"],
        cons: ["Often tied to specific employer", "May have salary requirements", "Processing can be slow"],
        likelihood: profile.job_offer === "yes" ? "high" : "medium"
      })
    }
  }
  
  return recommendations
}

// Format recommendations for the AI to use
export function formatRecommendationsForAI(recommendations: VisaRecommendation[]): string {
  if (recommendations.length === 0) {
    return "No specific visa recommendations available. Research the destination country's immigration website for options."
  }
  
  return recommendations.map((rec, i) => `
${i + 1}. ${rec.name} (${rec.type === "primary" ? "RECOMMENDED" : "Alternative"})
   Processing Time: ${rec.processingTime}
   Estimated Cost: ${rec.estimatedCost}
   Likelihood: ${rec.likelihood.toUpperCase()}
   
   Requirements:
   ${rec.requirements.map(r => `   - ${r}`).join("\n")}
   
   Pros:
   ${rec.pros.map(p => `   + ${p}`).join("\n")}
   
   Cons:
   ${rec.cons.map(c => `   - ${c}`).join("\n")}
`).join("\n---\n")
}
