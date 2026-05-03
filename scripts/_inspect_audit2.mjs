import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await a.from('agent_audit').select('agent_name,phase,field_or_output_key').order('retrieved_at',{ascending:false}).limit(30)
const counts = {}
for (const r of data) counts[r.agent_name] = (counts[r.agent_name]||0)+1
console.log('recent agent_audit rows by agent (last 30):')
console.log(counts)
const { data: spec } = await a.from('agent_audit').select('*').like('agent_name','%specialist%').or('agent_name.like.%adapter%,agent_name.like.%navigator%,agent_name.like.%helper%').limit(3)
console.log('---specialist sample---')
for (const r of (spec||[])) {
  console.log(r.agent_name, '| profile_id:', r.profile_id)
  console.log('  value:', JSON.stringify(r.value).slice(0, 600))
}
