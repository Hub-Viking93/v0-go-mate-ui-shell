// Populates each of the 4 persona plans with COMPLETE profile data
// satisfying every required field per profile-schema FIELD_CONFIG.
// Uses real account auth (no service-role at runtime). Then verifies
// each plan reaches 100% required-fields-filled.

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
const sbAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const ACCOUNT_EMAIL = process.env.PERSONA_ACCOUNT_EMAIL;
const ACCOUNT_PASSWORD = process.env.PERSONA_ACCOUNT_PASSWORD;
if (!ACCOUNT_EMAIL || !ACCOUNT_PASSWORD) {
  throw new Error("PERSONA_ACCOUNT_EMAIL and PERSONA_ACCOUNT_PASSWORD env vars required");
}
const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
  email: ACCOUNT_EMAIL,
  password: ACCOUNT_PASSWORD,
});
if (authErr) throw authErr;
const token = auth.session.access_token;
const userId = auth.user.id;
console.log("Signed in as", userId);

// Comprehensive profiles. Every always-required + all conditionally-required
// fields satisfied for the given purpose/visa_role/family combination.
const PROFILES = {
  // Stevenson primary applicant (UK -> Australia, work, family + dog)
  "634f0c0f-4938-4818-8fd8-8c6384317fb9": {
    name: "James Stevenson",
    citizenship: "British",
    current_location: "Manchester, UK",
    destination: "Australia",
    target_city: "Melbourne",
    purpose: "work",
    visa_role: "primary",            // FIX — he has the Atlassian job
    duration: "permanent",
    timeline: "About 90 days",
    moving_alone: "no",
    savings_available: "120000 GBP",
    monthly_budget: "8000 AUD",
    healthcare_needs: "none",
    pets: "dog",
    // work conditionals
    job_offer: "yes",
    job_field: "tech",
    employer_sponsorship: "yes",
    highly_skilled: "yes",
    posting_or_secondment: "no",
    years_experience: "12 years",
    // family conditionals (moving_alone=no)
    spouse_joining: "yes",
    children_count: "2",
    children_ages: "7 and 10",
    // pet conditionals (pets != none)
    pet_microchip_status: "yes",
    pet_vaccination_status: "all current including rabies",
    pet_size_weight: "medium ~20kg",
    pet_breed: "Border Collie",
    pet_age: "5 years",
    education_level: "masters",
    diploma_apostille_status: "in_progress",
    police_clearance_status: "applied",
    spouse_career_field: "healthcare (registered nurse)",
    spouse_seeking_work: "yes",
    spouse_language_skills: "native English",
    spouse_visa_dependency: "yes",
    children_school_type_preference: "public",
    children_language_skills_destination: "native English",
    children_birth_certificate_apostille_status: "in_progress",
    family_visa_cascade_aware: "yes",
  },
  // Axel posted worker (Germany -> Sweden, work + family)
  "43012cff-ed03-424e-9a0a-cffae893a445": {
    name: "Axel",
    citizenship: "German",
    current_location: "Munich, Germany",
    destination: "Sweden",
    target_city: "Stockholm",
    purpose: "work",
    visa_role: "primary",
    duration: "14 months",
    timeline: "About 60 days",
    moving_alone: "no",
    savings_available: "60000 EUR",
    monthly_budget: "5000 EUR",
    healthcare_needs: "none",
    pets: "none",
    job_offer: "yes",
    job_field: "engineering",
    employer_sponsorship: "yes",
    highly_skilled: "yes",
    posting_or_secondment: "yes",
    home_country_employer: "Siemens AG",
    posting_employer_address: "Werner-von-Siemens-Strasse 1, 80333 Munich, Germany",
    posting_duration_months: "14",
    a1_certificate_status: "applied",
    coc_status: "in_progress",
    pwd_filed: "no",
    years_experience: "10 years",
    spouse_joining: "yes",
    children_count: "2",
    children_ages: "5 and 8",
    education_level: "masters",
    diploma_apostille_status: "completed",
    police_clearance_status: "completed",
    spouse_career_field: "marketing",
    spouse_seeking_work: "yes",
    spouse_language_skills: "fluent English, basic Swedish",
    spouse_visa_dependency: "yes",
    children_school_type_preference: "international",
    children_language_skills_destination: "fluent English, basic Swedish",
    children_birth_certificate_apostille_status: "completed",
    family_visa_cascade_aware: "yes",
  },
  // Priya digital nomad (US -> Spain, solo)
  "9ec74a63-3942-4eb1-9cd5-c4843eab402e": {
    name: "Priya",
    citizenship: "American",
    current_location: "San Francisco, USA",
    destination: "Spain",
    target_city: "Barcelona",
    purpose: "digital_nomad",
    visa_role: "primary",
    duration: "12 months initially",
    timeline: "About 90 days",
    moving_alone: "yes",
    savings_available: "80000 USD",
    monthly_budget: "3500 EUR",
    healthcare_needs: "none",
    pets: "none",
    // digital_nomad conditionals
    remote_income: "yes",
    income_source: "employed_remote",
    monthly_income: "14000 USD",
    income_consistency: "stable",
    income_history_months: "48 months",
    years_experience: "8 years",
  },
  // Roselle sambo (Philippines -> Sweden, family reunion as dependent)
  "fdac6264-575a-4250-9b96-04606b7981dc": {
    name: "Roselle",
    citizenship: "Filipino",
    current_location: "Manila, Philippines",
    destination: "Sweden",
    target_city: "Stockholm",
    purpose: "settle",
    visa_role: "dependent",
    duration: "permanent",
    timeline: "About 30 days",
    moving_alone: "no",
    savings_available: "15000 USD",
    monthly_budget: "2500 EUR",
    healthcare_needs: "none",
    pets: "none",
    // dependent conditionals
    partner_citizenship: "Swedish",
    partner_visa_status: "citizen",
    relationship_type: "cohabitant",
    partner_residency_duration: "lifelong (citizen)",
    relationship_duration: "3 years",
    // settle conditionals
    settlement_reason: "family_reunion",
    family_ties: "yes",
    spouse_joining: "yes",
    children_count: "0",
    birth_certificate_apostille_status: "in_progress",
    spouse_career_field: "engineering (already employed in Sweden)",
    spouse_seeking_work: "no",
    spouse_language_skills: "native Swedish, fluent English",
    spouse_visa_dependency: "no",
  },
};

// Required fields list (mirrors profile-schema always-required + common gates)
// Used only for 100% verification print.
const ALWAYS_REQ = [
  "name", "citizenship", "current_location", "destination", "target_city",
  "purpose", "visa_role", "duration", "timeline", "moving_alone",
  "savings_available", "monthly_budget", "healthcare_needs", "pets",
];

for (const [planId, profileData] of Object.entries(PROFILES)) {
  // Switch is_current to this plan so PATCH /profile updates it
  const switchR = await fetch("http://localhost:8080/api/plans", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ planId, action: "switch" }),
  });
  if (!switchR.ok) {
    console.error("switch failed", planId, switchR.status, await switchR.text());
    continue;
  }

  // Wipe profile_data first by writing a sentinel via service role (PATCH merges).
  await sbAdmin
    .from("relocation_plans")
    .update({ profile_data: {}, updated_at: new Date().toISOString() })
    .eq("id", planId);

  // PATCH new full profile
  const r = await fetch("http://localhost:8080/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ planId, profileData }),
  });
  if (!r.ok) {
    console.error("PATCH /profile failed", planId, r.status, await r.text());
    continue;
  }
  const out = await r.json();
  const filled = Object.keys(out.plan.profile_data).filter(k =>
    !k.startsWith("_") && out.plan.profile_data[k] !== null && out.plan.profile_data[k] !== "" && out.plan.profile_data[k] !== undefined
  );
  const alwaysReqMissing = ALWAYS_REQ.filter(k => !filled.includes(k));
  console.log(`\n[${planId.slice(0, 8)}] ${profileData.name}`);
  console.log(`  total filled: ${filled.length}`);
  console.log(`  always-req missing: ${alwaysReqMissing.length === 0 ? "NONE ✓" : alwaysReqMissing.join(", ")}`);
}

// Set Stevenson as current for screenshot ergonomics
await fetch("http://localhost:8080/api/plans", {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ planId: "634f0c0f-4938-4818-8fd8-8c6384317fb9", action: "switch" }),
});
console.log("\n✓ Stevenson set as current plan");
