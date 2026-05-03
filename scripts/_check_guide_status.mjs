import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await a.from('guides').select('status').limit(20)
const counts = {}
for (const r of data) counts[r.status] = (counts[r.status]||0)+1
console.log('existing status values:', counts)
