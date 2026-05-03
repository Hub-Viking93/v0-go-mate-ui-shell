import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// PostgREST exposes columns via OPTIONS request; try select with column not exists to get error containing valid columns
const tries = ['id','title','description','created_at','foo']
for (const c of tries) {
  const { error } = await a.from('pre_departure_actions').select(c).limit(1)
  console.log(c, '→', error?.message?.slice(0,80) || 'OK')
}
