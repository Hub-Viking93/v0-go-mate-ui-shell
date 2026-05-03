// Reproduce onboarding extraction bugs.
// Strategy: sign in, create a fresh plan, send messages turn by turn,
// inspect what got persisted, log every gap.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://lrdxpxkjouqjujatupkx.supabase.co'
const ANON = process.env.SUPABASE_ANON_KEY
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD
const API = 'http://localhost:3001' // direct to api-server

if (!ANON || !SVC || !EMAIL || !PASSWORD) {
  console.error('Missing env vars'); process.exit(1)
}

const sb = createClient(SUPABASE_URL, ANON)
const admin = createClient(SUPABASE_URL, SVC)

const { data: signin, error: sErr } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (sErr) { console.error('signin', sErr); process.exit(1) }
const userId = signin.user.id
const accessToken = signin.session.access_token
console.log('signed in as', signin.user.email, 'userId=', userId)

// Wipe any existing plan and create a fresh empty one as "current".
// This guarantees we exercise the cold-start onboarding path.
const { error: delErr } = await admin
  .from('relocation_plans')
  .delete()
  .eq('user_id', userId)
if (delErr) console.warn('delete failed:', delErr)

const { data: plan, error: pErr } = await admin
  .from('relocation_plans')
  .insert({
    user_id: userId,
    profile_data: {},
    interview_state: 'interview',
    chat_history: [],
    stage: 'collecting',
    is_current: true,
    title: 'Smoke test plan',
  })
  .select()
  .single()
if (pErr) { console.error('insert plan', pErr); process.exit(1) }
console.log('created plan', plan.id, 'stage=', plan.stage)

// Send one chat turn
async function chat(userText, profile = {}, pendingField = null) {
  const messages = [{ role: 'user', content: userText }]
  const body = { messages, profile, pendingField }
  const res = await fetch(`${API}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  // Parse SSE — grab everything after "data: "
  const events = []
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (payload === '[DONE]') continue
    try { events.push(JSON.parse(payload)) } catch {}
  }
  return { status: res.status, events, raw: text.slice(0, 500) }
}

async function readProfile() {
  const { data } = await admin.from('relocation_plans')
    .select('profile_data,chat_history')
    .eq('id', plan.id)
    .single()
  return data
}

const persona = [
  // The bundled-extraction stress test: cram 5 fields into one answer.
  "My name is Roselle Santos, I'm a Filipino citizen living in Manila and we want to settle in Stockholm permanently",
  "I'm 32",
  "We're moving to be with my Swedish husband",
  "yes my husband is a Swedish citizen",
  "we've been married for 3 years",
  "spouse",
  "yes I have family ties in Sweden",
  "settle permanently",
  "Stockholm",
  "I'm the primary applicant",
  "within 3 months",
  "permanent",
  "8000 EUR",
  "1500 EUR",
  "no I'm not moving alone, my kid is coming",
  "1 child age 5",
  "no special healthcare needs",
  "no pets",
]

let lastQuestionField = null
for (let i = 0; i < persona.length; i++) {
  const userText = persona[i]
  console.log(`\n--- TURN ${i + 1} ---`)
  console.log('USER:', userText)
  const before = await readProfile()
  console.log('field count BEFORE:', Object.keys(before.profile_data || {}).filter(k => !k.startsWith('_')).length)
  const r = await chat(userText, before.profile_data || {}, lastQuestionField)
  console.log('http:', r.status)
  if (r.status !== 200) {
    console.log('error body:', r.raw)
    break
  }
  const mascotEvents = r.events.filter(e => e.type === 'mascot')
  for (const m of mascotEvents) console.log('  MASCOT:', m.kind, m.field || '', m.confidence || m.detail || '')
  const text = r.events.filter(e => e.type === 'text-delta').map(e => e.delta).join('')
  console.log('AI:', text.slice(0, 200))
  const meta = r.events.find(e => e.type === 'message-end')?.metadata
  if (meta) {
    console.log('meta.fieldFilled:', meta.fieldFilled, 'attemptedField:', meta.attemptedField, 'nextPendingField:', meta.nextPendingField)
    console.log('meta.additionalDetected:', meta.extractorAdditionalFieldsDetected)
    if (meta.retryHint) console.log('meta.retryHint:', meta.retryHint)
    lastQuestionField = meta.nextPendingField
  }
  const after = await readProfile()
  const beforeKeys = new Set(Object.keys(before.profile_data || {}).filter(k => !k.startsWith('_')))
  const afterKeys = new Set(Object.keys(after.profile_data || {}).filter(k => !k.startsWith('_')))
  const newlyAdded = [...afterKeys].filter(k => !beforeKeys.has(k))
  console.log('NEWLY PERSISTED:', newlyAdded.map(k => `${k}=${JSON.stringify(after.profile_data[k])}`).join(', ') || '(NONE)')
}

const final = await readProfile()
console.log('\n=== FINAL PROFILE ===')
console.log(JSON.stringify(final.profile_data, null, 2))
