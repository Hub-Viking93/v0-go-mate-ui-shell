import { createClient } from '@supabase/supabase-js'
const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const cols = ['id','user_id','plan_id','title','description','category','action_key','status','source_url','prefill','generated_by_agent','deadline','blocking','estimated_minutes','source_title','source_excerpt','completed_at','user_notes','due_date','priority','order_index','phase','timeline_weeks','docs_required']
for (const c of cols) {
  const { error } = await a.from('pre_departure_actions').select(c).limit(1)
  console.log(c, '→', error ? '✗' : '✓')
}
