user_test_phase3.md





TEST 1 APPROVED

TEST 2 APPROVED

TEST 3 FAILED WITH:

The settling-in tasks are successfully generated and returned by the /api/settling-in endpoint, and task state updates (e.g. mark complete) work correctly. However, none of the returned task objects include a task_key field.

Evidence:

Endpoint tested: GET /api/settling-in

Task count: 9

task_key missing: 9

Example task object keys returned:
[
"id",
"user_id",
"plan_id",
"title",
"description",
"category",
"depends_on",
"deadline_days",
"is_legal_requirement",
"why_it_matters",
"steps",
"documents_needed",
"official_link",
"estimated_time",
"cost",
"status",
"completed_at",
"sort_order",
"created_at",
"updated_at"
]

The task_key field is not present in the API response.

Additional verification:
The Supabase table public.settling_in_tasks was inspected via Table Editor. The task_key column does not exist in the table schema.

Conclusion:
The Phase 3 requirement that settling-in tasks must include a stable task_key is not currently satisfied.

Impact:
This prevents deterministic task identification and violates the Phase 3 migration specification.

TEST 4 APPROVED

NEGATIVE TEST 1 APPROVED

NEGATIVE TEST 2 APPROVED

NEGATIVE TEST 3 APPROVED