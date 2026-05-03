import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// Try to query — if 42P01 table doesn't exist
for (const t of ['guides','guide_section_citations','agent_audit','agent_run_log','pre_departure_actions','chat_messages']) {
  const { data, error, count } = await a.from(t).select('*', { count: 'exact', head: true })
  console.log(t, error ? 'ERR '+error.code+': '+error.message : 'OK rows='+(count ?? 0))
}
// inspect guides shape
const { data: guides } = await a.from('guides').select('*').limit(1)
console.log('---guide cols---')
if (guides?.[0]) console.log(Object.keys(guides[0]).join(', '))
