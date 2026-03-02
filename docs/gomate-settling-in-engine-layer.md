# GoMate — Post-Relocation (Batch 8) Contracts (v1)
Batch 8 = Settling-In Engine Layer

Includes:
8.1 Settling-In Checklist Engine Contract
8.2 Task Graph & Dependency Contract
8.3 Why-It-Matters Enrichment Contract

Scope:
- Defines HOW settling-in tasks are generated, structured, and enriched.
- Depends on Batch 7 (Arrival Contract + Settling-In Persistence).
- All generation and enrichment must be schema-safe, idempotent, and replayable.

Non-negotiable:
- Generation is deterministic per plan + arrival_date snapshot.
- Dependency graph must be a valid DAG.
- Enrichment is cached and never regenerated unnecessarily.

================================================================================
8.1 SETTLING-IN CHECKLIST ENGINE CONTRACT (v1)
================================================================================

## 8.1.1 Purpose
Generate a personalized checklist of settling-in tasks for a user after arrival.

Checklist must be:
- Personalized to user profile + plan destination
- Legally safe (no guarantees)
- Structured and dependency-aware
- Cached and idempotent
- Replayable and observable

Checklist generation is NOT free-form content generation.
It is a controlled extraction pipeline producing strict SettlingInTask records.

## 8.1.2 Generation trigger sources

Generation may be triggered by:

Primary:
- POST /api/settling-in/generate
- Automatically after arrival (recommended)

Secondary:
- Explicit “Regenerate checklist” user action (optional v1.1)

Never generate automatically without arrival state.

Hard rule:
Generation must verify:
- plan.stage == 'arrived'
- arrival_date exists

Else:
- return STAGE_NOT_ARRIVED

## 8.1.3 Generation inputs (canonical)

Input bundle:

GenerationContext:
- user_id
- plan_id
- arrival_date
- destination:
  - country_code
  - city (optional)
- profile snapshot:
  - nationality
  - employment_status
  - occupation
  - relocation_intent
  - household info (optional)
- country baseline (from country_baselines table)
- trace_id

Hard rule:
Use committed profile data only.
Never use candidate/unconfirmed data.

## 8.1.4 Generation architecture pipeline

Pipeline stages:

Stage 1 — Baseline task load
- Load baseline tasks from Country DB (country_baselines.admin_steps)
- Convert to SettlingInTask schema

Stage 2 — Web research (optional but recommended)
- Fetch official sources via Source Fetch system
- Extract additional tasks using Extraction Service
- Tag origin='web_source'

Stage 3 — AI personalization
- Use LLM with strict extraction schema prompt
- Provide:
  - baseline tasks
  - user profile snapshot
  - destination context

LLM must output:
- new tasks
- dependency relationships
- why this task exists

Never allow LLM to invent schema structure.

Stage 4 — Merge & validation
- Merge baseline + web + AI tasks
- Deduplicate
- Validate schema
- Validate dependency graph (see 8.2)

Stage 5 — Persist
- Insert tasks into settling_in_tasks table
- Set locked flags correctly
- Record generation run

Stage 6 — Finalize
- Emit settling_in.tasks.generated event

## 8.1.5 API contract

### POST /api/settling-in/generate

Headers:
- Authorization
- Idempotency-Key

Body:
- {}  (all data inferred from plan/profile)

Response:
200 OK:
{
  "plan_id": "...",
  "status": "succeeded|partial",
  "tasks_created": 12,
  "trace_id": "...",
  "job_id": "...optional..."
}

Idempotency rules:
- job_key = settling_in:${plan_id}:${arrival_date}
- Duplicate calls must not create duplicate tasks.

If already generated:
- return existing result.

## 8.1.6 Partial generation behavior

Generation may fail partially due to:
- source fetch failures
- extraction failures
- LLM failures

Allowed:
- baseline tasks only
- status='partial'

Not allowed:
- empty checklist unless baseline empty.

## 8.1.7 Regeneration policy

Default v1:
- generation occurs once per arrival_date

Optional regeneration:
- explicit user action required
- must archive or version previous tasks

Never silently overwrite completed tasks.

## 8.1.8 Observability

Events:
- settling_in.generate.started
- settling_in.generate.completed
- settling_in.generate.partial
- settling_in.generate.failed

Trace_id mandatory.

## 8.1.9 Definition of Done

Checklist engine is complete when:

- generation is idempotent
- schema always valid
- dependencies valid
- no duplicate tasks created
- baseline fallback works

================================================================================
8.2 TASK GRAPH & DEPENDENCY CONTRACT (v1)
================================================================================

## 8.2.1 Purpose

Define strict rules for task dependency graph.

Graph must be:

Directed  
Acyclic  
Deterministic  
Stable  

Dependency graph controls locking behavior.

## 8.2.2 Graph model

Each task has:

depends_on: uuid[]

Meaning:

Task is locked until ALL depends_on tasks are done.

Graph is stored as adjacency list.

Example:

Register address → Get ID number → Open bank account

Bank account depends_on ID number
ID number depends_on Register address

## 8.2.3 DAG invariant

Graph MUST be a Directed Acyclic Graph.

Cycles forbidden.

Invalid:

A depends_on B
B depends_on A

Server must detect and reject generation if cycle exists.

## 8.2.4 Cycle detection algorithm

At generation time:

Use:

DFS cycle detection  
OR topological sort validation

If cycle found:

Remove or correct dependency  
OR fail generation

Never store cyclic graph.

## 8.2.5 Lock computation

Locked state defined as:

locked = any(dep.status != done)

Must be computed at:

- generation
- task completion

Never computed client-side.

Server authoritative.

## 8.2.6 Unlock transaction

When task completed:

Transaction:

Update task status

Find dependents

For each dependent:
If all deps done:
Set locked=false

Emit unlock events

Atomic required.

## 8.2.7 Stable identifiers

Dependency must use:

task_id

Never use title.

Title may change.

task_id is canonical.

## 8.2.8 Dependency validation rules

Must ensure:

- dependency task exists
- dependency belongs to same plan
- dependency is not self

Reject invalid dependencies.

## 8.2.9 Observability

Events:

task.locked
task.unlocked
task.dependency_invalid

## 8.2.10 Definition of Done

Graph contract complete when:

- cycles impossible
- locking deterministic
- unlocking atomic
- dependencies stable

================================================================================
8.3 WHY-IT-MATTERS ENRICHMENT CONTRACT (v1)
================================================================================

## 8.3.1 Purpose

Provide personalized explanation:

Why task matters for THIS user.

Goals:

- increase trust
- increase completion rate
- avoid hallucinated legal advice

## 8.3.2 Generation trigger

Lazy-loaded only.

User action required.

POST /api/settling-in/{task_id}/why-it-matters

## 8.3.3 Inputs

- task details
- user profile snapshot
- destination

LLM prompt must be extraction-style:

Output:

2-3 sentences
Plain explanation
No legal guarantees

## 8.3.4 Storage contract

Stored in:

settling_in_tasks.why_it_matters

Cache rules:

If exists:

Return cached value

Never regenerate automatically.

## 8.3.5 Idempotency

Multiple requests:

Must not regenerate

Must return existing text

## 8.3.6 Rate limiting

Recommended:

Max 20 enrichments per day per user

Prevent abuse.

## 8.3.7 Safety rules

LLM must NOT:

Claim legal certainty  
Claim eligibility  
Invent requirements  

Must use hedging language:

“Typically”
“In many cases”
“You may need”

## 8.3.8 Failure handling

If generation fails:

Return:

status=failed

Do not store partial text.

User can retry.

## 8.3.9 Observability

Events:

why.generated
why.cached
why.failed

## 8.3.10 Definition of Done

Enrichment complete when:

- cached correctly
- never duplicated
- safe language used
- idempotent

END