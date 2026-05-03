export interface SettlingTask {
  id: string
  title: string
  description?: string
  category: SettlingCategory
  priority: "high" | "medium" | "low"
  timeframe: string
  why?: string
  url?: string
  source?: string
  completed?: boolean
}

export type SettlingCategory =
  | "registration"
  | "banking"
  | "housing"
  | "healthcare"
  | "transport"
  | "communication"
  | "community"
  | "documents"
  | "tax"
  | "other"

export const SETTLING_CATEGORIES: { key: SettlingCategory; label: string; icon: string }[] = [
  { key: "registration", label: "Registration", icon: "FileText" },
  { key: "banking", label: "Banking", icon: "Wallet" },
  { key: "housing", label: "Housing", icon: "Home" },
  { key: "healthcare", label: "Healthcare", icon: "Heart" },
  { key: "transport", label: "Transport", icon: "Car" },
  { key: "communication", label: "Communication", icon: "Phone" },
  { key: "community", label: "Community", icon: "Users" },
  { key: "documents", label: "Documents", icon: "FileCheck" },
  { key: "tax", label: "Tax", icon: "Calculator" },
  { key: "other", label: "Other", icon: "MoreHorizontal" },
]

export interface SettlingGeneratorInput {
  destinationCountry: string
  arrivalDate?: string | null
}

export interface GeneratedSettlingPlan {
  tasks: SettlingTask[]
  generatedAt: string
  sources?: { title: string; url: string }[]
}
