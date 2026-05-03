import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const planId = '634f0c0f-4938-4818-8fd8-8c6384317fb9'; // Stevenson
const { data: plan } = await sb.from('relocation_plans')
  .select('*')
  .eq('id', planId)
  .single();
console.log('=== Stevenson plan full row keys ===');
console.log(Object.keys(plan).sort().join(', '));
console.log('\n=== profile_data ===');
console.log(JSON.stringify(plan.profile_data, null, 2));
console.log('\n=== other relevant fields ===');
for (const k of ['stage','locked','plan_version','is_current','confirmed_fields','profile_confirmed_at','user_confirmed_profile']) {
  if (k in plan) console.log(`  ${k}:`, JSON.stringify(plan[k]));
}
