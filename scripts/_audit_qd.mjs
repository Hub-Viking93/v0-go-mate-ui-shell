import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const planId = 'aae402df-18ea-4e88-9998-4497f5328b75'
// Try plan_id (v2 column) first; many tables only have profile_id.
const { data, error } = await a.from('agent_audit')
  .select('agent_name,phase,field_or_output_key,value,confidence,source_user_message,retrieved_at')
  .eq('profile_id', planId)
  .order('retrieved_at', { ascending: false })
  .limit(15)
if (error) console.log('err:', error.message)
console.log('rows:', data?.length)
for (const r of (data||[])) {
  const valSnippet = JSON.stringify(r.value).slice(0,150)
  console.log(r.retrieved_at?.slice(11,19), '|', r.agent_name.padEnd(20), '|', r.phase.padEnd(12), '|', (r.field_or_output_key||'').padEnd(28), '|', valSnippet)
}
