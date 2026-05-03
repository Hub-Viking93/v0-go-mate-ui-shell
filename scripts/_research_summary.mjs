import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await a.from('relocation_plans').select('id,visa_research,local_requirements_research,research_status,research_meta')
  .eq('user_id','819053d3-0f53-49c6-a8a0-d92122cab5ae').order('created_at',{ascending:false}).limit(1).single()
console.log('plan', data.id)
console.log('research_status:', data.research_status)
console.log('research_meta:', JSON.stringify(data.research_meta, null, 2))
console.log('---visa---')
if (data.visa_research) {
  console.log('  visaOptions:', data.visa_research.visaOptions?.length)
  for (const v of (data.visa_research.visaOptions || [])) {
    console.log('   →', v.name, '|', v.eligibility, '|', v.type)
    console.log('     factors:', v.factors)
  }
  console.log('  generalRequirements count:', data.visa_research.generalRequirements?.length)
  console.log('  importantNotes count:', data.visa_research.importantNotes?.length)
}
console.log('---local_requirements---')
if (data.local_requirements_research) {
  const lr = data.local_requirements_research
  console.log(' keys:', Object.keys(lr).join(','))
  console.log(' total items:', (lr.items||[]).length)
}
