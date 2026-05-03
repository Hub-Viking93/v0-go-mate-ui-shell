// Lock the current Roselle plan, trigger research, poll status, capture result.
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD
const API = 'http://localhost:3001'

const sb = createClient(SUPABASE_URL, ANON)
const admin = createClient(SUPABASE_URL, SVC)
const { data: signin } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
const accessToken = signin.session.access_token
const userId = signin.user.id

// Find the latest plan
const { data: plans } = await admin
  .from('relocation_plans')
  .select('id,profile_data,is_current,stage,locked,research_status')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(1)
const plan = plans[0]
console.log('plan', plan.id, 'stage=', plan.stage, 'locked=', plan.locked, 'research=', plan.research_status, 'fields=', Object.keys(plan.profile_data||{}).filter(k=>!k.startsWith('_')).length)

// Lock the plan if not already
if (!plan.locked) {
  const { error: lErr } = await admin.from('relocation_plans')
    .update({ locked: true, stage: 'complete', onboarding_completed: true })
    .eq('id', plan.id)
  if (lErr) console.error('lock', lErr)
  console.log('plan locked')
}

// Trigger research
console.log('POST /api/plans/trigger-research')
const r1 = await fetch(`${API}/api/plans/trigger-research`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ planId: plan.id }),
})
console.log('  status:', r1.status, await r1.text().then(t => t.slice(0, 200)))

// Trigger visa research synchronously
console.log('POST /api/research/visa')
const r2 = await fetch(`${API}/api/research/visa`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ planId: plan.id }),
})
const visaText = await r2.text()
console.log('  status:', r2.status)
try {
  const j = JSON.parse(visaText)
  if (j.research?.visaOptions) {
    for (const v of j.research.visaOptions) {
      console.log(' →', v.eligibility, '|', v.type, '|', v.name)
      console.log('    reason:', v.eligibilityReason?.slice(0, 200))
    }
  } else {
    console.log('body:', visaText.slice(0, 600))
  }
} catch {
  console.log('body:', visaText.slice(0, 600))
}

// Read final state from DB
const { data: after } = await admin.from('relocation_plans')
  .select('visa_research,research_status,research_completed_at')
  .eq('id', plan.id).single()
console.log('\nFINAL DB:')
console.log('  research_status:', after.research_status)
console.log('  completed_at:', after.research_completed_at)
console.log('  visaOptions count:', after.visa_research?.visaOptions?.length)
