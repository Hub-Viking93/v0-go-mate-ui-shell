// =============================================================
// /onboarding/profile — wizard step 1 of 5.
// =============================================================
// Pure identity: name, year of birth, citizenship, current
// country/city, languages spoken. Everything else (occupation,
// income, education) is purpose-dependent and lives on step 3
// where we can ask the right question for each purpose (study /
// work / digital nomad / settle) instead of a generic prompt
// that doesn't map cleanly to any of them.
//
// All values land directly in profile_data via PATCH /api/profile
// — no AI extraction. The chat-driven onboarding flow
// (pages/chat) still works in parallel; this wizard runs
// alongside it until all 5 steps are built and we cut over.
// =============================================================

import * as React from "react"
import { useRouter } from "@/lib/router-compat"
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronUp } from "lucide-react"
import {
  OnboardingShell,
  OnboardingSection,
  OnboardingField,
} from "./_shell"
import { CountrySelect } from "@/components/onboarding/country-select"
import { CityInput } from "@/components/onboarding/city-input"
import {
  LanguagesInput,
  type SpokenLanguage,
} from "@/components/onboarding/languages-input"
import { YearOfBirthSelect } from "@/components/onboarding/year-of-birth-select"
import { getNativeLanguages } from "@/lib/gomate/country-languages"

// --- form state ----------------------------------------------------------

interface ProfileFormState {
  name: string
  birth_year: string | null
  citizenship: string | null
  other_citizenships: string | null
  current_location: string | null
  current_city: string | null
  languages_spoken: SpokenLanguage[]
}

const EMPTY_FORM: ProfileFormState = {
  name: "",
  birth_year: null,
  citizenship: null,
  other_citizenships: null,
  current_location: null,
  current_city: null,
  languages_spoken: [],
}

interface ValidationErrors {
  name?: string
  birth_year?: string
  citizenship?: string
  current_location?: string
  languages_spoken?: string
}

function validate(form: ProfileFormState): ValidationErrors {
  const e: ValidationErrors = {}
  if (!form.name.trim()) e.name = "Tell us what to call you."
  if (!form.birth_year) e.birth_year = "Select your year of birth."
  if (!form.citizenship) e.citizenship = "Select your country of citizenship."
  if (!form.current_location) e.current_location = "Select where you are now."
  if (form.languages_spoken.length === 0) {
    e.languages_spoken = "Add at least one language."
  }
  return e
}

function buildDefaultLanguages(
  citizenship: string | null,
  currentLocation: string | null,
): SpokenLanguage[] {
  const out: SpokenLanguage[] = []
  const seen = new Set<string>()
  const push = (lang: string, level: SpokenLanguage["level"]) => {
    const k = lang.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push({ language: lang, level })
  }

  for (const lang of getNativeLanguages(citizenship)) push(lang, "native")
  if (currentLocation && currentLocation.toLowerCase() !== (citizenship ?? "").toLowerCase()) {
    for (const lang of getNativeLanguages(currentLocation)) push(lang, "fluent")
  }
  push("English", "intermediate")
  return out
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

export default function OnboardingProfilePage() {
  const router = useRouter()

  const [form, setForm] = React.useState<ProfileFormState>(EMPTY_FORM)
  const [planVersion, setPlanVersion] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [submitAttempted, setSubmitAttempted] = React.useState(false)
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null)
  const [showOtherCitizenships, setShowOtherCitizenships] = React.useState(false)

  const [hydrated, setHydrated] = React.useState(false)
  const userTouchedLanguages = React.useRef(false)

  const update = React.useCallback(
    <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  // Hydrate from server on mount.
  React.useEffect(() => {
    let cancelled = false
    fetchProfile()
      .then((data) => {
        if (cancelled) return
        const pd = (data.plan?.profile_data ?? {}) as Record<string, unknown>
        setPlanVersion(data.plan?.plan_version ?? 1)
        setForm({
          name: typeof pd.name === "string" ? pd.name : "",
          birth_year: typeof pd.birth_year === "string" ? pd.birth_year : null,
          citizenship: typeof pd.citizenship === "string" ? pd.citizenship : null,
          other_citizenships:
            typeof pd.other_citizenships === "string" ? pd.other_citizenships : null,
          current_location:
            typeof pd.current_location === "string" ? pd.current_location : null,
          current_city: typeof pd.current_city === "string" ? pd.current_city : null,
          languages_spoken: Array.isArray(pd.languages_spoken)
            ? (pd.languages_spoken as SpokenLanguage[])
            : [],
        })
        if (typeof pd.other_citizenships === "string" && pd.other_citizenships) {
          setShowOtherCitizenships(true)
        }
        if (Array.isArray(pd.languages_spoken) && pd.languages_spoken.length > 0) {
          userTouchedLanguages.current = true
        }
      })
      .catch((err) => {
        console.error("[onboarding/profile] hydrate failed", err)
        setErrorBanner("Couldn't load your saved data. You can still continue.")
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setHydrated(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-suggest languages based on citizenship + current_location, but
  // only the first time both are set and the user hasn't touched the
  // list yet.
  React.useEffect(() => {
    if (!hydrated) return
    if (userTouchedLanguages.current) return
    if (!form.citizenship || !form.current_location) return
    if (form.languages_spoken.length > 0) return
    const defaults = buildDefaultLanguages(form.citizenship, form.current_location)
    if (defaults.length > 0) {
      setForm((prev) =>
        prev.languages_spoken.length > 0
          ? prev
          : { ...prev, languages_spoken: defaults },
      )
    }
  }, [hydrated, form.citizenship, form.current_location, form.languages_spoken.length])

  const errors = submitAttempted ? validate(form) : {}
  const hasErrors = Object.keys(validate(form)).length > 0

  const buildProfileData = (): Record<string, unknown> => ({
    name: form.name.trim() || null,
    birth_year: form.birth_year,
    citizenship: form.citizenship,
    other_citizenships: form.other_citizenships?.trim() || null,
    current_location: form.current_location,
    current_city: form.current_city?.trim() || null,
    languages_spoken: form.languages_spoken.length > 0 ? form.languages_spoken : null,
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
          console.error("[onboarding/profile] retry after conflict failed", retryErr)
        }
      } else {
        console.error("[onboarding/profile] save failed", err)
      }
      setErrorBanner("Couldn't save. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleContinue = () => {
    void save(() => router.push("/onboarding/destination"), { requireValid: true })
  }

  const handleSaveExit = () => {
    void save(() => router.push("/dashboard"), { requireValid: false })
  }

  const handleBack = () => router.push("/onboarding")

  if (loading) {
    return (
      <OnboardingShell
        step={1}
        totalSteps={5}
        eyebrow="Step 1 of 5"
        title="Tell us about yourself"
        subtitle="Just the basics — under a minute."
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
      step={1}
      totalSteps={5}
      eyebrow="Step 1 of 5"
      title="Tell us about yourself"
      subtitle="Just the basics — under a minute."
      primaryLabel="Save & continue"
      primaryLoading={saving}
      onPrimary={handleContinue}
      onSecondary={handleSaveExit}
      onBack={handleBack}
      errorBanner={errorBanner}
    >
      <div className="space-y-6">
        <OnboardingSection title="Identity">
          <OnboardingField
            label="What should we call you?"
            htmlFor="name"
            error={errors.name}
          >
            <Input
              id="name"
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Sarah"
              className="h-10"
              maxLength={80}
            />
          </OnboardingField>

          <OnboardingField
            label="Year of birth"
            htmlFor="birth_year"
            helper="Used for age-specific visa pathways like Working Holiday."
            error={errors.birth_year}
          >
            <YearOfBirthSelect
              id="birth_year"
              value={form.birth_year}
              onChange={(year) => update("birth_year", year)}
            />
          </OnboardingField>
        </OnboardingSection>

        <OnboardingSection title="Citizenship & Location">
          <OnboardingField
            label="Country of citizenship"
            htmlFor="citizenship"
            error={errors.citizenship}
          >
            <CountrySelect
              id="citizenship"
              value={form.citizenship}
              onChange={(c) => update("citizenship", c)}
              placeholder="Select your citizenship"
              ariaLabel="Country of citizenship"
            />
          </OnboardingField>

          <div>
            <button
              type="button"
              onClick={() => setShowOtherCitizenships((v) => !v)}
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
            >
              {showOtherCitizenships ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              I have another passport
            </button>
            {showOtherCitizenships && (
              <div className="mt-3">
                <OnboardingField
                  label="Other citizenship"
                  helper="A second passport may unlock additional visa pathways."
                >
                  <Input
                    type="text"
                    value={form.other_citizenships ?? ""}
                    onChange={(e) =>
                      update("other_citizenships", e.target.value || null)
                    }
                    placeholder="e.g. Ireland"
                    className="h-10"
                  />
                </OnboardingField>
              </div>
            )}
          </div>

          <OnboardingField
            label="Where are you now?"
            htmlFor="current_location"
            error={errors.current_location}
          >
            <CountrySelect
              id="current_location"
              value={form.current_location}
              onChange={(c) => {
                update("current_location", c)
                if (c !== form.current_location) update("current_city", null)
              }}
              placeholder="Select your current country"
              ariaLabel="Current country"
            />
          </OnboardingField>

          <OnboardingField label="City (optional)" htmlFor="current_city">
            <CityInput
              id="current_city"
              value={form.current_city}
              onChange={(c) => update("current_city", c)}
              country={form.current_location}
            />
          </OnboardingField>
        </OnboardingSection>

        <OnboardingSection title="Languages">
          <OnboardingField
            label="Languages you speak"
            helper="Pick a level for each. Used for visa eligibility (language tests) and integration planning."
            error={errors.languages_spoken}
          >
            <LanguagesInput
              value={form.languages_spoken}
              onChange={(langs) => {
                userTouchedLanguages.current = true
                update("languages_spoken", langs)
              }}
            />
          </OnboardingField>
        </OnboardingSection>
      </div>
    </OnboardingShell>
  )
}
