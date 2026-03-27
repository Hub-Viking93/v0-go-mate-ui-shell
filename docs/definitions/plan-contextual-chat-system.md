PLAN CONTEXTUAL CHAT SYSTEM — CANONICAL SYSTEM DEFINITION
GoMate Relocation Platform
Version: 1.0

CRITICAL SCOPE BOUNDARY:
This document covers ONLY the Plan Contextual Chat System (post-plan advisory assistant).
The Onboarding Interview System (pre-plan structured collection) is a SEPARATE system defined in chat-interview-system-definition.md.
These two systems are independent. They are NOT phases of the same system.

Chat History persistence is defined in chat-history-system.md (shared persistence layer for both systems).

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Post-arrival contextual chat exists and works via GPT-4o
- Chat is plan-scoped and stage-aware — system prompt includes plan
  context, profile data, and task state
- Marker protocol works: chat emits [TASK_DONE:exact task title] markers
  that the frontend parses to trigger task completion via PATCH
- Chat messages are NOT persisted — they exist only in React component
  state; refreshing loses conversation history
- No artifact referencing system — chat cannot directly reference or quote
  from guide content, requirements, or timeline items
- No chat-to-system action triggers beyond the marker protocol
- System prompt injection includes current task list and profile data

V1 Deviations from Canonical Spec:
- Section A (plan-scoped advisory): COMPLIANT — chat is plan-scoped with
  context injection
- Section B (stage awareness): COMPLIANT — system prompt adapts based on
  plan.stage
- Section C (artifact referencing): NOT_IMPLEMENTED — no structured
  artifact lookup; chat relies on system prompt context only
- Section D (action triggers): PARTIAL — only marker protocol for task
  completion; no other system actions triggered from chat
- Section E (chat history): NOT_IMPLEMENTED — no persistence; messages
  in memory only (chat-history-system.md is NOT_IMPLEMENTED)
- Section F (context window management): PARTIAL — no explicit context
  window management; relies on GPT-4o's native context

V1 Cross-Reference Adjustments:
- Chat History System: NOT_IMPLEMENTED — messages lost on refresh
- Task System: marker protocol works for task completion
- Guide/Requirements/Timeline: no structured reference — chat has system
  prompt context but cannot query artifacts
- Event System: does not exist — no chat events emitted
- Profile versioning: does not exist — chat reads live profile JSONB

V1 Fallback Behavior:
- Advisory chat: works via GPT-4o with plan context injection
- Task completion: marker protocol [TASK_DONE:title] works end-to-end
- Context: system prompt includes profile + tasks; limited but functional
- No conversation continuity across sessions

============================================================


============================================================
A. PURPOSE, ROLE & HARD BOUNDARIES
============================================================


A.1 Core Purpose

The Plan Contextual Chat System is the post-plan advisory assistant for GoMate.

It exists to:

1. Answer user questions about their specific relocation plan
2. Provide contextual guidance based on plan state, profile, and generated artifacts
3. Support post-arrival settling-in execution (task completion, compliance advice)
4. Surface relevant information from plan artifacts (guide, requirements, timeline, tasks)

It is a PLAN-SCOPED, STAGE-AWARE advisory assistant.

It is NOT:

- A profile collection engine (that is the Onboarding Interview System)
- A generation trigger (it cannot start guide/checklist generation)
- A data authority (it reads from authoritative systems, never writes to them except via the marker protocol)
- A booking engine
- A replacement for the dashboard


A.2 Lifecycle Scope

START: When a plan exists (plan_id is set, user.current_plan_id is not null).

The Plan Contextual Chat is available for ALL plan stages:

- collecting: Advisory mode — answers questions about relocation, profile completion progress
- generating: Advisory mode — informs user about ongoing generation
- complete: Full advisory mode — references guide, recommendations, requirements, cost of living
- arrived: Post-arrival settling-in mode — task coaching, compliance guidance, marker protocol active

END: The chat remains available as long as the plan exists and is not archived/deleted.

CRITICAL: Plan Contextual Chat is DISABLED when no plan exists (user.current_plan_id = null). During the pre-plan phase, only the Onboarding Interview Chat is available.


A.3 Authority Boundaries

Plan Contextual Chat is ALLOWED to:

- Answer open-ended relocation questions
- Reference plan artifacts (guide content, requirements, recommendations, cost of living, timeline)
- Provide contextual advice based on user profile and destination
- Complete settling-in tasks via the marker protocol (arrived stage only)
- Provide compliance guidance and deadline awareness
- Explain why specific requirements or tasks exist

Plan Contextual Chat is NOT ALLOWED to:

- Modify the user profile directly (profile extraction is suppressed when plan is locked)
- Trigger artifact generation (guide, checklist, requirements, recommendations)
- Create or modify bookings
- Modify plan lifecycle state
- Override task status outside the marker protocol
- Provide legal advice (must include disclaimers)
- Make promises about visa outcomes or government decisions


A.4 Relationship to Onboarding Interview System

| Aspect | Onboarding Interview | Plan Contextual Chat |
|--------|---------------------|---------------------|
| Phase | Pre-plan + early collecting | All post-plan stages |
| Purpose | Structured profile collection | Freeform advisory assistant |
| Ownership | Onboarding System | Plan Contextual Chat System (this doc) |
| plan_id | null initially, set at creation | Always required |
| Profile extraction | Active — extraction rules applied | Inactive when plan locked; limited otherwise |
| Behavior | Goal-directed, bounded | Open-ended advisory |
| conversation_kind | onboarding_interview | plan_contextual |
| Cardinality | One active per user | One per plan |
| System prompt | buildSystemPrompt() | buildPostArrivalSystemPrompt() (arrived) or advisory prompt (other stages) |

These are TWO SEPARATE SYSTEMS that happen to share the same /api/chat endpoint.
Mode is determined server-side by plan.stage — the client cannot override.

Cross-reference: chat-interview-system-definition.md (Onboarding Interview authority).


============================================================
B. CONVERSATION IDENTITY & PERSISTENCE
============================================================


B.1 Conversation Identity

Plan Contextual Chat conversations are identified by:

conversation_kind = "plan_contextual"
user_id (required)
plan_id (required, NOT nullable)

Canonical identity in Chat History System:

(user_id, plan_id, conversation_kind="plan_contextual")

Cross-reference: chat-history-system.md Section B.1 (conversation definition).


B.2 Cardinality

One plan MUST have at most ONE plan_contextual conversation.

If user switches plans (via user.current_plan_id), the chat loads the conversation for the new current plan.

Switching plans does NOT delete the old conversation. It remains associated with its plan_id.


B.3 Conversation Creation

Conversation is created when:

- User opens chat for a plan, OR
- User sends first message for that plan

Creation is idempotent — if conversation already exists for (user_id, plan_id, plan_contextual), return existing.


B.4 Message Persistence

Messages are persisted by the Chat History System (chat-history-system.md):

- User message saved BEFORE AI generation starts
- Assistant message saved AFTER streaming completes (final state only)
- Streaming chunks are NOT persisted (transient)
- Messages are immutable once completed

Metadata (profile, state, extraction results) is attached to assistant messages but NOT independently persisted.


============================================================
C. STAGE-AWARE MODE SWITCHING
============================================================


C.1 Mode Determination

The chat mode is determined SERVER-SIDE on every request by reading plan.stage from the database.

The client CANNOT override the mode.

Mode determination logic:

| plan.stage | Chat Mode | System Prompt | Profile Extraction |
|-----------|-----------|---------------|-------------------|
| collecting | Advisory (limited) | Advisory prompt | Active (if not locked) |
| generating | Advisory (limited) | Advisory prompt | Suppressed |
| complete | Full advisory | Advisory prompt | Suppressed (plan locked) |
| arrived | Post-arrival settling-in | buildPostArrivalSystemPrompt() | Suppressed (plan locked) |

Mode switching is implicit — when plan.stage changes, the next chat request automatically uses the new mode.

There is no explicit "mode switch" event. The stage transition (managed by Plan System) is the mode switch.


C.2 Plan Lock Interaction

When plan.locked = true:

- Profile extraction is SKIPPED entirely
- Profile is loaded from the database snapshot (plan.profile_data)
- Interview state is forced to "complete"
- Chat operates in read-only advisory mode (no profile mutations)

Plan lock is checked on EVERY request. It is not cached.


C.3 Stage Transition Behavior

When plan.stage transitions (e.g., complete → arrived):

- The next chat request automatically picks up the new stage
- System prompt changes accordingly
- No conversation reset — history is preserved
- The user is NOT notified of mode change within the chat (dashboard shows stage change)


============================================================
D. POST-ARRIVAL MODE (STAGE = ARRIVED)
============================================================


D.1 Post-Arrival Purpose

When plan.stage = "arrived", the Plan Contextual Chat becomes a settling-in coach.

Primary role:

- Guide user through post-arrival compliance tasks
- Provide task-specific advice and step-by-step guidance
- Mark tasks as completed via the marker protocol
- Alert about upcoming deadlines and overdue items

Secondary role:

- Answer general settling-in questions
- Provide destination-specific practical advice


D.2 Settling-in Task Injection

On every post-arrival chat request, the system fetches ALL settling-in tasks for the plan and injects them into the system prompt.

Injected task data:

- title
- category
- status (pending, in_progress, completed, blocked)
- deadline_days
- is_legal_requirement (boolean)

The assistant uses this context to:

- Know what the user needs to do
- Prioritize legal/compliance tasks
- Track what has already been completed
- Provide relevant advice per task


D.3 Task Completion Marker Protocol

V1 Marker Format:

[TASK_DONE:exact task title]

The marker uses task TITLE (not UUID). This is intentional.

Protocol flow:

1. User discusses a task with the assistant
2. When the user indicates a task is done, the assistant emits the marker in its response
3. Frontend parses the marker from the assistant's message using regex
4. Frontend fires PATCH /api/settling-in/{id} to mark the task as completed

Frontend parsing:

- Regex: /\[TASK_DONE:(.+?)\]/g
- Only parsed from assistant messages (never user messages)
- Title matching is case-insensitive
- Deduplication via useRef per component lifetime

Server verification (PATCH endpoint):

- Auth check (401)
- Tier check (403 — Pro+ required)
- Task ownership check (404)
- Locked status check (400)
- Stage check: plan.stage === "arrived" required (400)

CRITICAL: Do NOT change the marker format without updating BOTH the system prompt AND the frontend parser simultaneously.

Cross-reference: settling-in-tasks.md (task lifecycle), CLAUDE.md (marker protocol architecture fact).


D.4 Post-Arrival System Prompt Contract

The post-arrival system prompt (buildPostArrivalSystemPrompt) MUST include:

- User profile context (name, destination, citizenship, purpose)
- Full settling-in task list with status
- Marker protocol instructions (when and how to emit [TASK_DONE:...])
- Compliance priority rules (legal requirements first)
- Disclaimer rules (not legal advice)

The post-arrival system prompt MUST NOT include:

- Interview questions or profile collection logic
- Artifact generation triggers
- Financial advice beyond what cost_of_living artifact provides


============================================================
E. PRE-ARRIVAL ADVISORY MODE (STAGES: COLLECTING, GENERATING, COMPLETE)
============================================================


E.1 Advisory Mode Purpose

Before arrival, the Plan Contextual Chat serves as a general advisory assistant.

It can:

- Answer relocation planning questions
- Explain generated artifacts (guide, requirements, recommendations)
- Provide destination-specific context
- Help user understand their relocation timeline

It cannot:

- Trigger generation
- Modify profile (when locked)
- Complete tasks (marker protocol inactive)


E.2 Stage-Specific Behavior

collecting stage:
- Profile extraction MAY be active if plan is not locked
- Chat can help explain what information is still needed
- Limited artifact context (artifacts may not exist yet)

generating stage:
- Profile extraction suppressed
- Chat informs user that generation is in progress
- No artifact references available

complete stage:
- Full artifact context available (guide, recommendations, requirements, cost of living)
- Profile extraction suppressed (plan locked)
- Rich advisory capabilities — can reference all generated artifacts


============================================================
F. PROFILE INTERACTION MODEL
============================================================


F.1 Profile Extraction Rules

Profile extraction is the process of parsing user messages to update profile fields.

Extraction is ACTIVE only when ALL of these conditions are true:

- plan.locked = false
- plan.stage = "collecting"
- User has NOT confirmed profile

Extraction is SUPPRESSED in all other cases.

When extraction is active:

- Extraction runs on every assistant turn
- Uses GPT-4o-mini with JSON mode
- Extracts fields from the LAST user message only
- Validates enum values before saving
- Saves updated profile to Supabase

When extraction is suppressed:

- Profile is loaded from the database snapshot (read-only)
- No profile mutations occur
- Chat operates in pure advisory mode


F.2 Confidence Model

Extraction produces confidence levels per field:

- explicit — user directly stated the value
- inferred — derived from context
- assumed — reasonable assumption from available information

V1 limitation: Confidence levels are computed per-turn and included in message metadata but NOT persisted to a database schema.


F.3 Profile Read Context

Regardless of extraction status, the chat ALWAYS has access to the current profile for context.

Profile is injected into the system prompt to enable personalized responses.

Profile data sources:

- If plan locked: plan.profile_data (frozen snapshot)
- If plan not locked: latest profile state from database


============================================================
G. STREAMING & RESPONSE CONTRACT
============================================================


G.1 Response Format

The chat uses Server-Sent Events (SSE) with three event types:

| Event | Timing | Payload |
|-------|--------|---------|
| message-start | First | { type, id, role } |
| text-delta | Each chunk | { type, delta } |
| message-end | After completion | { type, metadata } |

HTTP headers included:

- X-GoMate-Profile — encoded full profile snapshot
- X-GoMate-State — interview state (interview/review/complete)


G.2 Metadata Payload

The message-end event includes metadata:

Always included:

- profile (current profile state)
- state ("interview" | "review" | "complete")
- pendingField (next field to collect, if applicable)
- filledFields (list of filled field keys)
- requiredFields (list of required field keys)
- progressInfo ({ filled, total, percentage })
- relevantSources (contextual sources)
- planLocked (boolean)

Conditionally included (when isProfileComplete = true):

- officialSources
- profileSummary
- visaRecommendation
- costOfLiving
- budget
- savings
- researchReport

Conditionally included (when extraction attempted):

- lastExtraction ({ attempted, fieldsExtracted, extractedValues, fieldConfidence, success })


G.3 Model Configuration

Chat model: GPT-4o via raw fetch to OpenAI API
Extraction model: GPT-4o-mini with JSON response format
Streaming: enabled
Routing: Direct OpenAI (not via OpenRouter)

Engineering contract requirements:

- max_tokens MUST be set explicitly on all LLM calls
- Temperature SHOULD be set for deterministic extraction


============================================================
H. AUTHENTICATION & AUTHORIZATION
============================================================


H.1 Authentication

Every chat request MUST call supabase.auth.getUser() and return 401 if no session.


H.2 Plan Authorization

Chat MUST verify that the user owns the current plan.

Plan is resolved via:

- relocation_plans WHERE user_id = current_user AND is_current = true

If no plan exists: return appropriate error (chat is disabled without a plan).


H.3 Tier Gating

Post-arrival chat features (task completion via marker protocol) require Pro+ tier.

Tier check: getUserTier(user.id) — return 403 if tier does not qualify for post-arrival features.

Pre-arrival advisory chat: available to all tiers.


============================================================
I. ERROR HANDLING & RESILIENCE
============================================================


I.1 Streaming Error Handling

If the LLM stream fails mid-response:

- The partial response is visible to the user
- The message-end event is NOT sent
- Metadata is lost for that turn
- The conversation can continue (next request starts fresh)

No automatic retry of streaming failures.


I.2 Plan Load Failure

If plan cannot be loaded from database:

- Chat MUST NOT silently fall back to a different mode
- Return explicit error to client
- User sees error state in UI

Gap: Current implementation silently falls back to pre-arrival mode if plan load fails. This should be fixed to return an explicit error.


I.3 Extraction Failure

If profile extraction fails:

- Chat response is still delivered (extraction is best-effort)
- Extraction failure is logged server-side
- No user-visible error for extraction failure
- Profile remains unchanged


I.4 Task Completion Failure

If PATCH /api/settling-in/{id} fails after marker parsing:

- The chat message is still displayed (markers are parsed client-side)
- Task remains in its previous state
- No automatic retry
- User can manually mark task as completed via dashboard


============================================================
J. RELATIONSHIP TO PLAN LIFECYCLE
============================================================


J.1 Plan Stage Dependencies

| Plan Stage | Chat Available | Mode | Key Capabilities |
|-----------|---------------|------|-----------------|
| collecting | Yes | Advisory (limited) | Profile questions, basic advice |
| generating | Yes | Advisory (limited) | Generation status, general advice |
| complete | Yes | Full advisory | Artifact references, rich guidance |
| arrived | Yes | Post-arrival coach | Task completion, compliance guidance |

Plan LifecycleState dependencies:

| LifecycleState | Chat Available | Notes |
|---------------|---------------|-------|
| CREATED | Yes | Early advisory mode |
| ACTIVE | Yes | Standard operation |
| LOCKED | Yes | Read-only advisory (no profile mutations) |
| ARCHIVED | No | Chat disabled for archived plans |
| DELETED | No | Chat disabled for deleted plans |


J.2 Plan Switch Behavior

When user switches current plan (user.current_plan_id changes):

- Next chat request loads the conversation for the new plan
- Old conversation preserved (associated with old plan_id)
- No conversation merging
- System prompt reconstructed for new plan context


============================================================
K. CROSS-SYSTEM REFERENCES
============================================================


K.1 Upstream (systems the chat reads from)

- Plan System (plan-system.md) — plan_id, stage, locked status, LifecycleState
- Profile System (profile-system.md) — profile data for system prompt context; profile extraction target
- Settling-in Task System (settling-in-tasks.md) — task list injected into post-arrival system prompt
- Guide Generation System (guide-generation.md) — guide content referenced in advisory responses
- Recommendation System (recommendation-system.md) — visa recommendation, cost recommendations
- Cost of Living System (cost-of-living.md) — cost data for financial context
- Local Requirements System (local-requirements.md) — requirements for compliance context
- Timeline System (timeline-system.md) — timeline items for "what's next" advisory
- Progress Tracking System (progress-tracking-system.md) — interview_progress for completion context

K.2 Downstream (systems the chat writes to)

- Settling-in Task System (settling-in-tasks.md) — task completion via marker protocol (PATCH /api/settling-in/{id})
- Profile System (profile-system.md) — profile extraction writes (collecting stage only, when not locked)
- Chat History System (chat-history-system.md) — message persistence (user and assistant messages)

K.3 Shared Infrastructure

- Chat History System (chat-history-system.md) — shared persistence layer for all chat systems; conversation_kind="plan_contextual"
- Onboarding Interview System (chat-interview-system-definition.md) — separate system sharing the same /api/chat endpoint; mode determined by plan.stage
- Event/Trigger System (event-trigger-system.md) — chat does NOT emit domain events (it is a consumer, not a producer)

K.4 Shared Contracts

- Plan LifecycleState x Stage: plan-system.md Section C (chat mode determined by stage)
- Profile versioning: profile-system.md Section G (extraction writes to live profile, not version snapshots)
- Task marker protocol: settling-in-tasks.md (task title matching); CLAUDE.md (architecture fact — do not change format)
- Tier gating: lib/gomate/tier.ts — getUserTier() for post-arrival feature gating
- Chat History identity: chat-history-system.md Section B (conversation_kind, cardinality, lifecycle)


V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Plan System (plan-system.md) | PARTIAL |
| Profile System (profile-system.md) | PARTIAL |
| Settling-in Tasks (settling-in-tasks.md) | PARTIAL |
| Guide Generation System (guide-generation.md) | PARTIAL |
| Recommendation System (recommendation-system.md) | MINIMAL |
| Cost of Living System (cost-of-living.md) | PARTIAL |
| Local Requirements System (local-requirements.md) | NOT_IMPLEMENTED |
| Timeline System (timeline-system.md) | NOT_IMPLEMENTED |
| Progress Tracking System (progress-tracking-system.md) | PARTIAL |
| Chat History System (chat-history-system.md) | NOT_IMPLEMENTED |
| Chat Interview System (chat-interview-system-definition.md) | PARTIAL |
| Event Trigger System (event-trigger-system.md) | NOT_IMPLEMENTED |


============================================================
L. SYSTEM INVARIANTS
============================================================


Invariant 1: Plan Contextual Chat requires plan_id — it is DISABLED when no plan exists (user.current_plan_id = null).

Invariant 2: Chat mode is determined SERVER-SIDE by plan.stage — the client CANNOT override mode selection.

Invariant 3: Profile extraction is SUPPRESSED when plan.locked = true — no profile mutations in locked state.

Invariant 4: Task completion marker protocol uses task TITLE (not UUID) — format is [TASK_DONE:exact task title].

Invariant 5: Plan Contextual Chat and Onboarding Interview Chat are TWO SEPARATE SYSTEMS sharing one endpoint.

Invariant 6: Post-arrival task completion requires plan.stage = "arrived" — marker protocol is inactive in other stages.

Invariant 7: Chat NEVER triggers artifact generation — it is a consumer of artifacts, not a producer.

Invariant 8: Plan Contextual Chat is available for ALL plan stages (collecting through arrived) — it is NOT gated by stage, only its capabilities change per stage.

Invariant 9: One plan has at most ONE plan_contextual conversation — conversation is plan-scoped.

Invariant 10: Streaming failures do NOT corrupt conversation state — partial responses are visible but metadata is lost; next turn starts fresh.


============================================================
M. V1 IMPLEMENTATION NOTES
============================================================


M.1 Current Architecture

Both chat systems (Onboarding Interview and Plan Contextual) share a single /api/chat POST handler.

Mode is determined inline by checking plan.stage:
- stage = "arrived" → post-arrival system prompt
- all other stages → pre-arrival system prompt (shared with interview mode)

V1 does NOT fully separate advisory mode from interview mode for non-arrived stages. The same system prompt builder (buildSystemPrompt) is used for both onboarding interview and pre-arrival advisory.

M.2 Known Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| G-2.1-A | P2 | Raw fetch to OpenAI — no retry logic, no SDK features |
| G-2.1-B | P2 | State determination inline — computeNextState() dead code |
| G-2.1-D | P2 | Temperature not set — non-deterministic extraction |
| G-2.1-E | P2 | Stream error handling — no recovery, metadata lost on interruption |
| G-2.1-F | P2 | Confidence levels not persisted to database |
| G-10.1-A | P2 | All tasks injected with no token budget overflow cap |
| G-10.1-G | P1 | Auth failure silently falls back to pre-arrival mode |
| G-10.2-C | P1 | Missing plan.stage check on task PATCH endpoint |

M.3 Chat History Not Yet Implemented

The Chat History System (chat-history-system.md) defines the canonical persistence model, but V1 does NOT implement:

- conversation table
- message persistence
- conversation_kind tracking
- greeting eligibility from history

Messages exist only in client state during the session. This is an explicit V1 limitation — chat history persistence is out of scope per CLAUDE.md.


============================================================
END OF PLAN CONTEXTUAL CHAT SYSTEM DEFINITION
============================================================

---

## v1 Alignment Note (GAP-024)

v1 sends the profile in the request body (`{ messages, profile }`) and injects it into the system prompt. The definition specifies sending profile data via headers. Request body injection is the standard Next.js pattern for complex data — headers are unusual for structured objects and have size limits.

**Source:** `app/api/chat/route.ts` — receives profile in request body, builds system prompt with profile data
