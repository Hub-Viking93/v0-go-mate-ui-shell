create or replace function switch_current_plan(p_user_id uuid, p_plan_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Step 1: Clear current flag (satisfies partial unique index first)
  update relocation_plans
  set is_current = false
  where user_id = p_user_id
    and is_current = true;

  -- Step 2: Set new current plan
  update relocation_plans
  set is_current = true
  where user_id = p_user_id
    and id = p_plan_id;
end;
$$;
