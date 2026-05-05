// Common occupations — used as autocomplete suggestions for the
// occupation input on the onboarding wizard. The user can free-type
// any title; this list is just shortcuts. Biased toward fields that
// matter for visa eligibility (regulated professions, shortage
// occupation lists, highly-skilled categories).

export const COMMON_OCCUPATIONS: string[] = [
  // Tech
  "Software engineer",
  "Data scientist",
  "Product manager",
  "UX designer",
  "DevOps engineer",
  "ML engineer",

  // Healthcare (often regulated / shortage occupation)
  "Nurse",
  "Doctor",
  "Pharmacist",
  "Dentist",
  "Physiotherapist",

  // Engineering
  "Civil engineer",
  "Mechanical engineer",
  "Electrical engineer",
  "Architect",

  // Business & finance
  "Accountant",
  "Financial analyst",
  "Marketing manager",
  "Sales manager",
  "Consultant",
  "Entrepreneur / founder",

  // Education
  "Teacher",
  "University researcher",
  "PhD student",

  // Creative / media
  "Designer",
  "Writer",
  "Photographer",
  "Filmmaker",

  // Trades & services
  "Chef",
  "Electrician",
  "Plumber",
  "Carpenter",

  // Other common
  "Lawyer",
  "Translator",
  "Journalist",
  "Student",
  "Retired",
  "Freelancer",
  "Self-employed",
]
