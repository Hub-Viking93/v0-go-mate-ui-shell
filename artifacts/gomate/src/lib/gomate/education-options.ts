// Education-level options for the wizard dropdown. Values are stored
// as lowercase keys in profile.education_level so visa logic and
// downstream consumers can pattern-match on them. Labels are what
// the user sees.

export interface EducationOption {
  value: string
  label: string
}

export const EDUCATION_OPTIONS: EducationOption[] = [
  { value: "high_school", label: "High school" },
  { value: "vocational", label: "Vocational / Trade certificate" },
  { value: "bachelors", label: "Bachelor's degree" },
  { value: "masters", label: "Master's degree" },
  { value: "phd", label: "Doctorate / PhD" },
  { value: "other", label: "Other" },
]

export const LANGUAGE_LEVEL_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "fluent", label: "Fluent" },
  { value: "native", label: "Native" },
] as const

export type LanguageLevel = (typeof LANGUAGE_LEVEL_OPTIONS)[number]["value"]
