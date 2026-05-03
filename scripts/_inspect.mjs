import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await a.from('relocation_plans').select('id,user_id,interview_state,profile_data,stage').not('interview_state','is',null).limit(2)
for (const r of data) console.log(JSON.stringify(r, null, 2))
