import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
const {data} = await sb.from('relocation_plans').select('id,profile_data,is_current,created_at').eq('user_id','819053d3-0f53-49c6-a8a0-d92122cab5ae').order('created_at');
data.forEach(p=>console.log(p.id, p.is_current?'★':' ', '=>', p.profile_data?.name||'(empty)'));
