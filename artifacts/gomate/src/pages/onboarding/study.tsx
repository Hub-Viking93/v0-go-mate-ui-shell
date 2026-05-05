// =============================================================
// /onboarding/study — wizard step 3 (study branch).
// =============================================================
// Reached only when destination's purpose === "study".
//
// MVP scope (deliberately tight):
//   - study_type, study_field, education_level, study_funding (always)
//   - language_skill (only when study_type === "language_school")
//
// study_field's label/placeholder swap when study_type is
// language_school — same field, different framing ("Which
// language do you want to study?" instead of "What do you want
// to study?").
//
// Fields we previously sketched but cut for MVP:
//   - institution_name, study_admission_status, study_language
// Their schema entries remain (harmless nulls); the UI does not
// surface them.
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

const STUDY_TYPE_OPTIONS = [
  { value: "university", label: "University" },
  { value: "language_school", label: "Language school" },
  { value: "vocational", label: "Vocational" },
  { value: "exchange", label: "Exchange" },
] as const

const STUDY_FUNDING_OPTIONS = [
  // Stored as `self_funded` for stability — label shifted to "Own savings"
  // since "Self-funded" was ambiguous (own money? scholarships? loans? mix?).
  { value: "self_funded", label: "Own savings" },
  { value: "scholarship", label: "Scholarship" },
  { value: "student_loan", label: "Student loan" },
  { value: "family_support", label: "Family support" },
  { value: "mixed", label: "Mixed" },
] as const

const LANGUAGE_LEVEL_OPTIONS = [
  { value: "none", label: "None" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "fluent", label: "Fluent" },
] as const

// --- form state ----------------------------------------------------------

interface StudyFormState {
  study_type: string | null
  study_field: string | null
  education_level: string | null
  study_funding: string | null
  language_skill: string | null
}

const EMPTY_FORM: StudyFormState = {
  study_type: null,
  study_field: null,
  education_level: null,
  study_funding: null,
  language_skill: null,
}

interface ValidationErrors {
  study_type?: string
  study_field?: string
  education_level?: string
  study_funding?: string
  language_skill?: string
}

function validate(form: StudyFormState): ValidationErrors {
  const e: ValidationErrors = {}
  if (!form.study_type) e.study_type = "Pick what kind of study you're planning."
  if (!form.study_field?.trim()) {
    e.study_field =
      form.study_type === "language_school"
        ? "Tell us which language you want to study."
        : "Tell us what you want to study."
  }
  if (!form.education_level) e.education_level = "Pick your highest completed education."
  if (!form.study_funding) e.study_funding = "Pick how you'll fund your studies."
  if (form.study_type === "language_school" && !form.language_skill) {
    e.language_skill = "Pick your current level in that language."
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

export default function OnboardingStudyPage() {
  const router = useRouter()

  const [form, setForm] = React.useState<StudyFormState>(EMPTY_FORM)
  const [planVersion, setPlanVersion] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [submitAttempted, setSubmitAttempted] = React.useState(false)
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null)

  const update = React.useCallback(
    <K extends keyof StudyFormState>(key: K, value: StudyFormState[K]) => {
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
          study_type: typeof pd.study_type === "string" ? pd.study_type : null,
          study_field: typeof pd.study_field === "string" ? pd.study_field : null,
          education_level:
            typeof pd.education_level === "string" ? pd.education_level : null,
          study_funding: typeof pd.study_funding === "string" ? pd.study_funding : null,
          language_skill:
            typeof pd.language_skill === "string" ? pd.language_skill : null,
        })
      })
      .catch((err) => {
        console.error("[onboarding/study] hydrate failed", err)
        setErrorBanner("Couldn't load your saved data. You can still continue.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Clear language_skill if user switches away from language_school —
  // it's contextually attached to that branch and would otherwise persist
  // a stale answer.
  React.useEffect(() => {
    if (form.study_type !== "language_school" && form.language_skill) {
      update("language_skill", null)
    }
  }, [form.study_type, form.language_skill, update])

  const errors = submitAttempted ? validate(form) : {}
  const hasErrors = Object.keys(validate(form)).length > 0

  const buildProfileData = (): Record<string, unknown> => ({
    study_type: form.study_type,
    study_field: form.study_field?.trim() || null,
    education_level: form.education_level,
    study_funding: form.study_funding,
    language_skill: form.language_skill,
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
          console.error("[onboarding/study] retry after conflict failed", retryErr)
        }
      } else {
        console.error("[onboarding/study] save failed", err)
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
        title="Tell us about your studies"
        subtitle="What, your background, and how you'll fund it."
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

  const isLanguageSchool = form.study_type === "language_school"
  const studyFieldLabel = isLanguageSchool
    ? "Which language do you want to study?"
    : "What do you want to study?"
  const studyFieldPlaceholder = isLanguageSchool
    ? "e.g. Japanese, Spanish, German"
    : "e.g. Computer Science, Medicine, Business"

  return (
    <OnboardingShell
      step={3}
      totalSteps={5}
      eyebrow="Step 3 of 5"
      title="Tell us about your studies"
      subtitle="What, your background, and how you'll fund it."
      primaryLabel="Save & continue"
      primaryLoading={saving}
      onPrimary={handleContinue}
      onSecondary={handleSaveExit}
      onBack={handleBack}
      errorBanner={errorBanner}
    >
      <div className="space-y-6">
        <OnboardingSection title="Your studies">
          <OnboardingField
            label="What kind of study are you planning?"
            error={errors.study_type}
          >
            <OptionPills
              options={STUDY_TYPE_OPTIONS}
              value={form.study_type}
              onChange={(v) => update("study_type", v)}
              ariaLabel="Type of study"
            />
          </OnboardingField>

          <OnboardingField
            label={studyFieldLabel}
            htmlFor="study_field"
            error={errors.study_field}
          >
            <Input
              id="study_field"
              type="text"
              value={form.study_field ?? ""}
              onChange={(e) => update("study_field", e.target.value || null)}
              placeholder={studyFieldPlaceholder}
              className="h-10"
              maxLength={120}
            />
          </OnboardingField>

          {isLanguageSchool && (
            <OnboardingField
              label="What's your current level in that language?"
              error={errors.language_skill}
            >
              <OptionPills
                options={LANGUAGE_LEVEL_OPTIONS}
                value={form.language_skill}
                onChange={(v) => update("language_skill", v)}
                ariaLabel="Current language level"
              />
            </OnboardingField>
          )}
        </OnboardingSection>

        <OnboardingSection title="Background & funding">
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
            label="How will you fund your studies?"
            error={errors.study_funding}
          >
            <OptionPills
              options={STUDY_FUNDING_OPTIONS}
              value={form.study_funding}
              onChange={(v) => update("study_funding", v)}
              ariaLabel="Study funding"
            />
          </OnboardingField>
        </OnboardingSection>
      </div>
    </OnboardingShell>
  )
}
