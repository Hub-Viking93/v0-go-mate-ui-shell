# Batch 3 Alignment Audit — Post-Arrival Execution and Compliance

> Batch: 3
> Scope: Arrival / Settling-In Tasks / Timeline / Compliance
> Authority: `docs/audits/document-authority.md`
> Method: definitions -> code/database/runtime/frontend, with system docs used as supporting evidence
> Closure Rule: audit -> patch stale docs -> re-audit -> PASS
> Final Result: PASS

---

## 1. Systems Audited

This batch audited the post-arrival execution layer across:

- post-arrival stage
- settling-in task generation
- settling-in persistence
- task graph and blockers
- task completion via chat
- compliance timeline and alerting
- why-it-matters enrichment where it affects execution semantics

Primary inputs used:

- `docs/definitions/settling-in-tasks.md`
- `docs/definitions/timeline-system.md`
- `docs/definitions/event-trigger-system.md`
- `docs/systems/post-arrival-stage.md`
- `docs/systems/settling-in-engine.md`
- `docs/systems/settling-in-persistence.md`
- `docs/systems/task-graph.md`
- `docs/systems/task-completion-via-chat.md`
- `docs/systems/compliance-timeline.md`
- `docs/systems/why-it-matters.md`
- `app/api/settling-in/route.ts`
- `app/api/settling-in/generate/route.ts`
- `app/api/settling-in/[id]/route.ts`
- `app/api/settling-in/[id]/why-it-matters/route.ts`
- `app/api/settling-in/arrive/route.ts`
- `app/api/progress/route.ts`
- `app/api/chat/route.ts`
- `app/(app)/settling-in/page.tsx`
- `components/compliance-alerts.tsx`
- `components/compliance-timeline.tsx`
- `components/settling-in-task-card.tsx`
- `components/chat/chat-message-content.tsx`
- `lib/gomate/settling-in-generator.ts`
- `lib/gomate/dag-validator.ts`
- `lib/gomate/progress.ts`
- `lib/gomate/system-prompt.ts`

---

## 2. Audit Loop Performed

### Pass 1

Mapped the canonical post-arrival execution model against the current runtime model.

Main result:

- Batch 3 is now materially more implemented than the older docs claimed.
- Stage checks exist on the main execution routes.
- DAG validation exists in the generation path.
- task_key is populated in persistence.
- overdue / urgency / block_reason behavior exists on the settling-in read path.
- the remaining gaps are no longer “feature missing” gaps so much as authority and consistency gaps between state, progress, execution, and compliance surfaces.

### Patch Pass

Corrected stale Batch 3 documents that still described pre-fix post-arrival behavior.

Patched files:

- `docs/definitions/settling-in-tasks.md`
- `docs/definitions/timeline-system.md`
- `docs/systems/post-arrival-stage.md`
- `docs/systems/settling-in-engine.md`
- `docs/systems/settling-in-persistence.md`
- `docs/systems/task-graph.md`
- `docs/systems/task-completion-via-chat.md`
- `docs/systems/compliance-timeline.md`
- `docs/systems/why-it-matters.md`
- `docs/systems/master-index.md`
- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`

Patch themes:

- corrected stale claims that settling-in routes had no stage checks
- corrected stale claims that task generation had no DAG validation
- corrected stale claims that task_key is not populated
- corrected stale claims that why-it-matters has no rate limiting at all
- corrected stale claims that compliance dismissal is only component state
- corrected stale claims that all compliance deadline logic is still client-side
- corrected stale dependency storage descriptions from task_key arrays to task UUID arrays

### Runtime Verification Pass

Authenticated localhost runtime verification was executed against `http://localhost:3000` using the configured test account from `.env.local`.

Verified cases:

1. Current `generating` plan
- `GET /api/progress` returned `stage="generating"` and `post_arrival_progress.total = 0`
- `GET /api/settling-in` returned `200` with `tasks=[]`, `stage="generating"`, `arrivalDate=null`
- `POST /api/settling-in/arrive` returned `400`

2. Older `complete` plan with pre-existing settling-in tasks
- The normal `/api/plans` switch route returned `500`, so the older plan was made current directly in the DB as a test fixture
- `GET /api/progress` returned `stage="complete"` with `post_arrival_progress = 33% (3 / 9)`
- `GET /api/settling-in` returned `200` with `tasks=[]`, `stage="complete"`, `arrivalDate=null`
- `POST /api/settling-in/generate` returned `400`
- `PATCH /api/settling-in/:id` returned `400`
- `POST /api/settling-in/:id/why-it-matters` returned `200` before arrival

3. Same older plan after arrival
- `POST /api/settling-in/arrive` returned `200`
- `GET /api/settling-in` returned 9 tasks with:
  - `stats.total = 9`
  - `stats.completed = 3`
  - `stats.available = 2`
  - `stats.locked = 4`
  - `stats.progressPercent = 33`
  - `deadline_at`
  - `days_until_deadline`
  - `urgency`
  - `block_reason`
  - `blocked_by`
- locked-task completion still returned `400`
- `GET /api/progress` returned `stage="arrived"` with the same `post_arrival_progress = 33%`

4. State restoration
- the test fixture restored the account to its original current-plan state
- the temporary why-it-matters write was reverted

### Re-Audit Pass

Re-scanned the Batch 3 docs after patching and compared them against the code and live results.

No remaining unclassified Batch 3 mismatch type appeared in the second pass.

The final runtime findings that remained significant were:

- progress can surface post-arrival work before arrival if task rows already exist
- settling-in routes do not share one consistent stage-gate contract
- why-it-matters is still reachable pre-arrival

Those findings are explicitly classified below.

That satisfies the Batch 3 closure rule.

---

## 3. Canonical Target Summary

Canonical Batch 3 target, condensed:

- post-arrival execution starts from a clean, canonical arrival transition
- tasks are version-bound operational artifacts with stable identity and explicit lifecycle states
- blockers are first-class state, not just UI hints
- compliance derives canonically from task and requirement models
- timeline is the chronological execution backbone, not just a visual convenience
- chat-based completion resolves against canonical task identity
- enrichment follows the same execution-stage authority as the rest of the task surface

---

## 4. Current Reality Summary

Actual Batch 3 runtime, condensed:

- arrival is a direct route update on `relocation_plans.stage` plus `arrival_date`
- settling-in tasks are persisted on `settling_in_tasks` with UUID `id` and slug `task_key`
- generation is explicit and manual after arrival; no event/job system exists
- task availability is dependency-driven and works in practice
- block_reason / blocked_by / urgency / overdue are derived on the read path
- compliance is a task-deadline layer, not a separate canonical compliance system
- `ComplianceAlerts` uses server-derived urgency, but `ComplianceTimeline` still recomputes client-side
- chat completion still resolves through task titles, not canonical task ids or task keys
- stage gating is inconsistent across GET / generate / PATCH / why-it-matters

---

## 5. Audit Questions Answered

### What is the canonical task identity and lifecycle?

Canonically it is a version-bound task artifact with a stable task type identity and a strict lifecycle.

In reality it is:

- `id` as the route/storage identity
- `task_key` as a persisted stable slug
- `title` as the chat completion identity
- `status` as `locked | available | in_progress | completed | skipped | overdue`

So identity exists, but it is split across three forms depending on the surface.

### Are task blockers modeled correctly?

Partially.

Dependency blockers work operationally:

- blocked tasks remain locked
- GET surfaces `block_reason = PREREQUISITES_INCOMPLETE`
- GET surfaces `blocked_by`

But blocker state is still not canonical:

- it is derived on read, not persisted as the primary state model
- manual block modes do not exist
- skipped tasks do not unblock dependencies

### Where are stage checks missing, duplicated, or overused?

They are inconsistent rather than universally missing.

- `POST /api/settling-in/generate`: hard gate
- `PATCH /api/settling-in/[id]`: hard gate
- `GET /api/settling-in`: soft gate (`200` + empty tasks)
- `POST /api/settling-in/[id]/why-it-matters`: no stage gate

There is still no shared post-arrival guard helper, so stage semantics are route-specific.

### Does compliance derive from tasks canonically or only visually?

Only partially canonically.

Compliance currently derives from task deadlines and task legal flags, but not from a formal compliance model or requirement system.

- task route computes `deadline_at`, `urgency`, and `overdue`
- alerts consume those fields
- timeline view still computes on the client

So compliance is still mostly a task-UI interpretation layer.

### Is timeline an execution artifact or just a display convenience?

Currently it is only a display convenience over task deadlines.

There is no `timeline_items` system, no aggregated chronology, and no cross-artifact execution backbone.

### Are chat-based completion actions tied to canonical task identity?

No.

They are intentionally tied to exact task title strings in v1, then resolved client-side to task UUIDs via `GET /api/settling-in`.

That works, but it is not canonical identity.

---

## 6. Current Dependency Chain

Current Batch 3 execution chain:

1. current plan selected by Batch 1 authority model
2. arrival transition sets `stage="arrived"` and `arrival_date`
3. generate route reads:
   - `profile_data`
   - opportunistic visa context from `visa_research`
4. route generates and persists:
   - `settling_in_tasks`
   - `task_key`
   - `deadline_at`
   - `deadline_anchor`
5. GET route derives:
   - available tasks
   - overdue state
   - urgency
   - block_reason / blocked_by
6. frontend renders:
   - task cards
   - compliance timeline
   - compliance alerts
7. chat completion resolves title -> task id -> PATCH route

Weak points in the chain:

- no requirement-set authority
- no task version set identity
- no unified stage-gate helper
- no timeline artifact
- progress route can count post-arrival tasks even when settling-in routes are still soft-gated

---

## 7. V1-Minimal vs Actually Broken

### Acceptable v1-minimal divergences

- no formal timeline system
- no event-trigger generation model
- no requirement-set to task-set chain
- no task versioning/profile snapshot binding
- title-based chat completion marker

These are meaningful canonical gaps, but they can be coherent if documented honestly.

### Actually broken or misleading

- pre-arrival plans with existing task rows can produce post-arrival progress before arrival
- GET /api/settling-in hides tasks pre-arrival while `/api/progress` may still count them
- why-it-matters can run pre-arrival even though the rest of the execution surface is stage-gated
- compliance deadline authority is split between server and client paths

These are not just “smaller than the spec”. They distort the meaning of execution state in live behavior.

---

## 8. Gap Table

| ID | Domain | Canonical Requirement | Current Reality | Impact | Outcome |
|---|---|---|---|---|---|
| B3-001 | Stage-gate authority | Post-arrival execution surfaces should obey one coherent `arrived` gate | Generate/PATCH hard-gate, GET soft-gates, why-it-matters has no stage gate | Execution semantics differ by route and are hard to reason about | `code_fix_now` |
| B3-002 | Progress/stage coherence | Post-arrival progress should only surface when the plan is truly in post-arrival execution mode | Runtime verified `stage="complete"` with hidden task surface but `post_arrival_progress = 33%` | Progress can overstate post-arrival readiness before arrival | `code_fix_now` |
| B3-003 | Legacy task-state coherence | Non-arrived plans should not carry active post-arrival task sets in a way that contradicts the API surface | Runtime fixture exposed a `complete` plan with `arrival_date`, `post_relocation_generated=true`, and 9 tasks | Old or inconsistent task sets can strand execution state behind a soft gate | `phase_candidate` |
| B3-004 | Task identity model | One canonical task identity should drive persistence, dependencies, and chat completion | Runtime uses UUID for routes, task_key for persistence uniqueness, title for chat markers | Identity is operationally split across three surfaces | `intentional_v1_minimal` |
| B3-005 | Blocker model | Blockers should be first-class lifecycle state with explicit causes and transitions | Dependency blockers work, but are derived on read and only expose `PREREQUISITES_INCOMPLETE` | Execution guidance is useful but not canonical enough for richer task workflows | `phase_candidate` |
| B3-006 | Compliance ownership | Compliance progress should derive from REQUIRED work, not all tasks | No task priority field; progress counts all tasks | Compliance and general settling progress are conflated | `phase_candidate` |
| B3-007 | Timeline architecture | Timeline should be the chronological execution artifact across systems | No timeline system exists; only task-deadline rendering exists | No cross-artifact time backbone exists | `defer_v2` |
| B3-008 | Generation architecture | Task generation should have stronger idempotency, persistence, and validation structure | No run table, no transaction, no event emission, no baseline tables | Hard to audit or safely regenerate execution artifacts | `phase_candidate` |
| B3-009 | Enrichment safety | Why-it-matters should obey execution-stage authority and avoid implicit legal guarantees | Route lacks stage gate, prompt lacks hedging, no audit trail exists | Pre-arrival invocation and legal-sounding overreach remain possible | `phase_candidate` |
| B3-010 | Compliance rendering authority | Compliance UI should derive from one canonical deadline/status computation | Alerts use server urgency, timeline still computes client-side | Different compliance surfaces can drift | `phase_candidate` |

---

## 9. Runtime-Verified Findings

These were verified in live localhost responses, not just inferred from code:

- `GET /api/settling-in` now soft-gates pre-arrival plans instead of exposing tasks
- `POST /api/settling-in/generate` rejects pre-arrival plans
- `PATCH /api/settling-in/:id` rejects pre-arrival task completion
- `POST /api/settling-in/:id/why-it-matters` still succeeds before arrival
- after arrival, GET returns:
  - `deadline_at`
  - `days_until_deadline`
  - `urgency`
  - `block_reason`
  - `blocked_by`
  - aggregate stats
- locked-task completion is still blocked after arrival as expected
- `/api/progress` can expose post-arrival progress before arrival if task rows already exist

Inference from runtime and code:

- the core execution engine is no longer “missing”
- the real Batch 3 problem is consistency of state authority across surfaces

---

## 10. Recommended Phase Candidates

### Candidate A — Post-Arrival Gate Normalization

- introduce one shared post-arrival guard helper
- make GET / generate / PATCH / why-it-matters use the same stage contract
- decide whether GET should hard-fail or remain a soft gate

### Candidate B — Post-Arrival Progress Integrity

- suppress or separately classify post-arrival progress when plan is not `arrived`
- define how legacy/pre-existing task rows should be handled
- align `/api/progress` with the settling-in surface contract

### Candidate C — Task Identity Consolidation

- preserve title markers for v1 if required
- but formalize one canonical downstream identity across persistence, chat resolution, and dependency modeling

### Candidate D — Compliance Ownership Upgrade

- add task priority / requiredness
- split compliance progress from overall settling progress
- move `ComplianceTimeline` onto server-derived deadline fields

### Candidate E — Why-It-Matters Safety

- add `arrived` stage gate
- add hedging language
- add lightweight observability
- refine rate-limit contract from per-plan cap to explicit policy

---

## 11. Re-Audit Result

Final re-audit result:

- no stale Batch 3 contradiction remains in the patched definitions/system/audit docs touched by this run
- task authority, stage gating, and compliance ownership are explicitly mapped
- every Batch 3 mismatch found in this run has one of the allowed outcomes
- Batch 2 dependency on `visa_research` is documented rather than assumed
- the runtime findings that matter most are now recorded and classified

This does not mean Batch 3 systems are aligned to the canonical definitions.

It means Batch 3 itself is audit-complete, internally coherent, and closed under the required loop.

---

## 12. Final Result

Final Result: PASS
