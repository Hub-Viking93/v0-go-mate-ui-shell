// =============================================================
// /onboarding/digital-nomad — wizard step 3 (digital_nomad branch).
// =============================================================
// Reached only when destination's purpose === "digital_nomad".
// Captures the income and work-style shape that drives DN visas:
// most jurisdictions require proof of foreign-only income, a
// minimum monthly amount, and 6–12 months of history. Section 1
// nails the income facts; Section 2 handles the work-style
// follow-ups.
// =============================================================

import * as React from "react"
import { useRouter } from "@/lib/router-compat"
import {
  OnboardingShell,
  OnboardingSection,
  OnboardingField,
} from "./_shell"
import { OptionPills } from "@/components/onboarding/option-pills"
import { CurrencyAmountInput } from "@/components/onboarding/currency-amount-input"
import { getCurrencyFromCountry } from "@/lib/gomate/currency"

// --- options -------------------------------------------------------------

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const

const INCOME_SOURCE_OPTIONS = [
  { value: "freelance", label: "Freelance" },
  { value: "remote_employee", label: "Remote employee" },
  { value: "business_owner", label: "Business owner" },
  { value: "mixed", label: "Mixed" },
] as const

const INCOME_CONSISTENCY_OPTIONS = [
  { value: "stable", label: "Stable" },
  { value: "variable", label: "Variable" },
  { value: "new", label: "New / just started" },
] as const

const INCOME_HISTORY_OPTIONS = [
  { value: "less_than_3_months", label: "Less than 3 months" },
  { value: "3_6_months", label: "3–6 months" },
  { value: "6_12_months", label: "6–12 months" },
  { value: "12_plus_months", label: "12+ months" },
] as const

const KEEP_CURRENT_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "partly", label: "Partly" },
  { value: "not_sure", label: "Not sure" },
] as const

const FOREIGN_INCOME_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "mixed", label: "Mixed" },
  { value: "not_sure", label: "Not sure" },
] as const

// --- form state ----------------------------------------------------------

interface DnFormState {
  remote_income: string | null
  income_source: string | null
  monthly_income: string | null
  preferred_currency: string | null
  income_consistency: string | null
  income_history_months: string | null
  keep_current_remote_work: string | null
  foreign_income_only: string | null
}

const EMPTY_FORM: DnFormState = {
  remote_income: null,
  income_source: null,
  monthly_income: null,
  preferred_currency: null,
  income_consistency: null,
  income_history_months: null,
  keep_current_remote_work: null,
  foreign_income_only: null,
}

interface ValidationErrors {
  remote_income?: string
  income_source?: string
  monthly_income?: string
  income_consistency?: string
  income_history_months?: string
  keep_current_remote_work?: string
  foreign_income_only?: string
}

function validate(form: DnFormState): ValidationErrors {
  const e: ValidationErrors = {}
  if (!form.remote_income) e.remote_income = "Pick yes or no."
  if (!form.income_source) e.income_source = "Pick the option that fits."
  if (!form.monthly_income || !form.preferred_currency) {
    e.monthly_income = "Enter your approximate monthly income."
  }
  if (!form.income_consistency) {
    e.income_consistency = "Pick the option that fits."
  }
  if (!form.income_history_months) {
    e.income_history_months = "Pick how much income history you can show."
  }
  if (!form.keep_current_remote_work) {
    e.keep_current_remote_work = "Pick the option that fits."
  }
  if (!form.foreign_income_only) {
    e.foreign_income_only = "Pick the option that fits."
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

export default function OnboardingDigitalNomadPage() {
  const router = useRouter()

  const [form, setForm] = React.useState<DnFormState>(EMPTY_FORM)
  const [destination, setDestination] = React.useState<string | null>(null)
  const [planVersion, setPlanVersion] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [submitAttempted, setSubmitAttempted] = React.useState(false)
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null)

  const update = React.useCallback(
    <K extends keyof DnFormState>(key: K, value: DnFormState[K]) => {
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
        setDestination(typeof pd.destination === "string" ? pd.destination : null)
        setForm({
          remote_income: typeof pd.remote_income === "string" ? pd.remote_income : null,
          income_source:
            typeof pd.income_source === "string" ? pd.income_source : null,
          monthly_income:
            typeof pd.monthly_income === "string" ? pd.monthly_income : null,
          preferred_currency:
            typeof pd.preferred_currency === "string" ? pd.preferred_currency : null,
          income_consistency:
            typeof pd.income_consistency === "string"
              ? pd.income_consistency
              : null,
          income_history_months:
            typeof pd.income_history_months === "string"
              ? pd.income_history_months
              : null,
          keep_current_remote_work:
            typeof pd.keep_current_remote_work === "string"
              ? pd.keep_current_remote_work
              : null,
          foreign_income_only:
            typeof pd.foreign_income_only === "string"
              ? pd.foreign_income_only
              : null,
        })
      })
      .catch((err) => {
        console.error("[onboarding/digital-nomad] hydrate failed", err)
        setErrorBanner("Couldn't load your saved data. You can still continue.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Default the currency from destination once we know it (only if user
  // hasn't already chosen one). visa-finance uses the same default; we
  // mirror the behaviour here so the pre-fill is consistent across pages.
  React.useEffect(() => {
    if (!destination || form.preferred_currency) return
    const inferred = getCurrencyFromCountry(destination)
    if (inferred) update("preferred_currency", inferred)
  }, [destination, form.preferred_currency, update])

  const errors = submitAttempted ? validate(form) : {}
  const hasErrors = Object.keys(validate(form)).length > 0

  const buildProfileData = (): Record<string, unknown> => ({
    remote_income: form.remote_income,
    income_source: form.income_source,
    monthly_income: form.monthly_income,
    preferred_currency: form.preferred_currency,
    income_consistency: form.income_consistency,
    income_history_months: form.income_history_months,
    keep_current_remote_work: form.keep_current_remote_work,
    foreign_income_only: form.foreign_income_only,
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
          console.error(
            "[onboarding/digital-nomad] retry after conflict failed",
            retryErr,
          )
        }
      } else {
        console.error("[onboarding/digital-nomad] save failed", err)
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
        title="Tell us about your remote work"
        subtitle="Income source, history, and your work style."
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

  return (
    <OnboardingShell
      step={3}
      totalSteps={5}
      eyebrow="Step 3 of 5"
      title="Tell us about your remote work"
      subtitle="Income source, history, and your work style."
      primaryLabel="Save & continue"
      primaryLoading={saving}
      onPrimary={handleContinue}
      onSecondary={handleSaveExit}
      onBack={handleBack}
      errorBanner={errorBanner}
    >
      <div className="space-y-6">
        <OnboardingSection title="Remote work setup">
          <OnboardingField
            label="Do you already earn income remotely?"
            error={errors.remote_income}
          >
            <OptionPills
              options={YES_NO}
              value={form.remote_income}
              onChange={(v) => update("remote_income", v)}
              ariaLabel="Remote income"
            />
          </OnboardingField>

          <OnboardingField
            label="What is your main source of income?"
            error={errors.income_source}
          >
            <OptionPills
              options={INCOME_SOURCE_OPTIONS}
              value={form.income_source}
              onChange={(v) => update("income_source", v)}
              ariaLabel="Income source"
            />
          </OnboardingField>

          <OnboardingField
            label="What is your approximate monthly income?"
            helper="Most digital-nomad visas have a minimum income threshold (often €2–3k/month). Net or gross — we'll calibrate either way."
            error={errors.monthly_income}
          >
            <CurrencyAmountInput
              amount={form.monthly_income}
              currency={form.preferred_currency}
              onAmountChange={(a) => update("monthly_income", a)}
              onCurrencyChange={(c) => update("preferred_currency", c)}
            />
          </OnboardingField>

          <OnboardingField
            label="How consistent is your income?"
            error={errors.income_consistency}
          >
            <OptionPills
              options={INCOME_CONSISTENCY_OPTIONS}
              value={form.income_consistency}
              onChange={(v) => update("income_consistency", v)}
              ariaLabel="Income consistency"
            />
          </OnboardingField>

          <OnboardingField
            label="How much income history can you show?"
            helper="Many DN visas require 6–12 months of documented earnings."
            error={errors.income_history_months}
          >
            <OptionPills
              options={INCOME_HISTORY_OPTIONS}
              value={form.income_history_months}
              onChange={(v) => update("income_history_months", v)}
              ariaLabel="Income history"
            />
          </OnboardingField>
        </OnboardingSection>

        <OnboardingSection title="Work style">
          <OnboardingField
            label="Are you planning to keep your current clients / employer after the move?"
            error={errors.keep_current_remote_work}
          >
            <OptionPills
              options={KEEP_CURRENT_OPTIONS}
              value={form.keep_current_remote_work}
              onChange={(v) => update("keep_current_remote_work", v)}
              ariaLabel="Keep current remote work"
            />
          </OnboardingField>

          <OnboardingField
            label="Will you mainly work for clients / employers outside the destination country?"
            helper="Most DN visas require foreign-only income — local clients can disqualify you."
            error={errors.foreign_income_only}
          >
            <OptionPills
              options={FOREIGN_INCOME_OPTIONS}
              value={form.foreign_income_only}
              onChange={(v) => update("foreign_income_only", v)}
              ariaLabel="Foreign income only"
            />
          </OnboardingField>
        </OnboardingSection>
      </div>
    </OnboardingShell>
  )
}
