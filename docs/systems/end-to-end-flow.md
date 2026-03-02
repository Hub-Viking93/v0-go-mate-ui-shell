# End-to-End Flow — System Document (Reality Version)

**Phase:** 6.2
**Status:** Reality-first
**Primary sources:**
- `middleware.ts`, `lib/supabase/middleware.ts` — session + route guard (Phase 6.1)
- `app/auth/sign-up/page.tsx`, `app/auth/callback/route.ts` — signup (Phase 6.1)
- `app/api/profile/route.ts` (207 lines) — plan initialization, profile update, plan lock
- `app/api/chat/route.ts` (537 lines) — conversation, extraction, streaming
- `app/api/research/trigger/route.ts` — research orchestration (Phase 3.1)
- `app/api/research/visa/route.ts`, `app/api/research/local-requirements/route.ts`, `app/api/research/checklist/route.ts` — sub-research routes (Phase 3.1–3.3)
- `lib/gomate/guide-generator.ts` — guide generation (Phase 4.1)
- `lib/gomate/state-machine.ts`, `lib/gomate/profile-schema.ts` — profile state (Phase 3.2)
- `scripts/001–009_*.sql` — database schema
**Last audited:** 2026-02-25

---

## 1. Overview

The GoMate user journey has five distinct stages:

1. **Account creation** — sign-up, email verification, profile row creation
2. **Plan initialization** — first dashboard load creates a relocation plan
3. **Chat interview** — conversation loop: extraction → profile update → streaming response
4. **Plan lock** — user confirms profile → guide generated → research triggered
5. **Post-lock state** — guide browsing, research results, checklist tracking (partially functional)

This document traces the actual data path through each stage as implemented. It does not describe intended or target behavior.

---

## 2. Stage 1: Account Creation

```
User visits /auth/sign-up
│
├── Client: supabase.auth.signUp({ email, password, emailRedirectTo: origin + "/auth/callback" })
│
├── Supabase: creates auth.users row
├── DB trigger: on_auth_user_created fires →
│   inserts public.profiles(id, email, first_name=null, last_name=null)
│
├── Client: navigates to /auth/sign-up-success (static page, no state)
│
└── User clicks email link → GET /auth/callback?code=xxx&next=/dashboard
    ├── supabase.auth.exchangeCodeForSession(code)
    ├── Session cookies written to response
    └── redirect to /dashboard
```

### Data created at end of Stage 1:

| Table | Row | Content |
|---|---|---|
| `auth.users` | New row | Supabase-managed (email, encrypted password, UUID) |
| `public.profiles` | New row | `id` = user UUID, `email`, `first_name` = null, `last_name` = null |
| `relocation_plans` | None yet | Not created until Stage 2 |

**Key gap:** `first_name` and `last_name` are always null after signup — the sign-up form does not collect them and `raw_user_meta_data` is empty. The `profiles` table is effectively unused beyond `email`.

---

## 3. Stage 2: Plan Initialization

```
GET /dashboard (first load)
│
├── Middleware: updateSession() → getUser() → authenticated → proceed
│
├── Dashboard component mounts
│   (some component calls GET /api/profile)
│
└── GET /api/profile
    ├── supabase.auth.getUser() → user
    ├── SELECT * FROM relocation_plans WHERE user_id=? AND is_current=true
    ├── No plan found →
    │   INSERT relocation_plans {
    │     user_id,
    │     profile_data: {},
    │     stage: "collecting",
    │     is_current: true
    │   }
    └── Return { plan: newPlan }
```

### Data created at end of Stage 2:

| Table | Row | Content |
|---|---|---|
| `relocation_plans` | New row | `profile_data: {}`, `stage: "collecting"`, `is_current: true`, `locked: false` |

**Key gap:** Plan creation in `GET /api/profile` is not idempotent-safe. If two concurrent requests hit `GET /api/profile` simultaneously for the same user with no existing plan, two plans may be inserted. The partial unique index on `(user_id) WHERE is_current = true` prevents both from having `is_current = true`, but the second insert would fail with a constraint error rather than being deduplicated. No locking mechanism exists.

---

## 4. Stage 3: Chat Interview

The chat interview is the core data collection loop. Each user message goes through the same sequence:

```
POST /api/chat
{ messages: UIMessage[], profile?: Profile, confirmed?: boolean }
│
├── Check OPENAI_API_KEY (return 500 if missing)
│
├── Initialize profile: incomingProfile || EMPTY_PROFILE
│
├── Inline auth check (Supabase):
│   SELECT locked, profile_data FROM relocation_plans
│   WHERE user_id=? AND is_current=true
│   → if plan.locked: set planLocked=true, use locked profile_data
│
├── Extract profile data (if !planLocked && !confirmed):
│   ├── extractProfileData(lastUserText, currentProfile) → GPT-4o-mini
│   │   Model: gpt-4o-mini
│   │   Format: response_format: { type: "json_object" }
│   │   Output: { fields: {...}, confidence: {...} }
│   │
│   ├── updateProfile(profile, extractedFields) → merged profile
│   │
│   └── saveProfileToSupabase(profile) → PATCH relocation_plans.profile_data
│
├── Determine interview state:
│   ├── isProfileComplete(profile) = false → "interview"
│   ├── isProfileComplete(profile) = true && !confirmed → "review"
│   └── isProfileComplete(profile) = true && confirmed → "complete"
│
├── buildSystemPrompt(profile, pendingField, interviewState)
│
├── Compute metadata (all synchronous except extraction):
│   ├── getRelevantSources(lastUserText, destination) — source linker
│   ├── getVisaStatus(citizenship, destination) — visa checker
│   ├── getOfficialSourcesArray(destination) — official sources
│   ├── getProgressInfo(profile) — field completion tracking
│   ├── generateProfileSummary(profile) — if complete
│   ├── generateVisaRecommendation(profile) — if complete
│   ├── getCostOfLivingData(destination, targetCity) — if complete
│   ├── calculateMonthlyBudget(profile, costData) — if complete
│   ├── calculateSavingsTarget(profile, budget) — if complete
│   └── generateResearchReport(profile) — if complete
│
├── POST https://api.openai.com/v1/chat/completions (gpt-4o, stream: true)
│
├── TransformStream: OpenAI SSE → GoMate SSE format
│   ├── message-start event
│   ├── text-delta events (content tokens)
│   └── message-end event (carries full metadata bundle)
│
└── Return Response(stream, {
      "Content-Type": "text/event-stream",
      "X-GoMate-Profile": encodeURIComponent(JSON.stringify(profile)),
      "X-GoMate-State": interviewState,
    })
```

### 4.1 Profile Completeness Check

`isProfileComplete()` uses the `state-machine.ts` logic. The API route also has its own completeness check in `PATCH /api/profile`:

```typescript
const requiredFields = [
  "name", "citizenship", "current_location", "destination", "purpose",
  "sub_purpose", "duration", "timeline", "budget", "dependents",
  "language_skill", "work_eligibility", "education", "prior_visa", "special_needs"
]
const filledCount = requiredFields.filter(f => mergedProfile[f]).length
const isComplete = filledCount === requiredFields.length
```

When all 15 fields are non-empty, `stage` is updated to `"generating"`.

**Gap:** The chat route uses `isProfileComplete()` from `state-machine.ts` to determine interview state. The profile PATCH route uses a separate hardcoded field list. If these two completeness definitions diverge, a profile can appear complete in chat but incomplete to the PATCH route (or vice versa).

### 4.2 Profile Persistence in Chat

`saveProfileToSupabase()` is called after every extraction that produces at least one field. This function (in `lib/gomate/supabase-utils.ts`) updates `relocation_plans.profile_data` for the current user's active plan.

**Key gap:** The client sends the full profile in every `POST /api/chat` request body. The server-side profile is loaded from the DB only to check lock status. The working profile is the client-supplied one, not the DB one. This means:
- If client-side state is lost (page refresh), profile data resets to DB state
- The DB is updated per-turn but only with extracted fields — not the full submitted profile
- There is no chat turn history stored in the database. The conversation lives entirely in client React state.

### 4.3 Cost of Living Data (Per-Turn)

`getCostOfLivingData()` is called on every chat turn when the profile is complete. This function (from `lib/gomate/web-research.ts`) returns hardcoded or Numbeo-derived data depending on configuration. It runs synchronously before the stream response. There is no caching — the data is recomputed on every turn.

### 4.4 Data State After Each Chat Turn

| Storage | Updated by | Content |
|---|---|---|
| `relocation_plans.profile_data` | `saveProfileToSupabase()` | Merged profile fields extracted this turn |
| `relocation_plans.stage` | PATCH `/api/profile` only | Not updated by chat route |
| Client React state | `message-end` metadata | Full profile, interview state, extraction feedback |
| Database chat history | Not stored | Only in client state |

---

## 5. Stage 4: Plan Lock

When the user confirms their profile in the review state, the client sends:

```
PATCH /api/profile
{ action: "lock", planId?: string }
```

```
PATCH /api/profile (action="lock")
│
├── auth check
├── SELECT * FROM relocation_plans WHERE user_id=? AND (planId OR is_current=true)
│
├── UPDATE relocation_plans SET
│   { locked: true, locked_at: now(), stage: "complete", updated_at: now() }
│
├── Auto-generate guide (try/catch — failure is swallowed):
│   ├── Check profile.destination exists
│   ├── SELECT id FROM guides WHERE plan_id=?  → check if guide already exists
│   ├── If no existing guide:
│   │   generateGuideFromProfile(profile)  → Guide object
│   │   INSERT INTO guides {
│   │     user_id, plan_id, title, destination, purpose,
│   │     sections: guideData.sections   ← see G-6.2-D
│   │   }
│   └── catch: console.error("[GoMate] Error auto-generating guide:") — silent swallow
│
└── Return { plan: lockedPlan }
```

### 5.1 Stage at Lock

| Field | Before lock | After lock |
|---|---|---|
| `locked` | false | true |
| `locked_at` | null | ISO timestamp |
| `stage` | "generating" (or "collecting") | "complete" |
| `status` | null | still null — never set to "completed" |

**Gap:** `status` is a column added in migration 009 with possible values "active" | "archived". It is never explicitly set by the lock action or any other route. The `status` field for a locked plan remains null.

### 5.2 Post-Lock Research Trigger

After the plan is locked, the client triggers research separately. The research trigger is called from the frontend after receiving the locked plan response. It is not called from the profile lock route.

```
POST /api/research/trigger { planId }
│
├── auth check
├── Weak dedup: return early if research_status === "in_progress"
├── UPDATE relocation_plans SET research_status = "pending"
│
├── Resolve base URL (NEXT_PUBLIC_APP_URL || request origin)
│
├── Promise.allSettled([
│     fetch(baseUrl + "/api/research/visa", { method:"POST", Cookie: forwarded })
│     fetch(baseUrl + "/api/research/local-requirements", { method:"POST", Cookie: forwarded })
│     fetch(baseUrl + "/api/research/checklist", { method:"POST", Cookie: forwarded })
│   ])  ← maxDuration: 60s
│
├── If any succeeded: UPDATE research_status = "completed"
├── If all failed:   UPDATE research_status = "failed"
│
└── Return { success, results }
```

Each sub-route (visa, local-requirements, checklist) runs independently:
- Fetches from external APIs (Firecrawl, OpenAI/Anthropic)
- Falls back to empty/default data on failure (silently)
- Writes results to `relocation_plans` JSONB columns

Research results storage:

| Column | Written by | Schema |
|---|---|---|
| `visa_research` | `POST /api/research/visa` | `{ visaOptions, generalRequirements, importantNotes }` |
| `local_requirements_research` | `POST /api/research/local-requirements` | `{ categories, generalTips, importantDeadlines }` |
| `checklist_items` | `POST /api/research/checklist` | `ChecklistItem[]` |

None of these three columns are documented in the TypeScript `RelocationPlan` interface.

---

## 6. Stage 5: Post-Lock State

After lock and research, the user can:
- View the generated guide at `/guides`
- Browse the checklist at `/documents`
- Use the chat in locked mode (extraction skipped)

### 6.1 Guide Display

```
GET /api/guides (user's guides)
→ Returns all guides for user_id
→ UI renders guide sections from JSONB columns
```

The guide was generated in Stage 4 via `generateGuideFromProfile()`. It uses static TypeScript templates covering 6 countries (Germany, Netherlands, Spain, Portugal, Sweden, Japan). All other destinations use `DEFAULT_COUNTRY_DATA` — a generic template.

### 6.2 Research Display

Research results are read from `relocation_plans` JSONB columns by the relevant API routes:
- `GET /api/research/visa` — returns `plan.visa_research`
- `GET /api/research/local-requirements` — returns `plan.local_requirements_research`
- `GET /api/research/checklist` — returns `plan.checklist_items`

No normalization occurs on read for visa and checklist. Local requirements GET normalizes between two historical data shapes.

### 6.3 Checklist Progress

The `checklist_progress` table (migration 003) exists to track per-item completion. It has no API routes. Checklist completion tracking is non-functional. See Phase 4.5, G-4.5-A.

### 6.4 Locked Chat Behavior

When a user sends a message to a locked plan:
- Extraction is skipped (`planLocked = true`)
- The locked profile data is used for all metadata computation
- GPT-4o streams a response based on the locked profile context
- No profile updates occur

---

## 7. Complete Data Model After Full Journey

At the end of the full user journey, the database state:

| Table | Rows | Key fields |
|---|---|---|
| `auth.users` | 1 | id, email, encrypted_password |
| `public.profiles` | 1 | id (= user_id), email, first_name=null, last_name=null |
| `relocation_plans` | 1 (+ any archived) | profile_data, stage="complete", locked=true, is_current=true, visa_research, local_requirements_research, checklist_items, research_status="completed" |
| `guides` | 1 | title, destination, purpose, sections (or individual columns — see G-6.2-D) |
| `checklist_progress` | 0 | No rows ever written (no API) |
| `user_subscriptions` | 0 or 1 | tier="free" unless manually upgraded |

---

## 8. Cross-Cutting Observations

### 8.1 No Chat History Persistence

Conversation history is never written to the database. Every `POST /api/chat` receives the full message history from the client. If the client loses state (refresh, browser close), the conversation is gone. There is no way to resume a conversation from the server side.

### 8.2 Two AI Models in Parallel Per Turn

A single chat turn makes two OpenAI API calls:
1. `gpt-4o-mini` — profile extraction (`extractProfileData()`)
2. `gpt-4o` — chat response (streaming)

Both are sequential: extraction completes before the streaming call starts. If extraction fails (network, rate limit), it returns `null` and the streaming call proceeds anyway.

### 8.3 No Request Correlation

No trace_id links the extraction call to the streaming call within a single chat turn, or links any turn to the profile save operation. If the extraction succeeds but the Supabase save fails, there is no observable link between the two events in logs. See Phase 5.2.

### 8.4 Research Runs Against the DB Profile

The research trigger sub-routes read `profile_data` from the database. If a chat turn's extraction succeeded but `saveProfileToSupabase()` failed, the research runs against a stale profile. There is no consistency check between the profile used for lock and the profile used for research.

### 8.5 Stage Field Is Not a State Machine

The `stage` field transitions:
- "collecting" → auto-set to "generating" when 15 fields are complete (in PATCH `/api/profile`)
- "generating" → "complete" on plan lock (in PATCH `/api/profile` with action="lock")

There is no enforcement of valid transitions — any PATCH with a direct `stage` value could set it to any string. The stage is also out of sync with the chat `interviewState` field which uses "interview" | "review" | "complete" (different vocabulary).

---

## 9. Gap Analysis — Critical Findings

### G-6.2-A: No chat history persistence

Conversation is client-only. Server has no record of what was said. Debugging user issues requires the user to reproduce the conversation. The profile extracted fields are stored but the messages that produced them are not.

### G-6.2-B: Profile completeness defined in two places

`state-machine.ts::isProfileComplete()` and the `requiredFields` array in `PATCH /api/profile` must stay in sync manually. Divergence causes stage/state inconsistency without any error.

### G-6.2-C: Research results stored in undocumented columns

`visa_research`, `local_requirements_research`, and `checklist_items` are JSONB columns on `relocation_plans` that are written by research routes but absent from:
- The `RelocationPlan` TypeScript interface
- The `requiredFields` completeness check
- Any documented migration (visa_research and local_requirements_research are not in any .sql file)

### G-6.2-D: Guide insert in lock handler uses wrong schema

The profile lock handler calls `generateGuideFromProfile(profile)` and inserts with `sections: guideData.sections`. The `Guide` interface from `guide-generator.ts` has individual section properties (`overview`, `visa_section`, `budget_section`, etc.), not a unified `sections` property. The `sections` key does not match any column in the `guides` table (migration 005 has individual columns). This insert either:
- Fails silently (Supabase ignores unknown keys in JSONB mode), or
- Succeeds but stores nothing in the individual section columns

The catch block in the lock handler swallows this error. Guide auto-generation on lock may be a no-op.

**Note:** The `POST /api/guides` route uses `guideToDbFormat()` which correctly maps to individual columns. The two guide-writing paths have different insert shapes.

### G-6.2-E: Plan creation race condition in GET /api/profile

Concurrent first loads for the same user can trigger two INSERT attempts. The second fails at the partial unique index constraint. The error is caught and logged but the response to the second request is a 500. On a slow connection with the user double-clicking, this can produce a visible error on first load.

### G-6.2-F: Research trigger is not called by server on lock

Plan lock (PATCH `/api/profile` action="lock") does not trigger research. Research is triggered separately by the client after receiving the lock response. If the client fails to make the research trigger call (network error, page navigation), research never runs for that plan. There is no server-side mechanism to detect a locked plan with no research and trigger research retroactively.

### G-6.2-G: Cost of living recomputed every chat turn

`getCostOfLivingData()` runs synchronously on every chat turn once the profile is complete. This is a blocking computation before the streaming response begins. For Numbeo-backed data (which uses a fetch), this adds latency to every streaming call for complete profiles.

---

## 10. End-to-End Happy Path Summary

| Step | Entry point | Key operation | Data written |
|---|---|---|---|
| 1 | `/auth/sign-up` | `supabase.auth.signUp()` | `auth.users`, `public.profiles` |
| 2 | `/auth/callback` | `exchangeCodeForSession()` | Session cookies |
| 3 | GET `/api/profile` | Create plan | `relocation_plans` (empty profile) |
| 4–N | POST `/api/chat` | Extract fields, update profile | `relocation_plans.profile_data` |
| N+1 | PATCH `/api/profile` (lock) | Lock plan, generate guide | `relocation_plans.locked=true`, `guides` row |
| N+2 | POST `/api/research/trigger` | Run 3 research sub-tasks | `relocation_plans.visa_research`, `.local_requirements_research`, `.checklist_items` |
| N+3 | GET `/api/guides` | Load guide | — (read only) |

Total database writes for a complete session: ~5–20 rows/updates across 4 tables.
Total external API calls: 2 per chat turn (extraction + streaming) + 2–10 Firecrawl calls + 3 AI calls during research.
