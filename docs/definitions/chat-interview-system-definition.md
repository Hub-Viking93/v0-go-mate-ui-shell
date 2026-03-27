# GoMate — Onboarding Interview System Definition

This document defines the Onboarding Interview System as a deterministic, state-driven subsystem.

The Onboarding Interview is NOT a freeform chatbot. It is a structured interview engine with bounded authority.

The Onboarding Interview exists to safely collect relocation profile data required to create a relocation plan, without corrupting system state.

CRITICAL SCOPE BOUNDARY:
This document covers ONLY the Onboarding Interview System (pre-plan structured collection).
The Plan Contextual Chat System (post-plan advisory assistant) is a SEPARATE system defined in plan-contextual-chat-system.md.
These two systems are independent. They are NOT phases of the same system.

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- The onboarding interview is implemented and functional via GPT-4o chat
  with structured extraction (GPT-4o-mini)
- State machine (lib/gomate/state-machine.ts) drives interview progression
  through stages: collecting → generating → complete → arrived
- Profile schema (lib/gomate/profile-schema.ts) defines 45 fields
- Chat messages are NOT persisted — they exist only in React component
  state (in-memory, per session); refreshing the page loses chat history
- Extraction pipeline works: LLM extracts profile fields from
  conversation, updates live profile JSONB on the current relocation_plans row
- Field confidence is embedded in `profile_data.__field_confidence`, not in a
  separate persisted confidence model
- No profile_version_id — extraction writes directly to the live profile
  JSONB column
- No INTERVIEW_COMPLETED event — the state machine transitions stages
  based on field collection, not via a formal event system
- No required_fields_registry table — required fields defined in
  profile-schema.ts application code
- No true PRE_PLAN runtime phase — a current plan is typically created before
  the chat finishes collecting destination data

V1 Deviations from Canonical Spec:
- Section A (state-driven): COMPLIANT — state machine exists and works
- Section B (extraction model): PARTIAL — extraction works but writes to
  live profile (no snapshot/versioning)
- Section C (chat history): NOT_IMPLEMENTED — no chat history persistence;
  messages lost on page refresh (chat-history-system.md is NOT_IMPLEMENTED)
- Section D (completion model): PARTIAL — state machine transitions on
  field collection, not via Progress System events
- Section E (profile versioning): NOT_IMPLEMENTED — no profile_version_id;
  direct JSONB writes

V1 Cross-Reference Adjustments:
- Chat History System: NOT_IMPLEMENTED — messages in memory only
- Progress System: interview progress is implicit in state machine, not
  computed by a unified Progress System
- Event System: does not exist — no INTERVIEW_COMPLETED event emitted
- Profile versioning: does not exist — no immutable snapshots

V1 Fallback Behavior:
- Interview flow: works correctly via state machine + GPT-4o chat +
  extraction pipeline
- Field collection: profile-schema.ts defines fields; state machine tracks
  which are collected
- Plan creation: not owned by the chat state machine; the current plan is
  typically bootstrapped by `/api/profile` or the profile save helper
- Chat continuity: lost on page refresh — user must re-enter information

============================================================

---

# A. PURPOSE, ROLE & HARD BOUNDARIES

---

## A.1 Core Purpose

The Onboarding Interview System is a deterministic, state-driven structured interview engine whose sole purpose is to safely collect, confirm, and finalize relocation profile data required to create a relocation plan.

Lifecycle scope:
- START: Before a plan exists (user clicks "Start your relocation plan") OR immediately after plan creation when required profile fields are incomplete.
- END: When interview completes and plan generation is triggered.
- TERMINATION POINT: INTERVIEW_COMPLETE or PLAN_GENERATING. After this point, this system has NO further authority.

The interview collects structured inputs. The minimum required field to complete the interview and trigger plan creation is destination_country.

---

## A.2 Authority by Phase

### Phase: PRE_PLAN (No plan_id exists)

Purpose:

Collect initial relocation intent and structured inputs to create a plan.

Chat Authority:

ALLOWED:

- Ask destination country (REQUIRED — minimum field for plan creation)
- Ask purpose of relocation
- Ask move date / timeframe
- Ask household composition
- Ask citizenship (may pre-populate from User Profile Layer 1)
- Confirm collected inputs with the user
- Explain why each question is needed

NOT ALLOWED:

- Create plan silently (plan creation requires destination_country confirmation)
- Generate any artifacts (checklist, guide, recommendations)
- Write to any plan-scoped table (no plan_id exists)
- Provide open-ended relocation advisory
- Skip destination_country collection

Trigger to create plan:

User confirms destination_country. This is the interview completion boundary.
At this moment, the Plan System creates the plan atomically (see Plan System Definition D.1).

Data flow:
- During PRE_PLAN, collected data is held in the interview session state (persisted by Chat History System as an onboarding_interview conversation, keyed by user_id with plan_id = null).
- At interview completion, all collected data is atomically written to the new Plan Profile (Layer 2) and the onboarding_interview conversation is linked to the newly created plan_id.

---

### Phase: POST_PLAN_COLLECTING (Plan exists, LifecycleState=CREATED, Stage=collecting)

Purpose:

Collect additional structured profile data beyond the minimum required for plan creation.

This phase is OPTIONAL. If the user provided sufficient data during PRE_PLAN, the system may skip directly to generation.

Authority:

ALLOWED:

- Ask additional structured questions (move_date, family_size, budget, visa preferences, employment context, housing needs)
- Confirm answers
- Ask clarification questions
- Explain why additional fields improve plan quality
- Propose generation when readiness_state = READY (all required fields complete)

NOT ALLOWED:

- Skip required fields silently
- Invent answers
- Modify confirmed answers without user consent
- Provide open-ended relocation advisory (that is Plan Contextual Chat's role)
- Trigger generation without user awareness (generation trigger must be explicit or clearly communicated)

Inference allowed ONLY as "inferred" confidence level. Never treated as confirmed.

---

### Phase: INTERVIEW_COMPLETE

Purpose:

Transition to plan generation.

Authority:

ALLOWED:

- Confirm interview completion to the user
- Trigger generation (via system trigger, not direct execution)
- Show summary of collected profile data for user review

NOT ALLOWED:

- Continue collecting required fields (interview is done)
- Silently modify profile
- Provide ongoing advisory (that transitions to Plan Contextual Chat)

---

## A.3 Termination Guarantee (CRITICAL INVARIANT)

Once plan generation begins (Stage transitions to `generating`), the Onboarding Interview System MUST permanently relinquish control.

It MUST NOT resume unless a new interview cycle is explicitly initiated via:
- "Create new plan" (triggers a fresh onboarding interview for the new plan)
- Plan fork (triggers a fresh onboarding interview for the forked plan, pre-populated with source plan data)
- Profile re-interview (future: user requests re-collection of profile data on an existing plan)

After termination, the Plan Contextual Chat System takes over as the active chat mode for the plan.

---

## A.4 Explicit Non-Goals

The Onboarding Interview System is NOT allowed to:

- Submit visa applications
- Book flights
- Provide legal advice
- Provide financial advice
- Guarantee outcomes
- Hallucinate authority
- Modify database directly (writes go through Profile Write API and Plan System)
- Invent profile schema fields
- Create plans without destination_country confirmation
- Operate after plan generation begins
- Provide open-ended relocation advisory (beyond profile clarification)
- Modify plan after generation
- Write recommendations, guides, timeline, tasks, or any derived artifacts

---

If user requests a disallowed action:

Response pattern:

Structure:

1. Acknowledge the request
2. Explain limitation
3. Provide safe alternative

Example:

"I can't help with that yet — let's first finish setting up your relocation plan. Once your plan is generated, you'll have a dedicated assistant to help with those questions."

---

## A.5 Authority Level Summary

| State                    | Authority              | Write Target           |
|--------------------------|------------------------|------------------------|
| PRE_PLAN                 | structured collector   | interview session      |
| POST_PLAN_COLLECTING     | structured collector   | Plan Profile Layer 2   |
| INTERVIEW_COMPLETE       | generation trigger     | (none — handoff only)  |

The Onboarding Interview System NEVER has execution authority, advisory authority, or artifact mutation authority.

---

## A.6 Domain Scope

Allowed domains (for structured collection context only):

- Relocation destination selection
- Visa category overview (to help user select purpose/visa_type)
- Move timing / logistics overview
- Household composition
- Budget range estimation

Out of scope (belongs to Plan Contextual Chat):

- Detailed legal interpretation
- Tax optimization
- Investment advice
- Immigration strategy recommendations
- Open-ended relocation Q&A
- Task execution guidance

---

# B. CANONICAL STATES & STATE MACHINE

---

## B.1 State Enumeration

States:

NOT_STARTED — No interview session exists. User has not clicked "Start your relocation plan."

PRE_PLAN_ACTIVE — Interview is in progress. No plan_id exists yet. System is collecting structured inputs.

PRE_PLAN_WAITING_FOR_USER — System has asked a question. Waiting for user response. No plan_id yet.

PRE_PLAN_PROCESSING — System is processing user response (extraction, validation). No plan_id yet.

PLAN_CREATED — Interview has collected destination_country. Plan System has created the plan. Plan Profile initialized.

POST_PLAN_COLLECTING — Plan exists (LifecycleState=CREATED). Interview continues collecting additional fields.

POST_PLAN_WAITING_FOR_USER — Additional question asked. Waiting for user. Plan exists.

POST_PLAN_PROCESSING — Processing user response for additional fields. Plan exists.

INTERVIEW_COMPLETE — All required fields collected (or user explicitly requests generation). Ready for generation trigger.

TERMINATED — Plan generation has started (Stage=generating). Interview System has permanently relinquished control.

---

## B.2 State Entry Conditions

NOT_STARTED:
- User has not initiated onboarding interview.

PRE_PLAN_ACTIVE:
- User clicked "Start your relocation plan" or sent first message to the onboarding interview.
- No plan_id exists.

PRE_PLAN_WAITING_FOR_USER:
- System has asked a structured question during PRE_PLAN phase.
- Awaiting user response.

PRE_PLAN_PROCESSING:
- User has responded. System is extracting and validating the response.

PLAN_CREATED:
- destination_country has been confirmed by user.
- Plan System has atomically created the plan.
- Plan Profile (Layer 2) initialized with interview data.
- Onboarding interview conversation linked to new plan_id.
- Transient state — immediately transitions to POST_PLAN_COLLECTING or INTERVIEW_COMPLETE.

POST_PLAN_COLLECTING:
- Plan exists (LifecycleState=CREATED, Stage=collecting).
- Additional required or optional fields remain to be collected.

POST_PLAN_WAITING_FOR_USER:
- System has asked additional question. Plan exists. Awaiting user.

POST_PLAN_PROCESSING:
- Processing response for additional fields.

INTERVIEW_COMPLETE:
- All required fields confirmed (readiness_state = READY), OR
- User explicitly requests generation ("Generate my plan"), OR
- System determines minimum viable profile is sufficient and proposes generation (user must confirm).

TERMINATED:
- Plan Stage has transitioned to `generating`.
- Interview System is permanently inactive for this plan.

---

## B.3 State Transition Rules

Allowed transitions:

NOT_STARTED → PRE_PLAN_ACTIVE (user initiates interview)
PRE_PLAN_ACTIVE → PRE_PLAN_WAITING_FOR_USER (system asks question)
PRE_PLAN_WAITING_FOR_USER → PRE_PLAN_PROCESSING (user responds)
PRE_PLAN_PROCESSING → PRE_PLAN_WAITING_FOR_USER (more questions needed)
PRE_PLAN_PROCESSING → PLAN_CREATED (destination_country confirmed)
PLAN_CREATED → POST_PLAN_COLLECTING (additional fields needed)
PLAN_CREATED → INTERVIEW_COMPLETE (sufficient data collected during PRE_PLAN)
POST_PLAN_COLLECTING → POST_PLAN_WAITING_FOR_USER (system asks question)
POST_PLAN_WAITING_FOR_USER → POST_PLAN_PROCESSING (user responds)
POST_PLAN_PROCESSING → POST_PLAN_WAITING_FOR_USER (more questions needed)
POST_PLAN_PROCESSING → INTERVIEW_COMPLETE (all required fields complete or user requests generation)
INTERVIEW_COMPLETE → TERMINATED (generation starts)

Forbidden transitions:

TERMINATED → any state (interview permanently ended for this plan)
INTERVIEW_COMPLETE → PRE_PLAN_* (cannot go back to pre-plan after plan exists)
POST_PLAN_* → PRE_PLAN_* (cannot go back to pre-plan after plan exists)

---

## B.4 Transition Triggers

| Source | Destination | Trigger | Actor |
|--------|-------------|---------|-------|
| NOT_STARTED | PRE_PLAN_ACTIVE | "Start your relocation plan" click or first message | user |
| PRE_PLAN_PROCESSING | PLAN_CREATED | destination_country confirmed | system (after user confirmation) |
| PLAN_CREATED | POST_PLAN_COLLECTING | additional fields needed | system |
| PLAN_CREATED | INTERVIEW_COMPLETE | sufficient data already collected | system |
| POST_PLAN_PROCESSING | INTERVIEW_COMPLETE | all required fields complete | system |
| POST_PLAN_COLLECTING | INTERVIEW_COMPLETE | user requests generation | user |
| INTERVIEW_COMPLETE | TERMINATED | generation pipeline starts | system |

---

## B.5 Invalid State Protection

Server is source of truth for interview state.

If client attempts invalid transition:
- Server rejects the request.
- Client must reload state.

If interview state and plan state are inconsistent (e.g., interview shows PRE_PLAN but plan exists):
- Server reconciles by advancing interview state to match plan state.
- Never roll back plan state to match interview state.

---

## B.6 Recovery

Interview progress is stored in Chat History System (onboarding_interview conversation).

On reload:
- Resume current state from server.
- Reconstruct interview progress from conversation messages + extraction records.
- No progress lost (within session TTL).

Session expiry:
- If interview session has been inactive longer than configurable TTL (e.g., 7 days):
  - PRE_PLAN: start fresh interview. Acceptable because no plan was created.
  - POST_PLAN: resume from plan state. Plan Profile data is persisted; only conversation context may need refresh.

---

# C. CONVERSATION MODEL & PERSISTENCE

---

## C.1 Conversation Ownership

Before plan creation (PRE_PLAN):
- Conversation belongs to user_id with conversation_kind = "onboarding_interview".
- plan_id is null.
- One user MUST have at most ONE active onboarding_interview conversation at a time.

After plan creation (POST_PLAN):
- The onboarding_interview conversation is linked to the newly created plan_id (preferred approach — preserves continuity).
- Conversation retains conversation_kind = "onboarding_interview" to distinguish it from plan_contextual conversations.

On interview termination:
- The onboarding_interview conversation is marked as completed (status = archived or completed).
- A new plan_contextual conversation may be created for the Plan Contextual Chat System.

---

## C.2 Conversation Identity

Primary key:
conversation_id (UUID)

Foreign keys:
- user_id (required)
- plan_id (nullable during PRE_PLAN; set at PLAN_CREATED)
- conversation_kind = "onboarding_interview" (required, distinguishes from plan_contextual)

---

## C.3 Message Model

Each message contains:

- id (UUID)
- conversation_id
- role (user | assistant | system | extraction)
- content (text)
- timestamp
- sequence_number (strictly increasing per conversation)
- status (pending | completed | failed | deleted)
- state_snapshot (optional — interview state at time of message)
- extraction_reference (optional — links to extraction record if this message triggered extraction)

Roles:

- user: user's message
- assistant: interview system's response (question, confirmation, explanation)
- system: system notifications (plan created, generation starting)
- extraction: structured data extracted from user message (stored as metadata, may not be visible in chat UI)

---

## C.4 Persistence Timing

User message saved immediately (before processing).

Assistant message saved after completion (after generation finishes).

Extraction records saved after validation (only confirmed extractions are persisted to profile).

All persistence goes through Chat History System.

---

## C.5 Loading Behavior

Load messages WHERE:
conversation_id = current onboarding_interview conversation for user

Order by sequence_number ASC.

On resume: load all messages to reconstruct interview progress and extraction state.

---

## C.6 Greeting Logic

Greeting allowed ONLY when:
message_count == 0 for the onboarding_interview conversation.

Never repeat greeting.

Greeting content should be the onboarding entry prompt (e.g., "Let's build your relocation plan together. Where are you planning to move?").

---

## C.7 Continuity

Conversation persists across:
- Page refresh
- Logout/login
- Device change

Interview state is reconstructed from conversation messages + extraction records on reload.

---

## C.8 History Limits

Interview conversations are typically short (10-30 messages).

No pagination needed for interview conversations.

Full history loaded on resume.

---

# D. EXTRACTION SUBSYSTEM

---

## D.1 Extraction Trigger

Runs after every user message during PRE_PLAN and POST_PLAN_COLLECTING phases.

Extraction is performed by a dedicated extraction model (e.g., GPT-4o-mini) that processes the user's message and produces structured field candidates.

---

## D.2 Extractable Fields

Fields that the extraction subsystem can identify from user messages:

PRE_PLAN extractable (stored in interview session until plan creation):
- destination_country (REQUIRED — triggers plan creation when confirmed)
- citizenship
- purpose
- move_date / move_window

POST_PLAN extractable (written to Plan Profile Layer 2 via Profile Write API):
- destination_city
- family_size
- budget_monthly
- employment_context
- housing_preferences
- visa_type
- special_requirements

Fields NOT extractable (system-controlled):
- profile_id, plan_id, user_id
- profile_completion_percentage, readiness_state, eligibility_status (derived)

---

## D.3 Extraction Authority

Extraction may write:
- explicit values (user directly stated the value)
- inferred values (system inferred from context)

BUT inferred values must NOT be marked as confirmed.

Extraction writes go through different paths depending on phase:
- PRE_PLAN: extracted values stored in interview session state. Written to Plan Profile atomically at plan creation.
- POST_PLAN: extracted values written to Plan Profile Layer 2 via Profile Write API, subject to merge rules (see Profile System Definition E).

---

## D.4 Confidence Levels

explicit — user directly stated the value ("I'm moving to Germany")
inferred — system inferred from context ("Since you mentioned a work visa, I infer your purpose is work")
assumed — system assumed a default (NOT ALLOWED for plan-critical fields; used only for soft defaults)

Storage per extraction:
- field_name
- field_value
- confidence (explicit | inferred | assumed)
- source_message_id (links to the message that produced this extraction)
- extraction_timestamp

---

## D.5 Write Rules

Extraction may NOT:
- Overwrite confirmed values without user consent (if a field was previously confirmed as explicit, extraction cannot silently change it)
- Write undefined fields (fields not in the profile schema)
- Modify locked fields (if plan is locked, extraction is already terminated — but this rule prevents bugs)
- Write to Plan Profile before plan creation (PRE_PLAN extractions are held in session state)

Extraction conflict resolution:
- If extraction proposes a value for a field that already has a confirmed value, the system MUST ask the user: "I noticed you mentioned [new_value]. Would you like to update [field] from [old_value] to [new_value]?"
- If user confirms: update field and set confidence = explicit.
- If user declines: keep existing value.

---

## D.6 Failure Handling

On extraction failure:
- Retry once with the same input.
- If still failed: skip extraction for this message and continue the conversation.
- Ask clarification if the extraction failure was due to ambiguous input.
- Never block the conversation on extraction failure.

---

## D.7 Determinism

temperature: 0 (extraction model)

retry: 1

strict schema validation required:
- Extraction output must conform to the profile schema.
- Invalid field names rejected.
- Invalid field types rejected.
- Invalid enum values rejected.

---

## D.8 Schema Evolution

Schema version stored per extraction record.

Old extractions remain valid (backward compatible).

If profile schema adds new fields, the extraction model must be updated to recognize them, but old extraction records are not retroactively modified.

---

# E. SINGLE SOURCE OF TRUTH

---

## E.1 Authority Location

Database is the only source of truth for profile data.

Interview session state (PRE_PLAN) is the only source of truth for pre-plan collected data.

Client cache is read-only and non-authoritative.

---

## E.2 Conflict Resolution

Confirmed values (confidence=explicit) override inferred values.

User manual edits (via UI) override extraction writes.

If the interview system and the UI produce conflicting writes simultaneously:
- Profile Write API enforces optimistic concurrency (version check).
- The second write fails with a conflict error.
- The losing write must re-read and re-evaluate.

---

## E.3 Synchronization

All writes occur server-side.

Client reloads state after write.

Interview state is synchronized via conversation messages (Chat History System) and profile state (Profile System).

---

## E.4 Versioning

During PRE_PLAN: no profile versioning (data is in interview session state, not yet in profile tables).

During POST_PLAN_COLLECTING: profile uses mutable working state (Plan Profile Layer 2). No snapshots created during normal editing.

At INTERVIEW_COMPLETE → generation trigger: a PRE_GENERATION_SNAPSHOT is created by the Profile System (see Profile System Definition G).

---

# F. CONFIRMATION & FIELD LOCK SYSTEM

---

## F.1 Confirmation Definition

A field is confirmed when:
- User explicitly confirms the value in the interview conversation.
- confidence = explicit

Confirmation is tracked per field, per plan (or per interview session for PRE_PLAN fields).

---

## F.2 Field-Level Lock Definition

Within the interview context, a "locked" field means:
- The user has explicitly confirmed the value.
- The extraction subsystem cannot silently overwrite it.
- Only the user can change it by explicitly requesting a change.

This is NOT the same as plan lock (Plan System LifecycleState=LOCKED). Field-level confirmation is a soft lock within the interview context only.

---

## F.3 Confirmation Flow

1. Extraction proposes a value from user message.
2. System asks user to confirm: "You're planning to move to Germany. Is that correct?"
3. User confirms → field confidence = explicit, field is "locked" within interview context.
4. User corrects → system updates to corrected value, asks for re-confirmation.

For destination_country (the plan creation trigger):
- Confirmation of destination_country triggers plan creation.
- This confirmation MUST be explicit. The system MUST NOT infer destination_country and auto-create a plan.

---

## F.4 Re-collection Rules

If user wants to change a confirmed field during POST_PLAN_COLLECTING:
- System must explicitly ask: "You previously confirmed [field] as [value]. Would you like to change it?"
- If user confirms change: update the field, recompute derived fields, and notify if this affects generation readiness.
- If the changed field is destination_country: this is a PLAN ANCHOR FIELD change. The system must warn that this will require full plan regeneration and may recommend creating a new plan instead of modifying the current one.

---

# G. INTERVIEW QUESTION STRATEGY

---

## G.1 Question Ordering

The interview follows a canonical question ordering:

Priority 1 (REQUIRED for plan creation):
1. destination_country — "Where are you planning to move?"

Priority 2 (REQUIRED for generation quality):
2. citizenship — "What's your current citizenship?" (may pre-populate from User Profile Layer 1)
3. purpose — "What's the main reason for your move?" (work/study/family/retirement/other)
4. move_date — "When are you planning to move?" (approximate is acceptable)

Priority 3 (OPTIONAL but improves plan quality):
5. family_size — "Will anyone be moving with you?"
6. budget_monthly — "What's your expected monthly budget?"
7. employment_context — "Do you have a job arranged, or will you be looking?"
8. housing_preferences — "Any housing preferences?"

The interview MUST ask destination_country first. Subsequent questions may be reordered based on conversational flow, but all Priority 2 questions should be asked before Priority 3.

---

## G.2 Adaptive Questioning

The interview system may adapt question ordering based on:
- Information already extracted from user messages (skip questions for fields already collected)
- User Profile Layer 1 defaults (pre-populate and confirm rather than ask fresh)
- Conversational context (if user volunteers information unprompted, extract and confirm)

The interview MUST NOT:
- Ask questions for fields already confirmed (unless user requests to change)
- Ask questions that are irrelevant to the user's situation (e.g., employer details for retirees)
- Repeat questions that were clearly answered

---

## G.3 Minimum Viable Interview

The absolute minimum interview to create a plan:
1. Ask destination_country.
2. User confirms.
3. Plan created.

All other questions are optional for plan creation but recommended for generation quality.

The system should communicate this: "I have enough to create your plan! But the more you tell me, the better your plan will be. Would you like to answer a few more questions, or shall we generate your plan now?"

---

# H. ERROR HANDLING

---

## H.1 Failure Types

- Stream failure (AI response generation fails)
- Extraction failure (extraction model fails to parse user input)
- State mismatch (interview state and plan state are inconsistent)
- Plan creation failure (Plan System fails to create plan at interview completion)
- Profile write failure (Profile Write API rejects an extraction write)
- Session expiry (interview session TTL exceeded)

---

## H.2 Recovery

Stream failure: retry once, then show error message. User can resend message.

Extraction failure: skip extraction, continue conversation. Ask clarification if ambiguous.

State mismatch: server reconciles (advance interview state to match plan state). Never roll back plan state.

Plan creation failure: retry once. If still fails: show error "Could not create your plan. Please try again." User can retry.

Profile write failure: show error for the specific field. Do not block the entire interview.

Session expiry (PRE_PLAN): start fresh interview. No plan data was committed.
Session expiry (POST_PLAN): resume from plan state. Plan Profile data is persisted.

---

## H.3 Idempotency

Each message has a unique id.

Duplicate writes rejected (via Chat History System deduplication).

Plan creation is idempotent: if the plan creation trigger fires twice, the second attempt detects the existing plan and links to it rather than creating a duplicate.

---

## H.4 Logging

Log per interview interaction:
- message_id
- conversation_id
- extraction records (field, value, confidence, source_message_id)
- state transitions
- errors (with context)
- plan_creation_event (when plan is created)

---

# I. INTEGRATION CONTRACT

---

## I.1 Systems the Interview Reads

- User Profile (Layer 1) — for defaults and pre-population
- Plan Profile (Layer 2) — for POST_PLAN phase, to know which fields are already filled
- Profile Schema — to know which fields to collect and their validation rules

---

## I.2 Systems the Interview Writes To

- Chat History System — conversation messages, extraction records
- Plan System — triggers plan creation at interview completion (via system event, not direct DB write)
- Profile System — writes extracted values to Plan Profile Layer 2 (POST_PLAN phase only, via Profile Write API)

---

## I.3 Systems the Interview Does NOT Write To

- Guide Generation System
- Recommendation System
- Timeline System
- Task System
- Requirements System
- Dashboard System
- Data Update System (profile changes trigger Data Update via the Profile System, not directly from the interview)

---

## I.4 Handoff to Plan Contextual Chat

When the interview terminates (INTERVIEW_COMPLETE → TERMINATED):

1. The onboarding_interview conversation is archived/completed.
2. The Plan Contextual Chat System becomes the active chat mode.
3. A new plan_contextual conversation may be created for the plan.
4. The user sees a seamless transition: "Your plan for [destination] is being generated! Your assistant is ready to help."

The two chat systems MUST NOT share active conversation state. The onboarding_interview conversation is historical once terminated.

---

# J. AI EXECUTION CONTRACT

---

## J.1 Allowed AI Actions

- Generate interview question text
- Generate conversational responses (confirmation, clarification, explanation)
- Propose extraction candidates from user messages

NOT allowed:

- Direct database writes
- State transitions (proposed by AI, executed by server)
- Plan creation (triggered by interview completion logic, not AI decision)
- Artifact generation

---

## J.2 AI Input Contract

AI receives:

- Conversation history (onboarding_interview messages)
- Current interview state (which fields are collected, which are pending)
- Profile schema (field definitions, validation rules)
- User Profile Layer 1 defaults (for pre-population context)
- Plan Profile Layer 2 (POST_PLAN only — current field values)

AI does NOT receive:

- Other users' data
- Other plans' data
- Generated artifacts from any plan
- System configuration or secrets

---

## J.3 AI Output Contract

AI returns:

- message_text (the response to show the user)
- extraction_candidates (structured fields extracted from user message, with confidence levels)
- next_question_suggestion (optional — which field to ask about next)

Server validates all output before persisting. Invalid output is rejected and logged.

---

## J.4 Model Configuration

Interview question generation:
- Model: as configured (GPT-4o or equivalent)
- Temperature: low (0.3) for consistent conversational quality
- Max tokens: bounded (e.g., 500 for responses)

Extraction:
- Model: as configured (GPT-4o-mini or equivalent)
- Temperature: 0 for deterministic extraction
- Max tokens: bounded (e.g., 200 for extraction output)
- Strict JSON schema validation on output

---

# K. RELATIONSHIP TO OTHER SYSTEM DEFINITIONS

---

## K.1 Plan System

The Interview System triggers plan creation via the Plan System when destination_country is confirmed. The Plan System owns the plan creation transaction. The Interview System does not create plans directly.

Reference: Plan System Definition D.1 (Creation Trigger).

## K.2 Profile System

The Interview System writes to Plan Profile Layer 2 via the Profile Write API during POST_PLAN phase. It reads User Profile Layer 1 for defaults during PRE_PLAN phase.

Reference: Profile System Definition E (Edit Behavior), F (Chat Sync Semantics).

## K.3 Onboarding System

The Interview System is the primary mechanism through which the Onboarding System achieves its goal (first plan creation + first output generation). The Onboarding System defines the higher-level state machine; the Interview System handles the chat interaction within it.

Reference: Onboarding System Definition A4 (Pre-Plan vs Post-Plan Boundary), C1 (When is First Plan Created).

## K.4 Chat History System

The Interview System uses the Chat History System for message persistence, using conversation_kind = "onboarding_interview". The Chat History System owns conversation identity and message ordering.

Reference: Chat History System Definition B.2 (Cardinality), C (Message Persistence Contract).

## K.5 Data Update System

The Interview System does NOT interact with the Data Update System directly. Profile changes made during POST_PLAN phase flow to the Data Update System via the Profile System's update notification mechanism.

Reference: Data Update System Definition B (Update Trigger Contract).

---

# SYSTEM INVARIANTS

Invariant 1:

The Onboarding Interview System and Plan Contextual Chat System are separate, independent systems.

Invariant 2:

The Onboarding Interview System MUST terminate permanently when plan generation begins (Stage=generating).

Invariant 3:

Chat never writes to the database directly. All writes go through the Profile Write API and Plan System.

Invariant 4:

Database is the single source of truth for profile data. Interview session state is authoritative only for pre-plan collected data before plan creation.

Invariant 5:

Extraction never overwrites confirmed values without explicit user consent.

Invariant 6:

Plan creation requires explicit user confirmation of destination_country. It is NEVER triggered silently by inference or assumption.

Invariant 7:

Conversation state transitions are server-controlled. Client may not advance interview state.

Invariant 8:

The Interview System MUST NOT provide open-ended relocation advisory. That is the Plan Contextual Chat System's responsibility.

---

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Plan System (plan-system.md) | PARTIAL |
| Profile System (profile-system.md) | PARTIAL |
| Onboarding System (onboarding-system.md) | PARTIAL |
| Chat History System (chat-history-system.md) | NOT_IMPLEMENTED |
| Data Update System (data-update-system.md) | NOT_IMPLEMENTED |
| Plan Contextual Chat (plan-contextual-chat-system.md) | PARTIAL |

# END OF DEFINITION

---

## v1 Alignment Note (GAP-003)

The v1 implementation uses a 4-state machine instead of the 8-state model described above:

| v1 State | Definition Equivalent(s) |
|----------|-------------------------|
| `interview` | PRE_PLAN_ACTIVE, PRE_PLAN_WAITING_FOR_USER, PRE_PLAN_PROCESSING |
| `review` | PLAN_CREATED |
| `confirmed` | POST_PLAN_COLLECTING (unreachable in code — plan locks directly) |
| `complete` | INTERVIEW_COMPLETE |

The 4-state model covers the functional flow. The 8-state model adds sub-state granularity (e.g., distinguishing "waiting for user input" from "processing user input") that is not needed in v1 because the chat endpoint handles both synchronously.

**Source:** `lib/gomate/state-machine.ts`
