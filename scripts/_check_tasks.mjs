import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const cols = ['id','plan_id','user_id','title','description','status','category','phase','depends_on','dependencies','deadline_days','is_legal_requirement','steps','documents_needed','official_link','estimated_time','cost','generated_by_agent','agent_who_added_it','order_index']
for (const c of cols) {
  const { error } = await a.from('settling_in_tasks').select(c).limit(1)
  console.log(c, '→', error ? '✗' : '✓')
}
