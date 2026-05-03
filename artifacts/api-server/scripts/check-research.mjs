import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const ids = {
  Stevenson: '634f0c0f-4938-4818-8fd8-8c6384317fb9',
  Axel:      '43012cff-ed03-424e-9a0a-cffae893a445',
  Priya:     '9ec74a63-3942-4eb1-9cd5-c4843eab402e',
  Roselle:   'fdac6264-575a-4250-9b96-04606b7981dc',
};
for (const [name, id] of Object.entries(ids)) {
  const { data } = await sb.from('relocation_plans').select('research_status, visa_research, local_requirements_research, research_completed_at').eq('id', id).single();
  const vr = data.visa_research;
  const lr = data.local_requirements_research;
  console.log(`\n${name} (${id.slice(0,8)})`);
  console.log(`  research_status: ${data.research_status}`);
  console.log(`  research_completed_at: ${data.research_completed_at}`);
  console.log(`  visa_research keys: ${vr ? Object.keys(vr).join(',') : 'NULL'}`);
  if (vr?.visaOptions || vr?.recommendedVisas) {
    const opts = vr.visaOptions || vr.recommendedVisas;
    console.log(`  visa options (${opts.length}):`);
    opts.forEach((o,i)=>console.log(`    ${i+1}. ${o.name||o.visaName||'?'} — eligibility: ${o.eligibility} ${o.recommended?'★RECOMMENDED':''}`));
  }
  console.log(`  local_requirements keys: ${lr ? Object.keys(lr).join(',') : 'NULL'}`);
}
