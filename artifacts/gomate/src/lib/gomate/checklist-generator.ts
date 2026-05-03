export interface ChecklistItem {
  id: string
  title: string
  description?: string
  category: string
  priority: "high" | "medium" | "low"
  timeframe: string
  url?: string
  source?: string
  required?: boolean
  completed?: boolean
}

export interface ChecklistGeneratorInput {
  destinationCountry: string
  visaType?: string
  citizenship?: string
  hasJob?: boolean
  hasFamily?: boolean
  arrivalDate?: string | null
}

export interface GeneratedChecklist {
  items: ChecklistItem[]
  generatedAt: string
  sources?: { title: string; url: string }[]
  warnings?: string[]
  visaType?: string
  isFallback?: boolean
}
