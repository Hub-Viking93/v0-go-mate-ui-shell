// =============================================================
// /onboarding/settle — wizard step 3 (settle branch).
// =============================================================
// Reached only when destination's purpose === "settle". Captures
// why the user is settling, family-reunion context (if any), and
// background. Family-reunion sub-fields are gated on the user
// picking that as their reason.
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
import { CountrySelect } from "@/components/onboarding/country-select"
import { OccupationInput } from "@/components/onboarding/occupation-input"
import { EducationSelect } from "@/components/onboarding/education-select"

// --- options -------------------------------------------------------------

const SETTLEMENT_REASON_OPTIONS = [
  { value: "retirement", label: "Retirement" },
  { value: "family_reunion", label: "Family reunion" },
  { value: "ancestry", label: "Ancestry / heritage" },
  { value: "investment", label: "Investment" },
  { value: "lifestyle", label: "Lifestyle / long-term move" },
  { value: "other", label: "Other" },
] as const

const FAMILY_TIES_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
] as const

const RELATIONSHIP_TYPE_OPTIONS = [
  { value: "spouse", label: "Spouse" },
  { value: "fiancé", label: "Fiancé / fiancée" },
  { value: "registered_partner", label: "Registered partner" },
  { value: "cohabitant", label: "Cohabitant / sambo" },
  { value: "parent", label: "Parent" },
  { value: "child", label: "Child" },
  { value: "other", label: "Other family member" },
] as const

const PARTNER_VISA_STATUS_OPTIONS = [
  { value: "citizen", label: "Citizen" },
  { value: "permanent_resident", label: "Permanent resident" },
  { value: "work_visa", label: "Work visa" },
  { value: "student_visa", label: "Student visa" },
  { value: "other", label: "Other" },
] as const

const RELATIONSHIP_DURATION_OPTIONS = [
  { value: "less_than_1_year", label: "Less than 1 year" },
  { value: "1_2_years", label: "1–2 years" },
  { value: "3_5_years", label: "3–5 years" },
  { value: "5_plus_years", label: "5+ years" },
] as const

const SPECIAL_REQUIREMENTS_TOGGLE_OPTIONS = [
  { value: "no", label: "No, nothing special" },
  { value: "yes", label: "Yes" },
] as const

// --- form state ----------------------------------------------------------

interface SettleFormState {
  settlement_reason: string | null
  family_ties: string | null
  relationship_type: string | null
  partner_citizenship: string | null
  partner_visa_status: string | null
  relationship_duration: string | null
  current_occupation: string | null
  education_level: string | null
  // UI-only toggle for "anything special?" — drives whether the
  // free-text input renders. Persisted state is only the text in
  // special_requirements (null when no).
  has_special_requirements: "yes" | "no" | null
  special_requirements: string | null
}

const EMPTY_FORM: SettleFormState = {
  settlement_reason: null,
  family_ties: null,
  relationship_type: null,
  partner_citizenship: null,
  partner_visa_status: null,
  relationship_duration: null,
  current_occupation: null,
  education_level: null,
  has_special_requirements: null,
  special_requirements: null,
}

interface ValidationErrors {
  settlement_reason?: string
  family_ties?: string
  relationship_type?: string
  partner_citizenship?: string
  partner_visa_status?: string
  relationship_duration?: string
  current_occupation?: string
  education_level?: string
  has_special_requirements?: string
  special_requirements?: string
}

function validate(form: SettleFormState): ValidationErrors {
  const e: ValidationErrors = {}
  if (!form.settlement_reason) {
    e.settlement_reason = "Pick the option that best describes your reason."
  }
  if (!form.family_ties) e.family_ties = "Pick yes or no."

  if (form.settlement_reason === "family_reunion") {
    if (!form.relationship_type) {
      e.relationship_type = "Pick who you're joining."
    }
    if (!form.partner_citizenship) {
      e.partner_citizenship = "Select the person's citizenship."
    }
    if (!form.partner_visa_status) {
      e.partner_visa_status = "Pick their status in the country."
    }
    if (!form.relationship_duration) {
      e.relationship_duration = "Pick how long you've been in this relationship."
    }
  }

  if (!form.current_occupation?.trim()) {
    e.current_occupation = "Tell us what you do."
  }
  if (!form.education_level) {
    e.education_level = "Pick your highest completed education."
  }
  if (!form.has_special_requirements) {
    e.has_special_requirements = "Pick the option that fits."
  }
  if (
    form.has_special_requirements === "yes" &&
    !form.special_requirements?.trim()
  ) {
    e.special_requirements = "Tell us about it briefly."
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

export default function OnboardingSettlePage() {
  const router = useRouter()

  const [form, setForm] = React.useState<SettleFormState>(EMPTY_FORM)
  const [planVersion, setPlanVersion] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [submitAttempted, setSubmitAttempted] = React.useState(false)
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null)

  const update = React.useCallback(
    <K extends keyof SettleFormState>(key: K, value: SettleFormState[K]) => {
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
        const specialReq =
          typeof pd.special_requirements === "string" ? pd.special_requirements : null
        setForm({
          settlement_reason:
            typeof pd.settlement_reason === "string" ? pd.settlement_reason : null,
          family_ties: typeof pd.family_ties === "string" ? pd.family_ties : null,
          relationship_type:
            typeof pd.relationship_type === "string" ? pd.relationship_type : null,
          partner_citizenship:
            typeof pd.partner_citizenship === "string" ? pd.partner_citizenship : null,
          partner_visa_status:
            typeof pd.partner_visa_status === "string" ? pd.partner_visa_status : null,
          relationship_duration:
            typeof pd.relationship_duration === "string"
              ? pd.relationship_duration
              : null,
          current_occupation:
            typeof pd.current_occupation === "string" ? pd.current_occupation : null,
          education_level:
            typeof pd.education_level === "string" ? pd.education_level : null,
          // Derive yes/no toggle from whether special_requirements has a
          // value. If null on hydrate, leave toggle unanswered so the
          // user explicitly picks.
          has_special_requirements: specialReq ? "yes" : null,
          special_requirements: specialReq,
        })
      })
      .catch((err) => {
        console.error("[onboarding/settle] hydrate failed", err)
        setErrorBanner("Couldn't load your saved data. You can still continue.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Clear family-reunion answers if user switches away from that reason.
  React.useEffect(() => {
    if (form.settlement_reason !== "family_reunion") {
      if (form.relationship_type) update("relationship_type", null)
      if (form.partner_citizenship) update("partner_citizenship", null)
      if (form.partner_visa_status) update("partner_visa_status", null)
      if (form.relationship_duration) update("relationship_duration", null)
    }
  }, [
    form.settlement_reason,
    form.relationship_type,
    form.partner_citizenship,
    form.partner_visa_status,
    form.relationship_duration,
    update,
  ])

  // Clear special_requirements text when toggle flips back to "no".
  React.useEffect(() => {
    if (form.has_special_requirements === "no" && form.special_requirements) {
      update("special_requirements", null)
    }
  }, [form.has_special_requirements, form.special_requirements, update])

  const errors = submitAttempted ? validate(form) : {}
  const hasErrors = Object.keys(validate(form)).length > 0

  const buildProfileData = (): Record<string, unknown> => {
    const isReunion = form.settlement_reason === "family_reunion"
    return {
      settlement_reason: form.settlement_reason,
      family_ties: form.family_ties,
      relationship_type: isReunion ? form.relationship_type : null,
      partner_citizenship: isReunion ? form.partner_citizenship : null,
      partner_visa_status: isReunion ? form.partner_visa_status : null,
      relationship_duration: isReunion ? form.relationship_duration : null,
      current_occupation: form.current_occupation?.trim() || null,
      education_level: form.education_level,
      // We don't persist the yes/no toggle directly — null
      // special_requirements implies "no, nothing special".
      special_requirements:
        form.has_special_requirements === "yes"
          ? form.special_requirements?.trim() || null
          : null,
    }
  }

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
          console.error("[onboarding/settle] retry after conflict failed", retryErr)
        }
      } else {
        console.error("[onboarding/settle] save failed", err)
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
        title="Tell us why you're settling"
        subtitle="Your reason, family context, and a bit about you."
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

  const isReunion = form.settlement_reason === "family_reunion"

  return (
    <OnboardingShell
      step={3}
      totalSteps={5}
      eyebrow="Step 3 of 5"
      title="Tell us why you're settling"
      subtitle="Your reason, family context, and a bit about you."
      primaryLabel="Save & continue"
      primaryLoading={saving}
      onPrimary={handleContinue}
      onSecondary={handleSaveExit}
      onBack={handleBack}
      errorBanner={errorBanner}
    >
      <div className="space-y-6">
        <OnboardingSection title="Why you're settling">
          <OnboardingField
            label="What best describes why you want to settle there?"
            error={errors.settlement_reason}
          >
            <OptionPills
              options={SETTLEMENT_REASON_OPTIONS}
              value={form.settlement_reason}
              onChange={(v) => update("settlement_reason", v)}
              ariaLabel="Settlement reason"
            />
          </OnboardingField>

          <OnboardingField
            label="Do you already have family ties in the country?"
            error={errors.family_ties}
          >
            <OptionPills
              options={FAMILY_TIES_OPTIONS}
              value={form.family_ties}
              onChange={(v) => update("family_ties", v)}
              ariaLabel="Family ties"
            />
          </OnboardingField>
        </OnboardingSection>

        {isReunion && (
          <OnboardingSection title="Family reunion">
            <OnboardingField
              label="Who are you joining in the country?"
              error={errors.relationship_type}
            >
              <OptionPills
                options={RELATIONSHIP_TYPE_OPTIONS}
                value={form.relationship_type}
                onChange={(v) => update("relationship_type", v)}
                ariaLabel="Relationship type"
              />
            </OnboardingField>

            <OnboardingField
              label="What citizenship does that person have?"
              htmlFor="partner_citizenship"
              error={errors.partner_citizenship}
            >
              <CountrySelect
                id="partner_citizenship"
                value={form.partner_citizenship}
                onChange={(c) => update("partner_citizenship", c)}
                placeholder="Select their citizenship"
                ariaLabel="Partner citizenship"
              />
            </OnboardingField>

            <OnboardingField
              label="What is their status in the country?"
              error={errors.partner_visa_status}
            >
              <OptionPills
                options={PARTNER_VISA_STATUS_OPTIONS}
                value={form.partner_visa_status}
                onChange={(v) => update("partner_visa_status", v)}
                ariaLabel="Partner visa status"
              />
            </OnboardingField>

            <OnboardingField
              label="How long have you been in this relationship / family arrangement?"
              error={errors.relationship_duration}
            >
              <OptionPills
                options={RELATIONSHIP_DURATION_OPTIONS}
                value={form.relationship_duration}
                onChange={(v) => update("relationship_duration", v)}
                ariaLabel="Relationship duration"
              />
            </OnboardingField>
          </OnboardingSection>
        )}

        <OnboardingSection title="Your background">
          <OnboardingField
            label="What is your current occupation?"
            htmlFor="current_occupation"
            error={errors.current_occupation}
          >
            <OccupationInput
              id="current_occupation"
              value={form.current_occupation}
              onChange={(o) => update("current_occupation", o)}
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
            label="Is there anything special about your situation we should keep in mind?"
            error={errors.has_special_requirements}
          >
            <OptionPills
              options={SPECIAL_REQUIREMENTS_TOGGLE_OPTIONS}
              value={form.has_special_requirements}
              onChange={(v) =>
                update("has_special_requirements", v as "yes" | "no")
              }
              ariaLabel="Has special requirements"
            />
          </OnboardingField>

          {form.has_special_requirements === "yes" && (
            <OnboardingField
              label="Tell us about any special requirement we should keep in mind."
              htmlFor="special_requirements"
              error={errors.special_requirements}
            >
              <Input
                id="special_requirements"
                type="text"
                value={form.special_requirements ?? ""}
                onChange={(e) =>
                  update("special_requirements", e.target.value || null)
                }
                placeholder="Briefly describe — accessibility, dietary, religious, etc."
                className="h-10"
                maxLength={240}
              />
            </OnboardingField>
          )}
        </OnboardingSection>
      </div>
    </OnboardingShell>
  )
}
