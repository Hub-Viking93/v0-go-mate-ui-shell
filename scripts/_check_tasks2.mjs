import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const cols = ['sort_order','sortOrder','order','deadline_at','deadline','priority','blocking','metadata']
for (const c of cols) {
  const { error } = await a.from('settling_in_tasks').select(c).limit(1)
  console.log(c, '→', error ? '✗' : '✓')
}
