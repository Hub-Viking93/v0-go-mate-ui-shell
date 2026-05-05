// =============================================================
// /onboarding/destination — wizard step 2 of 5.
// =============================================================
// Captures the high-level shape of the move: where, why, when,
// how long. Everything here drives the branching on step 3
// (purpose-specific page), so we keep it tight and unambiguous.
//
// - Country/city: searchable dropdowns (city is optional).
// - Purpose: 4-card single-select (the most consequential choice).
// - Timeline: real date picker with a "flexible" escape hatch.
// - Duration: dropdown of bucketed length-of-stay options.
// =============================================================

import * as React from "react"
import { useRouter } from "@/lib/router-compat"
import { Briefcase, GraduationCap, Laptop, Home, Check } from "lucide-react"
import {
  OnboardingShell,
  OnboardingSection,
  OnboardingField,
} from "./_shell"
import { CountrySelect } from "@/components/onboarding/country-select"
import { CityInput } from "@/components/onboarding/city-input"
import { DatePickerInput } from "@/components/onboarding/date-picker-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// --- options -------------------------------------------------------------

type Purpose = "work" | "study" | "digital_nomad" | "settle"

const PURPOSES: {
  value: Purpose
  label: string
  body: string
  Icon: React.ComponentType<{ className?: string }>
}[] = [
  {
    value: "work",
    label: "Work",
    body: "Job offer or actively job hunting in your destination.",
    Icon: Briefcase,
  },
  {
    value: "study",
    label: "Study",
    body: "University, language school, exchange, or vocational training.",
    Icon: GraduationCap,
  },
  {
    value: "digital_nomad",
    label: "Digital nomad",
    body: "Earning remotely or freelancing globally — bringing your own income.",
    Icon: Laptop,
  },
  {
    value: "settle",
    label: "Settle",
    body: "Retirement, family reunion, ancestry — making it permanent.",
    Icon: Home,
  },
]

const DURATION_OPTIONS = [
  { value: "3-6_months", label: "3–6 months" },
  { value: "6-12_months", label: "6–12 months" },
  { value: "1-2_years", label: "1–2 years" },
  { value: "permanent", label: "3+ years / permanent" },
  { value: "not_sure", label: "Not sure yet" },
] as const

// --- form state ----------------------------------------------------------

interface DestinationFormState {
  destination: string | null
  target_city: string | null
  purpose: Purpose | null
  timeline: string | null
  duration: string | null
}

const EMPTY_FORM: DestinationFormState = {
  destination: null,
  target_city: null,
  purpose: null,
  timeline: null,
  duration: null,
}

interface ValidationErrors {
  destination?: string
  purpose?: string
  timeline?: string
  duration?: string
}

function validate(form: DestinationFormState): ValidationErrors {
  const e: ValidationErrors = {}
  if (!form.destination) e.destination = "Select where you're going."
  if (!form.purpose) e.purpose = "Pick the option that fits you best."
  if (!form.timeline) {
    e.timeline = "Pick a date or check 'I'm flexible'."
  }
  if (!form.duration) e.duration = "Pick how long you plan to stay."
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

export default function OnboardingDestinationPage() {
  const router = useRouter()

  const [form, setForm] = React.useState<DestinationFormState>(EMPTY_FORM)
  const [planVersion, setPlanVersion] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [submitAttempted, setSubmitAttempted] = React.useState(false)
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null)

  const update = React.useCallback(
    <K extends keyof DestinationFormState>(key: K, value: DestinationFormState[K]) => {
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
          destination: typeof pd.destination === "string" ? pd.destination : null,
          target_city: typeof pd.target_city === "string" ? pd.target_city : null,
          purpose:
            typeof pd.purpose === "string" && isPurpose(pd.purpose) ? pd.purpose : null,
          timeline: typeof pd.timeline === "string" ? pd.timeline : null,
          duration: typeof pd.duration === "string" ? pd.duration : null,
        })
      })
      .catch((err) => {
        console.error("[onboarding/destination] hydrate failed", err)
        setErrorBanner("Couldn't load your saved data. You can still continue.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const errors = submitAttempted ? validate(form) : {}
  const hasErrors = Object.keys(validate(form)).length > 0

  const buildProfileData = (): Record<string, unknown> => ({
    destination: form.destination,
    target_city: form.target_city?.trim() || null,
    purpose: form.purpose,
    timeline: form.timeline,
    duration: form.duration,
    // v1 wizard hard-assumes a solo primary applicant. Set these
    // implicitly here (rather than asking the user) so backend gating,
    // chat back-compat, and dashboard cards all see the right shape.
    // TODO[v2]: surface family/dependents flow and let user choose.
    visa_role: "primary",
    moving_alone: "yes",
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
          console.error("[onboarding/destination] retry after conflict failed", retryErr)
        }
      } else {
        console.error("[onboarding/destination] save failed", err)
      }
      setErrorBanner("Couldn't save. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleContinue = () => {
    void save(() => router.push(getStep3Path(form.purpose)), { requireValid: true })
  }

  const handleSaveExit = () => {
    void save(() => router.push("/dashboard"), { requireValid: false })
  }

  const handleBack = () => router.push("/onboarding/profile")

  if (loading) {
    return (
      <OnboardingShell
        step={2}
        totalSteps={5}
        eyebrow="Step 2 of 5"
        title="Where are you going?"
        subtitle="Country, purpose, and how long."
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
      step={2}
      totalSteps={5}
      eyebrow="Step 2 of 5"
      title="Where are you going?"
      subtitle="Country, purpose, and how long."
      primaryLabel="Save & continue"
      primaryLoading={saving}
      onPrimary={handleContinue}
      onSecondary={handleSaveExit}
      onBack={handleBack}
      errorBanner={errorBanner}
    >
      <div className="space-y-6">
        <OnboardingSection title="Where">
          <OnboardingField
            label="Destination country"
            htmlFor="destination"
            error={errors.destination}
          >
            <CountrySelect
              id="destination"
              value={form.destination}
              onChange={(c) => {
                update("destination", c)
                if (c !== form.destination) update("target_city", null)
              }}
              placeholder="Where are you moving to?"
              ariaLabel="Destination country"
            />
          </OnboardingField>

          <OnboardingField
            label="City (optional)"
            htmlFor="target_city"
            helper="Pick your top candidate — we'll use it for cost-of-living and housing. Skip if you haven't decided."
          >
            <CityInput
              id="target_city"
              value={form.target_city}
              onChange={(c) => update("target_city", c)}
              country={form.destination}
            />
          </OnboardingField>
        </OnboardingSection>

        <OnboardingSection title="Why">
          <OnboardingField
            label="What brings you there?"
            error={errors.purpose}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PURPOSES.map((p) => {
                const Icon = p.Icon
                const selected = form.purpose === p.value
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => update("purpose", p.value)}
                    aria-pressed={selected}
                    className={cn(
                      "relative text-left rounded-xl border p-3 transition-all",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
                      selected
                        ? "border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-sm"
                        : "border-stone-200 dark:border-stone-800 bg-card hover:border-stone-300 dark:hover:border-stone-700",
                    )}
                  >
                    {selected && (
                      <div className="absolute top-2.5 right-2.5 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white">
                        <Check className="w-2.5 h-2.5" strokeWidth={3} />
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded-lg mb-2",
                        selected
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-[13px] font-semibold text-foreground">{p.label}</h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                      {p.body}
                    </p>
                  </button>
                )
              })}
            </div>
          </OnboardingField>
        </OnboardingSection>

        <OnboardingSection title="When">
          <OnboardingField
            label="When do you want to move?"
            helper="Pick a target date — even if it shifts later, it helps us pace the timeline."
            error={errors.timeline}
          >
            <DatePickerInput
              value={form.timeline}
              onChange={(v) => update("timeline", v)}
              placeholder="Pick your target date"
            />
          </OnboardingField>

          <OnboardingField
            label="How long do you plan to stay?"
            htmlFor="duration"
            error={errors.duration}
          >
            <Select
              value={form.duration ?? undefined}
              onValueChange={(v) => update("duration", v)}
            >
              <SelectTrigger id="duration" className="h-10">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </OnboardingField>
        </OnboardingSection>
      </div>
    </OnboardingShell>
  )
}

function isPurpose(s: string): s is Purpose {
  return s === "work" || s === "study" || s === "digital_nomad" || s === "settle"
}

/**
 * Maps the user's purpose choice to the appropriate step-3 route.
 * Falls back to /onboarding/study if purpose is somehow null —
 * shouldn't happen since validation requires it, but defensive.
 */
function getStep3Path(purpose: Purpose | null): string {
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
