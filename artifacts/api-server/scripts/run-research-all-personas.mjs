/**
 * Trigger research pipeline for all 4 persona plans, in series (so they
 * don't fight for Anthropic/Firecrawl rate limits), and verify the
 * persisted columns. Requires PERSONA_ACCOUNT_EMAIL + PERSONA_ACCOUNT_PASSWORD.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.env.PERSONA_ACCOUNT_EMAIL;
const PASSWORD = process.env.PERSONA_ACCOUNT_PASSWORD;
const API_BASE = process.env.API_BASE || "http://localhost:8080";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !EMAIL || !PASSWORD) {
  console.error("Missing env: SUPABASE_URL, SUPABASE_ANON_KEY, PERSONA_ACCOUNT_EMAIL, PERSONA_ACCOUNT_PASSWORD");
  process.exit(1);
}

const PLANS = {
  Stevenson: "634f0c0f-4938-4818-8fd8-8c6384317fb9",
  Axel:      "43012cff-ed03-424e-9a0a-cffae893a445",
  Priya:     "9ec74a63-3942-4eb1-9cd5-c4843eab402e",
  Roselle:   "fdac6264-575a-4250-9b96-04606b7981dc",
};

const sbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const sbAdmin = SUPABASE_SERVICE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } }) : null;

const { data: signin, error: signinErr } = await sbAuth.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (signinErr) { console.error("Sign-in failed:", signinErr.message); process.exit(1); }
const TOKEN = signin.session.access_token;
const USER_ID = signin.user.id;
console.log(`Signed in as ${EMAIL} (user_id=${USER_ID.slice(0,8)})`);

async function setCurrent(planId) {
  if (!sbAdmin) {
    console.error("SUPABASE_SERVICE_ROLE_KEY required to flip is_current");
    process.exit(1);
  }
  await sbAdmin.from("relocation_plans").update({ is_current: false }).eq("user_id", USER_ID);
  await sbAdmin.from("relocation_plans").update({ is_current: true }).eq("id", planId);
}

async function api(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  return res;
}

async function runOne(name, planId) {
  console.log(`\n=== ${name} (${planId.slice(0,8)}) ===`);
  await setCurrent(planId);
  // Reset prior research so we can verify fresh writes
  await sbAdmin.from("relocation_plans").update({
    research_status: null,
    research_completed_at: null,
    visa_research: null,
    local_requirements_research: null,
  }).eq("id", planId);

  // 1. Set trigger timestamp
  const trigRes = await api("/api/plans/trigger-research", { method: "POST" });
  if (!trigRes.ok) {
    const txt = await trigRes.text();
    console.error(`  trigger-research failed: ${trigRes.status} ${txt}`);
    return { ok: false };
  }
  console.log("  ✓ trigger-research timestamp set");

  // 2. Kickoff
  const kickRes = await api("/api/research/trigger", { method: "POST" });
  if (!kickRes.ok && kickRes.status !== 202) {
    const txt = await kickRes.text();
    console.error(`  kickoff failed: ${kickRes.status} ${txt}`);
    return { ok: false };
  }
  const kickJson = await kickRes.json();
  console.log(`  ✓ kickoff (${kickJson.dispatch?.specialists?.length ?? 0} specialists)`);

  // 3. Poll DB for completion (research_status terminal)
  const start = Date.now();
  let lastStatus = null;
  while (Date.now() - start < 240_000) {
    const { data } = await sbAdmin
      .from("relocation_plans")
      .select("research_status, visa_research, local_requirements_research")
      .eq("id", planId)
      .single();
    if (data.research_status !== lastStatus) {
      console.log(`  status: ${data.research_status} (${Math.round((Date.now()-start)/1000)}s)`);
      lastStatus = data.research_status;
    }
    if (data.research_status === "completed" || data.research_status === "partial" || data.research_status === "failed") {
      const vr = data.visa_research;
      const lr = data.local_requirements_research;
      console.log(`  visa_research: ${vr ? `✓ ${vr.visaOptions?.[0]?.name || "?"} (${vr.visaOptions?.length || 0} options)` : "✗ NULL"}`);
      console.log(`  local_requirements: ${lr ? `✓ ${lr.categories?.length || 0} categories, ${lr.categories?.reduce((a,c)=>a+(c.items?.length||0),0)} items` : "✗ NULL"}`);
      return { ok: data.research_status !== "failed", visa: !!vr, local: !!lr };
    }
    await new Promise(r => setTimeout(r, 3000));
  }
  console.error("  TIMEOUT waiting for completion");
  return { ok: false };
}

const results = {};
for (const [name, planId] of Object.entries(PLANS)) {
  results[name] = await runOne(name, planId);
}

console.log("\n=== SUMMARY ===");
for (const [name, r] of Object.entries(results)) {
  console.log(`  ${name}: ${r.ok ? "OK" : "FAIL"}  visa=${r.visa ? "✓":"✗"}  local=${r.local ? "✓":"✗"}`);
}
const allOk = Object.values(results).every(r => r.ok && r.visa && r.local);
process.exit(allOk ? 0 : 1);
