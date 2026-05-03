import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data } = await sb.auth.signInWithPassword({
  email: process.env.PERSONA_ACCOUNT_EMAIL, password: process.env.PERSONA_ACCOUNT_PASSWORD,
});
const tok = data.session.access_token;
const dupes = ['54168811-7c52-46b2-8a44-3d8d5c4d5ba6', '9685e967', '0436dd56'];
// We need full UUIDs. Look them up:
const sb2 = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: full } = await sb2.from('relocation_plans')
  .select('id, profile_data, stage, created_at')
  .eq('user_id', data.user.id)
  .gte('created_at', '2026-05-03T00:38:00')
  .order('created_at');
const toDelete = [
  full.find(p => p.id.startsWith('54168811')),
  full.find(p => p.id.startsWith('9685e967')),
  full.find(p => p.id.startsWith('0436dd56')),
].filter(Boolean);
for (const p of toDelete) {
  const r = await fetch(`http://localhost:8080/api/plans?planId=${p.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tok}` },
  });
  console.log(`DELETE ${p.id.slice(0,8)} (${p.profile_data?.name}, stage=${p.stage}) → ${r.status}`);
}
