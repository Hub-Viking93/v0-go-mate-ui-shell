import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: g } = await a.from('guides')
  .select('id,title,destination,destination_city,hero_image_url,hero_image_attribution,sections,official_links,created_at')
  .order('created_at',{ascending:false}).limit(1).single()
console.log('guide:', g.id, '|', g.title)
console.log('hero:', g.hero_image_url ? 'YES (' + g.hero_image_url.slice(0,80) + '...)' : 'NO')
console.log('sections count:', g.sections?.length)
console.log('global citations:', g.official_links?.length)
for (const s of (g.sections || [])) {
  console.log(`  [${s.key}] ${s.paragraphs?.length}¶ ${s.citations?.length}cite`)
  if (s.paragraphs?.[0]) console.log('     ¶1:', s.paragraphs[0].slice(0,180))
}
const { data: cites } = await a.from('guide_section_citations').select('*').eq('guide_id', g.id)
console.log('\nguide_section_citations rows for this guide:', cites?.length)
