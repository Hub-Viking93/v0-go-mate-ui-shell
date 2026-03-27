# GoMate — Onboarding System Definition

This document defines EXACT behavior, state model, and rules for the Onboarding system.

Onboarding is NOT a UI feature.
It is a STATE MACHINE that guarantees every user reaches first plan activation safely and deterministically.

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Onboarding flow exists via the state machine (lib/gomate/state-machine.ts)
  which drives the collecting/review/lock flow on an already-created current plan
- State machine transitions: collecting → generating → complete → arrived
- No formal LifecycleState enum — the spec references CREATED → ACTIVE
  transition which maps to plan creation + first generation in v1
- No onboarding_state table or explicit onboarding tracking — onboarding
  state is implicit in plan.stage
- No onboarding completion event — state machine handles transitions
  directly
- No strict pre-plan boundary in runtime — `/api/profile` may create the
  current plan before destination confirmation
- First-time user flow is functional, but plan creation happens early
  during plan bootstrap rather than only after interview completion

V1 Deviations from Canonical Spec:
- Section A (state machine): PARTIAL — state machine exists but uses
  plan.stage (collecting/generating/complete/arrived), not the spec's
  LifecycleState (CREATED/ACTIVE/LOCKED)
- Section B (success condition): PARTIAL — the spec defines
  plan.lifecycle_state = "ACTIVE" as success; v1 uses plan.stage =
  "complete" (guide generated)
- Section C (failure handling): PARTIAL — no explicit onboarding failure
  state; errors shown inline in chat UI
- Section D (progress tracking): NOT_IMPLEMENTED — no onboarding progress
  events; state machine transitions are the only progress indicator
- Section E (abandonment detection): NOT_IMPLEMENTED — no tracking of
  abandoned onboarding flows

V1 Cross-Reference Adjustments:
- Plan System: uses status + stage, not LifecycleState
- Progress System: no onboarding progress events
- Event System: does not exist — no onboarding events emitted
- Chat Interview System: the interview IS the onboarding in v1 — these
  are effectively the same system

V1 Fallback Behavior:
- Onboarding flow: works via the current-plan collecting → complete pipeline,
  not a strict pre-plan → post-plan handoff
- User guidance: chat interview guides user through field collection
- Completion: plan transitions to "complete" stage after generation,
  visible on dashboard
- No re-onboarding — user cannot restart the interview once plan exists

============================================================

---

# A. Scope & Success

## A1. Onboarding Goal (Minimum Aha Moment)

The onboarding goal is achieved when the user has:

- a relocation plan created (via Onboarding Interview completion)
AND
- at least one AI-generated structured output tied to that plan

Example outputs:

- checklist generated
- settling-in tasks generated
- recommendations generated

Minimum success condition in database:

plan.lifecycle_state = "ACTIVE" (plan has transitioned from CREATED to ACTIVE, meaning first generation completed)

AND

plan.first_output_generated = true

---

## A2. When Onboarding is Complete (Hard Condition)

Source of truth:

profiles.onboarding_completed = true

Set ONLY when:

EXISTS relocation_plans
WHERE user_id = current_user
AND lifecycle_state = "ACTIVE"
AND first_output_generated = true

Onboarding completion is PER USER, not per plan.

Once set to true, it remains true permanently for that user, even if all plans are later deleted or archived. The user has completed onboarding at least once and knows how the product works.

Rationale: A user who has completed onboarding once should not be forced through it again for subsequent plans. New plan creation for returning users uses the standard "Create new plan" flow, which triggers a new Onboarding Interview but does NOT reset onboarding_completed.

---

## A3. Happy Path vs Skip Path

Happy Path:

signup
→ onboarding starts
→ Onboarding Interview Chat begins (pre-plan phase; NO plan_id exists yet)
→ user answers interview questions
→ destination_country confirmed → Plan System creates plan (plan_id assigned)
→ user provides additional profile inputs (optional)
→ AI generates first output (guide, tasks, or recommendations)
→ plan transitions CREATED → ACTIVE
→ onboarding_completed = true

Skip Path:

signup
→ user leaves before Onboarding Interview completes

System state:

profiles.onboarding_completed = false
AND
user.current_plan_id = null (no plan exists because interview was not completed)

User is forced back into onboarding on next login.

Skip path NEVER marks onboarding complete.

---

## A4. Pre-Plan vs Post-Plan Boundary

The Onboarding System operates across a critical boundary:

PRE-PLAN PHASE (before plan creation):
- No plan_id exists.
- No plan-scoped artifacts can exist.
- The only permitted interaction is the Onboarding Interview Chat.
- The Plan Contextual Chat Assistant is disabled.
- Dashboard is locked.

POST-PLAN PHASE (after plan creation):
- plan_id exists.
- Plan-scoped artifacts can be created.
- Plan Contextual Chat is enabled.
- Dashboard shows plan data (once first generation completes).

The boundary between these phases is: Onboarding Interview completion → Plan System creates plan.

This boundary is ATOMIC. There is no intermediate state where "the interview is done but the plan doesn't exist yet." Interview completion and plan creation happen in the same transaction.

---

# B. Entry Points

User enters onboarding when ANY of the following is true:

Condition 1:

New signup (profiles.onboarding_completed does not exist or is false)

Condition 2:

profiles.onboarding_completed = false

Condition 3:

user.current_plan_id = null AND no non-DELETED plans exist for this user

Condition 4:

Plan exists with lifecycle_state = CREATED but no first_output_generated (plan was created but generation has not completed)

Condition 5:

user.current_plan_id = null AND non-DELETED plans exist (user must select a plan or create a new one — this is technically a plan-selection flow, not full onboarding, but the routing logic checks here)

---

## B1. User Creates Account but Never Starts Plan

System state:

profiles.onboarding_completed = false
AND
user.current_plan_id = null
AND
no relocation_plans exist for this user

Dashboard must show:

"Create your relocation plan"

Plan Contextual Chat is disabled (there is no plan to provide context for).

Onboarding Interview Chat is the ONLY available chat interaction.

User cannot bypass onboarding.

Clarification: "Chat is disabled" in this context means the Plan Contextual Chat Assistant (post-plan, plan-scoped). The Onboarding Interview Chat (pre-plan) IS available — it is the mechanism through which the user completes onboarding and creates a plan.

---

## B2. User Has Completed Onboarding Before but Has No Current Plan

System state:

profiles.onboarding_completed = true
AND
user.current_plan_id = null

This happens when all plans have been deleted or the user explicitly deselected the current plan.

Dashboard shows:

Plan selector if non-DELETED plans exist ("Select a plan or create a new one").
OR
New plan creation flow if no non-DELETED plans exist ("Create a new relocation plan").

This is NOT a full onboarding re-entry. The user is experienced and goes directly to plan creation (which still triggers the Onboarding Interview for the new plan's structured inputs).

---

# C. Plan Creation Rules

---

## C1. When is First Plan Created

Plan is created when the Onboarding Interview completes — specifically when destination_country is confirmed by the user.

Precise lifecycle:

1. User clicks "Start your relocation plan" → Onboarding Interview Chat session begins. NO plan_id exists.
2. Onboarding Interview collects structured inputs:
   - destination_country (REQUIRED — minimum field to create a plan)
   - move_date (optional)
   - purpose (optional)
   - household info (optional)
   - citizenship (may pre-populate from User Profile Layer 1)
3. Interview completes when destination_country is confirmed.
4. At the moment of interview completion:
   - Plan System creates the plan (new plan_id)
   - Plan Profile (Layer 2) initialized with all interview data
   - user.current_plan_id set to new plan_id
   - Onboarding Interview Chat session ends
   - Plan Contextual Chat becomes available

Plan is NEVER auto-created at signup.

Plan is NEVER created on first chat message (that starts the Onboarding Interview, not the plan).

Reason:

Prevents empty garbage plans. Every plan has at least destination_country from birth.

---

## C2. Automatic vs User Action

Plan creation requires user action (completing the Onboarding Interview with at least destination_country confirmed).

System NEVER silently creates plans.

The Plan System mechanically executes plan creation when the interview completes, but this is always the result of user-driven interview responses.

---

## C3. Definition of Current Plan

Current plan is defined as:

The plan referenced by user.current_plan_id.

user.current_plan_id is the SOLE canonical mechanism for resolving the current plan. It is stored explicitly on the user record.

Rules:

- user.current_plan_id must reference a plan owned by the user and not in DELETED lifecycle state.
- If user.current_plan_id is null, the user has no current plan (see B1, B2 for routing).
- Only ONE plan can be current at a time (enforced by the single-valued nature of user.current_plan_id).

Derived convenience (non-authoritative):

An `is_current` boolean column MAY exist on the plan row as a query optimization. If it exists, it MUST be maintained as a strict projection of user.current_plan_id and MUST NEVER be used as the source of truth for current plan resolution. See Plan System Definition B.3 for full specification.

---

## C4. How Current Plan is Selected

When a new plan is created (via Onboarding Interview completion):

user.current_plan_id is atomically set to the new plan_id.

No mutation is performed on any existing plan. Previous plans retain their lifecycle state and stage.

When user explicitly switches plan:

user.current_plan_id is atomically set to the selected plan_id.

See Plan System Definition F for full switching semantics.

---

## C5. How Many Plans Can User Have

Unlimited.

Reason:

Users may explore multiple relocation scenarios.

Example:

Sweden plan (work)
Japan plan (study)
Canada plan (family)

Each plan is created via its own Onboarding Interview (or fork), each with its own destination_country.

---

## C6. Plan in CREATED State (Pre-Generation)

A plan in LifecycleState = CREATED and Stage = collecting is a plan that was just created from the Onboarding Interview but has not yet had its first generation run.

This is NOT the same as "draft" in the traditional sense:
- The plan has a valid plan_id.
- The plan has at least destination_country populated.
- The plan is tied to user.current_plan_id.
- The user may still be providing additional profile inputs before triggering generation.

A plan in CREATED state:
- IS shown in the dashboard (in a "completing your profile" mode).
- IS usable with Plan Contextual Chat (for additional profile collection).
- Is NOT yet fully onboarded (first_output_generated = false).
- Does NOT satisfy the onboarding completion condition (A2).

---

# D. UI / UX Flow

---

## D1. Screen States

State 1: No plan exists, onboarding not complete

user.current_plan_id = null
profiles.onboarding_completed = false
No non-DELETED plans exist.

Show:

Empty onboarding screen with Onboarding Interview entry point.

CTA:

"Start your relocation plan"

Available interactions: Onboarding Interview Chat ONLY. Dashboard locked. Plan Contextual Chat disabled.

---

State 2: Onboarding Interview in progress (pre-plan)

user.current_plan_id = null
Onboarding Interview Chat session is active
No plan_id exists yet

Show:

Onboarding Interview Chat interface.

The user is answering structured questions. The system is collecting destination_country and other inputs.

---

State 3: Plan exists in CREATED state (post-interview, pre-generation)

user.current_plan_id = [plan_id]
plan.lifecycle_state = CREATED
plan.stage = collecting

Show:

Dashboard in "profile completion" mode.
Plan Contextual Chat available for additional profile input.
Generation trigger available (e.g., "Generate your relocation guide" button, or automatic trigger when readiness_state = READY).

---

State 4: Plan exists, generation running

user.current_plan_id = [plan_id]
plan.lifecycle_state = CREATED (or transitioning to ACTIVE)
plan.stage = generating (job running)

Show:

Generation progress indicator.
"Generating your plan..." messaging.
Chat may be disabled during generation to prevent conflicting inputs.

---

State 5: Plan exists, generation complete, onboarding done

user.current_plan_id = [plan_id]
plan.lifecycle_state = ACTIVE
profiles.onboarding_completed = true

Show:

Full dashboard. All features unlocked.

---

## D2. First Call To Action

Always:

"Start your relocation plan"

Never auto-start.

This CTA initiates the Onboarding Interview Chat, NOT plan creation directly. Plan creation happens after the interview completes.

---

## D3. Empty State Copy

Case:

No plan, no interview started

Copy:

"Let's build your relocation plan together."

Case:

Onboarding Interview in progress

Copy:

"Tell me where you're planning to move."
(This is the first structured question of the interview — collecting destination_country.)

Case:

Plan exists (CREATED) but no generation yet

Copy:

"We have your basics. Ready to generate your relocation guide?"

Case:

Plan exists, generation running

Copy:

"Generating your plan..."

---

## D4. Leave and Return Behavior

If user leaves mid Onboarding Interview (before plan creation):

Onboarding Interview progress is stored in a temporary interview session (keyed by user_id, NOT plan_id because no plan exists yet).

On return:

Resume the interview from where the user left off.

Never restart from zero.

If the interview session has expired (configurable TTL, e.g., 7 days): start a fresh interview. This is acceptable because no plan was created and no data was committed to permanent storage.

If user leaves after plan creation but before first generation:

Plan remains in lifecycle_state = CREATED, stage = collecting.

user.current_plan_id still points to this plan.

On return:

Resume automatically — show plan dashboard in "profile completion" mode.

---

## D5. Onboarding Interview to Plan Transition (UX)

When the Onboarding Interview completes and the plan is created:

1. Onboarding Interview Chat session ends (messages may be preserved for reference but the chat mode switches).
2. The UI transitions from the "onboarding interview" view to the "plan dashboard" view.
3. Plan Contextual Chat becomes available immediately.
4. The transition should feel seamless to the user — they should understand that their answers have been captured and a plan has been created.
5. Show confirmation: "Your relocation plan for [destination_country] has been created!"
6. If additional profile inputs are needed (readiness_state != READY), prompt the user to complete their profile.

---

# E. Re-Entry & Resume

---

## E1. Resume Logic

System always resumes from the user's current state:

If user.current_plan_id is not null:
- Load the referenced plan.
- Resume from the plan's current lifecycle_state and stage.

If user.current_plan_id is null AND profiles.onboarding_completed = false:
- Check for an existing Onboarding Interview session for this user.
- If session exists and is not expired: resume interview.
- If no session: show onboarding entry screen (D1).

If user.current_plan_id is null AND profiles.onboarding_completed = true:
- Show plan selector or new plan creation flow (see B2).

---

## E2. Dashboard Sync

Dashboard visibility rules:

If onboarding_completed = false AND no plan exists:

Dashboard is locked.

Show onboarding instead.

---

If onboarding_completed = false AND plan exists in CREATED state:

Dashboard shows in "profile completion" mode (limited view).

Generation features available but full dashboard not yet unlocked.

---

If onboarding_completed = true:

Dashboard unlocked. Full feature set available.

---

# C-bis. Two Chat Modes (Canonical)

The Onboarding System spans TWO distinct chat interactions. These are separate systems, NOT the same chat in different modes.

---

## C-bis.1 Onboarding Interview Chat (Pre-Plan Phase)

Purpose:

Collect structured inputs required to create a plan. This is a goal-directed interview, NOT a freeform assistant.

Scope:

- Exists BEFORE any plan_id exists.
- Not attached to any plan.
- Temporary interaction context (stored in interview session, not in plan chat history).

Ownership:

Owned by the Onboarding System.

Behavior:

- Enabled when user has no current plan and onboarding is not complete.
- Asks structured questions to collect: destination_country (REQUIRED), move_date, purpose, household info, citizenship (may pre-populate from User Profile Layer 1).
- When destination_country is confirmed → triggers plan creation.
- After plan creation: Onboarding Interview Chat session ends.

AI context:

- User Profile (Layer 1) only — no plan-scoped data exists.
- Global reference data (country information, visa categories) for helping the user choose.
- NO access to any plan-scoped data (there is no plan).

Persistence:

- Interview session data is stored temporarily (keyed by user_id).
- Chat messages may be stored for audit/debugging.
- Interview session data is NOT part of Plan Chat History.
- After plan creation, interview inputs become part of the Plan Profile; the interview session itself can be archived or discarded.

---

## C-bis.2 Plan Contextual Chat Assistant (Post-Plan Phase)

Purpose:

Assist user with their specific relocation plan. Freeform assistant with plan-scoped context.

Scope:

- Exists ONLY when plan_id exists.
- Always tied to a specific plan_id.
- Part of the Plan Chat History.

Ownership:

Owned by the Chat System (NOT the Onboarding System).

Behavior:

- Disabled when no plan exists.
- Enabled immediately after plan creation.
- Has full access to Plan Profile, plan artifacts, and plan-scoped context.

AI context:

- Plan Profile (Layer 2 merged with Layer 1 defaults).
- Plan-scoped artifacts (guide, tasks, timeline, recommendations).
- Global reference data.
- NO access to other plans' data.

Persistence:

- Stored as part of plan chat history (plan-scoped).

---

## C-bis.3 Handoff Between Chat Modes

When the Onboarding Interview completes and plan is created:

1. Onboarding Interview Chat session is marked as completed.
2. Plan Contextual Chat becomes available with the newly created plan_id.
3. The conversation history from the Onboarding Interview is NOT automatically imported into the Plan Contextual Chat.
4. If the user needs to continue providing profile inputs, they do so via the Plan Contextual Chat (which can extract and write to Plan Profile Layer 2).

The two chat systems MUST NEVER share conversation state automatically. They are separate contexts with separate persistence.

---

# F. Permissions & Identity

---

## F1. Requirements to Start Onboarding

User must have:

Valid authenticated session

user_id present

Email verification optional depending on product policy.

User Profile (Layer 1) may or may not exist:
- If it exists: Onboarding Interview can use it for defaults (pre-populate citizenship, etc.).
- If it does not exist: create a minimal Layer 1 record (user_id only) at the start of onboarding.

---

## F2. Session Expires Mid Onboarding

Behavior:

User redirected to login

After login:

Resume from current state:
- If in Onboarding Interview (pre-plan): resume interview session if not expired.
- If plan exists (post-plan): resume plan dashboard.

No progress lost (interview session is persisted server-side, plan data is in database).

---

## F3. Permissions During Onboarding

During onboarding (before first plan creation):
- User can: start/continue Onboarding Interview, view marketing/help content.
- User cannot: access dashboard, use Plan Contextual Chat, view/create plan artifacts.

During onboarding (after plan creation, before first generation):
- User can: edit Plan Profile, use Plan Contextual Chat, trigger generation.
- User cannot: access full dashboard features that depend on generated artifacts (timeline view, task list, guide viewer).

---

# G. Error & Recovery

---

## G1. Possible Errors

Plan creation fail (interview completes but plan creation transaction fails)
Onboarding Interview session lost (server restart, session expiry)
Network fail
Session expired
Database fail
Generation fail (plan created but first output fails)

---

## G2. User Error Messages

Plan creation fail:

"Could not create your plan. Please try again."
(System should retry the plan creation transaction once before showing this error.)

Interview session lost:

"Your interview progress could not be recovered. Let's start fresh."
(Acceptable because no plan data was committed.)

Network fail:

"Connection lost. Please retry."

Session fail:

"Session expired. Please log in again."

Generation fail:

"We couldn't generate your plan right now. You can try again or continue editing your profile."
(Plan remains in CREATED state. User can retry generation later.)

---

## G3. Reset Onboarding

Reset MUST NOT delete data automatically.

Reset logic:

Set:

profiles.onboarding_completed = false

Set:

user.current_plan_id = null

Existing plans are NOT deleted. They remain in their current lifecycle state.

User must go through onboarding flow again to set onboarding_completed = true.

Optional:

User may manually delete individual plans via plan management UI.

Reset is an admin action or explicit user request. It is NOT triggered by normal system behavior.

---

## G4. Edge Cases

Interview abandoned after partial input:
- Interview session data persisted. On return, resume from last state.
- If session expired: start fresh. No plan was created, no data loss.

Browser crash during plan creation transaction:
- If transaction committed: plan exists. On return, user sees the plan in CREATED state.
- If transaction did not commit: no plan exists. On return, interview session may still be available to resume.

User refreshes page during generation:
- Plan is in CREATED state, stage=generating.
- On page load, check generation job status:
  - If still running: show progress indicator.
  - If completed: transition to ACTIVE.
  - If failed: show retry option.

Multiple browser tabs:
- Only one Onboarding Interview session per user. If user opens a second tab, it should resume the same session, not create a duplicate.
- After plan creation: multiple tabs are handled by Plan System's standard concurrent access rules.

---

# H. Analytics / Telemetry

---

## H1. Required Events

signup_completed

onboarding_interview_started (NEW — tracks when user enters the Onboarding Interview Chat)

destination_country_confirmed (NEW — tracks the plan creation trigger moment)

plan_created

first_user_input (first profile edit after plan creation, via UI or Plan Contextual Chat)

generation_triggered (NEW — tracks when first generation pipeline starts)

first_output_generated

onboarding_completed

---

## H2. Funnel

signup_completed

→ onboarding_interview_started

→ destination_country_confirmed (plan creation boundary)

→ plan_created

→ first_user_input

→ generation_triggered

→ first_output_generated

→ onboarding_completed

---

## H3. Drop-Off Points

Critical failure points:

signup → no interview started (user never clicked "Start your relocation plan")

interview_started → no destination confirmed (user abandoned interview mid-flow)

destination_confirmed → plan_created failure (system error)

plan_created → no additional input (user stopped after plan creation)

input → generation not triggered (user never initiated generation)

generation_triggered → no output (generation pipeline failed)

output → onboarding not completed (system failed to set flag)

---

# SYSTEM INVARIANTS (NON-NEGOTIABLE)

Invariant 1:

User can have at most one current plan, determined by user.current_plan_id (single source of truth).

Invariant 2:

Onboarding complete ONLY after first output is generated and plan transitions to ACTIVE.

Invariant 3:

Plans are never auto-created without user action. Plan creation requires Onboarding Interview completion with destination_country confirmed.

Invariant 4:

Dashboard is locked until onboarding complete (full dashboard features require onboarding_completed = true and plan.lifecycle_state = ACTIVE).

Invariant 5:

Onboarding progress never lost. Interview sessions are persisted server-side. Plan data is in the database. Session expiry only affects pre-plan interview state, which is acceptable.

Invariant 6:

The Onboarding Interview Chat (pre-plan) and Plan Contextual Chat (post-plan) are separate systems that NEVER share conversation state automatically.

Invariant 7:

Interview completion and plan creation are atomic. There is no state where "interview is done but plan doesn't exist."

Invariant 8:

Once onboarding_completed = true for a user, it remains true permanently. Subsequent plan creation does not reset it (except explicit admin/user reset via G3).

---

---

# L. CROSS-SYSTEM REFERENCES

---

## L.1 Upstream (systems onboarding depends on)

- Profile System (profile-system.md) — User Profile Layer 1 defaults for pre-population
- Chat Interview System (chat-interview-system-definition.md) — interview engine that drives onboarding flow

## L.2 Downstream (systems activated by onboarding completion)

- Plan System (plan-system.md) — plan creation triggered by interview completion
- Dashboard System (dashboard.md) — dashboard state derived from onboarding progress
- Plan Contextual Chat (plan-contextual-chat-system.md) — enabled after plan creation
- Guide Generation System (guide-generation.md) — first output generation after onboarding
- Chat History System (chat-history-system.md) — interview conversation persistence

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Profile System (profile-system.md) | PARTIAL |
| Chat Interview System (chat-interview-system-definition.md) | PARTIAL |
| Plan System (plan-system.md) | PARTIAL |
| Dashboard System (dashboard.md) | PARTIAL |
| Plan Contextual Chat (plan-contextual-chat-system.md) | PARTIAL |
| Guide Generation System (guide-generation.md) | PARTIAL |
| Chat History System (chat-history-system.md) | NOT_IMPLEMENTED |

# END OF DEFINITION

---

## v1 Alignment Note (GAP-022, GAP-023)

**Single chat endpoint (GAP-022):** v1 uses a single `/api/chat` endpoint that switches between pre-arrival and post-arrival modes via plan stage detection. The definition describes "two distinct chat systems sharing /api/chat" — in practice, the distinction exists in the system prompt (`buildSystemPrompt` vs `buildPostArrivalSystemPrompt`), not in separate code paths. This is architecturally simpler and functionally equivalent.

**Early plan creation (GAP-023):** v1 creates a plan on first `GET /api/profile` if none exists, regardless of whether destination_country has been confirmed. The definition says to create the plan when destination is confirmed. Early creation (then filling via interview) is simpler and produces the same functional outcome — the plan exists as a container that gets populated during the interview.

**Source:** `app/api/chat/route.ts` (mode switching), `app/api/profile/route.ts` GET handler (early plan creation)
