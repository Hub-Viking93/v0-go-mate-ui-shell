# Phase 1 — P0 Security Fixes

**Status:** Not started
**Prerequisite:** Phase 0 complete ✅ (2026-02-28)
**Specification authority:** `docs/build-protocol.md` § "Phase 1 — P0 Security Fixes"
**Gate protocol:** `docs/phase-implementation-protocol.md`

---

## Rationale

Two P0 gaps make the system unsafe for real users:
- Any authenticated user can grant themselves Pro+ tier for free — no payment required (INV-S1 violated)
- Subscription expiry enforcement was believed missing but is already implemented (INV-S2 is already met — no change needed)

Two additional gaps make core functionality broken:
- PDF guide download renders `undefined` in all section fields for every user (INV-D5 / INV-F1 violated)
- Open redirect in `/auth/callback` allows attackers to redirect authenticated users to external sites (INV-S3 violated)
- Middleware auth errors silently allow all requests through rather than redirecting to error page (INV-S4 violated)

---

## Entry Criteria

Before starting Phase 1, verify ALL of the following are true:

```
[ ] docs/phase-status.md shows Phase 0 ✅ Complete
[ ] All three migrations 011/012/013 are applied to the live Supabase database
[ ] SELECT column_name FROM information_schema.columns WHERE table_name = 'settling_in_tasks'
    returns: steps, documents_needed, cost
[ ] SELECT column_name FROM information_schema.columns WHERE table_name = 'relocation_plans'
    returns: visa_research, local_requirements_research, document_statuses
[ ] .env.local is configured (or: vercel env pull .env.local has been run)
[ ] pnpm dev starts without TypeScript errors blocking compilation
```

If any criterion is not met, resolve it before writing any code.

---

## Files to Change

| File | Action | Gap(s) fixed |
|---|---|---|
| `app/api/subscription/route.ts` | Remove `POST` handler entirely | G-4.3-D |
| `app/api/profile/route.ts` (lines 110–131) | Replace `generateGuideFromProfile` insert with `generateGuide + guideToDbFormat` | G-6.2-D, G-4.1-G |
| `app/auth/callback/route.ts` | Add allowlist validation on `next` parameter | G-6.1-C |
| `lib/supabase/middleware.ts` | Replace catch block `return supabaseResponse` with redirect to `/auth/error` | G-6.1-D |

## Files Verified (no change needed)

| File | Reason |
|---|---|
| `lib/gomate/tier.ts` | `getUserTier()` already enforces expiry at line 280 — G-4.3-B is a false gap, INV-S2 already met |
| `lib/gomate/pdf-generator.ts` | Correct — reads `visa_section`, `budget_section`, etc. from DB row |
| `app/(app)/guides/[id]/page.tsx` | Correct — reads section columns from DB; only the insert was broken |

## Files to NOT Touch

- The Supabase auth flow (login, signup, session refresh)
- `lib/supabase/middleware.ts` beyond the catch block
- Any API route not listed above
- The tier check in `app/api/chat/route.ts` (already correct)
- All migration files

---

## Exact Changes Required

### 1. `app/api/subscription/route.ts` — Remove POST handler

Remove the entire `export async function POST(req: Request) { ... }` function.

Keep the `GET` handler — it is used by the UI to fetch subscription info and feature flags.

After the fix: `POST /api/subscription` returns `405 Method Not Allowed`. This is intentional. No upgrade UI should be functional before Stripe is integrated.

**Important:** The vulnerability is in `POST`, not `PATCH`. `PATCH /api/subscription` does not exist.

---

### 2. `app/api/profile/route.ts` — Fix guide insert on plan lock

**Location:** lines 110–131, inside the `action === "lock"` branch.

**Current broken code:**
```typescript
import { generateGuideFromProfile } from "@/lib/gomate/guide-generator"
// ...
const guideData = generateGuideFromProfile(profile)
await supabase.from("guides").insert({
  user_id: user.id,
  plan_id: currentPlan.id,
  title: guideData.title,
  destination: guideData.destination,
  purpose: guideData.purpose,
  sections: guideData.sections,  // ← column does not exist; silently ignored
})
```

**Fix — use the same pattern as `app/api/guides/route.ts`:**
```typescript
import { generateGuide, guideToDbFormat } from "@/lib/gomate/guide-generator"
// ...
const guide = generateGuide(profile)
const dbData = guideToDbFormat(guide, user.id, currentPlan.id)
await supabase.from("guides").insert(dbData)
```

Remove the `generateGuideFromProfile` import from this file after the change.

---

### 3. `app/auth/callback/route.ts` — Add redirect allowlist

**Current broken code:**
```typescript
const next = searchParams.get("next") ?? "/dashboard"
return NextResponse.redirect(`${origin}${next}`)
```

**Fix:**
```typescript
const ALLOWED_REDIRECTS = [
  '/', '/dashboard', '/chat', '/settling-in',
  '/guides', '/profile', '/settings', '/booking'
]
const rawNext = searchParams.get("next") ?? "/dashboard"
const next = ALLOWED_REDIRECTS.includes(rawNext) ? rawNext : "/dashboard"
return NextResponse.redirect(`${origin}${next}`)
```

---

### 4. `lib/supabase/middleware.ts` — Fix catch block

**Location:** catch block around line 68–72.

**Current broken code:**
```typescript
} catch (error) {
    console.error("[GoMate] Middleware auth error:", error)
    // On any error, allow the request to proceed
    return supabaseResponse  // ← NextResponse.next() — passes request through
}
```

**Fix:**
```typescript
} catch (error) {
    console.error("[GoMate] Middleware auth error:", error)
    const url = request.nextUrl.clone()
    url.pathname = "/auth/error"
    url.searchParams.set("message", "Authentication error")
    return NextResponse.redirect(url)
}
```

The `/auth/error` page already exists (`app/auth/error/page.tsx`). Do not create a new one.

---

## Gap Codes Fixed in This Phase

| Code | System | Severity | Description |
|---|---|---|---|
| G-4.3-D | Subscription | P0 | Any user can self-upgrade for free via POST /api/subscription |
| G-6.2-D | End-to-End | P0 | Guide insert on plan lock uses wrong schema key (`sections`) |
| G-4.1-G | Guide Generation | P0 | PDF renders 4 fields as `undefined` for every user (root cause: G-6.2-D) |
| G-6.1-C | Auth | P1 | Open redirect in /auth/callback — `next` param not validated |
| G-6.1-D | Auth | P1 | Middleware error silently allows all requests through |

**False gap resolved (no change needed):**
- G-4.3-B — Subscription expiry: `getUserTier()` already enforces expiry at `lib/gomate/tier.ts:280`

---

## V1 Invariants This Phase Satisfies

| Invariant | Description | How verified |
|---|---|---|
| INV-S1 | No user can self-grant a higher tier | POST /api/subscription → 405 |
| INV-S2 | Expired subscription degrades to free | Already met — no change needed |
| INV-S3 | /auth/callback validates `next` before redirecting | /auth/callback?next=//evil.com → /dashboard |
| INV-S4 | Middleware errors redirect to error page | Trigger auth error → /auth/error |
| INV-D5 | Guide PDF renders all sections without undefined | GET /api/guides/{id} → non-null visa_section, budget_section |
| INV-F1 | PDF download renders a complete document | Download PDF from /guides/[id] → all sections present |

---

## Exit Criteria (Success Criteria from `docs/build-protocol.md`)

All of the following must be true before Phase 1 can be declared complete:

```
[ ] POST /api/subscription with { action: "upgrade", tier: "pro_plus" } returns 405
[ ] GET /api/subscription still returns subscription info and feature access flags (not broken)
[ ] GET /api/guides/{id} returns guide with non-null visa_section, budget_section, housing_section
[ ] Guide PDF download renders a complete document — no undefined fields visible
[ ] GET /auth/callback?next=//evil.com redirects to /dashboard (not to evil.com)
[ ] GET /auth/callback?next=/dashboard redirects to /dashboard (valid path still works)
[ ] Triggering a middleware auth error redirects to /auth/error (not allows through)
[ ] No regression in login, signup, or OAuth callback flows
[ ] tsc --noEmit passes with zero errors
```

---

## Required Gate Artifacts

These three files must exist and be complete before Phase 1 can be declared COMPLETE:

| Artifact | Owner | Gate |
|---|---|---|
| `backend-acceptance-phase-1.md` | Claude Code | Backend Acceptance Gate (gate 2) |
| `frontend-wiring-report-phase-1.md` | Claude Code | Frontend Wiring Gate (gate 3) |
| `regression-report-phase-1.md` | Claude Code + User | Regression Gate (gate 6) |

Plus: `PHASE_1_USER_TEST.md` (User Test Spec Gate, gate 4).

---

## No Migration Required

Phase 1 makes no database schema changes. No SQL migration file needs to be created or applied. The next migration number remains **015**.
