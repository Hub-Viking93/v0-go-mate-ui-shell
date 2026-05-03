// E2E persona harness — drives full GoMate flow as a real user:
// 1. POST /api/plans (new plan, is_current=true)
// 2. Loop POST /api/chat, parsing SSE for metadata.pendingField/onboardingCompleted,
//    answering whatever field the system asks for from the persona's answers map.
// 3. POST /api/research/visa + /api/research/local-requirements (sync per-card endpoints).
// 4. Verify DB: profile_data complete, visa_research + local_requirements_research populated.
//
// Usage:
//   PERSONA_ACCOUNT_EMAIL=... PERSONA_ACCOUNT_PASSWORD=... \
//   node artifacts/api-server/scripts/e2e-personas-round1.mjs

import { createClient } from "@supabase/supabase-js";

const API = process.env.API_BASE ?? "http://localhost:8080";
const ACCOUNT_EMAIL = process.env.PERSONA_ACCOUNT_EMAIL;
const ACCOUNT_PASSWORD = process.env.PERSONA_ACCOUNT_PASSWORD;
const ONBOARDING_ONLY = process.env.ONBOARDING_ONLY === "1" || process.env.ONBOARDING_ONLY === "true";
if (!ACCOUNT_EMAIL || !ACCOUNT_PASSWORD) {
  throw new Error("PERSONA_ACCOUNT_EMAIL + PERSONA_ACCOUNT_PASSWORD required");
}

const sb = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const sbAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
  email: ACCOUNT_EMAIL,
  password: ACCOUNT_PASSWORD,
});
if (authErr) throw authErr;
const TOKEN = auth.session.access_token;
const USER_ID = auth.user.id;
console.log(`Signed in as ${USER_ID}`);

// ============================================================
// 10 diverse personas — different origins, destinations, purposes,
// durations, family/pet/healthcare situations.
// Each entry: { label, answers: { fieldKey: freeTextAnswer } }
// answers must cover at minimum every always-required field +
// every field the conditional cascade will surface for this persona.
// ============================================================
const PERSONAS = [
  {
    label: "Sofia — Brazilian dev → Portugal (work primary, solo, dog)",
    answers: {
      name: "Sofia Almeida",
      citizenship: "Brazilian",
      current_location: "São Paulo, Brazil",
      destination: "Portugal",
      target_city: "Lisbon",
      purpose: "work",
      visa_role: "primary",
      duration: "permanent",
      timeline: "About 90 days from now",
      moving_alone: "yes, solo",
      savings_available: "45000 EUR",
      monthly_budget: "2500 EUR",
      healthcare_needs: "none",
      pets: "dog",
      job_offer: "yes",
      job_field: "tech",
      employer_sponsorship: "yes",
      highly_skilled: "yes",
      posting_or_secondment: "no",
      years_experience: "9 years",
      education_level: "bachelors",
      diploma_apostille_status: "in_progress",
      police_clearance_status: "not_started",
      pet_microchip_status: "yes",
      pet_vaccination_status: "rabies + boosters current",
      pet_size_weight: "medium ~18kg",
      pet_breed: "mixed Labrador",
      pet_age: "4 years",
    },
  },
  {
    label: "Hiroshi — Japanese student → Germany (study, solo)",
    answers: {
      name: "Hiroshi Tanaka",
      citizenship: "Japanese",
      current_location: "Tokyo, Japan",
      destination: "Germany",
      target_city: "Munich",
      purpose: "study",
      visa_role: "primary",
      duration: "3 years",
      timeline: "About 120 days",
      moving_alone: "yes",
      savings_available: "20000 EUR",
      monthly_budget: "1200 EUR",
      healthcare_needs: "none",
      pets: "none",
      study_type: "university",
      study_field: "mechanical engineering",
      study_funding: "self-funded",
      education_level: "bachelors",
      years_experience: "0",
      diploma_apostille_status: "completed",
      police_clearance_status: "not_started",
    },
  },
  {
    label: "Aisha — Nigerian nurse → Canada (work primary, family + 1 child)",
    answers: {
      name: "Aisha Okafor",
      citizenship: "Nigerian",
      current_location: "Lagos, Nigeria",
      destination: "Canada",
      target_city: "Toronto",
      purpose: "work",
      visa_role: "primary",
      duration: "permanent",
      timeline: "About 180 days",
      moving_alone: "no",
      savings_available: "30000 CAD",
      monthly_budget: "4500 CAD",
      healthcare_needs: "none",
      pets: "none",
      job_offer: "yes",
      job_field: "healthcare",
      employer_sponsorship: "yes",
      highly_skilled: "yes",
      posting_or_secondment: "no",
      years_experience: "7 years",
      education_level: "bachelors",
      diploma_apostille_status: "completed",
      police_clearance_status: "completed",
      spouse_joining: "yes",
      children_count: "1",
      children_ages: "6",
      spouse_career_field: "teaching",
      spouse_seeking_work: "yes",
      spouse_language_skills: "fluent English",
      spouse_visa_dependency: "yes",
      children_school_type_preference: "public",
      children_language_skills_destination: "fluent English",
      children_birth_certificate_apostille_status: "in_progress",
      family_visa_cascade_aware: "yes",
    },
  },
  {
    label: "Liam — Irish (EU) engineer → Netherlands (work, no visa needed)",
    answers: {
      name: "Liam O'Sullivan",
      citizenship: "Irish",
      current_location: "Dublin, Ireland",
      destination: "Netherlands",
      target_city: "Amsterdam",
      purpose: "work",
      visa_role: "primary",
      duration: "5 years",
      timeline: "About 45 days",
      moving_alone: "yes",
      savings_available: "35000 EUR",
      monthly_budget: "3000 EUR",
      healthcare_needs: "none",
      pets: "cat",
      job_offer: "yes",
      job_field: "engineering",
      employer_sponsorship: "no, EU citizen so no sponsorship needed",
      highly_skilled: "yes",
      posting_or_secondment: "no",
      years_experience: "11 years",
      education_level: "masters",
      pet_microchip_status: "yes",
      pet_vaccination_status: "all current including rabies",
      pet_size_weight: "small ~5kg",
      pet_breed: "British Shorthair",
      pet_age: "3 years",
    },
  },
  {
    label: "Maria — Mexican → Australia (working holiday, solo)",
    answers: {
      name: "Maria Hernández",
      citizenship: "Mexican",
      current_location: "Guadalajara, Mexico",
      destination: "Australia",
      target_city: "Sydney",
      purpose: "work",
      visa_role: "primary",
      duration: "12 months",
      timeline: "About 60 days",
      moving_alone: "yes",
      savings_available: "8000 AUD",
      monthly_budget: "2200 AUD",
      healthcare_needs: "none",
      pets: "none",
      job_offer: "no",
      job_field: "hospitality",
      employer_sponsorship: "no",
      highly_skilled: "no",
      posting_or_secondment: "no",
      years_experience: "4 years",
      education_level: "bachelors",
      birth_year: "1998",
    },
  },
  {
    label: "Chen — Chinese PhD → UK (study, scholarship, solo)",
    answers: {
      name: "Chen Wei",
      citizenship: "Chinese",
      current_location: "Shanghai, China",
      destination: "United Kingdom",
      target_city: "Cambridge",
      purpose: "study",
      visa_role: "primary",
      duration: "4 years",
      timeline: "About 150 days",
      moving_alone: "yes",
      savings_available: "10000 GBP",
      monthly_budget: "1500 GBP",
      healthcare_needs: "chronic_condition",
      pets: "none",
      study_type: "university",
      study_field: "computational biology",
      study_funding: "scholarship",
      education_level: "masters",
      years_experience: "2 years",
      diploma_apostille_status: "completed",
      police_clearance_status: "completed",
      chronic_condition_description: "well-managed asthma",
      prescription_medications: "salbutamol inhaler",
      english_speaking_doctor_required: "yes",
      prescription_medications_list: "Ventolin (salbutamol) 100mcg",
      pre_existing_condition_disclosure_concern: "no",
    },
  },
  {
    label: "Olga — Russian designer → Cyprus (digital nomad, solo)",
    answers: {
      name: "Olga Petrova",
      citizenship: "Russian",
      current_location: "Belgrade, Serbia",
      destination: "Cyprus",
      target_city: "Limassol",
      purpose: "digital_nomad",
      visa_role: "primary",
      duration: "12 months initially",
      timeline: "About 60 days",
      moving_alone: "yes",
      savings_available: "25000 EUR",
      monthly_budget: "2800 EUR",
      healthcare_needs: "none",
      pets: "cat",
      remote_income: "yes",
      income_source: "freelance",
      monthly_income: "5500 EUR",
      income_consistency: "stable",
      income_history_months: "30 months",
      years_experience: "8 years",
      education_level: "bachelors",
      pet_microchip_status: "yes",
      pet_vaccination_status: "all current including rabies",
      pet_size_weight: "small ~4kg",
      pet_breed: "domestic shorthair",
      pet_age: "6 years",
    },
  },
  {
    label: "Tom — American retiree → Thailand (settle/retirement, with spouse)",
    answers: {
      name: "Tom Mitchell",
      citizenship: "American",
      current_location: "Phoenix, USA",
      destination: "Thailand",
      target_city: "Chiang Mai",
      purpose: "settle",
      visa_role: "primary",
      duration: "permanent",
      timeline: "About 120 days",
      moving_alone: "no",
      savings_available: "350000 USD",
      monthly_budget: "2500 USD",
      healthcare_needs: "chronic_condition",
      pets: "none",
      settlement_reason: "retirement",
      family_ties: "no",
      spouse_joining: "yes",
      children_count: "0",
      birth_year: "1958",
      education_level: "bachelors",
      years_experience: "35 years (now retired)",
      chronic_condition_description: "type 2 diabetes, controlled hypertension",
      prescription_medications: "metformin, lisinopril",
      english_speaking_doctor_required: "yes",
      prescription_medications_list: "Metformin 1000mg, Lisinopril 10mg",
      pre_existing_condition_disclosure_concern: "yes",
      spouse_career_field: "retired (former librarian)",
      spouse_seeking_work: "no",
      spouse_language_skills: "English only",
      spouse_visa_dependency: "yes",
    },
  },
  {
    label: "Fatima — Moroccan → France (family reunion, dependent)",
    answers: {
      name: "Fatima El-Amrani",
      citizenship: "Moroccan",
      current_location: "Casablanca, Morocco",
      destination: "France",
      target_city: "Lyon",
      purpose: "settle",
      visa_role: "dependent",
      duration: "permanent",
      timeline: "About 90 days",
      moving_alone: "no",
      savings_available: "12000 EUR",
      monthly_budget: "2200 EUR",
      healthcare_needs: "none",
      pets: "none",
      partner_citizenship: "French",
      partner_visa_status: "citizen",
      relationship_type: "spouse",
      partner_residency_duration: "lifelong (citizen, born in France)",
      relationship_duration: "5 years",
      settlement_reason: "family_reunion",
      family_ties: "yes",
      spouse_joining: "yes",
      children_count: "1",
      children_ages: "3",
      education_level: "bachelors",
      marriage_certificate_apostille_status: "completed",
      birth_certificate_apostille_status: "completed",
      children_school_type_preference: "public",
      children_language_skills_destination: "basic French at home",
      children_birth_certificate_apostille_status: "completed",
      spouse_career_field: "software engineering (already employed in France)",
      spouse_seeking_work: "no",
      spouse_language_skills: "native French, fluent English",
      spouse_visa_dependency: "no",
    },
  },
  {
    label: "Erik — Swedish engineer → USA (work primary, H-1B, family)",
    answers: {
      name: "Erik Lindström",
      citizenship: "Swedish",
      current_location: "Gothenburg, Sweden",
      destination: "United States",
      target_city: "Seattle",
      purpose: "work",
      visa_role: "primary",
      duration: "3 years initially (H-1B)",
      timeline: "About 150 days",
      moving_alone: "no",
      savings_available: "75000 USD",
      monthly_budget: "7500 USD",
      healthcare_needs: "none",
      pets: "none",
      job_offer: "yes",
      job_field: "tech",
      employer_sponsorship: "yes",
      highly_skilled: "yes",
      posting_or_secondment: "no",
      years_experience: "13 years",
      education_level: "masters",
      diploma_apostille_status: "completed",
      police_clearance_status: "not_required",
      spouse_joining: "yes",
      children_count: "2",
      children_ages: "4 and 8",
      spouse_career_field: "marketing",
      spouse_seeking_work: "yes (will need EAD on H-4)",
      spouse_language_skills: "fluent English",
      spouse_visa_dependency: "yes",
      children_school_type_preference: "public",
      children_language_skills_destination: "fluent English",
      children_birth_certificate_apostille_status: "completed",
      family_visa_cascade_aware: "yes",
    },
  },
];

// ============================================================
// SSE parser — extracts the final message-end metadata block
// ============================================================
async function chatTurn(messages) {
  const r = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ messages }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`/api/chat ${r.status}: ${t.slice(0, 300)}`);
  }
  // Stream chunks; assemble message-end JSON.
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let assistantText = "";
  let messageEnd = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = frame.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const obj = JSON.parse(payload);
        if (obj.type === "text-delta" && typeof obj.delta === "string") assistantText += obj.delta;
        if (obj.type === "message-end") messageEnd = obj;
      } catch {
        /* ignore */
      }
    }
  }
  return { assistantText, messageEnd };
}

function buildMessages(history) {
  // history: [{ role, text }]
  return history.map((m) => ({
    role: m.role,
    content: m.text,
    parts: [{ type: "text", text: m.text }],
  }));
}

async function readPlan(planId) {
  const { data } = await sbAdmin
    .from("relocation_plans")
    .select(
      "id, stage, locked, profile_data, research_status, research_completed_at, visa_research, local_requirements_research, user_triggered_research_at",
    )
    .eq("id", planId)
    .maybeSingle();
  return data;
}

function validateLocalReq(card) {
  if (!card || typeof card !== "object") return ["missing"];
  const issues = [];
  const expected = ["banking", "healthcare", "tax_registration", "civil_registration", "housing"];
  for (const k of expected) {
    const c = card[k];
    if (!c || typeof c !== "object") {
      issues.push(`${k}:missing`);
      continue;
    }
    if (typeof c.summary !== "string" || c.summary.length < 30) issues.push(`${k}:thin-summary`);
    if (!Array.isArray(c.steps) || c.steps.length < 1) issues.push(`${k}:no-steps`);
  }
  return issues;
}

function validateVisa(card) {
  if (!card || typeof card !== "object") return ["missing"];
  const issues = [];
  const recs = card.recommendations ?? card.candidates ?? card.recommended_visas;
  if (!Array.isArray(recs) || recs.length < 1) issues.push("no-recommendations");
  if (typeof card.summary !== "string" || card.summary.length < 30) issues.push("thin-summary");
  return issues;
}

// ============================================================
// Per-persona runner
// ============================================================
async function runPersona(persona, idx) {
  const log = (msg) => console.log(`  [${idx + 1}/${PERSONAS.length}] ${msg}`);
  console.log(`\n=== Persona ${idx + 1}: ${persona.label} ===`);

  // 1. Create fresh plan
  const planResp = await fetch(`${API}/api/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  });
  if (!planResp.ok) throw new Error(`POST /api/plans ${planResp.status}: ${await planResp.text()}`);
  const { plan } = await planResp.json();
  log(`Created plan ${plan.id.slice(0, 8)}`);

  // 2. Drive intake — first message kicks off the conversation
  const history = [{ role: "user", text: "Hi! I want to plan my relocation." }];
  const askedFields = [];
  const filledTrace = [];
  let turn = 0;
  const MAX_TURNS = 70;
  let completed = false;
  let questionsLog = []; // capture every assistant question
  while (turn < MAX_TURNS) {
    turn++;
    const { assistantText, messageEnd } = await chatTurn(buildMessages(history));
    if (!messageEnd) {
      log(`turn ${turn}: NO message-end metadata — bailing`);
      break;
    }
    const md = messageEnd.metadata ?? {};
    questionsLog.push({ turn, q: assistantText.slice(0, 200), pendingField: md.pendingField, filled: (md.filledFields ?? []).length });
    history.push({ role: "assistant", text: assistantText });
    if (md.onboardingCompleted) {
      log(`turn ${turn}: ONBOARDING COMPLETE (filled=${(md.filledFields ?? []).length})`);
      completed = true;
      break;
    }
    const pf = md.pendingField;
    if (!pf) {
      log(`turn ${turn}: no pendingField but not complete — anomaly`);
      break;
    }
    askedFields.push(pf);
    let ans = persona.answers[pf];
    if (ans === undefined) {
      // Field not in persona dict — try a sensible default + record gap
      ans = "skip";
      log(`turn ${turn}: persona has no answer for "${pf}" → skipping`);
    }
    history.push({ role: "user", text: String(ans) });
    filledTrace.push({ pf, ans: String(ans).slice(0, 50), filledCount: (md.filledFields ?? []).length });
  }

  // 3. Read DB state
  const after = await readPlan(plan.id);
  const filledCount = Object.keys(after?.profile_data ?? {}).filter(
    (k) => !k.startsWith("_") && after.profile_data[k] != null && after.profile_data[k] !== "",
  ).length;
  log(`stage=${after?.stage} locked=${after?.locked} filled=${filledCount} turns=${turn} complete=${completed}`);

  // Compute coverage: how many of the persona's intended answers
  // actually landed in profile_data (i.e. extractor did its job).
  const intendedKeys = Object.keys(persona.answers);
  const extractedFromIntended = intendedKeys.filter(
    (k) => after?.profile_data?.[k] != null && after?.profile_data?.[k] !== "",
  );
  const missingFromIntended = intendedKeys.filter(
    (k) => !(after?.profile_data?.[k] != null && after?.profile_data?.[k] !== ""),
  );
  log(
    `coverage: ${extractedFromIntended.length}/${intendedKeys.length} intended fields extracted; missing: ${missingFromIntended.slice(0, 8).join(",")}${missingFromIntended.length > 8 ? "..." : ""}`,
  );

  if (!completed) {
    return {
      persona: persona.label,
      planId: plan.id,
      pass: false,
      reason: `did not complete onboarding (turns=${turn}, filled=${filledCount})`,
      askedFields,
      questionsLog,
      profile: after?.profile_data,
      missingFromIntended,
    };
  }

  // 4. Trigger research (sync per-card) — skipped in ONBOARDING_ONLY mode
  let visaOk = true, lrOk = true, visaIssues = [], lrIssues = [];
  if (!ONBOARDING_ONLY) {
    log("triggering visa research...");
    const visaResp = await fetch(`${API}/api/research/visa`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ planId: plan.id }),
    });
    visaOk = visaResp.ok;
    const visaBody = await visaResp.text();
    if (!visaOk) log(`visa research FAILED ${visaResp.status}: ${visaBody.slice(0, 200)}`);

    log("triggering local-requirements research...");
    const lrResp = await fetch(`${API}/api/research/local-requirements`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ planId: plan.id }),
    });
    lrOk = lrResp.ok;
    const lrBody = await lrResp.text();
    if (!lrOk) log(`local-req research FAILED ${lrResp.status}: ${lrBody.slice(0, 200)}`);

    const final = await readPlan(plan.id);
    visaIssues = validateVisa(final?.visa_research);
    lrIssues = validateLocalReq(final?.local_requirements_research);
    log(`visa issues: ${visaIssues.length === 0 ? "NONE" : visaIssues.join(",")}`);
    log(`local-req issues: ${lrIssues.length === 0 ? "NONE" : lrIssues.join(",")}`);
  } else {
    log("ONBOARDING_ONLY=1 — skipping research stage");
  }

  const pass = completed && visaOk && lrOk && visaIssues.length === 0 && lrIssues.length === 0;
  return {
    persona: persona.label,
    planId: plan.id,
    pass,
    completed,
    turns: turn,
    filledCount,
    visaOk,
    lrOk,
    visaIssues,
    lrIssues,
    askedFields,
    questionsLog,
  };
}

// ============================================================
// Main
// ============================================================
const results = [];
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",").map((n) => parseInt(n.trim(), 10))) : null;
for (let i = 0; i < PERSONAS.length; i++) {
  if (ONLY && !ONLY.has(i)) continue;
  try {
    const r = await runPersona(PERSONAS[i], i);
    results.push(r);
  } catch (err) {
    console.error(`PERSONA ${i + 1} CRASHED:`, err.message);
    results.push({ persona: PERSONAS[i].label, pass: false, crash: err.message });
  }
}

console.log("\n\n========== SUMMARY ==========");
let pass = 0;
for (const r of results) {
  const icon = r.pass ? "✓" : "✗";
  console.log(`${icon} ${r.persona}`);
  if (!r.pass) {
    if (r.crash) console.log(`    CRASH: ${r.crash}`);
    if (r.reason) console.log(`    reason: ${r.reason}`);
    if (r.visaIssues?.length) console.log(`    visa: ${r.visaIssues.join(",")}`);
    if (r.lrIssues?.length) console.log(`    local-req: ${r.lrIssues.join(",")}`);
    if (r.completed === false) console.log(`    onboarding incomplete: turns=${r.turns} filled=${r.filledCount}`);
  }
  if (r.pass) pass++;
}
console.log(`\nFINAL: ${pass}/${PERSONAS.length} passed`);

// Write detailed report for debugging failures
const fs = await import("node:fs/promises");
await fs.writeFile(
  ".local/e2e-personas-round1-report.json",
  JSON.stringify(results, null, 2),
);
console.log("Detailed report → .local/e2e-personas-round1-report.json");

process.exit(pass === PERSONAS.length ? 0 : 1);
