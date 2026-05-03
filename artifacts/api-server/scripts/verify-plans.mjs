import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, error } = await sb.auth.signInWithPassword({
  email: process.env.PERSONA_ACCOUNT_EMAIL, password: process.env.PERSONA_ACCOUNT_PASSWORD,
});
if (error) { console.error(error); process.exit(1); }
const tok = data.session.access_token;
const r = await fetch('http://localhost:8080/api/plans', {
  headers: { Authorization: `Bearer ${tok}` },
});
const j = await r.json();
console.log(`User has ${j.plans.length} plan(s). Tier:`, j.tier);
console.log('---');
// Fetch full profile_data for each plan via direct DB query
const sb2 = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: full } = await sb2.from('relocation_plans')
  .select('id, title, is_current, stage, profile_data, created_at')
  .eq('user_id', data.user.id)
  .order('created_at', { ascending: false })
  .limit(10);
for (const p of full) {
  const pd = p.profile_data || {};
  const filled = Object.entries(pd).filter(([k,v]) =>
    !k.startsWith('_') && v !== null && v !== undefined && v !== '' &&
    !(Array.isArray(v) && v.length === 0)
  );
  console.log(`\n[${p.is_current ? '★' : ' '}] ${p.id.slice(0,8)} stage=${p.stage} title=${p.title || '(auto)'}`);
  console.log(`    created: ${p.created_at}`);
  console.log(`    filled fields (${filled.length}):`);
  for (const [k,v] of filled) {
    const vs = typeof v === 'object' ? JSON.stringify(v) : String(v);
    console.log(`      ${k.padEnd(22)} = ${vs.slice(0,80)}`);
  }
}
