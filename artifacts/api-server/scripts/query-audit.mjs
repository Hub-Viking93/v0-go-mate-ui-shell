import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// Find the most recent plan
const { data:plans } = await sb.from("relocation_plans")
  .select("id,user_id,created_at,profile_data")
  .order("created_at",{ascending:false}).limit(5);
console.log("recent plans:");
for (const p of plans) console.log(`  ${p.created_at}  plan=${p.id}  user=${p.user_id}  name=${p.profile_data?.name||"?"}  cit=${p.profile_data?.citizenship||"?"}`);

const target = plans[0];
console.log(`\n=== audit for plan ${target.id} ===`);
const { data } = await sb.from("agent_audit").select("agent_name,phase,field_or_output_key,value,confidence,source_user_message,retrieved_at")
  .eq("profile_id", target.id).order("retrieved_at",{ascending:true});
for (const r of data) {
  const v = JSON.stringify(r.value)?.slice(0,40);
  console.log(`[${r.retrieved_at.slice(11,19)}] ${r.agent_name.padEnd(18)} field=${(r.field_or_output_key||"").padEnd(15)} val=${v?.padEnd(42)} conf=${r.confidence||""} msg="${(r.source_user_message||"").slice(0,50)}"`);
}
