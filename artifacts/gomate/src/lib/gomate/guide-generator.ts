export const COUNTRY_DATA: Record<string, {
  currency?: string
  taxInfo?: {
    incomeTaxBrackets?: { upTo: number | null; rate: number }[]
    socialContributions?: string
    specialRegimes?: { name: string; summary: string; eligibility: string }[]
    taxYear?: string
    filingDeadline?: string
    disclaimer?: string
    officialLink?: string
    lastVerified?: string
  }
}> = {}
