// =============================================================
// /onboarding/work — wizard step 3 (work branch).
// =============================================================
// Reached only when destination's purpose === "work". Captures
// the work-specific shape of the move:
//
//   1. Work Setup — job_offer, job_field, education_level,
//      years_experience, highly_skilled
//   2. Employer Path — employer_sponsorship (gated on a job
//      being lined up), posting_or_secondment, and the posting
//      block (employer name + address + duration) when applicable
//
// Posting compliance status (a1, coc, pwd) lives on step 4 with
// the rest of the visa/document state — not here.
// =============================================================

import * as React from "react"
import { useRouter } from "@/lib/router-compat"
import { Input } from "@/components/ui/input"
import {
  OnboardingShell,
  OnboardingSection,
  OnboardingField,
} from "./_shell"
import { OptionPills } from "@/components/onboarding/option-pills"
import { EducationSelect } from "@/components/onboarding/education-select"

// --- options -------------------------------------------------------------

const JOB_OFFER_OPTIONS = [
  { value: "yes", label: "I already have a job offer" },
  { value: "in_progress", label: "I'm interviewing / in progress" },
  { value: "no", label: "I'm still looking" },
] as const

const JOB_FIELD_OPTIONS = [
  { value: "tech", label: "Tech / IT" },
  { value: "engineering", label: "Engineering" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "education", label: "Education" },
  { value: "marketing_sales", label: "Marketing / Sales" },
  { value: "hospitality", label: "Hospitality / Service" },
  { value: "construction", label: "Construction / Skilled trades" },
  { value: "other", label: "Other" },
] as const

const YEARS_EXPERIENCE_OPTIONS = [
  { value: "0_1", label: "0–1 years" },
  { value: "2_4", label: "2–4 years" },
  { value: "5_9", label: "5–9 years" },
  { value: "10_plus", label: "10+ years" },
] as const

const YES_NO_NOT_SURE = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_sure", label: "Not sure" },
] as const

const POSTING_DURATION_OPTIONS = [
  { value: "0_6_months", label: "0–6 months" },
  { value: "6_12_months", label: "6–12 months" },
  { value: "12_24_months", label: "12–24 months" },
  { value: "24_plus_months", label: "24+ months" },
  { value: "not_sure", label: "Not sure" },
] as const

// --- form state ----------------------------------------------------------

interface WorkFormState {
  job_offer: string | null
  job_field: string | null
  education_level: string | null
  years_experience: string | null
  highly_skilled: string | null
  employer_sponsorship: string | null
  posting_or_secondment: string | null
  home_country_employer: string | null
  posting_employer_address: string | null
  posting_duration_months: string | null
}

const EMPTY_FORM: WorkFormState = {
  job_offer: null,
  job_field: null,
  education_level: null,
  years_experience: null,
  highly_skilled: null,
  employer_sponsorship: null,
  posting_or_secondment: null,
  home_country_employer: null,
  posting_employer_address: null,
  posting_duration_months: null,
}

interface ValidationErrors {
  job_offer?: string
  job_field?: string
  education_level?: string
  years_experience?: string
  highly_skilled?: string
  employer_sponsorship?: string
  posting_or_secondment?: string
  home_country_employer?: string
  posting_employer_address?: string
  posting_duration_months?: string
}

function validate(form: WorkFormState): ValidationErrors {
  const e: ValidationErrors = {}
  if (!form.job_offer) e.job_offer = "Pick the option that fits."
  if (!form.job_field) e.job_field = "Pick the field you'll work in."
  if (!form.education_level) e.education_level = "Pick your highest completed education."
  if (!form.years_experience) e.years_experience = "Pick how much experience you have."
  if (!form.highly_skilled) e.highly_skilled = "Pick the option that fits."
  if (
    (form.job_offer === "yes" || form.job_offer === "in_progress") &&
    !form.employer_sponsorship
  ) {
    e.employer_sponsorship = "Pick the option that fits."
  }
  if (!form.posting_or_secondment) {
    e.posting_or_secondment = "Pick the option that fits."
  }
  if (form.posting_or_secondment === "yes") {
    if (!form.home_country_employer?.trim()) {
      e.home_country_employer = "Tell us your home-country employer."
    }
    if (!form.posting_employer_address?.trim()) {
      e.posting_employer_address = "Enter the employer's registered address."
    }
    if (!form.posting_duration_months) {
      e.posting_duration_months = "Pick how long the posting will last."
    }
  }
  return e
}

// --- API plumbing --------------------------------------------------------

interface PlanResponse {
  plan: {
    id: string
    plan_version: number
    profile_data: Record<string, unknown> | null
  } | null
}

async function fetchProfile(): Promise<PlanResponse> {
  const res = await fetch("/api/profile")
  if (!res.ok) throw new Error(`GET /api/profile ${res.status}`)
  return res.json()
}

async function patchProfile(
  profileData: Record<string, unknown>,
  expectedVersion: number,
): Promise<PlanResponse> {
  const res = await fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profileData, expectedVersion }),
  })
  if (res.status === 409) throw new VersionConflictError()
  if (!res.ok) throw new Error(`PATCH /api/profile ${res.status}`)
  return res.json()
}

class VersionConflictError extends Error {
  constructor() {
    super("Version conflict")
    this.name = "VersionConflictError"
  }
}

// --- page ---------------------------------------------------------------

export default function OnboardingWorkPage() {
  const router = useRouter()

  const [form, setForm] = React.useState<WorkFormState>(EMPTY_FORM)
  const [planVersion, setPlanVersion] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [submitAttempted, setSubmitAttempted] = React.useState(false)
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null)

  const update = React.useCallback(
    <K extends keyof WorkFormState>(key: K, value: WorkFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  React.useEffect(() => {
    let cancelled = false
    fetchProfile()
      .then((data) => {
        if (cancelled) return
        const pd = (data.plan?.profile_data ?? {}) as Record<string, unknown>
        setPlanVersion(data.plan?.plan_version ?? 1)
        setForm({
          job_offer: typeof pd.job_offer === "string" ? pd.job_offer : null,
          job_field: typeof pd.job_field === "string" ? pd.job_field : null,
          education_level:
            typeof pd.education_level === "string" ? pd.education_level : null,
          years_experience:
            typeof pd.years_experience === "string" ? pd.years_experience : null,
          highly_skilled:
            typeof pd.highly_skilled === "string" ? pd.highly_skilled : null,
          employer_sponsorship:
            typeof pd.employer_sponsorship === "string"
              ? pd.employer_sponsorship
              : null,
          posting_or_secondment:
            typeof pd.posting_or_secondment === "string"
              ? pd.posting_or_secondment
              : null,
          home_country_employer:
            typeof pd.home_country_employer === "string"
              ? pd.home_country_employer
              : null,
          posting_employer_address:
            typeof pd.posting_employer_address === "string"
              ? pd.posting_employer_address
              : null,
          posting_duration_months:
            typeof pd.posting_duration_months === "string"
              ? pd.posting_duration_months
              : null,
        })
      })
      .catch((err) => {
        console.error("[onboarding/work] hydrate failed", err)
        setErrorBanner("Couldn't load your saved data. You can still continue.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Clear gated answers if their gating field changes back.
  React.useEffect(() => {
    if (
      form.job_offer !== "yes" &&
      form.job_offer !== "in_progress" &&
      form.employer_sponsorship
    ) {
      update("employer_sponsorship", null)
    }
  }, [form.job_offer, form.employer_sponsorship, update])

  React.useEffect(() => {
    if (form.posting_or_secondment !== "yes") {
      if (form.home_country_employer) update("home_country_employer", null)
      if (form.posting_employer_address) update("posting_employer_address", null)
      if (form.posting_duration_months) update("posting_duration_months", null)
    }
  }, [
    form.posting_or_secondment,
    form.home_country_employer,
    form.posting_employer_address,
    form.posting_duration_months,
    update,
  ])

  const errors = submitAttempted ? validate(form) : {}
  const hasErrors = Object.keys(validate(form)).length > 0

  const buildProfileData = (): Record<string, unknown> => ({
    job_offer: form.job_offer,
    job_field: form.job_field,
    education_level: form.education_level,
    years_experience: form.years_experience,
    highly_skilled: form.highly_skilled,
    employer_sponsorship: form.employer_sponsorship,
    posting_or_secondment: form.posting_or_secondment,
    home_country_employer: form.home_country_employer?.trim() || null,
    posting_employer_address: form.posting_employer_address?.trim() || null,
    posting_duration_months: form.posting_duration_months,
  })

  const save = async (
    onSuccess: () => void,
    opts: { requireValid: boolean },
  ) => {
    setErrorBanner(null)
    if (opts.requireValid) {
      setSubmitAttempted(true)
      if (hasErrors) {
        setErrorBanner("Some fields need attention before you can continue.")
        return
      }
    }
    if (planVersion === null) {
      setErrorBanner("Still loading. Try again in a second.")
      return
    }
    setSaving(true)
    try {
      const result = await patchProfile(buildProfileData(), planVersion)
      if (result.plan?.plan_version) setPlanVersion(result.plan.plan_version)
      onSuccess()
    } catch (err) {
      if (err instanceof VersionConflictError) {
        try {
          const fresh = await fetchProfile()
          const v = fresh.plan?.plan_version ?? 1
          setPlanVersion(v)
          const retry = await patchProfile(buildProfileData(), v)
          if (retry.plan?.plan_version) setPlanVersion(retry.plan.plan_version)
          onSuccess()
          return
        } catch (retryErr) {
          console.error("[onboarding/work] retry after conflict failed", retryErr)
        }
      } else {
        console.error("[onboarding/work] save failed", err)
      }
      setErrorBanner("Couldn't save. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleContinue = () => {
    void save(() => router.push("/onboarding/visa-finance"), { requireValid: true })
  }

  const handleSaveExit = () => {
    void save(() => router.push("/dashboard"), { requireValid: false })
  }

  const handleBack = () => router.push("/onboarding/destination")

  if (loading) {
    return (
      <OnboardingShell
        step={3}
        totalSteps={5}
        eyebrow="Step 3 of 5"
        title="Tell us about your work"
        subtitle="Job, experience, and your employer path."
        primaryDisabled
      >
        <div className="space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          ))}
        </div>
      </OnboardingShell>
    )
  }

  const showEmployerSponsorship =
    form.job_offer === "yes" || form.job_offer === "in_progress"
  const showPostingBlock = form.posting_or_secondment === "yes"

  return (
    <OnboardingShell
      step={3}
      totalSteps={5}
      eyebrow="Step 3 of 5"
      title="Tell us about your work"
      subtitle="Job, experience, and your employer path."
      primaryLabel="Save & continue"
      primaryLoading={saving}
      onPrimary={handleContinue}
      onSecondary={handleSaveExit}
      onBack={handleBack}
      errorBanner={errorBanner}
    >
      <div className="space-y-6">
        <OnboardingSection title="Work setup">
          <OnboardingField
            label="What kind of work situation fits you best?"
            error={errors.job_offer}
          >
            <OptionPills
              options={JOB_OFFER_OPTIONS}
              value={form.job_offer}
              onChange={(v) => update("job_offer", v)}
              ariaLabel="Job offer status"
            />
          </OnboardingField>

          <OnboardingField
            label="What field will you be working in?"
            error={errors.job_field}
          >
            <OptionPills
              options={JOB_FIELD_OPTIONS}
              value={form.job_field}
              onChange={(v) => update("job_field", v)}
              ariaLabel="Job field"
            />
          </OnboardingField>

          <OnboardingField
            label="What is your highest completed education?"
            htmlFor="education_level"
            error={errors.education_level}
          >
            <EducationSelect
              id="education_level"
              value={form.education_level}
              onChange={(v) => update("education_level", v)}
            />
          </OnboardingField>

          <OnboardingField
            label="How many years of experience do you have in this field?"
            error={errors.years_experience}
          >
            <OptionPills
              options={YEARS_EXPERIENCE_OPTIONS}
              value={form.years_experience}
              onChange={(v) => update("years_experience", v)}
              ariaLabel="Years of experience"
            />
          </OnboardingField>

          <OnboardingField
            label="Would you consider yourself highly skilled for this role?"
            helper="Affects eligibility for fast-track work visas (e.g. EU Blue Card)."
            error={errors.highly_skilled}
          >
            <OptionPills
              options={YES_NO_NOT_SURE}
              value={form.highly_skilled}
              onChange={(v) => update("highly_skilled", v)}
              ariaLabel="Highly skilled"
            />
          </OnboardingField>
        </OnboardingSection>

        <OnboardingSection title="Employer path">
          {showEmployerSponsorship && (
            <OnboardingField
              label="Will your employer sponsor your visa?"
              error={errors.employer_sponsorship}
            >
              <OptionPills
                options={YES_NO_NOT_SURE}
                value={form.employer_sponsorship}
                onChange={(v) => update("employer_sponsorship", v)}
                ariaLabel="Employer sponsorship"
              />
            </OnboardingField>
          )}

          <OnboardingField
            label="Is this a company transfer or secondment?"
            helper="A posting is when your home-country employer sends you to work in the destination temporarily."
            error={errors.posting_or_secondment}
          >
            <OptionPills
              options={YES_NO_NOT_SURE}
              value={form.posting_or_secondment}
              onChange={(v) => update("posting_or_secondment", v)}
              ariaLabel="Posting or secondment"
            />
          </OnboardingField>

          {showPostingBlock && (
            <>
              <OnboardingField
                label="What is the name of your home-country employer?"
                htmlFor="home_country_employer"
                error={errors.home_country_employer}
              >
                <Input
                  id="home_country_employer"
                  type="text"
                  value={form.home_country_employer ?? ""}
                  onChange={(e) =>
                    update("home_country_employer", e.target.value || null)
                  }
                  placeholder="e.g. Acme AB"
                  className="h-10"
                  maxLength={160}
                />
              </OnboardingField>

              <OnboardingField
                label="What is the employer's registered address?"
                htmlFor="posting_employer_address"
                error={errors.posting_employer_address}
              >
                <Input
                  id="posting_employer_address"
                  type="text"
                  value={form.posting_employer_address ?? ""}
                  onChange={(e) =>
                    update("posting_employer_address", e.target.value || null)
                  }
                  placeholder="Street, city, country"
                  className="h-10"
                  maxLength={240}
                />
              </OnboardingField>

              <OnboardingField
                label="How long will the posting last?"
                error={errors.posting_duration_months}
              >
                <OptionPills
                  options={POSTING_DURATION_OPTIONS}
                  value={form.posting_duration_months}
                  onChange={(v) => update("posting_duration_months", v)}
                  ariaLabel="Posting duration"
                />
              </OnboardingField>
            </>
          )}
        </OnboardingSection>
      </div>
    </OnboardingShell>
  )
}
