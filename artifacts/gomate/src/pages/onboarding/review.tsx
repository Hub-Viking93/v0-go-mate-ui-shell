// =============================================================
// /onboarding/review — wizard step 5 (universal).
// =============================================================
// Single route for all purposes. Reads profile_data, renders
// only the fields that are actually filled, grouped into:
//
//   1. Profile
//   2. Destination
//   3. Purpose details   ← title + edit-route depend on purpose,
//                          contents are picked from the schema
//                          based on profile.purpose
//   4. Visa & finance
//
// Submit triggers /api/plans/trigger-research and hard-navigates
// to /dashboard?research=triggered, matching the legacy chat
// flow's behaviour so the dashboard's ResearchProgressModal
// picks up the run.
// =============================================================

import * as React from "react"
import { Link } from "wouter"
import { useRouter } from "@/lib/router-compat"
import { format, parseISO } from "date-fns"
import { Pencil } from "lucide-react"
import {
  OnboardingShell,
  OnboardingSection,
} from "./_shell"

// --- value formatting / label maps -------------------------------------

const PURPOSE_LABELS: Record<string, string> = {
  study: "Study",
  work: "Work",
  digital_nomad: "Digital nomad",
  settle: "Settle",
}

const DURATION_LABELS: Record<string, string> = {
  "3-6_months": "3–6 months",
  "6-12_months": "6–12 months",
  "1-2_years": "1–2 years",
  permanent: "3+ years / permanent",
  not_sure: "Not sure yet",
}

const STUDY_TYPE_LABELS: Record<string, string> = {
  university: "University",
  language_school: "Language school",
  vocational: "Vocational",
  exchange: "Exchange",
}

const STUDY_FUNDING_LABELS: Record<string, string> = {
  self_funded: "Own savings",
  scholarship: "Scholarship",
  student_loan: "Student loan",
  family_support: "Family support",
  mixed: "Mixed",
}

const EDUCATION_LABELS: Record<string, string> = {
  high_school: "High school",
  vocational: "Vocational / Trade certificate",
  bachelors: "Bachelor's degree",
  masters: "Master's degree",
  phd: "Doctorate / PhD",
  other: "Other",
}

const HEALTHCARE_LABELS: Record<string, string> = {
  none: "None",
  chronic_condition: "Chronic condition",
  disability: "Disability",
}

const PETS_LABELS: Record<string, string> = {
  none: "None",
  dog: "Dog",
  cat: "Cat",
  other: "Other",
}

const WORK_WHILE_STUDYING_LABELS: Record<string, string> = {
  yes_part_time: "Yes, part-time",
  yes_breaks_only: "Yes, during breaks only",
  no: "No",
  not_sure: "Not sure",
}

const JOB_OFFER_LABELS: Record<string, string> = {
  yes: "Have a job offer",
  in_progress: "Interviewing / in progress",
  no: "Still looking",
}

const JOB_FIELD_LABELS: Record<string, string> = {
  tech: "Tech / IT",
  engineering: "Engineering",
  healthcare: "Healthcare",
  finance: "Finance",
  education: "Education",
  marketing_sales: "Marketing / Sales",
  hospitality: "Hospitality / Service",
  construction: "Construction / Skilled trades",
  other: "Other",
}

const YEARS_EXPERIENCE_LABELS: Record<string, string> = {
  "0_1": "0–1 years",
  "2_4": "2–4 years",
  "5_9": "5–9 years",
  "10_plus": "10+ years",
}

const YES_NO_NOT_SURE_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  not_sure: "Not sure",
}

const POSTING_DURATION_LABELS: Record<string, string> = {
  "0_6_months": "0–6 months",
  "6_12_months": "6–12 months",
  "12_24_months": "12–24 months",
  "24_plus_months": "24+ months",
  not_sure: "Not sure",
}

const PRE_FIRST_PAYCHECK_LABELS: Record<string, string> = {
  own_savings: "Own savings",
  family_support: "Family support",
  employer_support: "Employer support / relocation package",
  mixed: "Mixed",
  not_sure: "Not sure",
}

const POSTING_DOC_STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  obtained: "Obtained",
  not_applicable: "Not applicable",
}

const SETTLEMENT_REASON_LABELS: Record<string, string> = {
  retirement: "Retirement",
  family_reunion: "Family reunion",
  ancestry: "Ancestry / heritage",
  investment: "Investment",
  lifestyle: "Lifestyle / long-term move",
  other: "Other",
}

const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  spouse: "Spouse",
  "fiancé": "Fiancé / fiancée",
  registered_partner: "Registered partner",
  cohabitant: "Cohabitant / sambo",
  parent: "Parent",
  child: "Child",
  other: "Other family member",
}

const PARTNER_VISA_STATUS_LABELS: Record<string, string> = {
  citizen: "Citizen",
  permanent_resident: "Permanent resident",
  work_visa: "Work visa",
  student_visa: "Student visa",
  other: "Other",
}

const RELATIONSHIP_DURATION_LABELS: Record<string, string> = {
  less_than_1_year: "Less than 1 year",
  "1_2_years": "1–2 years",
  "3_5_years": "3–5 years",
  "5_plus_years": "5+ years",
}

const SETTLEMENT_SUPPORT_LABELS: Record<string, string> = {
  own_savings: "Own savings",
  pension: "Pension / retirement income",
  investment_income: "Investment income",
  remote_income: "Remote income",
  family_support: "Family support",
  mixed: "Mixed",
  not_sure: "Not sure",
}

const INCOME_SOURCE_LABELS: Record<string, string> = {
  freelance: "Freelance",
  remote_employee: "Remote employee",
  business_owner: "Business owner",
  mixed: "Mixed",
}

const INCOME_CONSISTENCY_LABELS: Record<string, string> = {
  stable: "Stable",
  variable: "Variable",
  new: "New / just started",
}

const INCOME_HISTORY_LABELS: Record<string, string> = {
  less_than_3_months: "Less than 3 months",
  "3_6_months": "3–6 months",
  "6_12_months": "6–12 months",
  "12_plus_months": "12+ months",
}

const KEEP_CURRENT_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  partly: "Partly",
  not_sure: "Not sure",
}

const FOREIGN_INCOME_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  mixed: "Mixed",
  not_sure: "Not sure",
}

const INCOME_COVERS_LIVING_LABELS: Record<string, string> = {
  yes: "Yes",
  no: "No",
  not_sure: "Not sure",
}

const LANGUAGE_LEVEL_LABELS: Record<string, string> = {
  none: "None",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  fluent: "Fluent",
  native: "Native",
}

function fmtYesNo(v: unknown): string | null {
  if (v === "yes") return "Yes"
  if (v === "no") return "No"
  return null
}

function fmtTimeline(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null
  if (v === "flexible") return "Flexible"
  try {
    const d = parseISO(v)
    if (!Number.isNaN(d.getTime())) return format(d, "MMMM d, yyyy")
  } catch {}
  return v
}

function fmtLanguagesSpoken(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null
  return v
    .map((l: { language?: unknown; level?: unknown }) => {
      const lang = typeof l.language === "string" ? l.language : ""
      const lvl =
        typeof l.level === "string"
          ? LANGUAGE_LEVEL_LABELS[l.level] ?? l.level
          : ""
      return lvl ? `${lang} · ${lvl}` : lang
    })
    .filter(Boolean)
    .join(", ")
}

function fmtCurrencyAmount(amount: unknown, currency: unknown): string | null {
  if (typeof amount !== "string" || !amount) return null
  const n = Number(amount.replace(/[^\d.-]/g, ""))
  if (Number.isNaN(n)) return amount
  const cur = typeof currency === "string" ? currency : ""
  return cur ? `${n.toLocaleString()} ${cur}` : n.toLocaleString()
}

function fmtPlain(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v
  return null
}

function fmtMapped(map: Record<string, string>) {
  return (v: unknown): string | null => {
    if (typeof v !== "string" || !v) return null
    return map[v] ?? v
  }
}

// --- review schema -----------------------------------------------------

interface ReviewRow {
  label: string
  value: string
}

type Profile = Record<string, unknown>

function buildProfileRows(p: Profile): ReviewRow[] {
  const rows: ReviewRow[] = []
  const push = (label: string, value: string | null) => {
    if (value) rows.push({ label, value })
  }

  push("Name", fmtPlain(p.name))
  push("Year of birth", fmtPlain(p.birth_year))
  push("Citizenship", fmtPlain(p.citizenship))
  push("Other citizenship", fmtPlain(p.other_citizenships))
  push(
    "Currently in",
    [fmtPlain(p.current_city), fmtPlain(p.current_location)].filter(Boolean).join(", "),
  )
  push("Languages", fmtLanguagesSpoken(p.languages_spoken))

  return rows
}

function buildDestinationRows(p: Profile): ReviewRow[] {
  const rows: ReviewRow[] = []
  const push = (label: string, value: string | null) => {
    if (value) rows.push({ label, value })
  }

  push(
    "Going to",
    [fmtPlain(p.target_city), fmtPlain(p.destination)].filter(Boolean).join(", "),
  )
  push("Purpose", fmtMapped(PURPOSE_LABELS)(p.purpose))
  push("Move date", fmtTimeline(p.timeline))
  push("Duration", fmtMapped(DURATION_LABELS)(p.duration))

  return rows
}

function buildPurposeDetailsRows(p: Profile): ReviewRow[] {
  const rows: ReviewRow[] = []
  const push = (label: string, value: string | null) => {
    if (value) rows.push({ label, value })
  }

  switch (p.purpose) {
    case "study":
      push("Type of study", fmtMapped(STUDY_TYPE_LABELS)(p.study_type))
      push(
        p.study_type === "language_school" ? "Language" : "Field of study",
        fmtPlain(p.study_field),
      )
      if (p.study_type === "language_school") {
        push(
          "Current level",
          fmtMapped(LANGUAGE_LEVEL_LABELS)(p.language_skill),
        )
      }
      push("Highest education", fmtMapped(EDUCATION_LABELS)(p.education_level))
      push("Funding", fmtMapped(STUDY_FUNDING_LABELS)(p.study_funding))
      break

    case "work":
      push("Job situation", fmtMapped(JOB_OFFER_LABELS)(p.job_offer))
      push("Field", fmtMapped(JOB_FIELD_LABELS)(p.job_field))
      push("Highest education", fmtMapped(EDUCATION_LABELS)(p.education_level))
      push("Years of experience", fmtMapped(YEARS_EXPERIENCE_LABELS)(p.years_experience))
      push("Highly skilled", fmtMapped(YES_NO_NOT_SURE_LABELS)(p.highly_skilled))
      // employer_sponsorship is gated on job_offer in {yes, in_progress}
      // on the wizard. Show whatever's stored (the wizard auto-clears on
      // gating change, so a stale value shouldn't be there).
      if (p.job_offer === "yes" || p.job_offer === "in_progress") {
        push(
          "Employer will sponsor visa",
          fmtMapped(YES_NO_NOT_SURE_LABELS)(p.employer_sponsorship),
        )
      }
      push(
        "Company posting / secondment",
        fmtMapped(YES_NO_NOT_SURE_LABELS)(p.posting_or_secondment),
      )
      if (p.posting_or_secondment === "yes") {
        push("Home-country employer", fmtPlain(p.home_country_employer))
        push("Employer address", fmtPlain(p.posting_employer_address))
        push(
          "Posting duration",
          fmtMapped(POSTING_DURATION_LABELS)(p.posting_duration_months),
        )
      }
      break

    case "settle":
      push("Reason", fmtMapped(SETTLEMENT_REASON_LABELS)(p.settlement_reason))
      push("Family ties in country", fmtYesNo(p.family_ties))
      if (p.settlement_reason === "family_reunion") {
        push("Joining", fmtMapped(RELATIONSHIP_TYPE_LABELS)(p.relationship_type))
        push("Their citizenship", fmtPlain(p.partner_citizenship))
        push(
          "Their status",
          fmtMapped(PARTNER_VISA_STATUS_LABELS)(p.partner_visa_status),
        )
        push(
          "Relationship duration",
          fmtMapped(RELATIONSHIP_DURATION_LABELS)(p.relationship_duration),
        )
      }
      push("Current occupation", fmtPlain(p.current_occupation))
      push("Highest education", fmtMapped(EDUCATION_LABELS)(p.education_level))
      push("Special requirements", fmtPlain(p.special_requirements))
      break

    case "digital_nomad":
      push("Already earns remotely", fmtYesNo(p.remote_income))
      push("Income source", fmtMapped(INCOME_SOURCE_LABELS)(p.income_source))
      push(
        "Approx. monthly income",
        fmtCurrencyAmount(p.monthly_income, p.preferred_currency),
      )
      push(
        "Income consistency",
        fmtMapped(INCOME_CONSISTENCY_LABELS)(p.income_consistency),
      )
      push(
        "Income history",
        fmtMapped(INCOME_HISTORY_LABELS)(p.income_history_months),
      )
      push(
        "Keeps current clients / employer",
        fmtMapped(KEEP_CURRENT_LABELS)(p.keep_current_remote_work),
      )
      push(
        "Foreign-only income",
        fmtMapped(FOREIGN_INCOME_LABELS)(p.foreign_income_only),
      )
      break
  }

  return rows
}

function buildVisaFinanceRows(p: Profile): ReviewRow[] {
  const rows: ReviewRow[] = []
  const push = (label: string, value: string | null) => {
    if (value) rows.push({ label, value })
  }

  push(
    "Saved so far",
    fmtCurrencyAmount(p.savings_available, p.preferred_currency),
  )
  if (p.purpose === "study") {
    push(
      "Work while studying",
      fmtMapped(WORK_WHILE_STUDYING_LABELS)(p.work_while_studying),
    )
  }
  if (p.purpose === "work") {
    push(
      "Support before first paycheck",
      fmtMapped(PRE_FIRST_PAYCHECK_LABELS)(p.pre_first_paycheck_support),
    )
  }
  if (p.purpose === "settle") {
    push(
      "Support after the move",
      fmtMapped(SETTLEMENT_SUPPORT_LABELS)(p.settlement_support_source),
    )
  }
  if (p.purpose === "digital_nomad") {
    push(
      "Income covers living costs",
      fmtMapped(INCOME_COVERS_LIVING_LABELS)(p.income_covers_living_costs),
    )
  }
  push("Prior visa for this country", fmtYesNo(p.prior_visa))
  push("Prior visa type", fmtPlain(p.prior_visa_type))
  push("Visa rejections", fmtYesNo(p.visa_rejections))
  push("Criminal record / legal issues", fmtYesNo(p.criminal_record))
  push("Healthcare needs", fmtMapped(HEALTHCARE_LABELS)(p.healthcare_needs))
  push("Prescription medications", fmtYesNo(p.prescription_medications))
  push("Pets", fmtMapped(PETS_LABELS)(p.pets))
  // Posting compliance is only collected when work + posting=yes. The
  // visa-finance page nulls these fields for any other shape, so checking
  // value-presence is enough — but we also gate on the upstream flags
  // for clarity.
  if (p.purpose === "work" && p.posting_or_secondment === "yes") {
    push(
      "A1 certificate",
      fmtMapped(POSTING_DOC_STATUS_LABELS)(p.a1_certificate_status),
    )
    push(
      "Certificate of Coverage",
      fmtMapped(POSTING_DOC_STATUS_LABELS)(p.coc_status),
    )
    push("Posted-worker declaration filed", fmtMapped(YES_NO_NOT_SURE_LABELS)(p.pwd_filed))
  }

  return rows
}

function getPurposeStepRoute(purpose: unknown): string {
  switch (purpose) {
    case "work":
      return "/onboarding/work"
    case "study":
      return "/onboarding/study"
    case "digital_nomad":
      return "/onboarding/digital-nomad"
    case "settle":
      return "/onboarding/settle"
    default:
      return "/onboarding/study"
  }
}

function getPurposeSectionTitle(purpose: unknown): string {
  switch (purpose) {
    case "work":
      return "Work details"
    case "study":
      return "Study details"
    case "digital_nomad":
      return "Remote-work details"
    case "settle":
      return "Settlement details"
    default:
      return "Purpose details"
  }
}

// --- API plumbing ------------------------------------------------------

async function fetchProfile(): Promise<{
  plan: { profile_data: Profile | null } | null
}> {
  const res = await fetch("/api/profile")
  if (!res.ok) throw new Error(`GET /api/profile ${res.status}`)
  return res.json()
}

async function triggerResearch(): Promise<void> {
  const res = await fetch("/api/plans/trigger-research", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }
}

// --- review section UI -------------------------------------------------

interface ReviewBlockProps {
  title: string
  editRoute: string
  rows: ReviewRow[]
}

function ReviewBlock({ title, editRoute, rows }: ReviewBlockProps) {
  if (rows.length === 0) return null
  return (
    <OnboardingSection title={title}>
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-card overflow-hidden">
        <div className="flex items-center justify-end px-3 pt-2 pb-0.5">
          <Link
            href={editRoute}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </Link>
        </div>
        <dl className="divide-y divide-stone-100 dark:divide-stone-800">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-4 px-3 py-2"
            >
              <dt className="text-[12px] text-muted-foreground shrink-0">{r.label}</dt>
              <dd className="text-[13px] text-foreground text-right break-words min-w-0">
                {r.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </OnboardingSection>
  )
}

// --- page --------------------------------------------------------------

export default function OnboardingReviewPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(true)
  const [profile, setProfile] = React.useState<Profile>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetchProfile()
      .then((data) => {
        if (cancelled) return
        setProfile((data.plan?.profile_data ?? {}) as Profile)
      })
      .catch((err) => {
        console.error("[onboarding/review] hydrate failed", err)
        setErrorBanner("Couldn't load your saved data.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async () => {
    setErrorBanner(null)
    setSubmitting(true)
    try {
      await triggerResearch()
      // Hard navigation so dashboard re-fetches plan state from a clean
      // slate and the ResearchProgressModal opens.
      window.location.href = "/dashboard?research=triggered"
    } catch (err) {
      console.error("[onboarding/review] trigger-research failed", err)
      setErrorBanner(
        err instanceof Error ? err.message : "Couldn't start your plan. Try again.",
      )
      setSubmitting(false)
    }
  }

  const handleBack = () => router.push("/onboarding/visa-finance")

  if (loading) {
    return (
      <OnboardingShell
        step={5}
        totalSteps={5}
        eyebrow="Step 5 of 5"
        title="Review your details"
        subtitle="Double-check everything looks right, then we generate your plan."
        primaryDisabled
      >
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-24 bg-muted rounded-xl" />
            </div>
          ))}
        </div>
      </OnboardingShell>
    )
  }

  const profileRows = buildProfileRows(profile)
  const destinationRows = buildDestinationRows(profile)
  const purposeRows = buildPurposeDetailsRows(profile)
  const visaFinanceRows = buildVisaFinanceRows(profile)

  return (
    <OnboardingShell
      step={5}
      totalSteps={5}
      eyebrow="Step 5 of 5"
      title="Review your details"
      subtitle="Double-check everything looks right, then we generate your plan."
      primaryLabel="Generate my plan"
      primaryLoading={submitting}
      onPrimary={handleSubmit}
      onBack={handleBack}
      errorBanner={errorBanner}
    >
      <div className="space-y-6">
        <ReviewBlock
          title="Profile"
          editRoute="/onboarding/profile"
          rows={profileRows}
        />
        <ReviewBlock
          title="Destination"
          editRoute="/onboarding/destination"
          rows={destinationRows}
        />
        <ReviewBlock
          title={getPurposeSectionTitle(profile.purpose)}
          editRoute={getPurposeStepRoute(profile.purpose)}
          rows={purposeRows}
        />
        <ReviewBlock
          title="Visa & finance"
          editRoute="/onboarding/visa-finance"
          rows={visaFinanceRows}
        />

        <p className="text-xs text-muted-foreground text-center px-4">
          Once you generate your plan, our AI specialists start researching your visa
          pathway, budget, timeline, and document checklist. It takes a few minutes.
        </p>
      </div>
    </OnboardingShell>
  )
}
