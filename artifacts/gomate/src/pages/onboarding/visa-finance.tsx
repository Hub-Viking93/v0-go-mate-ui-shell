// =============================================================
// /onboarding/visa-finance — wizard step 4 of 5.
// =============================================================
// Universal across all purposes (study / work / digital_nomad /
// settle). Captures:
//
//   1. Money — savings + currency. We do NOT ask monthly_budget
//      here: per idé.md the system computes the required runway
//      from cost-of-living × stay duration. Purpose-specific
//      money follow-ups: work_while_studying (study),
//      pre_first_paycheck_support (work).
//   2. Visa History — prior_visa, prior_visa_type (gated),
//      visa_rejections, criminal_record.
//   3. Special Circumstances — healthcare_needs, prescription_
//      medications (gated), pets.
//   4. Posting Compliance (work + posting_or_secondment=yes only)
//      — a1_certificate_status, coc_status, pwd_filed. Status of
//      the EU-mandated paperwork for posted workers.
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
import { CurrencyAmountInput } from "@/components/onboarding/currency-amount-input"
import { getCurrencyFromCountry } from "@/lib/gomate/currency"

// --- options -------------------------------------------------------------

const YES_NO = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
] as const

const HEALTHCARE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "chronic_condition", label: "Chronic condition" },
  { value: "disability", label: "Disability" },
] as const

const PETS_OPTIONS = [
  { value: "none", label: "None" },
  { value: "dog", label: "Dog" },
  { value: "cat", label: "Cat" },
  { value: "other", label: "Other" },
] as const

const WORK_WHILE_STUDYING_OPTIONS = [
  { value: "yes_part_time", label: "Yes, part-time" },
  { value: "yes_breaks_only", label: "Yes, during breaks only" },
  { value: "no", label: "No" },
  { value: "not_sure", label: "Not sure" },
] as const

const PRE_FIRST_PAYCHECK_SUPPORT_OPTIONS = [
  { value: "own_savings", label: "Own savings" },
  { value: "family_support", label: "Family support" },
  { value: "employer_support", label: "Employer support / relocation package" },
  { value: "mixed", label: "Mixed" },
  { value: "not_sure", label: "Not sure" },
] as const

const SETTLEMENT_SUPPORT_OPTIONS = [
  { value: "own_savings", label: "Own savings" },
  { value: "pension", label: "Pension / retirement income" },
  { value: "investment_income", label: "Investment income" },
  { value: "remote_income", label: "Remote income" },
  { value: "family_support", label: "Family support" },
  { value: "mixed", label: "Mixed" },
  { value: "not_sure", label: "Not sure" },
] as const

const INCOME_COVERS_LIVING_OPTIONS = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_sure", label: "Not sure" },
] as const

const POSTING_DOC_STATUS_OPTIONS = [
  { value: "not_started", label: "Not started" },
  { value: "in_progress", label: "In progress" },
  { value: "obtained", label: "Obtained" },
  { value: "not_applicable", label: "Not applicable" },
] as const

const YES_NO_NOT_SURE = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_sure", label: "Not sure" },
] as const

// --- form state ----------------------------------------------------------

interface VisaFinanceFormState {
  savings_available: string | null
  preferred_currency: string | null
  work_while_studying: string | null
  pre_first_paycheck_support: string | null
  settlement_support_source: string | null
  income_covers_living_costs: string | null
  prior_visa: string | null
  prior_visa_type: string | null
  visa_rejections: string | null
  criminal_record: string | null
  healthcare_needs: string | null
  prescription_medications: string | null
  pets: string | null
  a1_certificate_status: string | null
  coc_status: string | null
  pwd_filed: string | null
}

const EMPTY_FORM: VisaFinanceFormState = {
  savings_available: null,
  preferred_currency: null,
  work_while_studying: null,
  pre_first_paycheck_support: null,
  settlement_support_source: null,
  income_covers_living_costs: null,
  prior_visa: null,
  prior_visa_type: null,
  visa_rejections: null,
  criminal_record: null,
  healthcare_needs: null,
  prescription_medications: null,
  pets: null,
  a1_certificate_status: null,
  coc_status: null,
  pwd_filed: null,
}

interface ValidationErrors {
  savings_available?: string
  work_while_studying?: string
  pre_first_paycheck_support?: string
  settlement_support_source?: string
  income_covers_living_costs?: string
  prior_visa?: string
  prior_visa_type?: string
  visa_rejections?: string
  criminal_record?: string
  healthcare_needs?: string
  prescription_medications?: string
  pets?: string
  a1_certificate_status?: string
  coc_status?: string
  pwd_filed?: string
}

function validate(
  form: VisaFinanceFormState,
  purpose: string | null,
  posting: string | null,
): ValidationErrors {
  const e: ValidationErrors = {}
  if (!form.savings_available || !form.preferred_currency) {
    e.savings_available = "Enter how much you've saved so far."
  }
  if (purpose === "study" && !form.work_while_studying) {
    e.work_while_studying = "Pick the option that fits."
  }
  if (purpose === "work" && !form.pre_first_paycheck_support) {
    e.pre_first_paycheck_support = "Pick the option that fits."
  }
  if (purpose === "settle" && !form.settlement_support_source) {
    e.settlement_support_source = "Pick the option that fits."
  }
  if (purpose === "digital_nomad" && !form.income_covers_living_costs) {
    e.income_covers_living_costs = "Pick the option that fits."
  }
  if (!form.prior_visa) e.prior_visa = "Pick yes or no."
  if (form.prior_visa === "yes" && !form.prior_visa_type?.trim()) {
    e.prior_visa_type = "Tell us what type of visa it was."
  }
  if (!form.visa_rejections) e.visa_rejections = "Pick yes or no."
  if (!form.criminal_record) e.criminal_record = "Pick yes or no."
  if (!form.healthcare_needs) e.healthcare_needs = "Pick the option that fits."
  if (form.healthcare_needs && form.healthcare_needs !== "none" && !form.prescription_medications) {
    e.prescription_medications = "Pick yes or no."
  }
  if (!form.pets) e.pets = "Pick the option that fits."
  if (purpose === "work" && posting === "yes") {
    if (!form.a1_certificate_status) {
      e.a1_certificate_status = "Pick the status."
    }
    if (!form.coc_status) {
      e.coc_status = "Pick the status."
    }
    if (!form.pwd_filed) {
      e.pwd_filed = "Pick the option that fits."
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

export default function OnboardingVisaFinancePage() {
  const router = useRouter()

  const [form, setForm] = React.useState<VisaFinanceFormState>(EMPTY_FORM)
  const [purpose, setPurpose] = React.useState<string | null>(null)
  // posting_or_secondment is set on /onboarding/work and read here only
  // to gate the Posting Compliance section. Not editable on this page.
  const [postingOrSecondment, setPostingOrSecondment] = React.useState<string | null>(
    null,
  )
  const [destination, setDestination] = React.useState<string | null>(null)
  const [planVersion, setPlanVersion] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [submitAttempted, setSubmitAttempted] = React.useState(false)
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null)

  const update = React.useCallback(
    <K extends keyof VisaFinanceFormState>(key: K, value: VisaFinanceFormState[K]) => {
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
        setPurpose(typeof pd.purpose === "string" ? pd.purpose : null)
        setPostingOrSecondment(
          typeof pd.posting_or_secondment === "string"
            ? pd.posting_or_secondment
            : null,
        )
        setDestination(typeof pd.destination === "string" ? pd.destination : null)
        setForm({
          savings_available:
            typeof pd.savings_available === "string" ? pd.savings_available : null,
          preferred_currency:
            typeof pd.preferred_currency === "string" ? pd.preferred_currency : null,
          work_while_studying:
            typeof pd.work_while_studying === "string"
              ? pd.work_while_studying
              : null,
          pre_first_paycheck_support:
            typeof pd.pre_first_paycheck_support === "string"
              ? pd.pre_first_paycheck_support
              : null,
          settlement_support_source:
            typeof pd.settlement_support_source === "string"
              ? pd.settlement_support_source
              : null,
          income_covers_living_costs:
            typeof pd.income_covers_living_costs === "string"
              ? pd.income_covers_living_costs
              : null,
          prior_visa: typeof pd.prior_visa === "string" ? pd.prior_visa : null,
          prior_visa_type:
            typeof pd.prior_visa_type === "string" ? pd.prior_visa_type : null,
          visa_rejections:
            typeof pd.visa_rejections === "string" ? pd.visa_rejections : null,
          criminal_record:
            typeof pd.criminal_record === "string" ? pd.criminal_record : null,
          healthcare_needs:
            typeof pd.healthcare_needs === "string" ? pd.healthcare_needs : null,
          prescription_medications:
            typeof pd.prescription_medications === "string"
              ? pd.prescription_medications
              : null,
          pets: typeof pd.pets === "string" ? pd.pets : null,
          a1_certificate_status:
            typeof pd.a1_certificate_status === "string"
              ? pd.a1_certificate_status
              : null,
          coc_status:
            typeof pd.coc_status === "string" ? pd.coc_status : null,
          pwd_filed:
            typeof pd.pwd_filed === "string" ? pd.pwd_filed : null,
        })
      })
      .catch((err) => {
        console.error("[onboarding/visa-finance] hydrate failed", err)
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
  // hasn't already chosen one).
  React.useEffect(() => {
    if (!destination || form.preferred_currency) return
    const inferred = getCurrencyFromCountry(destination)
    if (inferred) update("preferred_currency", inferred)
  }, [destination, form.preferred_currency, update])

  // Clear gated answers if their gating field changes back.
  React.useEffect(() => {
    if (form.prior_visa !== "yes" && form.prior_visa_type) {
      update("prior_visa_type", null)
    }
  }, [form.prior_visa, form.prior_visa_type, update])

  React.useEffect(() => {
    if (
      form.healthcare_needs === "none" &&
      form.prescription_medications
    ) {
      update("prescription_medications", null)
    }
  }, [form.healthcare_needs, form.prescription_medications, update])

  const errors = submitAttempted ? validate(form, purpose, postingOrSecondment) : {}
  const hasErrors =
    Object.keys(validate(form, purpose, postingOrSecondment)).length > 0

  const buildProfileData = (): Record<string, unknown> => {
    const isWork = purpose === "work"
    const isSettle = purpose === "settle"
    const isDn = purpose === "digital_nomad"
    const isPosting = isWork && postingOrSecondment === "yes"
    return {
      savings_available: form.savings_available,
      preferred_currency: form.preferred_currency,
      // Purpose-scoped fields are nulled out when their gate doesn't
      // apply, so stale state from an earlier purpose doesn't leak.
      work_while_studying: purpose === "study" ? form.work_while_studying : null,
      pre_first_paycheck_support: isWork ? form.pre_first_paycheck_support : null,
      settlement_support_source: isSettle ? form.settlement_support_source : null,
      income_covers_living_costs: isDn ? form.income_covers_living_costs : null,
      prior_visa: form.prior_visa,
      prior_visa_type: form.prior_visa_type?.trim() || null,
      visa_rejections: form.visa_rejections,
      criminal_record: form.criminal_record,
      healthcare_needs: form.healthcare_needs,
      prescription_medications: form.prescription_medications,
      pets: form.pets,
      a1_certificate_status: isPosting ? form.a1_certificate_status : null,
      coc_status: isPosting ? form.coc_status : null,
      pwd_filed: isPosting ? form.pwd_filed : null,
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
          console.error("[onboarding/visa-finance] retry after conflict failed", retryErr)
        }
      } else {
        console.error("[onboarding/visa-finance] save failed", err)
      }
      setErrorBanner("Couldn't save. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleContinue = () => {
    void save(() => router.push("/onboarding/review"), { requireValid: true })
  }

  const handleSaveExit = () => {
    void save(() => router.push("/dashboard"), { requireValid: false })
  }

  // Back routes to whichever step 3 page the user came from.
  const handleBack = () => {
    const path =
      purpose === "work"
        ? "/onboarding/work"
        : purpose === "digital_nomad"
        ? "/onboarding/digital-nomad"
        : purpose === "settle"
        ? "/onboarding/settle"
        : "/onboarding/study"
    router.push(path)
  }

  if (loading) {
    return (
      <OnboardingShell
        step={4}
        totalSteps={5}
        eyebrow="Step 4 of 5"
        title="Visa & finances"
        subtitle="Money, visa history, and special circumstances."
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

  const showPrescriptionMedications =
    form.healthcare_needs && form.healthcare_needs !== "none"

  return (
    <OnboardingShell
      step={4}
      totalSteps={5}
      eyebrow="Step 4 of 5"
      title="Visa & finances"
      subtitle="Money, visa history, and special circumstances."
      primaryLabel="Save & continue"
      primaryLoading={saving}
      onPrimary={handleContinue}
      onSecondary={handleSaveExit}
      onBack={handleBack}
      errorBanner={errorBanner}
    >
      <div className="space-y-6">
        <OnboardingSection title="Money">
          <OnboardingField
            label="How much have you saved so far?"
            helper="Total liquid savings you can put toward this move. We'll use this to compute what you still need to save based on cost-of-living in your destination."
            error={errors.savings_available}
          >
            <CurrencyAmountInput
              amount={form.savings_available}
              currency={form.preferred_currency}
              onAmountChange={(a) => update("savings_available", a)}
              onCurrencyChange={(c) => update("preferred_currency", c)}
            />
          </OnboardingField>

          {purpose === "study" && (
            <OnboardingField
              label="Do you expect to work while studying?"
              error={errors.work_while_studying}
            >
              <OptionPills
                options={WORK_WHILE_STUDYING_OPTIONS}
                value={form.work_while_studying}
                onChange={(v) => update("work_while_studying", v)}
                ariaLabel="Work while studying"
              />
            </OnboardingField>
          )}

          {purpose === "work" && (
            <OnboardingField
              label="How will you support yourself before your first paycheck?"
              helper="Most work moves have 4–8 weeks between arrival and first salary payment."
              error={errors.pre_first_paycheck_support}
            >
              <OptionPills
                options={PRE_FIRST_PAYCHECK_SUPPORT_OPTIONS}
                value={form.pre_first_paycheck_support}
                onChange={(v) => update("pre_first_paycheck_support", v)}
                ariaLabel="Pre-first-paycheck support"
              />
            </OnboardingField>
          )}

          {purpose === "settle" && (
            <OnboardingField
              label="How will you support yourself after the move?"
              error={errors.settlement_support_source}
            >
              <OptionPills
                options={SETTLEMENT_SUPPORT_OPTIONS}
                value={form.settlement_support_source}
                onChange={(v) => update("settlement_support_source", v)}
                ariaLabel="Settlement support source"
              />
            </OnboardingField>
          )}

          {purpose === "digital_nomad" && (
            <OnboardingField
              label="Do you expect your current income to cover your living costs there?"
              error={errors.income_covers_living_costs}
            >
              <OptionPills
                options={INCOME_COVERS_LIVING_OPTIONS}
                value={form.income_covers_living_costs}
                onChange={(v) => update("income_covers_living_costs", v)}
                ariaLabel="Income covers living costs"
              />
            </OnboardingField>
          )}
        </OnboardingSection>

        <OnboardingSection title="Visa history">
          <OnboardingField
            label="Have you held a visa for this country before?"
            error={errors.prior_visa}
          >
            <OptionPills
              options={YES_NO}
              value={form.prior_visa}
              onChange={(v) => update("prior_visa", v)}
              ariaLabel="Prior visa"
            />
          </OnboardingField>

          {form.prior_visa === "yes" && (
            <OnboardingField
              label="What type of visa was it?"
              htmlFor="prior_visa_type"
              error={errors.prior_visa_type}
            >
              <Input
                id="prior_visa_type"
                type="text"
                value={form.prior_visa_type ?? ""}
                onChange={(e) => update("prior_visa_type", e.target.value || null)}
                placeholder="e.g. Tourist, Student, Work permit"
                className="h-10"
                maxLength={120}
              />
            </OnboardingField>
          )}

          <OnboardingField
            label="Have you ever had a visa refused or rejected?"
            error={errors.visa_rejections}
          >
            <OptionPills
              options={YES_NO}
              value={form.visa_rejections}
              onChange={(v) => update("visa_rejections", v)}
              ariaLabel="Visa rejections"
            />
          </OnboardingField>

          <OnboardingField
            label="Do you have any criminal record or ongoing legal issues that could affect a visa application?"
            error={errors.criminal_record}
          >
            <OptionPills
              options={YES_NO}
              value={form.criminal_record}
              onChange={(v) => update("criminal_record", v)}
              ariaLabel="Criminal record"
            />
          </OnboardingField>
        </OnboardingSection>

        <OnboardingSection title="Special circumstances">
          <OnboardingField
            label="Do you have any ongoing medical conditions or healthcare needs?"
            error={errors.healthcare_needs}
          >
            <OptionPills
              options={HEALTHCARE_OPTIONS}
              value={form.healthcare_needs}
              onChange={(v) => update("healthcare_needs", v)}
              ariaLabel="Healthcare needs"
            />
          </OnboardingField>

          {showPrescriptionMedications && (
            <OnboardingField
              label="Do you take any prescription medications?"
              error={errors.prescription_medications}
            >
              <OptionPills
                options={YES_NO}
                value={form.prescription_medications}
                onChange={(v) => update("prescription_medications", v)}
                ariaLabel="Prescription medications"
              />
            </OnboardingField>
          )}

          <OnboardingField
            label="Are you bringing any pets?"
            error={errors.pets}
          >
            <OptionPills
              options={PETS_OPTIONS}
              value={form.pets}
              onChange={(v) => update("pets", v)}
              ariaLabel="Pets"
            />
          </OnboardingField>
        </OnboardingSection>

        {purpose === "work" && postingOrSecondment === "yes" && (
          <OnboardingSection title="Posting compliance">
            <OnboardingField
              label="What is the status of your A1 certificate?"
              helper="Issued by your home-country social-security authority — proves you stay covered there during the posting."
              error={errors.a1_certificate_status}
            >
              <OptionPills
                options={POSTING_DOC_STATUS_OPTIONS}
                value={form.a1_certificate_status}
                onChange={(v) => update("a1_certificate_status", v)}
                ariaLabel="A1 certificate status"
              />
            </OnboardingField>

            <OnboardingField
              label="What is the status of your Certificate of Coverage?"
              helper="The bilateral-agreement equivalent of an A1 for non-EU postings."
              error={errors.coc_status}
            >
              <OptionPills
                options={POSTING_DOC_STATUS_OPTIONS}
                value={form.coc_status}
                onChange={(v) => update("coc_status", v)}
                ariaLabel="Certificate of Coverage status"
              />
            </OnboardingField>

            <OnboardingField
              label="Has the posted-worker declaration been filed?"
              helper="Filed with the destination labor authority before work starts (e.g. Arbetsmiljöverket in Sweden, ZOLL in Germany)."
              error={errors.pwd_filed}
            >
              <OptionPills
                options={YES_NO_NOT_SURE}
                value={form.pwd_filed}
                onChange={(v) => update("pwd_filed", v)}
                ariaLabel="Posted-worker declaration filed"
              />
            </OnboardingField>
          </OnboardingSection>
        )}
      </div>
    </OnboardingShell>
  )
}
