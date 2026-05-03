import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// most recent plan from the last 10 min
const cutoff = new Date(Date.now() - 10*60*1000).toISOString()
const { data: plans } = await a.from('relocation_plans')
  .select('id,user_id,profile_data,interview_state,stage,locked,created_at,updated_at')
  .gte('updated_at', cutoff)
  .order('updated_at', { ascending: false })
  .limit(3)
console.log('plans updated in last 10min:', plans?.length)
for (const p of (plans||[])) {
  // check if anon user (no email)
  const { data: u } = await a.auth.admin.getUserById(p.user_id)
  const email = u?.user?.email || '(anonymous)'
  console.log('---')
  console.log('plan:', p.id, '| user:', email)
  console.log('stage:', p.stage, '| locked:', p.locked, '| created:', p.created_at?.slice(11,19))
  const pd = p.profile_data || {}
  const visible = Object.entries(pd).filter(([k]) => !k.startsWith('_'))
  console.log('FIELDS PERSISTED:', visible.length)
  for (const [k, v] of visible) console.log('  ', k.padEnd(28), '=', JSON.stringify(v))
  if (pd._field_attempts) console.log('  _field_attempts:', JSON.stringify(pd._field_attempts))
  if (pd._skipped_fields) console.log('  _skipped_fields:', JSON.stringify(pd._skipped_fields))
}
