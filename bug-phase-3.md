# Phase 3 Bug Log

## Resolved In This Session

### PHASE3-RUNTIME-001
- **Symptom:** `GET /api/progress` exposed `post_arrival_progress` for a `collecting` plan because hidden `settling_in_tasks` rows were counted even before arrival.
- **Impact:** Pre-arrival users could see misleading post-arrival completion percentages while `GET /api/settling-in` simultaneously hid the task surface.
- **Resolution:** `lib/gomate/progress.ts` now suppresses post-arrival and compliance progress unless the authoritative stage is `arrived`. `GET /api/progress` also returns a separate `post_arrival_state.hidden` summary instead of leaking that work into visible progress.

### PHASE3-RUNTIME-002
- **Symptom:** `POST /api/settling-in/[id]/why-it-matters` could still return `200` for a task that belonged to a non-arrived plan if the caller knew the task ID.
- **Impact:** Enrichment did not share the same execution-stage contract as the rest of the settling-in surface.
- **Resolution:** The route now verifies the owning plan is `arrived` and rejects hidden/pre-arrival task enrichment with `400`.

### PHASE3-RUNTIME-003
- **Symptom:** Compliance and task surfaces derived deadline/urgency state along split server/client paths.
- **Impact:** Alerts, timeline, and task cards could drift from each other.
- **Resolution:** `lib/gomate/post-arrival.ts` now computes canonical execution/compliance status on the server, and the timeline/alerts consume those server-derived fields.

### PHASE3-RUNTIME-004
- **Symptom:** `PATCH /api/settling-in/[id]` accepted a client-supplied `status: "overdue"`.
- **Impact:** A derived system state could be mutated directly by clients.
- **Resolution:** The PATCH route now only accepts user-controlled states (`available`, `in_progress`, `completed`, `skipped`). `overdue` remains server-derived.

## Open

- No new Phase 3-scoped open runtime bug remains after the backend verification pass.
