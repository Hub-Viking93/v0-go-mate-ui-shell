// E2E backend driver for Roselle + Axel — creates a fresh plan per
// persona, drives onboarding via /api/chat until isOnboardingComplete,
// triggers visa + local-requirements research, validates DB persistence.
//
// Usage:
//   PERSONA_ACCOUNT_EMAIL=... PERSONA_ACCOUNT_PASSWORD=... \
//   node artifacts/api-server/scripts/e2e-roselle-axel.mjs
//
// Writes:
//   .local/e2e-roselle-axel-report.json  (per-persona detail)
//   .local/e2e-roselle-axel-plan-ids.json {roselle, axel}  (consumed by UI verifier)

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";

const API = process.env.API_BASE ?? "http://localhost:8080";
const ACCOUNT_EMAIL = process.env.PERSONA_ACCOUNT_EMAIL;
const ACCOUNT_PASSWORD = process.env.PERSONA_ACCOUNT_PASSWORD;
if (!ACCOUNT_EMAIL || !ACCOUNT_PASSWORD) {
  throw new Error("PERSONA_ACCOUNT_EMAIL + PERSONA_ACCOUNT_PASSWORD required");
}

const sb = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY, {
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

// Wipe ALL existing plans for the test account so we start clean.
const { data: oldPlans } = await sbAdmin
  .from("relocation_plans").select("id").eq("user_id", USER_ID);
for (const p of oldPlans ?? []) {
  await sbAdmin.from("chat_messages").delete().eq("plan_id", p.id);
  await sbAdmin.from("relocation_plans").delete().eq("id", p.id);
}
console.log(`Wiped ${oldPlans?.length ?? 0} pre-existing plans`);

// ============================================================
// Personas — answers map covers every always-required + likely
// follow-up field the QuestionDirector + cascade may surface.
// ============================================================
const PERSONAS = [
  {
    slug: "roselle",
    label: "Roselle Santos — Filipino → Sweden (sambo + work, solo)",
    answers: {
      name: "Roselle Santos",
      citizenship: "Filipino",
      current_location: "Manila, Philippines",
      destination: "Sweden",
      target_city: "Stockholm",
      purpose: "settle",
      visa_role: "primary",
      duration: "permanent",
      timeline: "About 180 days from now, once the residence permit is approved",
      moving_alone: "yes, joining my Swedish sambo who already lives in Stockholm",
      savings_available: "8000 EUR",
      monthly_budget: "1500 EUR for personal spending — sharing housing costs with my partner",
      monthly_income: "No Swedish income yet — currently earning ~700 EUR/month as a nurse in Manila",
      healthcare_needs: "none, generally healthy",
      pets: "none",
      job_offer: "no job offer yet — will look for nursing work after arriving on the sambo permit",
      job_field: "healthcare / nursing",
      employer_sponsorship: "no — moving on the sambo (partner) residence permit, not a work permit",
      highly_skilled: "yes, registered nurse with 6 years hospital experience",
      posting_or_secondment: "no",
      years_experience: "6 years of professional nursing experience in hospitals in Manila",
      education_level: "bachelors",
      diploma_apostille_status: "authenticated by DFA Manila, will need Socialstyrelsen evaluation in Sweden",
      police_clearance_status: "NBI clearance from Philippines is current",
      // sambo-specific
      partner_citizenship: "Swedish",
      partner_visa_status: "citizen",
      relationship_type: "sambo (cohabiting partner)",
      relationship_duration: "3 years together, 18 months living together in Manila",
      partner_residency_duration: "lifelong (Swedish citizen)",
      settlement_reason: "family_reunion",
      family_ties: "yes, Swedish sambo in Stockholm",
      spouse_joining: "no, partner already lives there",
      children_count: "0",
    },
    expectKeyFields: ["name", "citizenship", "destination", "target_city", "purpose", "timeline"],
  },
  {
    slug: "axel",
    label: "Axel Bergström — Swedish → Philippines (SRRV + remote work, solo)",
    answers: {
      name: "Axel Bergström",
      citizenship: "Swedish",
      current_location: "Stockholm, Sweden",
      destination: "Philippines",
      target_city: "Cebu City",
      purpose: "digital_nomad",
      visa_role: "primary",
      duration: "permanent",
      timeline: "About 120 days from now",
      moving_alone: "yes, solo — no spouse, no kids, no pets",
      savings_available: "50000 EUR plus 10000 USD set aside for the SRRV time deposit",
      monthly_budget: "1800 EUR for cost of living in Cebu",
      monthly_income: "About 6000 EUR per month from my Swedish SaaS company, paid as salary, stable for 48 months",
      healthcare_needs: "none, will carry private international health insurance",
      pets: "none",
      job_offer: "no external job offer — I am self-employed running my own SaaS company",
      job_field: "tech / SaaS — software entrepreneur",
      employer_sponsorship: "no — moving on the SRRV Smile retiree-style visa, not a work permit",
      highly_skilled: "yes, qualified tech professional with 11 years experience",
      posting_or_secondment: "no",
      years_experience: "11 years of professional software/tech experience",
      education_level: "bachelors",
      diploma_apostille_status: "Bachelor diploma already apostilled by Swedish UD",
      police_clearance_status: "Belastningsregister ordered, will apostille for Philippines submission",
      // remote-work specific
      remote_income: "yes, fully remote — I run my own SaaS company registered in Sweden",
      income_source: "my own Swedish-registered SaaS company, paying myself a salary",
      income_consistency: "stable, consistent for the last 4 years",
      income_history_months: "48 months of consistent income from the SaaS business",
    },
    expectKeyFields: ["name", "citizenship", "destination", "target_city", "purpose", "timeline"],
  },
];

// ----------------- SSE chat helper -----------------
async function chatTurn(messages) {
  const r = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ messages }),
  });
  if (!r.ok) throw new Error(`/api/chat ${r.status}: ${(await r.text()).slice(0, 300)}`);
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
      } catch { /* ignore */ }
    }
  }
  return { assistantText, messageEnd };
}

const buildMessages = (history) => history.map((m) => ({
  role: m.role, content: m.text, parts: [{ type: "text", text: m.text }],
}));

async function readPlan(planId) {
  const { data } = await sbAdmin
    .from("relocation_plans")
    .select("id, stage, locked, profile_data, research_status, research_completed_at, visa_research, local_requirements_research, user_triggered_research_at")
    .eq("id", planId).maybeSingle();
  return data;
}

function validateVisa(card) {
  if (!card || typeof card !== "object") return ["missing"];
  const issues = [];
  const recs = card.recommendations ?? card.candidates ?? card.recommended_visas;
  if (!Array.isArray(recs) || recs.length < 1) issues.push("no-recommendations");
  if (typeof card.summary !== "string" || card.summary.length < 30) issues.push("thin-summary");
  return issues;
}

function validateLocalReq(card) {
  if (!card || typeof card !== "object") return ["missing"];
  const issues = [];
  const expected = ["banking", "healthcare", "tax_registration", "civil_registration", "housing"];
  for (const k of expected) {
    const c = card[k];
    if (!c || typeof c !== "object") { issues.push(`${k}:missing`); continue; }
    if (typeof c.summary !== "string" || c.summary.length < 30) issues.push(`${k}:thin-summary`);
    if (!Array.isArray(c.steps) || c.steps.length < 1) issues.push(`${k}:no-steps`);
  }
  return issues;
}

// ----------------- Per-persona runner -----------------
async function runPersona(persona) {
  console.log(`\n=== ${persona.label} ===`);
  // Create fresh plan
  const r = await fetch(`${API}/api/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) throw new Error(`POST /api/plans ${r.status}: ${await r.text()}`);
  const { plan } = await r.json();
  console.log(`Plan ${plan.id.slice(0, 8)} created`);

  // Drive intake
  const history = [{ role: "user", text: "Hi! I want to plan my relocation." }];
  const askedFields = [];
  let turn = 0, completed = false;
  const MAX_TURNS = 80;
  while (turn < MAX_TURNS) {
    turn++;
    const { assistantText, messageEnd } = await chatTurn(buildMessages(history));
    if (!messageEnd) { console.log(`turn ${turn}: NO message-end — bail`); break; }
    const md = messageEnd.metadata ?? {};
    history.push({ role: "assistant", text: assistantText });
    if (md.onboardingCompleted) {
      console.log(`turn ${turn}: ✓ ONBOARDING COMPLETE filled=${(md.filledFields ?? []).length}`);
      completed = true;
      break;
    }
    const pf = md.pendingField;
    if (!pf) { console.log(`turn ${turn}: no pendingField & not complete — bail`); break; }
    askedFields.push(pf);
    let ans = persona.answers[pf];
    if (ans === undefined) {
      console.log(`turn ${turn}: persona has no answer for "${pf}" → "no / not applicable"`);
      ans = "no, not applicable to my situation";
    }
    history.push({ role: "user", text: String(ans) });
    if (turn % 10 === 0) console.log(`  turn ${turn}: filled=${(md.filledFields ?? []).length} pending=${pf}`);
  }

  const after = await readPlan(plan.id);
  const filledKeys = Object.keys(after?.profile_data ?? {}).filter(
    (k) => !k.startsWith("_") && after.profile_data[k] != null && after.profile_data[k] !== "",
  );
  console.log(`stage=${after?.stage} locked=${after?.locked} filled=${filledKeys.length} (${filledKeys.slice(0, 12).join(",")}${filledKeys.length > 12 ? "..." : ""})`);

  if (!completed) {
    return { persona: persona.slug, planId: plan.id, pass: false, reason: "onboarding incomplete", turn, filledKeys };
  }

  // Trigger research (use /research/trigger for fire-and-forget, then poll)
  console.log(`Triggering research...`);
  const tr = await fetch(`${API}/api/plans/trigger-research`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
  });
  if (!tr.ok) console.log(`trigger-research WARN ${tr.status}: ${(await tr.text()).slice(0, 200)}`);

  // Per-card sync endpoints (await terminal)
  console.log(`POST /research/visa (sync, may take ~3min)...`);
  const visaResp = await fetch(`${API}/api/research/visa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ planId: plan.id }),
  });
  console.log(`  visa: ${visaResp.status}`);

  console.log(`POST /research/local-requirements (joins in-flight run)...`);
  const lrResp = await fetch(`${API}/api/research/local-requirements`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ planId: plan.id }),
  });
  console.log(`  local-req: ${lrResp.status}`);

  const final = await readPlan(plan.id);
  const visaIssues = validateVisa(final?.visa_research);
  const lrIssues = validateLocalReq(final?.local_requirements_research);
  console.log(`final stage=${final?.stage} research=${final?.research_status}`);
  console.log(`visa issues: ${visaIssues.length === 0 ? "NONE" : visaIssues.join(",")}`);
  console.log(`local-req issues: ${lrIssues.length === 0 ? "NONE" : lrIssues.join(",")}`);

  // Trigger pre-departure to advance to that stage so dashboard shows the
  // "Ready" state with the user-clicked guide-generation step.
  if (final?.stage === "ready_for_pre_departure") {
    const pd = await fetch(`${API}/api/plans/trigger-pre-departure`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    });
    console.log(`trigger-pre-departure: ${pd.status}`);
  }

  return {
    persona: persona.slug,
    planId: plan.id,
    pass: completed && visaResp.ok && lrResp.ok && visaIssues.length === 0 && lrIssues.length === 0,
    completed,
    turn,
    filledKeys,
    filledCount: filledKeys.length,
    finalStage: final?.stage,
    researchStatus: final?.research_status,
    visaIssues,
    lrIssues,
    visaResearchPresent: !!final?.visa_research,
    localReqResearchPresent: !!final?.local_requirements_research,
  };
}

// ----------------- Main -----------------
const planIds = {};
const results = [];
const FILTER = (process.env.PERSONA || "").toLowerCase().trim();
const personasToRun = FILTER
  ? PERSONAS.filter((p) => p.slug === FILTER)
  : PERSONAS;
if (FILTER && personasToRun.length === 0) {
  throw new Error(`PERSONA=${FILTER} matched none of: ${PERSONAS.map((p) => p.slug).join(",")}`);
}
for (const p of personasToRun) {
  try {
    const r = await runPersona(p);
    results.push(r);
    planIds[p.slug] = r.planId;
  } catch (err) {
    console.error(`${p.slug} CRASH:`, err.message);
    results.push({ persona: p.slug, pass: false, crash: err.message });
  }
}

await fs.mkdir(".local", { recursive: true });
await fs.writeFile(".local/e2e-roselle-axel-report.json", JSON.stringify(results, null, 2));
await fs.writeFile(".local/e2e-roselle-axel-plan-ids.json", JSON.stringify(planIds, null, 2));

console.log("\n========== SUMMARY ==========");
let pass = 0;
for (const r of results) {
  console.log(`${r.pass ? "✓" : "✗"} ${r.persona}: filled=${r.filledCount} stage=${r.finalStage} research=${r.researchStatus} visaOk=${r.visaIssues?.length === 0} lrOk=${r.lrIssues?.length === 0}`);
  if (r.pass) pass++;
}
console.log(`FINAL: ${pass}/${personasToRun.length} passed`);
console.log(`Plan IDs: ${JSON.stringify(planIds)}`);
process.exit(pass === personasToRun.length ? 0 : 1);
