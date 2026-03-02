# Phase 5 — UI Integrity

**Status:** Not started
**Prerequisite:** Phase 4 complete
**Specification authority:** `docs/build-protocol.md` § "Phase 5 — UI Integrity"
**Gate protocol:** `docs/phase-implementation-protocol.md`

---

## Rationale

Three UI-layer gaps remain after Phase 4:

1. **Compliance alert dismissal resets on every page navigation** — dismissal is stored in component `useState`, which is destroyed on unmount. The user dismisses the alert, navigates away, and it reappears. `localStorage` is the v1 target (server-side table is deferred to v2).

2. **Why-it-matters enrichment has no rate limiting** — any authenticated user can call the enrichment endpoint indefinitely, incurring unbounded AI costs.

3. **Booking page always uses mock data** — whether real flight search can be wired depends on whether `GET /api/flights` is functional (it may not be). Read the code first; document the outcome either way.

---

## Entry Criteria

Before starting Phase 5, verify ALL of the following are true:

```
[ ] docs/phase-status.md shows Phase 4 ✅ Complete
[ ] backend-acceptance-phase-4.md exists and is final
[ ] frontend-wiring-report-phase-4.md exists and is final
[ ] regression-report-phase-4.md exists and is final
[ ] lib/gomate/fetch-with-retry.ts exists and is in use by settling-in-generator.ts
[ ] All Firecrawl calls in lib/gomate/ have timeout + retry (Phase 4 confirmed)
```

---

## Files to Change

| File | Action | Gap(s) fixed |
|---|---|---|
| `components/compliance-alerts.tsx` | Replace `useState(false)` dismissal with `localStorage`-backed state | G-10.3-B |
| `app/api/settling-in/[id]/why-it-matters/route.ts` | Add per-plan enrichment count check; return 429 when limit exceeded | G-9.5-A |
| `app/(app)/booking/page.tsx` | Investigate mock flag; remove it if `GET /api/flights` is functional | G-7.1-E (conditional) |

## Files to NOT Touch

- Settling-in task card UI
- Compliance timeline rendering (`components/compliance-timeline.tsx`)
- Post-arrival chat mode
- Any route not listed above
- All migration files

---

## Exact Changes Required

### 1. `components/compliance-alerts.tsx` — Persist dismissal to localStorage

**Gap:** G-10.3-B. Current state is `useState(false)` — resets on unmount.

**Fix:** Replace with localStorage-backed initialization:

```typescript
const DISMISS_KEY = 'gomate:compliance-alerts-dismissed'

const [dismissed, setDismissed] = useState(() => {
  // SSR guard: localStorage is only available in the browser
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DISMISS_KEY) === 'true'
})

function handleDismiss() {
  localStorage.setItem(DISMISS_KEY, 'true')
  setDismissed(true)
}
```

Replace all calls to the existing dismiss handler with `handleDismiss()`.

**Scope boundary:** This is v1's target — localStorage, per-browser. Do NOT create a `compliance_alert_dismissals` server-side table. That is explicitly deferred to v2.

**Note:** If multiple compliance alerts exist per plan, the dismiss key may need to include the plan ID (e.g. `gomate:compliance-alerts-dismissed:${planId}`). Read the component before deciding — use a plan-scoped key if the component has access to planId.

---

### 2. `app/api/settling-in/[id]/why-it-matters/route.ts` — Add rate limiting

**Gap:** G-9.5-A. No per-user rate limiting on the enrichment endpoint.

**Fix:** Count how many tasks in the plan already have `why_it_matters` populated. If the count is at or above the limit, reject with 429.

```typescript
// After fetching the task and verifying plan ownership:
const { count } = await supabase
  .from('settling_in_tasks')
  .select('id', { count: 'exact', head: true })
  .eq('plan_id', task.plan_id)
  .not('why_it_matters', 'is', null)

const ENRICHMENT_LIMIT = 20

if ((count ?? 0) >= ENRICHMENT_LIMIT) {
  return NextResponse.json(
    { error: 'Enrichment limit reached for this plan' },
    { status: 429 }
  )
}
```

**What this counts:** Tasks that have already been enriched for this plan. This is a proxy for "how many enrichment API calls have been made" — it slightly undercounts (the current task hasn't been enriched yet when we check), but is a reasonable guard without a separate counter table.

**Adjust `ENRICHMENT_LIMIT` based on cost tolerance.** 20 is a sensible starting point for a typical settling-in task list (most plans have 20–40 tasks; enriching all is unusual).

---

### 3. `app/(app)/booking/page.tsx` — Investigate and assess

**Gap:** G-7.1-E. The booking page appears to always use mock/fake flight data.

**Before making any change, read:**
- `app/(app)/booking/page.tsx` — find the mock flag or hardcoded data
- `app/api/flights/route.ts` — determine if the route returns real Firecrawl results or mocked data

**Decision tree:**

**If `GET /api/flights` returns real Firecrawl results:**
- Remove the mock flag from the booking page
- Verify real search results appear in the UI
- Document in the phase completion artifact

**If `GET /api/flights` returns mock data, has no real integration, or has blocking gaps:**
- Do not build a flight search integration in this phase
- Add a comment in `app/(app)/booking/page.tsx`: `// TODO v2: connect to real flight search`
- Document in the phase completion artifact that booking remains mock and is parked for v2

**Do not build a flight search API in this phase regardless of outcome.**

---

## Gap Codes Fixed in This Phase

| Code | System | Severity | Description |
|---|---|---|---|
| G-10.3-B | Compliance | P2 | Alert dismissal not persisted — resets on every navigation |
| G-9.5-A | Enrichment | P2 | No rate limiting on why-it-matters endpoint |
| G-7.1-E | Frontend | P1 | Booking page always uses mock data (conditional — fixed only if flight API is functional) |

---

## V1 Invariants This Phase Satisfies

Phase 5 has no direct V1 security or data invariants. It completes the functional correctness baseline and is the final phase before v1 is considered production-ready.

---

## Post-Phase 5 — Final V1 Verification

After Phase 5 completes, verify ALL V1 invariants from `docs/audit.md § 2`:

```
INV-S1: POST /api/subscription with { tier: "pro_plus" } by free user → 405 or 403
INV-S2: getUserTier() for expired subscription → 'free' (already verified in Phase 1)
INV-S3: /auth/callback?next=//evil.com → redirects to /dashboard
INV-S4: Middleware auth error → redirects to /auth/error (not allows through)

INV-D1: Every DB column referenced in application code has a migration in scripts/
INV-D2: POST /api/settling-in/generate with stage != 'arrived' → 400
INV-D3: PATCH /api/settling-in/{id} with stage != 'arrived' → 400
INV-D4: Cyclical AI task graph → falls back to defaults without throwing
INV-D5: GET /api/guides/{id} returns non-null visa_section, budget_section, housing_section

INV-F1: PDF download from /guides/[id] renders all sections — no undefined fields
INV-F2: Free-tier user cannot call Pro+ API endpoints
INV-F3: Post-arrival chat activates iff plan.stage === 'arrived'
INV-F4: Task dependency unlock is correct after every task completion
```

All 12 invariants must pass before v1 is declared production-ready.

---

## Exit Criteria (Success Criteria from `docs/build-protocol.md`)

All of the following must be true before Phase 5 can be declared complete:

```
[ ] Compliance alert dismissed in one browser session remains dismissed after page reload
[ ] Compliance alert dismissed in one tab remains dismissed after navigating away and returning
[ ] localStorage key 'gomate:compliance-alerts-dismissed' (or plan-scoped variant) is set on dismiss
[ ] GET /api/settling-in/{id}/why-it-matters called 21+ times on the same plan returns 429
[ ] Normal enrichment (< 20 per plan) still returns 200 with why_it_matters content
[ ] Booking page assessment documented in phase completion artifact (real or v2)
[ ] All 12 V1 invariants verified (see list above)
[ ] No regression in compliance timeline rendering
[ ] No regression in why-it-matters enrichment for normal usage
[ ] tsc --noEmit passes with zero errors
```

---

## Required Gate Artifacts

| Artifact | Owner | Gate |
|---|---|---|
| `backend-acceptance-phase-5.md` | Claude Code | Backend Acceptance Gate (gate 2) |
| `frontend-wiring-report-phase-5.md` | Claude Code | Frontend Wiring Gate (gate 3) |
| `regression-report-phase-5.md` | Claude Code + User | Regression Gate (gate 6) |

Plus: `PHASE_5_USER_TEST.md` (User Test Spec Gate, gate 4).

---

## No Migration Required

Phase 5 makes no database schema changes. No SQL migration file needs to be created or applied. The next migration number remains **015**.

---

## v1 Complete

When all Phase 5 gate artifacts exist and the User declares **User Acceptance PASSED**, GoMate v1 is production-ready.

Update `docs/phase-status.md` to mark Phase 5 ✅ Complete. The system is now safe for real users.
