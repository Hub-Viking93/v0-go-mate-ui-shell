// =============================================================
// SNAPSHOT of artifacts/gomate/src/lib/gomate/profile-schema.ts
// + state-machine.ts (FIELD_ORDER + getNextPendingField).
// =============================================================
// The api-server cannot import from artifacts/gomate (cross-
// artifact dep). Wave 2.3 needs `getRequiredFields` and
// `getNextPendingField` to drive the chat orchestrator + Question
// Director on the server. Until profile-schema is promoted into a
// shared workspace package this snapshot lives here as the
// authoritative server-side mirror.
//
// TODO[wave-2.x-unify-schema]: promote profile-schema.ts into a
// shared `@workspace/intake-schema` package and delete this file.
// Same TODO is on lib/agents/src/intake-fields.ts; keep them all
// in sync until the unification lands.
//
// DRIFT GUARD: this file ONLY mirrors the `required` predicate
// and `dependsOn` block of each FIELD_CONFIG entry — labels,
// examples, intents, extraction hints intentionally OMITTED.
// Anything that runs server-side and needs those should depend on
// lib/agents/src/intake-fields.ts (FIELD_INFO) instead.
// =============================================================

export type AllFieldKey =
  | "name"
  | "citizenship"
  | "other_citizenships"
  | "birth_year"
  | "current_location"
  | "destination"
  | "target_city"
  | "purpose"
  | "visa_role"
  | "partner_citizenship"
  | "partner_visa_status"
  | "partner_residency_duration"
  | "relationship_type"
  | "relationship_duration"
  | "study_type"
  | "study_field"
  | "study_funding"
  | "job_offer"
  | "job_field"
  | "employer_sponsorship"
  | "highly_skilled"
  | "remote_income"
  | "income_source"
  | "monthly_income"
  | "income_consistency"
  | "income_history_months"
  | "settlement_reason"
  | "family_ties"
  | "duration"
  | "timeline"
  | "moving_alone"
  | "spouse_joining"
  | "children_count"
  | "children_ages"
  | "savings_available"
  | "monthly_budget"
  | "preferred_currency"
  | "need_budget_help"
  | "language_skill"
  | "education_level"
  | "years_experience"
  | "prior_visa"
  | "visa_rejections"
  | "healthcare_needs"
  | "pets"
  | "special_requirements"
  | "posting_or_secondment"
  | "home_country_employer"
  | "posting_employer_address"
  | "posting_duration_months"
  | "a1_certificate_status"
  | "coc_status"
  | "pwd_filed"
  | "prior_visa_country"
  | "prior_visa_type"
  | "prior_residence_outside_origin"
  | "birth_certificate_apostille_status"
  | "marriage_certificate_apostille_status"
  | "diploma_apostille_status"
  | "police_clearance_status"
  | "medical_exam_required"
  | "spouse_career_field"
  | "spouse_seeking_work"
  | "spouse_language_skills"
  | "spouse_visa_dependency"
  | "children_school_type_preference"
  | "children_language_skills_destination"
  | "children_special_needs"
  | "children_birth_certificate_apostille_status"
  | "chronic_condition_description"
  | "prescription_medications"
  | "english_speaking_doctor_required"
  | "prescription_medications_list"
  | "pre_existing_condition_disclosure_concern"
  | "pet_microchip_status"
  | "pet_vaccination_status"
  | "pet_size_weight"
  | "pet_breed"
  | "pet_age"
  | "bringing_vehicle"
  | "vehicle_make_model_year"
  | "vehicle_origin_country"
  | "vehicle_emission_standard"
  | "home_purchase_intent"
  | "rental_budget_max"
  | "furnished_preference"
  | "commute_tolerance_minutes"
  | "accessibility_needs"
  | "departure_tax_filing_required"
  | "exit_tax_obligations"
  | "pension_continuity_required"
  | "bringing_personal_effects"
  | "estimated_goods_volume_cubic_meters"
  | "goods_shipping_method"
  | "need_storage"
  | "origin_lease_status"
  | "origin_lease_termination_notice_days"
  | "driver_license_origin"
  | "driver_license_destination_intent"
  | "working_remote_during_transition"
  | "religious_practice_required"
  | "register_with_origin_embassy_intent"
  | "emergency_contact_origin_name"
  | "emergency_contact_origin_phone"
  | "pre_existing_investments_to_migrate"
  | "existing_offshore_accounts"
  | "insurance_needs_household"
  | "insurance_needs_vehicle"
  | "insurance_needs_life"
  | "gap_insurance_needed"
  | "family_visa_cascade_aware";

export type Profile = Partial<Record<AllFieldKey, string | number | null>>;

interface FieldRule {
  required: boolean | ((p: Profile) => boolean);
  dependsOn?: { field: AllFieldKey; values: string[] };
}

// Faithful mirror of FIELD_CONFIG.required + dependsOn (Wave 1.2).
const FIELD_RULES: Record<AllFieldKey, FieldRule> = {
  name: { required: true },
  citizenship: { required: true },
  other_citizenships: { required: false },
  birth_year: { required: false },
  current_location: { required: true },
  destination: { required: true },
  target_city: { required: true },
  purpose: { required: true },
  visa_role: { required: true },
  // No dependsOn on these 5: the required() predicate already
  // encodes both dependent-cascade and family_reunion-cascade.
  // A dependsOn gate on visa_role==="dependent" used to nullify
  // the family_reunion branch entirely. Bug fixed 2026-05.
  partner_citizenship: {
    required: (p) => p.visa_role === "dependent" || p.settlement_reason === "family_reunion",
  },
  partner_visa_status: {
    required: (p) => p.visa_role === "dependent" || p.settlement_reason === "family_reunion",
  },
  partner_residency_duration: {
    required: false,
  },
  relationship_type: {
    required: (p) => p.visa_role === "dependent" || p.settlement_reason === "family_reunion",
  },
  relationship_duration: {
    required: false,
  },
  study_type: {
    required: (p) => p.purpose === "study",
    dependsOn: { field: "purpose", values: ["study"] },
  },
  study_field: {
    required: (p) => p.purpose === "study" && p.study_type !== "language_school",
    dependsOn: { field: "study_type", values: ["university", "vocational", "exchange"] },
  },
  study_funding: {
    required: (p) => p.purpose === "study",
    dependsOn: { field: "purpose", values: ["study"] },
  },
  job_offer: {
    required: (p) => p.purpose === "work",
    dependsOn: { field: "purpose", values: ["work"] },
  },
  job_field: {
    required: (p) => p.purpose === "work",
    dependsOn: { field: "purpose", values: ["work"] },
  },
  employer_sponsorship: {
    required: (p) => p.purpose === "work" && p.job_offer === "yes",
    dependsOn: { field: "job_offer", values: ["yes", "in_progress"] },
  },
  highly_skilled: {
    required: (p) => p.purpose === "work",
    dependsOn: { field: "purpose", values: ["work"] },
  },
  remote_income: {
    required: (p) => p.purpose === "digital_nomad",
    dependsOn: { field: "purpose", values: ["digital_nomad"] },
  },
  income_source: {
    required: (p) => p.purpose === "digital_nomad",
    dependsOn: { field: "purpose", values: ["digital_nomad"] },
  },
  monthly_income: {
    required: (p) => p.purpose === "digital_nomad",
    dependsOn: { field: "purpose", values: ["digital_nomad"] },
  },
  income_consistency: {
    required: (p) => p.purpose === "digital_nomad",
    dependsOn: { field: "purpose", values: ["digital_nomad"] },
  },
  income_history_months: {
    required: (p) => p.purpose === "digital_nomad",
    dependsOn: { field: "purpose", values: ["digital_nomad"] },
  },
  settlement_reason: {
    required: (p) => p.purpose === "settle" || p.visa_role === "dependent",
    dependsOn: { field: "purpose", values: ["settle"] },
  },
  family_ties: {
    required: (p) => p.purpose === "settle",
    dependsOn: { field: "purpose", values: ["settle"] },
  },
  duration: { required: true },
  timeline: { required: true },
  moving_alone: { required: true },
  spouse_joining: {
    required: (p) => p.moving_alone === "no",
    dependsOn: { field: "moving_alone", values: ["no"] },
  },
  children_count: {
    required: (p) => p.moving_alone === "no",
    dependsOn: { field: "moving_alone", values: ["no"] },
  },
  children_ages: {
    required: (p) =>
      Boolean(p.moving_alone === "no" && p.children_count && p.children_count !== "0"),
    dependsOn: { field: "children_count", values: ["1", "2", "3", "4", "5"] },
  },
  savings_available: { required: true },
  monthly_budget: { required: true },
  preferred_currency: { required: false },
  need_budget_help: { required: false },
  language_skill: { required: false },
  education_level: { required: (p) => p.purpose === "work" || p.purpose === "study" },
  years_experience: {
    required: (p) => p.purpose === "work",
    dependsOn: { field: "purpose", values: ["work"] },
  },
  prior_visa: { required: false },
  visa_rejections: { required: false },
  healthcare_needs: { required: true },
  pets: { required: true },
  special_requirements: { required: false },
  posting_or_secondment: {
    required: (p) => p.purpose === "work" && p.visa_role === "primary",
    dependsOn: { field: "purpose", values: ["work"] },
  },
  home_country_employer: {
    required: (p) => p.purpose === "work" && p.posting_or_secondment === "yes",
    dependsOn: { field: "posting_or_secondment", values: ["yes"] },
  },
  posting_employer_address: {
    required: (p) => p.purpose === "work" && p.posting_or_secondment === "yes",
    dependsOn: { field: "posting_or_secondment", values: ["yes"] },
  },
  posting_duration_months: {
    required: (p) => p.purpose === "work" && p.posting_or_secondment === "yes",
    dependsOn: { field: "posting_or_secondment", values: ["yes"] },
  },
  a1_certificate_status: {
    required: (p) => p.purpose === "work" && p.posting_or_secondment === "yes",
    dependsOn: { field: "posting_or_secondment", values: ["yes"] },
  },
  coc_status: {
    required: (p) => p.purpose === "work" && p.posting_or_secondment === "yes",
    dependsOn: { field: "posting_or_secondment", values: ["yes"] },
  },
  pwd_filed: {
    required: (p) => p.purpose === "work" && p.posting_or_secondment === "yes",
    dependsOn: { field: "posting_or_secondment", values: ["yes"] },
  },
  prior_visa_country: {
    required: (p) => p.prior_visa === "yes",
    dependsOn: { field: "prior_visa", values: ["yes"] },
  },
  prior_visa_type: {
    required: (p) => p.prior_visa === "yes",
    dependsOn: { field: "prior_visa", values: ["yes"] },
  },
  prior_residence_outside_origin: { required: false },
  birth_certificate_apostille_status: {
    required: (p) =>
      p.visa_role === "dependent" ||
      p.settlement_reason === "family_reunion" ||
      p.purpose === "settle",
  },
  marriage_certificate_apostille_status: {
    required: (p) =>
      p.relationship_type === "spouse" || p.relationship_type === "registered_partner",
    dependsOn: { field: "relationship_type", values: ["spouse", "registered_partner"] },
  },
  diploma_apostille_status: {
    required: (p) =>
      (p.purpose === "work" && p.highly_skilled === "yes") ||
      (p.purpose === "study" && (p.study_type === "university" || p.study_type === "vocational")),
  },
  police_clearance_status: {
    required: (p) =>
      p.visa_role === "primary" &&
      (p.purpose === "work" || p.purpose === "study" || p.purpose === "settle"),
  },
  medical_exam_required: { required: false },
  spouse_career_field: {
    required: (p) => p.spouse_joining === "yes",
    dependsOn: { field: "spouse_joining", values: ["yes"] },
  },
  spouse_seeking_work: {
    required: (p) => p.spouse_joining === "yes",
    dependsOn: { field: "spouse_joining", values: ["yes"] },
  },
  spouse_language_skills: {
    required: (p) => p.spouse_joining === "yes",
    dependsOn: { field: "spouse_joining", values: ["yes"] },
  },
  spouse_visa_dependency: {
    required: (p) => p.spouse_joining === "yes",
    dependsOn: { field: "spouse_joining", values: ["yes"] },
  },
  children_school_type_preference: {
    required: (p) => Boolean(p.children_count && p.children_count !== "0"),
    dependsOn: { field: "children_count", values: ["1", "2", "3", "4", "5"] },
  },
  children_language_skills_destination: {
    required: (p) => Boolean(p.children_count && p.children_count !== "0"),
    dependsOn: { field: "children_count", values: ["1", "2", "3", "4", "5"] },
  },
  children_special_needs: { required: false },
  children_birth_certificate_apostille_status: {
    required: (p) => Boolean(p.children_count && p.children_count !== "0"),
    dependsOn: { field: "children_count", values: ["1", "2", "3", "4", "5"] },
  },
  chronic_condition_description: {
    required: (p) => Boolean(p.healthcare_needs && p.healthcare_needs !== "none"),
    dependsOn: { field: "healthcare_needs", values: ["chronic_condition", "disability", "yes"] },
  },
  prescription_medications: {
    required: (p) => Boolean(p.healthcare_needs && p.healthcare_needs !== "none"),
    dependsOn: { field: "healthcare_needs", values: ["chronic_condition", "disability", "yes"] },
  },
  english_speaking_doctor_required: {
    required: (p) => Boolean(p.healthcare_needs && p.healthcare_needs !== "none"),
    dependsOn: { field: "healthcare_needs", values: ["chronic_condition", "disability", "yes"] },
  },
  prescription_medications_list: {
    required: (p) => p.prescription_medications === "yes",
    dependsOn: { field: "prescription_medications", values: ["yes"] },
  },
  pre_existing_condition_disclosure_concern: { required: false },
  pet_microchip_status: {
    required: (p) => Boolean(p.pets && p.pets !== "none"),
    dependsOn: { field: "pets", values: ["dog", "cat", "other", "yes"] },
  },
  pet_vaccination_status: {
    required: (p) => Boolean(p.pets && p.pets !== "none"),
    dependsOn: { field: "pets", values: ["dog", "cat", "other", "yes"] },
  },
  pet_size_weight: {
    required: (p) => Boolean(p.pets && p.pets !== "none"),
    dependsOn: { field: "pets", values: ["dog", "cat", "other", "yes"] },
  },
  pet_breed: {
    required: (p) => Boolean(p.pets && p.pets !== "none"),
    dependsOn: { field: "pets", values: ["dog", "cat", "other", "yes"] },
  },
  pet_age: {
    required: (p) => Boolean(p.pets && p.pets !== "none"),
    dependsOn: { field: "pets", values: ["dog", "cat", "other", "yes"] },
  },
  bringing_vehicle: { required: false },
  vehicle_make_model_year: {
    required: (p) => p.bringing_vehicle === "yes",
    dependsOn: { field: "bringing_vehicle", values: ["yes"] },
  },
  vehicle_origin_country: {
    required: (p) => p.bringing_vehicle === "yes",
    dependsOn: { field: "bringing_vehicle", values: ["yes"] },
  },
  vehicle_emission_standard: {
    required: (p) => p.bringing_vehicle === "yes",
    dependsOn: { field: "bringing_vehicle", values: ["yes"] },
  },
  home_purchase_intent: { required: false },
  rental_budget_max: { required: false },
  furnished_preference: { required: false },
  commute_tolerance_minutes: { required: false },
  accessibility_needs: { required: false },
  departure_tax_filing_required: { required: false },
  exit_tax_obligations: { required: false },
  pension_continuity_required: { required: false },
  bringing_personal_effects: { required: false },
  estimated_goods_volume_cubic_meters: {
    required: (p) => p.bringing_personal_effects === "yes",
    dependsOn: { field: "bringing_personal_effects", values: ["yes"] },
  },
  goods_shipping_method: {
    required: (p) => p.bringing_personal_effects === "yes",
    dependsOn: { field: "bringing_personal_effects", values: ["yes"] },
  },
  need_storage: { required: false },
  origin_lease_status: { required: false },
  origin_lease_termination_notice_days: {
    required: (p) => p.origin_lease_status === "renting",
    dependsOn: { field: "origin_lease_status", values: ["renting"] },
  },
  driver_license_origin: { required: false },
  driver_license_destination_intent: {
    required: (p) => p.driver_license_origin === "yes",
    dependsOn: { field: "driver_license_origin", values: ["yes"] },
  },
  working_remote_during_transition: { required: false },
  religious_practice_required: { required: false },
  register_with_origin_embassy_intent: { required: false },
  emergency_contact_origin_name: { required: false },
  emergency_contact_origin_phone: { required: false },
  pre_existing_investments_to_migrate: { required: false },
  existing_offshore_accounts: { required: false },
  insurance_needs_household: { required: false },
  insurance_needs_vehicle: { required: false },
  insurance_needs_life: { required: false },
  gap_insurance_needed: { required: false },
  family_visa_cascade_aware: {
    required: (p) =>
      p.visa_role === "primary" &&
      (p.spouse_joining === "yes" || Boolean(p.children_count && p.children_count !== "0")),
  },
};

// Mirror of FIELD_ORDER from artifacts/gomate/src/lib/gomate/state-machine.ts
export const FIELD_ORDER: AllFieldKey[] = [
  "name",
  "destination",
  "target_city",
  "purpose",
  "visa_role",
  "timeline",
  "citizenship",
  "moving_alone",
  "study_type",
  "study_field",
  "study_funding",
  "job_offer",
  "job_field",
  "employer_sponsorship",
  "highly_skilled",
  "years_experience",
  "remote_income",
  "income_source",
  "monthly_income",
  "income_consistency",
  "income_history_months",
  "settlement_reason",
  "family_ties",
  "partner_citizenship",
  "partner_visa_status",
  "partner_residency_duration",
  "relationship_type",
  "relationship_duration",
  "other_citizenships",
  "birth_year",
  "spouse_joining",
  "children_count",
  "children_ages",
  "savings_available",
  "monthly_budget",
  "preferred_currency",
  "need_budget_help",
  "current_location",
  "duration",
  "language_skill",
  "education_level",
  "prior_visa",
  "visa_rejections",
  "healthcare_needs",
  "pets",
  "special_requirements",
  "posting_or_secondment",
  "home_country_employer",
  "posting_employer_address",
  "posting_duration_months",
  "a1_certificate_status",
  "coc_status",
  "pwd_filed",
  "spouse_career_field",
  "spouse_seeking_work",
  "spouse_language_skills",
  "spouse_visa_dependency",
  "children_school_type_preference",
  "children_language_skills_destination",
  "children_birth_certificate_apostille_status",
  "children_special_needs",
  "chronic_condition_description",
  "prescription_medications",
  "prescription_medications_list",
  "english_speaking_doctor_required",
  "pre_existing_condition_disclosure_concern",
  "pet_microchip_status",
  "pet_vaccination_status",
  "pet_breed",
  "pet_size_weight",
  "pet_age",
  "prior_visa_country",
  "prior_visa_type",
  "prior_residence_outside_origin",
  "bringing_vehicle",
  "vehicle_make_model_year",
  "vehicle_origin_country",
  "vehicle_emission_standard",
  "bringing_personal_effects",
  "estimated_goods_volume_cubic_meters",
  "goods_shipping_method",
  "need_storage",
  "origin_lease_status",
  "origin_lease_termination_notice_days",
  "driver_license_origin",
  "driver_license_destination_intent",
  "working_remote_during_transition",
  "birth_certificate_apostille_status",
  "marriage_certificate_apostille_status",
  "diploma_apostille_status",
  "police_clearance_status",
  "medical_exam_required",
  "departure_tax_filing_required",
  "exit_tax_obligations",
  "pension_continuity_required",
  "insurance_needs_household",
  "insurance_needs_vehicle",
  "insurance_needs_life",
  "gap_insurance_needed",
  "home_purchase_intent",
  "rental_budget_max",
  "furnished_preference",
  "commute_tolerance_minutes",
  "accessibility_needs",
  "family_visa_cascade_aware",
  "religious_practice_required",
  "register_with_origin_embassy_intent",
  "emergency_contact_origin_name",
  "emergency_contact_origin_phone",
  "pre_existing_investments_to_migrate",
  "existing_offshore_accounts",
];

/**
 * Returns the list of fields whose `required` predicate is true for
 * this profile AND whose `dependsOn` (if any) is satisfied. Mirrors
 * the gomate-side `getRequiredFields(profile)`.
 *
 * NOTE: this returns required fields regardless of whether they are
 * already filled — callers (e.g. Question Director) layer their own
 * "still needed" filter on top.
 */
export function getRequiredFields(profile: Profile): AllFieldKey[] {
  const required: AllFieldKey[] = [];
  for (const key of Object.keys(FIELD_RULES) as AllFieldKey[]) {
    const rule = FIELD_RULES[key];
    let isRequired =
      typeof rule.required === "boolean" ? rule.required : rule.required(profile);
    if (isRequired && rule.dependsOn) {
      const dependentValue = profile[rule.dependsOn.field];
      if (
        !dependentValue ||
        !rule.dependsOn.values.includes(String(dependentValue))
      ) {
        isRequired = false;
      }
    }
    if (isRequired) required.push(key);
  }
  return required;
}

/**
 * Walks FIELD_ORDER and returns the first required field that's not
 * yet filled in `profile`. Returns null when every required field is
 * filled. Mirrors the gomate-side `getNextPendingField`.
 */
export function getNextPendingField(profile: Profile): AllFieldKey | null {
  const required = new Set(getRequiredFields(profile));
  for (const field of FIELD_ORDER) {
    if (!required.has(field)) continue;
    const v = profile[field];
    if (v === null || v === undefined || v === "") return field;
  }
  return null;
}

export function isProfileComplete(profile: Profile): boolean {
  return getNextPendingField(profile) === null;
}
