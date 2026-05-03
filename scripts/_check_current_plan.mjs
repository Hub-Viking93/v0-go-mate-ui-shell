import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await a.from('relocation_plans').select('id,profile_data,is_current,stage,locked,research_status').eq('user_id','819053d3-0f53-49c6-a8a0-d92122cab5ae').order('created_at',{ascending:false}).limit(3)
for (const p of data) console.log(p.id, '| is_current=', p.is_current, 'stage=', p.stage, 'locked=', p.locked, 'research=', p.research_status, 'fields=', Object.keys(p.profile_data||{}).filter(k=>!k.startsWith('_')).length)
