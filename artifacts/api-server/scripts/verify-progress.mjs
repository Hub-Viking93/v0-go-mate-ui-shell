import { createClient } from "@supabase/supabase-js";
import { getRequiredFields } from "../src/lib/gomate/profile-schema-snapshot.ts";
const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ids=['634f0c0f-4938-4818-8fd8-8c6384317fb9','43012cff-ed03-424e-9a0a-cffae893a445','9ec74a63-3942-4eb1-9cd5-c4843eab402e','fdac6264-575a-4250-9b96-04606b7981dc'];
for(const id of ids){
  const {data}=await sb.from('relocation_plans').select('profile_data').eq('id',id).single();
  const pd=data.profile_data;
  const required=getRequiredFields(pd);
  const filled=required.filter(f=>pd[f]!=null&&pd[f]!=='');
  const pct=Math.round(filled.length/required.length*100);
  console.log(`${id.slice(0,8)} ${pd.name}: ${filled.length}/${required.length} = ${pct}%${pct===100?' ✓':''}`);
  const missing=required.filter(f=>pd[f]==null||pd[f]==='');
  if(missing.length)console.log('   missing:',missing.join(', '));
}
