import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await a.from('agent_audit').select('*').eq('agent_name','visa_specialist').order('retrieved_at',{ascending:false}).limit(1).maybeSingle()
if (data) {
  console.log('agent_name:', data.agent_name, 'phase:', data.phase, 'field:', data.field_or_output_key)
  console.log('value full:', JSON.stringify(data.value, null, 2).slice(0, 2000))
}
