import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: p } = await a.from('relocation_plans').select('id,research_meta')
  .order('updated_at',{ascending:false}).limit(1).single()
const specs = p.research_meta?.specialists || {}
console.log('plan:', p.id, '— specialists with data:', Object.keys(specs).length)
for (const [name, body] of Object.entries(specs)) {
  console.log('\n===', name, '===')
  const dsd = body.domainSpecificData || {}
  console.log('domainSpecificData keys:', Object.keys(dsd).join(', '))
  console.log('  sample:', JSON.stringify(dsd).slice(0, 400))
}
