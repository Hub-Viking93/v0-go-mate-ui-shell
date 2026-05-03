import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// Try inserting with empty array, then with text
const { data: d1, error: e1 } = await a.from('settling_in_tasks').insert({user_id:'819053d3-0f53-49c6-a8a0-d92122cab5ae',plan_id:'15b0ad78-cbb1-4a03-88f2-f3bf28ec2508',title:'TEST_DEL',depends_on:[]}).select('id,depends_on').single()
console.log('empty array:', e1?.message?.slice(0,80) || 'OK', d1)
if (d1) await a.from('settling_in_tasks').delete().eq('id', d1.id)
const { data: d2, error: e2 } = await a.from('settling_in_tasks').insert({user_id:'819053d3-0f53-49c6-a8a0-d92122cab5ae',plan_id:'15b0ad78-cbb1-4a03-88f2-f3bf28ec2508',title:'TEST_DEL2',depends_on:['00000000-0000-0000-0000-000000000001']}).select('id,depends_on').single()
console.log('uuid array:', e2?.message?.slice(0,80) || 'OK', d2)
if (d2) await a.from('settling_in_tasks').delete().eq('id', d2.id)
