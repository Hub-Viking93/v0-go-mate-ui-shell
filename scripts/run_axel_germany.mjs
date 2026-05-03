// End-to-end persona run for Axel — Germany work posting.
// 1. Sign in
// 2. Wipe and create a fresh plan with a fully-pre-populated profile
//    (skip onboarding — the guide pipeline only cares about profile_data)
// 3. Lock plan + trigger research
// 4. Poll until research finishes (research-orchestrator runs guide composition in finalize)
// 5. Read the latest guide row + citation rows; print summary

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
const userId = signin.user.id
const accessToken = signin.session.access_token
console.log('signed in as', signin.user.email)

await admin.from('relocation_plans').delete().eq('user_id', userId)

const profile = {
  name: 'Axel Cornelius',
  citizenship: 'Swedish',
  birth_year: 1995,
  current_location: 'Berlin, Germany',
  destination: 'Sweden',
  target_city: 'Stockholm, Sweden',
  purpose: 'work',
  visa_role: 'primary',
  duration: '14 months',
  timeline: 'within 3 months',
  job_offer: 'yes',
  job_field: 'Software engineering',
  highly_skilled: 'yes',
  monthly_income: '90000 SEK',
  employer_sponsorship: 'yes',
  spouse_joining: 'yes',
  spouse_career_field: 'UX design',
  spouse_seeking_work: 'yes',
  spouse_language_skills: 'medium',
  children_count: 2,
  children_ages: '4 and 7',
  children_school_type_preference: 'international',
  children_language_skills_destination: 'low',
  moving_alone: 'no',
  monthly_budget: '60000 SEK',
  savings_available: '500000 SEK',
  preferred_currency: 'SEK',
  posting_or_secondment: 'yes',
  home_country_employer: 'Acme GmbH',
  posting_employer_address: 'Friedrichstraße 200, 10117 Berlin, Germany',
  posting_duration_months: 14,
  a1_certificate_status: 'in_progress',
  coc_status: 'not_applicable',
  pwd_filed: 'no',
  language_skill: 'high',
  education_level: 'Master',
  years_experience: 8,
  prior_visa: 'no',
  birth_certificate_apostille_status: 'in_progress',
  marriage_certificate_apostille_status: 'in_progress',
  diploma_apostille_status: 'in_progress',
  police_clearance_status: 'applied',
  pets: 'one dog',
  pet_microchip_status: 'yes',
  pet_vaccination_status: 'current',
  pet_breed: 'labrador',
  pet_size_weight: '30 kg',
  pet_age: '4 years',
  healthcare_needs: 'None reported; generally healthy',
  family_ties: 'no',
}

const { data: plan } = await admin.from('relocation_plans').insert({
  user_id: userId,
  profile_data: profile,
  interview_state: 'interview',
  chat_history: [],
  stage: 'complete',
  locked: true,
  is_current: true,
  onboarding_completed: true,
  title: 'Axel — Germany→Sweden posting',
}).select().single()
console.log('plan', plan.id)

console.log('POST /api/plans/trigger-research')
const r1 = await fetch(`${API}/api/plans/trigger-research`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ planId: plan.id }),
})
console.log('  status:', r1.status)

console.log('POST /api/research/visa (synchronous run)')
const r2 = await fetch(`${API}/api/research/visa`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify({ planId: plan.id }),
})
console.log('  status:', r2.status)

// Wait a few seconds for guide composition to finish (it kicks off async)
console.log('Waiting 8s for guide composition to settle...')
await new Promise(r => setTimeout(r, 8000))

// Read guides + citations
const { data: guides } = await admin.from('guides').select('*').eq('plan_id', plan.id).order('created_at', { ascending: false })
console.log('\n=== GUIDES ===')
console.log('total guides:', guides?.length)
const g = guides?.[0]
if (g) {
  console.log('id:', g.id)
  console.log('title:', g.title)
  console.log('hero:', g.hero_image_url ? `set (${g.hero_image_url.slice(0, 60)}...)` : '(none)')
  console.log('hero_attribution:', g.hero_image_attribution)
  console.log('sections jsonb keys:', g.sections?.map(s => s.key).join(','))
  console.log('global citations:', g.official_links?.length)

  console.log('\n=== SECTIONS (paragraph snippets) ===')
  for (const s of (g.sections || [])) {
    console.log(`\n[${s.key}] "${s.title}" — ${s.paragraphs.length} paragraphs, ${s.citations.length} citations`)
    if (s.paragraphs[0]) console.log('  ¶1:', s.paragraphs[0].slice(0, 220))
    for (const c of s.citations.slice(0, 3)) console.log('  cite [' + c.number + ']:', c.sourceName, '→', c.sourceUrl)
  }

  console.log('\n=== GLOBAL CITATIONS (uniqueness check) ===')
  const seen = new Set()
  for (const c of (g.official_links || [])) {
    const dup = seen.has(c.url)
    seen.add(c.url)
    console.log(`  ${c.name} — ${c.url}${dup ? '  ‼ DUPLICATE' : ''}`)
  }

  console.log('\n=== guide_section_citations rows ===')
  const { data: cites } = await admin.from('guide_section_citations').select('*').eq('guide_id', g.id)
  console.log('total rows:', cites?.length)
  const sectionsCount = {}
  for (const c of (cites || [])) sectionsCount[c.section_key] = (sectionsCount[c.section_key] || 0) + 1
  console.log('per section:', sectionsCount)
}
