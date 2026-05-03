import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// Try inserting a minimal row to see what columns exist
const { error } = await a.from('pre_departure_actions').insert({user_id:'00000000-0000-0000-0000-000000000000'})
console.log('insert err:', error?.message?.slice(0, 200))
// Then SELECT to see columns of any existing row
const { data, error: e2 } = await a.from('pre_departure_actions').select('*').limit(1)
console.log('select err:', e2?.message?.slice(0, 100))
console.log('data sample:', data)
