import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await a.from('agent_audit').select('*').limit(1)
if (data?.[0]) console.log('cols:', Object.keys(data[0]).join(', '))
const { data: rows } = await a.from('agent_audit').select('agent_name,phase,field_or_output_key,value').eq('plan_id','3602784f-28dd-44a6-839e-a5a910b3a66e').like('agent_name','%specialist%').limit(5)
console.log('---specialist rows---')
for (const r of (rows||[])) {
  console.log(r.agent_name, r.phase, r.field_or_output_key)
  console.log('  value snippet:', JSON.stringify(r.value).slice(0, 300))
}
