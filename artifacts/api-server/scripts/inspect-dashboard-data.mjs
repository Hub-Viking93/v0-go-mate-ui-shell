import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
if (!process.env.PERSONA_ACCOUNT_EMAIL || !process.env.PERSONA_ACCOUNT_PASSWORD) {
  throw new Error("PERSONA_ACCOUNT_EMAIL and PERSONA_ACCOUNT_PASSWORD env vars required");
}
const { data } = await sb.auth.signInWithPassword({
  email: process.env.PERSONA_ACCOUNT_EMAIL,
  password: process.env.PERSONA_ACCOUNT_PASSWORD,
});
const tok = data.session.access_token;

// Switch to Stevenson plan first
const stevPlan = '634f0c0f-4938-4818-8fd8-8c6384317fb9';
await fetch('http://localhost:8080/api/plans', {
  method: 'PATCH',
  headers: { 'Content-Type':'application/json', Authorization:`Bearer ${tok}` },
  body: JSON.stringify({ planId: stevPlan, action: 'switch' }),
});

const profileR = await fetch('http://localhost:8080/api/profile', { headers:{ Authorization:`Bearer ${tok}` }});
const profileJ = await profileR.json();
console.log('=== /api/profile ===');
console.log(JSON.stringify(profileJ, null, 2).slice(0, 2500));

const progressR = await fetch('http://localhost:8080/api/checklist-progress', { headers:{ Authorization:`Bearer ${tok}` }});
console.log('\n=== /api/checklist-progress ===');
console.log((await progressR.text()).slice(0, 1500));

// Also try /api/progress
const progress2 = await fetch('http://localhost:8080/api/progress', { headers:{ Authorization:`Bearer ${tok}` }});
console.log('\n=== /api/progress ===');
console.log((await progress2.text()).slice(0, 1500));

// Look at __field_confidence in DB
const sbAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const { data: plan } = await sbAdmin.from('relocation_plans').select('profile_data').eq('id', stevPlan).single();
console.log('\n=== profile_data internal keys ===');
const pd = plan.profile_data;
console.log('keys:', Object.keys(pd));
console.log('__field_confidence:', JSON.stringify(pd.__field_confidence, null, 2));
console.log('_skipped_fields:', pd._skipped_fields);
