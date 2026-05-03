export interface TaxBracket {
  min: number
  max: number | null
  rate: number
}

export interface SpecialRegime {
  name: string
  description: string
  eligibility?: string
  url?: string
}

export interface TaxResearchResult {
  country: string
  currency?: string
  incomeTaxBrackets?: TaxBracket[]
  socialSecurityRate?: number
  vatRate?: number
  specialRegimes?: SpecialRegime[]
  filingDeadline?: string
  taxYearStart?: string
  doubleTaxationTreaties?: string[]
  notes?: string[]
  sources?: { title: string; url: string }[]
  generatedAt?: string
  researchedAt?: string
  quality?: "full" | "partial" | "fallback"
}
