# Batch 6 Alignment Audit — Chat History, Events, Data Update, Reliability, and Artifact Orchestration

> Batch: 6
> Scope: Chat history / event trigger system / data update system / reliability contracts / observability / job system / artifact system
> Authority: `docs/audits/document-authority.md`
> Method: definitions -> code/database/runtime/frontend, with system docs used as supporting evidence
> Closure Rule: audit -> patch stale docs/code -> re-audit -> PASS
> Final Result: PASS

---

## 1. Systems Audited

This batch audited the cross-cutting orchestration and persistence layers across:

- chat history persistence
- event/trigger orchestration
- data update / regeneration ownership
- reliability contracts
- observability
- job / queue substitute behavior
- artifact storage model

Primary inputs used:

- `docs/definitions/chat-history-system.md`
- `docs/definitions/event-trigger-system.md`
- `docs/definitions/data-update-system.md`
- `docs/definitions/research-system.md`
- `docs/systems/reliability-contracts.md`
- `docs/systems/observability.md`
- `docs/systems/job-system.md`
- `docs/systems/artifact-system.md`
- `docs/systems/end-to-end-flow.md`
- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`
- `app/api/chat/route.ts`
- `app/api/research/trigger/route.ts`
- `app/api/profile/route.ts`
- `lib/gomate/research-visa.ts`
- `lib/gomate/research-local-requirements.ts`
- `lib/gomate/research-checklist.ts`

---

## 2. Audit Loop Performed

### Pass 1

Mapped the canonical orchestration definitions against current code and the existing Batch 6 docs.

Main result:

- the codebase still has no chat history system, event bus, queue, or observability layer
- current orchestration is route-inline, synchronous, and request-coupled
- several Batch 6 docs were stale from earlier phases:
  - old self-HTTP research trigger flow was still documented
  - old plan-creation race remained documented as unresolved
  - old chat auth gap remained documented as unresolved
  - old guide-lock insert mismatch remained documented as unresolved

### Runtime Verification Pass

Authenticated and unauthenticated localhost runtime verification was executed against `http://localhost:3000` on 2026-03-14 using the configured test account from `.env.local`.

Verified cases:

1. Chat auth and termination guards
- unauthenticated `POST /api/chat` returned `401`
- authenticated `GET /api/profile` returned the current plan with:
  - `stage = "generating"`
  - `locked = false`
  - `plan_version = 2`
  - `research_status = "completed"`
  - `onboarding_completed = false`
- authenticated `POST /api/chat` on that current plan returned `400 "Interview complete — generation in progress."`

2. Research trigger orchestration bug, before patch
- the same current plan above was not locked and not in `complete`
- pre-patch, `POST /api/research/trigger` still accepted the plan and began mutating aggregate research state
- this proved that orchestration boundaries were only implied by the intended flow, not enforced by the route itself

### Patch Pass

Patched the in-scope live orchestration defect and corrected stale Batch 6 docs.

Code patches:

- `app/api/research/trigger/route.ts`
- `lib/gomate/research-visa.ts`
- `lib/gomate/research-local-requirements.ts`

Behavioral changes:

- `POST /api/research/trigger` now rejects plans that are not already `locked=true` with `stage in ("complete","arrived")`
- the aggregate trigger now owns aggregate `research_status` during orchestration
- partial success no longer reports aggregate `"completed"`; aggregate status becomes `"failed"` unless all three sub-results succeed
- standalone visa/local-requirements routes still manage their own status when called directly, but the aggregate trigger no longer lets those helpers overwrite aggregate state mid-run

Docs patched:

- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`
- `docs/systems/job-system.md`
- `docs/systems/end-to-end-flow.md`

Patch themes:

- removed stale self-HTTP descriptions from the active Batch 6 docs
- updated chat auth documentation to match the explicit `401` guard
- updated research trigger docs to reflect the locked-plan precondition and direct-helper orchestration
- marked the old first-load plan race and old guide-lock insert mismatch as resolved in the system doc layer

### Runtime Re-Verification Pass

Re-tested the patched research trigger on localhost.

Verified cases:

1. Pre-lock research is now rejected
- authenticated `POST /api/research/trigger` against the same current plan (`stage="generating"`, `locked=false`) returned `409`
- response body: `{"error":"Plan must be locked before research can run"}`

2. Rejected trigger does not mutate stored status
- follow-up authenticated `GET /api/research/trigger` still returned `200`
- status remained `completed`
- `completedAt` remained populated
- `hasVisaResearch` and `hasLocalRequirements` remained `true`

### Re-Audit Pass

Re-scanned the active Batch 6 docs for stale:

- self-HTTP research trigger language
- implicit-auth language for chat
- unresolved first-load race language
- unresolved guide-lock insert mismatch language

No remaining unclassified in-scope Batch 6 mismatch remained after the patch and re-audit sweep.

That satisfies the Batch 6 closure rule.

---

## 3. Canonical Target Summary

Canonical Batch 6 target, condensed:

- chat systems persist conversations/messages with continuity and ordered replay
- domain events route cross-system mutations through an event layer
- data updates/regenerations are orchestrated through a dependency-aware update system
- reliability contracts classify failures, retry transient work, and expose failure state honestly
- observability provides request correlation and traceability
- background orchestration is queue/job based rather than request-coupled
- artifacts share a unified versioned storage contract

---

## 4. Current Reality Summary

Actual Batch 6 runtime, condensed:

- chat history is entirely client-side; the server stores extracted profile state but not the conversation that produced it
- no event bus or queue exists; all orchestration lives inline in route handlers
- guide staleness and task unlocking are handled by direct route-side updates, not a formal data-update layer
- reliability behavior is still ad hoc:
  - single-attempt external calls
  - fallback-first behavior
  - limited user-visible failure signaling
- observability is still unstructured logging with inconsistent prefixes and no request correlation
- artifacts are still output-specific rows/columns rather than a unified artifact registry

The main in-scope runtime correction from this batch is that the research trigger now enforces the lock boundary instead of trusting the client flow to call it at the correct lifecycle point.

---

## 5. Audit Questions Answered

### Which missing infrastructure is truly necessary for v1 correctness?

Necessary now:

- lifecycle guards on inline orchestration routes
- honest aggregate research status semantics
- docs that accurately describe current orchestration ownership

Not necessary yet for current v1 correctness:

- a full queue system
- a full event bus
- a full trace/span model
- a unified artifact table

These remain important target-state systems, but the app can still function without them as long as inline orchestration boundaries are enforced and the missing systems are documented honestly.

### Which missing systems are only target-architecture concerns?

Primarily target-architecture concerns in the current product state:

- chat-history persistence layer
- event bus / outbox
- queue / worker system
- full observability and replay
- unified artifact storage

These gaps are real, but they are not all immediate blockers to current user flows.

### Where are inline triggers acceptable v1 substitutes?

Acceptable current v1 substitutes:

- guide staleness updates on profile PATCH
- arrival transition and settling-task unlock logic in route handlers
- locked-plan guard and aggregate research orchestration in `POST /api/research/trigger`

These are acceptable as long as the docs do not misrepresent them as a queue/event system.

### What cross-system orchestration is currently implicit in route handlers?

Current route-inline orchestration includes:

- chat -> extraction -> profile save
- profile PATCH -> plan_version increment -> guide staleness
- profile lock -> guide generation -> onboarding completion
- research trigger -> visa/local-requirements/checklist fan-out
- settling task completion -> dependent task unlocks

This orchestration is real, but it is implicit and not modeled as an independent platform layer.

### Which reliability gaps create user-visible correctness issues now?

Current user-visible issues now:

- chat continuity is lost on refresh because no server-side conversation exists
- research still depends on the client making a second call after lock; no server-side backstop exists
- external failures often collapse into fallback/default data with weak UI visibility
- no queue/retry layer means a transient failure is often just a failed request

The pre-lock research trigger bug also belonged here and was fixed during this batch.

---

## 6. Gap Table

| ID | Gap | Classification | Status |
|---|---|---|---|
| B6-001 | Chat history persistence is absent; conversations/messages are not stored server-side | `defer_v2` | classified |
| B6-002 | No event bus exists; inline route triggers are the current substitute | `intentional_v1_minimal` | accepted |
| B6-003 | No formal data-update DAG/cascade engine exists; artifact freshness remains route-owned and partial | `intentional_v1_minimal` | accepted |
| B6-004 | Research is still client-triggered after lock; there is no server-side backstop if that second call never happens | `phase_candidate` | classified |
| B6-005 | No queue/worker/retry ledger exists for research or other derived work | `phase_candidate` | classified |
| B6-006 | No trace IDs, structured observability, or replay capability exists | `defer_v2` | classified |
| B6-007 | Failure visibility is still weak: fallback/default data and profile-save issues are only partially surfaced to the user | `phase_candidate` | classified |
| B6-008 | Artifact storage remains output-specific rather than a unified versioned artifact layer | `defer_v2` | classified |

---

## 7. Classified Batch 6 Gaps

### B6-001 Chat History System Is Still Missing

- Classification: `defer_v2`
- Evidence: no `conversations` or `messages` tables exist; `POST /api/chat` operates entirely on client-provided message history
- Meaning: continuity, replay, and durable conversation debugging do not exist yet

### B6-002 Event Bus Is Not Implemented

- Classification: `intentional_v1_minimal`
- Evidence: cross-system effects are still performed inline in route handlers
- Meaning: current v1 orchestration is explicit route logic, not event-driven infrastructure

### B6-003 Data Update System Is Still Route-Owned

- Classification: `intentional_v1_minimal`
- Evidence: guide staleness, onboarding completion, and task-unlock effects are all route-owned; no DAG/cascade registry exists
- Meaning: the current freshness model is partial but coherent enough for the present artifact set

### B6-004 Research Has No Server-Side Backstop After Lock

- Classification: `phase_candidate`
- Evidence: lock still does not trigger research itself; the client must make a second call
- Meaning: a locked plan can still miss research entirely if the client never performs the follow-up request

### B6-005 No Queue, Retry, or Persisted Research Subtask Ledger Exists

- Classification: `phase_candidate`
- Evidence: `POST /api/research/trigger` still runs synchronously inside the request and persists only aggregate status
- Meaning: transient failures remain first-order user-visible failures, and operations have no durable subtask ledger

### B6-006 Observability Is Still Missing

- Classification: `defer_v2`
- Evidence: no trace IDs, span model, or replay system exists; logs remain ad hoc
- Meaning: production debugging and root-cause analysis are still primitive

### B6-007 Failure Visibility Is Still Too Weak

- Classification: `phase_candidate`
- Evidence:
  - chat surfaces `profileSaveError` metadata, but there is still no guaranteed user-visible remediation path
  - research/checklist/local-requirements still rely on silent fallback/default behavior in several failure modes
- Meaning: the system now avoids one major lifecycle bug, but it still does not explain degraded data well enough to the user

### B6-008 Artifact System Remains Output-Specific

- Classification: `defer_v2`
- Evidence: guides and research outputs still live in system-specific tables/columns with different metadata conventions
- Meaning: artifact unification is a target-state concern, not current v1 correctness work

---

## 8. Batch 6 Patch Outcome

The in-scope runtime defect fixed in this batch was:

- research trigger orchestration trusted the client flow and could execute on a plan that was still `generating` and `locked=false`

The current corrected behavior is:

- chat still hard-stops on `stage="generating"`
- research trigger now also enforces the lifecycle boundary and returns `409` before mutating state
- aggregate research status is now owned by the trigger route during fan-out
- aggregate partial failure no longer reports `"completed"`

This is the right Batch 6-level fix because it improves current correctness without pretending that a queue/event/replay platform already exists.

---

## 9. Final Result

Batch 6 closes with `PASS`.

That does not mean the target-state infrastructure exists. It means:

- the Batch 6 docs now accurately describe current runtime behavior
- the one live in-scope orchestration defect found during localhost verification was fixed
- the remaining Batch 6 differences are explicitly classified rather than left as hidden drift
- the batch was re-audited after patching and no unclassified in-scope mismatch remained
