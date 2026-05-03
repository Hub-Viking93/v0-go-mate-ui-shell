/** Kick off research for Axel, Priya, Roselle in parallel using service-role bypass.
 * Calls kickoffResearch directly via the orchestrator (no HTTP, no auth).
 * Pre-clears columns + sets user_triggered_research_at, then polls DB.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

const PLANS = {
  Axel:    "43012cff-ed03-424e-9a0a-cffae893a445",
  Priya:   "9ec74a63-3942-4eb1-9cd5-c4843eab402e",
  Roselle: "fdac6264-575a-4250-9b96-04606b7981dc",
};

// Sign in to get a JWT we can pass to the API server (it ignores service role for getUser).
const sbAuth = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: signin, error: sinErr } = await sbAuth.auth.signInWithPassword({
  email: process.env.PERSONA_ACCOUNT_EMAIL,
  password: process.env.PERSONA_ACCOUNT_PASSWORD,
});
if (sinErr) { console.error("signin failed", sinErr.message); process.exit(1); }
const TOKEN = signin.session.access_token;
console.log("signed in OK");

async function kickOne(name, planId) {
  // Reset
  await sb.from("relocation_plans").update({
    research_status: null,
    research_completed_at: null,
    visa_research: null,
    local_requirements_research: null,
    user_triggered_research_at: new Date().toISOString(),
    is_current: true,
  }).eq("id", planId);

  // Other plans: not current
  await sb.from("relocation_plans").update({ is_current: false }).eq("user_id", signin.user.id).neq("id", planId);
  // But re-set current for this one (the prior may have unset)
  await sb.from("relocation_plans").update({ is_current: true }).eq("id", planId);

  // Trigger
  const r = await fetch("http://localhost:8080/api/research/trigger", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  });
  const j = await r.json().catch(() => ({}));
  console.log(`[${name}] trigger ${r.status} ${j.alreadyRunning ? "(already running)" : "(new)"} specialists=${j.dispatch?.specialists?.length || 0}`);
}

// SERIES, not parallel — to avoid is_current race
for (const [name, planId] of Object.entries(PLANS)) {
  await kickOne(name, planId);
  // Wait for THIS plan to terminate before kicking next one
  const start = Date.now();
  while (Date.now() - start < 360_000) {
    const { data } = await sb.from("relocation_plans").select("research_status, visa_research, local_requirements_research").eq("id", planId).single();
    if (["completed", "partial", "failed"].includes(data.research_status)) {
      console.log(`[${name}] ${data.research_status} | visa=${!!data.visa_research} | local=${!!data.local_requirements_research}`);
      break;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

console.log("\n=== FINAL ===");
const { data } = await sb.from("relocation_plans").select("id, research_status, visa_research, local_requirements_research").in("id", Object.values(PLANS));
const names = Object.fromEntries(Object.entries(PLANS).map(([n,id]) => [id, n]));
for (const p of data) console.log(names[p.id], p.research_status, "visa:", !!p.visa_research, "local:", !!p.local_requirements_research);
