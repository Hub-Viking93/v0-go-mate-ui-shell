/**
 * Coordinator — head-chef agent that decides which specialists to
 * dispatch for a given user profile.
 *
 * Pure rule-based dispatch (no LLM). Returns the list of specialists
 * to run plus a one-line plain-English rationale for each, so the
 * decision is always explainable in the UI.
 *
 * The visible agents-panel grid on the dashboard calls
 * /api/research/dispatch-preview FIRST to render the panel skeletons,
 * then the actual research run dispatches the same set.
 */

import type { AllFieldKey, Profile } from "../gomate/profile-schema-snapshot";
import { currentLocationLooksLikeExitTaxCountry } from "../gomate/exit-tax-list";

export interface SpecialistInvocation {
  /** Stable specialist identifier (snake_case). Used as panel key. */
  name: string;
  /**
   * Profile slice the specialist needs. We pass only the fields the
   * specialist actually consumes so its prompt budget isn't wasted on
   * irrelevant context and so audit logs are scannable.
   */
  inputs: Partial<Profile>;
}

export interface DispatchRationale {
  /** Matches SpecialistInvocation.name. */
  specialist: string;
  /** Plain-English one-liner shown in the UI under the panel title. */
  reason: string;
}

export interface DispatchDecision {
  specialists: SpecialistInvocation[];
  rationale: DispatchRationale[];
}

/**
 * Pull `keys` out of `profile` into a fresh object. Missing keys are
 * omitted (undefined values would lie about what was actually set).
 */
function slice(profile: Profile, keys: AllFieldKey[]): Partial<Profile> {
  const out: Partial<Profile> = {};
  for (const k of keys) {
    const v = profile[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** True when string-or-number value is present and non-empty (post-trim). */
function has(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim() !== "";
  return true;
}

/** Normalise a stringly-typed enum value: trim + lowercase, "" if absent. */
function norm(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim().toLowerCase();
}

/** children_count is stored as string ("0", "1", "2", …). */
function childrenCount(profile: Profile): number {
  const raw = norm(profile.children_count);
  if (raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** pets is stored as string ("none", "dog", "cat", "other"). */
function hasPets(profile: Profile): boolean {
  const v = norm(profile.pets);
  if (v === "") return false;
  return v !== "none";
}

/** healthcare_needs deep-mode = present AND not literally "none". */
function hasHealthcareNeed(profile: Profile): boolean {
  const v = norm(profile.healthcare_needs);
  if (v === "") return false;
  return v !== "none";
}

// ---------------------------------------------------------------------
// Per-specialist input slices (single source of truth)
// ---------------------------------------------------------------------

/**
 * Field lists for the conditional specialists (those NOT in
 * ALWAYS_RUN_SPECS). Kept as a top-level constant so the
 * Critic-driven re-dispatch path can build a proper profile slice for
 * a specialist that wasn't initially dispatched, instead of passing an
 * empty `{}` (which would force the specialist into fallback quality).
 *
 * Must stay in sync with the per-branch `slice(profile, [...])` calls
 * below — there's a typecheck-time AllFieldKey constraint, but no
 * runtime check.
 */
export const CONDITIONAL_SPEC_FIELDS: Record<string, AllFieldKey[]> = {
  schools_specialist: [
    "destination",
    "target_city",
    "children_count",
    "children_ages",
    "children_school_type_preference",
    "children_language_skills_destination",
    "children_special_needs",
    "duration",
  ],
  study_program_specialist: [
    "destination",
    "target_city",
    "purpose",
    "study_type",
    "study_field",
    "study_funding",
    "duration",
  ],
  pet_specialist: [
    "destination",
    "pets",
    "pet_microchip_status",
    "pet_vaccination_status",
    "pet_breed",
    "pet_size_weight",
    "pet_age",
  ],
  posted_worker_specialist: [
    "current_location",
    "destination",
    "home_country_employer",
    "posting_employer_address",
    "posting_duration_months",
    "a1_certificate_status",
    "coc_status",
    "pwd_filed",
  ],
  digital_nomad_compliance: [
    "destination",
    "duration",
    "remote_income",
    "income_source",
    "monthly_income",
    "income_consistency",
    "income_history_months",
  ],
  job_compliance_specialist: [
    "destination",
    "job_field",
    "employer_sponsorship",
    "highly_skilled",
    "years_experience",
    "education_level",
  ],
  family_reunion_specialist: [
    "destination",
    "visa_role",
    "settlement_reason",
    "partner_citizenship",
    "partner_visa_status",
    "partner_residency_duration",
    "relationship_type",
    "relationship_duration",
    "marriage_certificate_apostille_status",
  ],
  departure_tax_specialist: [
    "current_location",
    "citizenship",
    "destination",
    "duration",
    "pre_existing_investments_to_migrate",
    "existing_offshore_accounts",
    "departure_tax_filing_required",
    "exit_tax_obligations",
  ],
  vehicle_import_specialist: [
    "destination",
    "vehicle_make_model_year",
    "vehicle_origin_country",
    "vehicle_emission_standard",
  ],
  property_purchase_specialist: [
    "destination",
    "target_city",
    "savings_available",
    "monthly_budget",
    "duration",
  ],
  trailing_spouse_career_specialist: [
    "destination",
    "spouse_career_field",
    "spouse_seeking_work",
    "spouse_language_skills",
    "spouse_visa_dependency",
  ],
  pension_continuity_specialist: [
    "current_location",
    "destination",
    "duration",
    "citizenship",
  ],
};

/**
 * Returns the input-field list a given specialist consumes, regardless
 * of whether the coordinator chose to dispatch it for this profile.
 * Used by the research-orchestrator's Critic-driven re-dispatch path so
 * a Critic-suggested specialist (one that was NOT initially dispatched)
 * can still be invoked with the right profile slice instead of `{}`.
 *
 * Returns `null` for unknown specialist names so the caller can skip.
 */
export function inputFieldsFor(name: string): AllFieldKey[] | null {
  for (const spec of ALWAYS_RUN_SPECS) {
    if (spec.name === name) return spec.fields;
  }
  return CONDITIONAL_SPEC_FIELDS[name] ?? null;
}

/**
 * Convenience: build a SpecialistInvocation for `name` from `profile`,
 * returning `null` if the specialist is unknown. Lets the
 * research-orchestrator re-dispatch a Critic-suggested specialist with
 * a proper profile slice.
 */
export function buildInvocation(
  profile: Profile,
  name: string,
): SpecialistInvocation | null {
  const fields = inputFieldsFor(name);
  if (!fields) return null;
  return { name, inputs: slice(profile, fields) };
}

const ALWAYS_RUN_SPECS: { name: string; fields: AllFieldKey[] }[] = [
  {
    name: "visa_specialist",
    fields: [
      "name",
      "citizenship",
      "other_citizenships",
      "birth_year",
      "current_location",
      "destination",
      "purpose",
      "visa_role",
      "duration",
      "timeline",
      "highly_skilled",
      "job_offer",
      "employer_sponsorship",
      "education_level",
      "years_experience",
      "prior_visa",
      "visa_rejections",
      // Family / settlement cascade. Without these the visa specialist
      // could not see "settle on a Swedish sambo permit" or "join a
      // citizen spouse" and defaulted to "Cannot determine — no
      // qualifying purpose" even when settlement_reason was set.
      "settlement_reason",
      "family_ties",
      "partner_citizenship",
      "partner_visa_status",
      "relationship_type",
      "relationship_duration",
      // Posting / remote-work / digital-nomad cascade. The specialist
      // needs to see SaaS/self-employed income and posting status to
      // recommend the right pathway (DN visa, retiree-style permit,
      // ICT, posted-worker A1).
      "posting_or_secondment",
      "posting_duration_months",
      "remote_income",
      "income_source",
      "monthly_income",
      "income_consistency",
      "income_history_months",
      "savings_available",
    ],
  },
  {
    name: "tax_strategist",
    fields: [
      "citizenship",
      "current_location",
      "destination",
      "duration",
      "purpose",
      "monthly_income",
      "savings_available",
      "remote_income",
      "income_source",
      "pre_existing_investments_to_migrate",
    ],
  },
  {
    name: "cost_specialist",
    fields: [
      "destination",
      "target_city",
      "duration",
      "monthly_budget",
      "savings_available",
      "preferred_currency",
      "moving_alone",
      "spouse_joining",
      "children_count",
    ],
  },
  {
    name: "housing_specialist",
    fields: [
      "destination",
      "target_city",
      "duration",
      "monthly_budget",
      "rental_budget_max",
      "furnished_preference",
      "commute_tolerance_minutes",
      "moving_alone",
      "children_count",
      "pets",
    ],
  },
  {
    name: "cultural_adapter",
    fields: [
      "citizenship",
      "current_location",
      "destination",
      "target_city",
      "duration",
      "purpose",
      "language_skill",
      "religious_practice_required",
      "children_count",
    ],
  },
  {
    name: "documents_specialist",
    fields: [
      // Core identity / pathway
      "citizenship",
      "destination",
      "target_city",
      "purpose",
      "visa_role",
      // Family / partner — drives "family" domain
      "relationship_type",
      "partner_citizenship",
      "spouse_joining",
      // Children / dependents — drives "school" domain
      "children_count",
      "children_ages",
      "children_birth_certificate_apostille_status",
      // Work / posted-worker — drives "work" + "posted_worker" domains
      "highly_skilled",
      "education_level",
      "study_type",
      "posting_or_secondment",
      "posting_duration_months",
      "home_country_employer",
      "coc_status",
      "pwd_filed",
      // Pet — drives "pet" domain
      "pets",
      "pet_microchip_status",
      "pet_vaccination_status",
      "pet_breed",
      // Vehicle — drives "vehicle" domain
      "bringing_vehicle",
      "vehicle_make_model_year",
      "vehicle_origin_country",
      "vehicle_emission_standard",
      // Departure-side
      "current_location",
      "departure_tax_filing_required",
      "exit_tax_obligations",
      "pension_continuity_required",
      "origin_lease_status",
      // Apostille / clearance state
      "birth_certificate_apostille_status",
      "marriage_certificate_apostille_status",
      "diploma_apostille_status",
      "police_clearance_status",
      "medical_exam_required",
    ],
  },
  {
    name: "healthcare_navigator",
    fields: [
      "destination",
      "target_city",
      "healthcare_needs",
      "chronic_condition_description",
      "prescription_medications",
      "prescription_medications_list",
      "english_speaking_doctor_required",
      "pre_existing_condition_disclosure_concern",
      "accessibility_needs",
      "children_count",
    ],
  },
  {
    name: "banking_helper",
    fields: [
      "citizenship",
      "current_location",
      "destination",
      "duration",
      "purpose",
      "preferred_currency",
      "monthly_income",
      "savings_available",
      "existing_offshore_accounts",
    ],
  },
];

// ---------------------------------------------------------------------
// decideDispatch — the head chef
// ---------------------------------------------------------------------

export function decideDispatch(profile: Profile): DispatchDecision {
  const specialists: SpecialistInvocation[] = [];
  const rationale: DispatchRationale[] = [];

  // Always-run specialists --------------------------------------------
  for (const { name, fields } of ALWAYS_RUN_SPECS) {
    specialists.push({ name, inputs: slice(profile, fields) });
  }
  rationale.push(
    { specialist: "visa_specialist",       reason: "Visa Specialist always runs to map destination requirements to your citizenship and purpose." },
    { specialist: "tax_strategist",        reason: "Tax Strategist always runs to flag double-taxation and residency-tax exposure for your move." },
    { specialist: "cost_specialist",       reason: "Cost Specialist always runs to size a realistic monthly budget for your destination city." },
    { specialist: "housing_specialist",    reason: "Housing Specialist always runs to surface neighbourhoods that fit your budget and household." },
    { specialist: "cultural_adapter",      reason: "Cultural Adapter always runs to flag etiquette, language, and integration considerations." },
    { specialist: "documents_specialist",  reason: "Documents Specialist always runs to enumerate the apostilles, translations, and certificates you'll need." },
  );

  // Healthcare navigator runs always — but the rationale changes when
  // the user has flagged a real need so the panel is appropriately
  // emphasized in the UI.
  const healthcareDeep = hasHealthcareNeed(profile);
  rationale.push({
    specialist: "healthcare_navigator",
    reason: healthcareDeep
      ? `Healthcare Navigator dispatched (deep mode) because user flagged "${profile.healthcare_needs}" — will research provider access, medication availability and insurance gaps.`
      : "Healthcare Navigator always runs to map destination healthcare access and any insurance gaps.",
  });

  rationale.push({
    specialist: "banking_helper",
    reason:
      "Banking Helper always runs to plan account-opening, currency, and remittance for the move.",
  });

  // Conditional specialists -------------------------------------------

  const kidsCount = childrenCount(profile);
  if (kidsCount > 0) {
    specialists.push({
      name: "schools_specialist",
      inputs: slice(profile, CONDITIONAL_SPEC_FIELDS.schools_specialist),
    });
    rationale.push({
      specialist: "schools_specialist",
      reason: `Schools Specialist dispatched because user is moving with ${kidsCount} ${kidsCount === 1 ? "child" : "children"}.`,
    });
  }

  if (profile.purpose === "study") {
    const studyType = typeof profile.study_type === "string" ? profile.study_type : "";
    const studyTypeLabel =
      studyType === "language_school" ? "language-school"
      : studyType === "university" ? "university"
      : studyType === "vocational" ? "vocational"
      : studyType === "exchange" ? "exchange"
      : "study";
    specialists.push({
      name: "study_program_specialist",
      inputs: slice(profile, CONDITIONAL_SPEC_FIELDS.study_program_specialist),
    });
    rationale.push({
      specialist: "study_program_specialist",
      reason: `Study-Program Specialist dispatched because purpose is study (${studyTypeLabel}) — surfaces accredited programs that can sponsor the student visa, application timelines, and scholarship pathways.`,
    });
  }

  if (hasPets(profile)) {
    specialists.push({
      name: "pet_specialist",
      inputs: slice(profile, CONDITIONAL_SPEC_FIELDS.pet_specialist),
    });
    rationale.push({
      specialist: "pet_specialist",
      reason: `Pet Specialist dispatched because user is bringing a ${profile.pets} — import paperwork, vaccinations and quarantine rules vary by destination.`,
    });
  }

  if (profile.posting_or_secondment === "yes") {
    specialists.push({
      name: "posted_worker_specialist",
      inputs: slice(profile, CONDITIONAL_SPEC_FIELDS.posted_worker_specialist),
    });
    const months = profile.posting_duration_months;
    const monthsLabel = has(months) ? `${months}-month ` : "";
    rationale.push({
      specialist: "posted_worker_specialist",
      reason: `Posted Worker Specialist dispatched because this is a ${monthsLabel}corporate posting/secondment — needs A1 certificate, posted-worker declaration and home-country social-security continuity.`,
    });
  }

  if (profile.purpose === "digital_nomad") {
    specialists.push({
      name: "digital_nomad_compliance",
      inputs: slice(profile, CONDITIONAL_SPEC_FIELDS.digital_nomad_compliance),
    });
    rationale.push({
      specialist: "digital_nomad_compliance",
      reason:
        "Digital-Nomad Compliance dispatched because purpose is digital nomad — checks income thresholds, visa eligibility and 183-day tax-residency triggers.",
    });
  }

  if (
    profile.purpose === "work" &&
    profile.job_offer === "yes" &&
    profile.posting_or_secondment !== "yes"
  ) {
    specialists.push({
      name: "job_compliance_specialist",
      inputs: slice(profile, CONDITIONAL_SPEC_FIELDS.job_compliance_specialist),
    });
    rationale.push({
      specialist: "job_compliance_specialist",
      reason:
        "Job-Compliance Specialist dispatched because user has a local job offer (not a posting) — checks work-permit pathway, sponsorship process and salary threshold.",
    });
  }

  if (
    profile.visa_role === "dependent" ||
    profile.settlement_reason === "family_reunion"
  ) {
    specialists.push({
      name: "family_reunion_specialist",
      inputs: slice(profile, CONDITIONAL_SPEC_FIELDS.family_reunion_specialist),
    });
    const reasonText =
      profile.visa_role === "dependent"
        ? `user is moving as a dependent (${profile.relationship_type ?? "partner"})`
        : "settlement reason is family reunion";
    rationale.push({
      specialist: "family_reunion_specialist",
      reason: `Family-Reunion Specialist dispatched because ${reasonText} — handles partner-visa pathway, sponsor income proof and relationship documentation.`,
    });
  }

  if (currentLocationLooksLikeExitTaxCountry(profile.current_location)) {
    specialists.push({
      name: "departure_tax_specialist",
      inputs: slice(profile, CONDITIONAL_SPEC_FIELDS.departure_tax_specialist),
    });
    rationale.push({
      specialist: "departure_tax_specialist",
      reason: `Departure-Tax Specialist dispatched because origin "${profile.current_location}" is a jurisdiction with exit-tax provisions — checks unrealised-gain triggers and filing obligations on emigration.`,
    });
  }

  if (profile.bringing_vehicle === "yes") {
    specialists.push({
      name: "vehicle_import_specialist",
      inputs: slice(profile, CONDITIONAL_SPEC_FIELDS.vehicle_import_specialist),
    });
    rationale.push({
      specialist: "vehicle_import_specialist",
      reason:
        "Vehicle-Import Specialist dispatched because user is bringing a vehicle — checks emissions compliance, registration paperwork and import-duty exemptions.",
    });
  }

  if (profile.home_purchase_intent === "yes") {
    specialists.push({
      name: "property_purchase_specialist",
      inputs: slice(profile, CONDITIONAL_SPEC_FIELDS.property_purchase_specialist),
    });
    rationale.push({
      specialist: "property_purchase_specialist",
      reason:
        "Property-Purchase Specialist dispatched because user intends to buy a home — checks foreigner-purchase rules, mortgage eligibility and transfer taxes.",
    });
  }

  if (
    profile.spouse_joining === "yes" &&
    profile.spouse_seeking_work === "yes"
  ) {
    specialists.push({
      name: "trailing_spouse_career_specialist",
      inputs: slice(profile, CONDITIONAL_SPEC_FIELDS.trailing_spouse_career_specialist),
    });
    rationale.push({
      specialist: "trailing_spouse_career_specialist",
      reason:
        "Trailing-Spouse Career Specialist dispatched because spouse is joining and plans to seek work — checks dependent work-permit rules and credential-recognition pathways.",
    });
  }

  if (profile.pension_continuity_required === "yes") {
    specialists.push({
      name: "pension_continuity_specialist",
      inputs: slice(profile, CONDITIONAL_SPEC_FIELDS.pension_continuity_specialist),
    });
    rationale.push({
      specialist: "pension_continuity_specialist",
      reason:
        "Pension-Continuity Specialist dispatched because user needs cross-border pension continuity — checks totalisation agreements and contribution gaps.",
    });
  }

  return { specialists, rationale };
}
