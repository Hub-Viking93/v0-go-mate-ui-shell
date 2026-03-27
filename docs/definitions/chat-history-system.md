CHAT HISTORY SYSTEM — FULL SYSTEM DEFINITION
GoMate — Canonical Specification

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: NOT_IMPLEMENTED (explicitly deferred to v2 — see CLAUDE.md "Out of Scope")

V1 Implementation Reality:
- No conversations table or messages table exists in the database
- No chat history is persisted server-side
- Chat messages exist only in React component state (in-memory, per session)
- When the user refreshes the page or navigates away, all chat history is lost
- The interview chat reconstructs its state from the profile JSONB and the
  state machine, not from message history
- The post-arrival chat starts fresh every session

V1 Deviations from Canonical Spec:
- The entire spec (Sections A–Z) describes a persistence layer that does not
  exist in v1
- No conversation_id, message_id, sequence_number, or conversation_kind
- No greeting eligibility check via message_count — greetings are always shown
  on fresh page load (since there's no persisted history)
- No conversation lifecycle (empty → active → archived → completed)
- No plan linkage for conversations (the interview chat uses plan_id from the
  URL/context, not from a conversation record)
- No message deduplication or idempotency keys

V1 Cross-Reference Adjustments:
- Systems listed in Section O (Recommendation, Research, Interview, Dashboard,
  Guide Generation) that "may read chat history" — in v1 they cannot; they read
  from the profile JSONB and plan data instead
- Plan System sync (Section H) is not applicable — there are no conversation
  records to sync
- Chat Engine sync (Section I) — messages are sent to OpenAI API and the
  response is streamed back; no persistence step occurs

V1 Fallback Behavior:
- Interview continuity: achieved via profile JSONB + state machine (the
  interview knows what fields are collected, not what was said)
- Post-arrival chat: no continuity; every page load starts a new conversation
- Greeting: always rendered on page load (virtual, not gated by history)
- Re-entry: user sees a fresh chat with a greeting, regardless of prior sessions

============================================================

This system is the ONLY source of truth for:
- conversation existence
- message existence
- conversation continuity
- greeting eligibility
- deterministic message ordering
- conversation state

No other system may infer chat state from UI heuristics, plan state, or streaming state.

CRITICAL SCOPE NOTE:
The Chat History System is a PERSISTENCE LAYER. It does not define chat behavior, chat authority, or chat lifecycle.
It persists conversations and messages for ALL chat systems (Onboarding Interview System and Plan Contextual Chat System).
Shared persistence does NOT imply shared system identity.

============================================================
A. PURPOSE & OWNERSHIP
============================================================

A.1 Primary Purpose

The Chat History System exists to:
1) Persist all conversations and messages for all chat systems
2) Define conversation identity and continuity
3) Provide deterministic ordering and retrieval
4) Provide resumable state (load exactly what happened)
5) Provide an auditable log of what the user and assistant actually said

It does NOT:
- generate AI text
- execute streaming
- run tools
- apply plan logic
- decide recommendations
- define chat behavior or authority (that belongs to the owning chat system)

It records and serves the canonical record.

A.2 Source of Truth Definition

Chat History is the single source of truth for:
- whether a conversation exists
- whether any messages exist
- the exact ordered message list
- whether greeting is eligible (purely derived from history)
- conversation state (empty/active/etc.)

A.3 Ownership Scope

Chat History System explicitly OWNS:
- conversation records (metadata)
- message records (final persisted text)
- message ordering keys (sequence_number)
- message status (draft/final/failed)
- conversation state derived from message existence

It does NOT own:
- model prompts
- tool execution traces (those live elsewhere, optionally referenced)
- plan lifecycle
- UI state (scroll position is client-owned)
- chat behavior or authority rules (owned by Onboarding Interview System or Plan Contextual Chat System respectively)

A.4 Ownership Relationship

Primary ownership hierarchy:

user_id → (plan_id | null) → conversation_id

- user_id is the top-level security boundary
- plan_id is the product context boundary (nullable for onboarding_interview conversations)
- conversation_id is the persistence identity boundary
- conversation_kind determines which chat system owns the behavioral logic

Session_id is NEVER a primary owner. Sessions are ephemeral.

============================================================
B. CONVERSATION IDENTITY MODEL
============================================================

B.1 Conversation Definition

A conversation is defined as:
"A persistent chat thread for a specific user within a specific context."

Context is determined by conversation_kind:

- onboarding_interview: Thread for structured profile collection during onboarding. Initially has no plan_id (PRE_PLAN phase). Linked to plan_id at plan creation.
- plan_contextual: Thread for the Plan Contextual Chat Assistant tied to a specific plan. Always has plan_id.

Therefore:
- Onboarding Interview Conversation = (user_id, conversation_kind="onboarding_interview")
- Plan Contextual Conversation = (user_id, plan_id, conversation_kind="plan_contextual")

A conversation is NOT:
- per session
- per destination
- per guide version
- per app launch

B.2 Cardinality

Onboarding Interview conversations:
- One user MUST have at most ONE active onboarding_interview conversation at a time.
- plan_id is null during PRE_PLAN phase.
- On plan creation, the active onboarding_interview conversation MUST be linked to the new plan_id (preferred approach — preserves continuity).
- When the interview terminates, the conversation is archived. A new onboarding_interview conversation is created only for subsequent plan creation flows.

Plan Contextual conversations:
- One plan MUST have at most ONE plan_contextual conversation.
- plan_id is always required (NOT nullable).

General rules:
- Conversations MUST have a valid conversation_kind.
- A conversation with conversation_kind = "plan_contextual" MUST NOT have plan_id = null.
- A conversation with conversation_kind = "onboarding_interview" MAY have plan_id = null (during PRE_PLAN) or a valid plan_id (after plan creation).

B.3 Conversation Lifecycle

Conversation is created when:
- onboarding_interview: user clicks "Start your relocation plan" (or resumes onboarding). Created with plan_id = null.
- plan_contextual: user opens chat for a plan OR sends first message for that plan. Created with plan_id set.

Creation must be idempotent:
GET /conversation(user_id, conversation_kind, plan_id) may create-if-missing.

Plan creation handoff (onboarding_interview → plan linkage):
When the Plan System creates a plan from the onboarding interview:
1. The active onboarding_interview conversation is updated: plan_id is set to the new plan_id.
2. The conversation retains conversation_kind = "onboarding_interview" (it does NOT become plan_contextual).
3. This preserves the full interview history as part of the plan's records.
4. The interview conversation continues (POST_PLAN_COLLECTING phase) until the Interview System terminates.
5. On interview termination: the onboarding_interview conversation status is set to "archived" or "completed".
6. A new plan_contextual conversation is created for the Plan Contextual Chat System.

Alternative (allowed but not preferred):
- Archive the onboarding_interview conversation and create a fresh plan_contextual conversation at plan creation.
- This loses interview continuity in the plan chat but keeps separation cleaner.
- The product should prefer the primary approach unless there is a strong reason not to.

B.4 Persistence

Conversations are persistent and durable.
They are NOT ephemeral.

B.5 Conversation Schema (Required)

conversation_id (UUID)
user_id (UUID)
plan_id (UUID, NULLABLE — null during PRE_PLAN onboarding_interview)
conversation_kind (enum: "onboarding_interview" | "plan_contextual")
created_at (timestamptz)
updated_at (timestamptz)
status (enum: empty | active | archived | completed)
last_message_at (nullable timestamptz)
message_count (denormalized, optional but must be consistent if present)
version (schema version, optional)

B.6 Conversation Kind Semantics

onboarding_interview:
- Owned behaviorally by the Onboarding Interview System.
- Created at onboarding start.
- plan_id starts null, set at plan creation.
- Archived/completed when interview terminates (generation starts).
- One active per user at a time.

plan_contextual:
- Owned behaviorally by the Plan Contextual Chat System.
- Created when user first interacts with a plan's chat.
- plan_id always required.
- Remains active as long as the plan is not deleted.
- One per plan.

============================================================
C. MESSAGE PERSISTENCE CONTRACT
============================================================

C.1 Message Definition

A message is the atomic persisted utterance in a conversation.
Messages are always tied to exactly one conversation_id.

C.2 Persisted Message Types

Persisted roles:

- user
- assistant
- system (rare; only if intentionally persisted — e.g., "Plan created" notification)
- tool (only if product explicitly needs user-visible tool outputs)
- extraction (structured data extracted from user message — may be stored as a message with role=extraction or as metadata on the user message)

Metadata/status "events" are NOT messages.
They belong in separate telemetry tables.

C.3 Streaming Persistence

Streaming chunks are NOT persisted.
Only the FINAL assistant message is persisted.

Intermediate streaming state is transient and belongs to Chat Engine or frontend state.

C.4 Partial Responses

Partial assistant text is not stored as a message.
If streaming fails, you may store an assistant message with:
status = failed
content = partial content OR empty
metadata.fail_reason
(But it must never be shown as a "completed" assistant message.)

C.5 Message Schema (Required)

message_id (UUID)
conversation_id (UUID)
role (enum: user | assistant | system | tool | extraction)
content (TEXT)
created_at (timestamptz)
sequence_number (INT, strictly increasing per conversation)
status (enum: pending | completed | failed | deleted)
metadata (JSONB) includes:
- client_message_id (optional — for idempotency)
- idempotency_key (optional — for deduplication)
- streaming_run_id (optional — links to streaming session for debugging)
- error_code / fail_reason (optional)
- model_id (optional — which AI model generated this response)
- tool_refs (optional — references to tool executions)
- extraction_data (optional — structured extraction output for extraction-role messages)
- interview_state (optional — snapshot of interview state at this message, for onboarding_interview conversations)

C.6 Immutability

Messages are IMMUTABLE once completed.

If edits/corrections are allowed, they MUST be represented as:
- a new message (preferred)
OR
- a new version record (message_versions table)

Never overwrite completed content in place.

C.7 Conversation Kind-Specific Message Rules

onboarding_interview conversations:
- Messages include extraction_data in metadata when extraction was performed.
- Messages may include interview_state snapshots for reconstruction on resume.
- System messages may record plan creation events ("Plan for Germany created").

plan_contextual conversations:
- Messages include plan-scoped context markers in metadata (e.g., which artifacts were referenced).
- System messages may record task completion markers ("[TASK_DONE:task title]").

============================================================
D. MESSAGE ORDERING GUARANTEES
============================================================

D.1 Ordering Model

Canonical order is determined ONLY by:
sequence_number (primary)
created_at (tie-breaker, but should never be needed)

UI must sort by sequence_number.

D.2 Guarantee Level

Strict deterministic ordering is guaranteed within a conversation.

D.3 Concurrency Handling

If two messages are saved simultaneously:
- server assigns sequence_number using a transaction + atomic increment per conversation

No client may assign sequence numbers.

D.4 Retry Handling

Retries MUST NOT create duplicates.
Idempotency is enforced with:

idempotency_key OR client_message_id
scoped to (conversation_id, role)

On retry, server returns existing message_id and sequence_number.

D.5 Consistency Model

Strong consistency for writes within a single conversation.
(At minimum: read-your-writes guarantees for the same user and plan.)

============================================================
E. LOADING SEMANTICS
============================================================

E.1 Load Triggers

When user opens chat:

For onboarding_interview:
1) Find active onboarding_interview conversation for user (create if missing, plan_id = null)
2) Load messages (all — interview conversations are short)

For plan_contextual:
1) Find plan_contextual conversation for current plan_id (create if missing)
2) Load messages (latest N)

E.2 Load Scope

Default load:
- onboarding_interview: all messages (typically <50)
- plan_contextual: last N messages (e.g., 50)

E.3 Pagination

Pagination supported for plan_contextual conversations:
- backward-only (load older messages)

Forward pagination is not required because newest are always loaded.

onboarding_interview conversations typically do not need pagination.

E.4 Lazy Loading

Older messages load on scroll-up (plan_contextual only).

E.5 Load Priority

Conversation first, messages second.
But conversation creation must not cause greeting bugs (see section F).

============================================================
F. GREETING BEHAVIOR CONTRACT (CRITICAL)
============================================================

F.1 Greeting Ownership

Greeting eligibility is decided ONLY by Chat History System,
derived from message existence.

Frontend must NOT infer greeting eligibility.
Chat Engine must NOT infer greeting eligibility.

F.2 Greeting Eligibility Definition

Greeting is eligible ONLY if:

message_count == 0

That's it.

Conversation existence is irrelevant.
A conversation may exist with zero messages; greeting is still eligible.

F.3 Greeting Suppression Rules

Greeting must NEVER appear if ANY message exists:
- any user message exists
OR
- any assistant message exists
OR
- any system/tool message exists

F.4 Greeting Persistence

Greeting is NOT persisted as a message.
It is a virtual UI state rendered only when message_count == 0.

Reason:
Persisting greetings risks duplication and pollutes audit history.

F.5 Greeting Identity

Greeting is a virtual assistant message rendered by UI, gated by:
message_count == 0

F.6 Greeting Uniqueness Guarantee

Since it is virtual and gated by message_count==0,
it cannot duplicate as long as message_count is accurate.

INVARIANT:
If message_count > 0, greeting must not render.

F.7 Greeting Content by Conversation Kind

onboarding_interview greeting:
"Let's build your relocation plan together. Where are you planning to move?"
(Or equivalent onboarding prompt)

plan_contextual greeting:
"I'm your relocation assistant for your [destination] plan. How can I help?"
(Or equivalent plan-scoped greeting)

Greeting content is owned by the respective chat system (Onboarding Interview System or Plan Contextual Chat System), not by Chat History System. Chat History only gates whether the greeting renders.

============================================================
G. EMPTY STATE DEFINITION
============================================================

G.1 Empty Chat

Empty chat is defined as:
message_count == 0

It does NOT matter if conversation exists.

G.2 Inactive Chat

Inactive chat is defined as:
message_count > 0 AND last_message_at older than inactivity threshold

This affects UI (e.g., "Continue where you left off"),
but does not affect greeting.

G.3 Empty vs Inactive UX

Empty:
- show greeting + prompts

Inactive:
- show last messages, no greeting

G.4 Archived/Completed Conversation

An archived or completed conversation (e.g., a terminated onboarding_interview):
- Messages are readable but the conversation is no longer accepting new messages.
- UI may show a "This conversation has ended" indicator.
- The plan_contextual conversation (if it exists for the same plan) takes over as the active chat.

============================================================
H. SYNC WITH PLAN SYSTEM
============================================================

H.1 Plan Relationship

plan_contextual conversations have a hard foreign key to plan_id.
onboarding_interview conversations have a nullable foreign key to plan_id (set at plan creation).

H.2 Plan Switching Behavior

When user switches plan (user.current_plan_id changes):
- Load the plan_contextual conversation for the new plan_id.
- Create if missing.
- Do NOT reuse conversations from another plan_id.
- onboarding_interview conversations are NOT affected by plan switching (they are keyed by user_id, not current_plan_id).

H.3 Plan Locking Behavior

Plan locking does NOT freeze the plan_contextual conversation by default.

Locking freezes plan artifacts (guide/timeline),
but chat may continue for support and Q&A.

If product wants lock to freeze chat, it must be an explicit feature flag.
Default: chat remains active (read-only context + Q&A mode, per Plan System Definition E.2).

H.4 Plan Deletion Behavior

When a plan is soft-deleted:
- The plan_contextual conversation for that plan is archived (status = archived).
- Messages remain readable for audit purposes but no new messages accepted.
- If the onboarding_interview conversation was linked to this plan_id, it also becomes read-only.

When a plan is hard-deleted:
- All conversations linked to plan_id are cascade-deleted.

H.5 Plan Creation (Onboarding Interview Handoff)

When Plan System creates a plan from the onboarding interview:
1. The active onboarding_interview conversation is updated: plan_id set to new plan_id.
2. The conversation continues until the Interview System terminates it.
3. On termination: conversation status → archived/completed.
4. A new plan_contextual conversation is created for the plan.

This is the ONLY moment where plan_id is set on an existing conversation. All other plan_id assignments happen at conversation creation time.

============================================================
I. SYNC WITH CHAT ENGINE
============================================================

I.1 Persistence Timing

User message persistence:
- saved BEFORE AI generation starts
(status=pending or completed)

Assistant message persistence:
- saved AFTER streaming completes as a single final message
(status=completed)

I.2 Failure Handling

If streaming fails:
- assistant message is saved with status=failed (optional)
- never marked completed
- UI can show "Try again" based on failed record

I.3 Streaming Identity

Streaming run_id is stored in assistant message metadata.
This is for debugging only.

I.4 Finalization

Assistant message is marked completed only once the final content is stored.

I.5 Chat System Routing

The Chat Engine routes messages to the appropriate chat system based on conversation_kind:
- onboarding_interview → Onboarding Interview System (structured collection behavior)
- plan_contextual → Plan Contextual Chat System (advisory behavior)

Chat History System does NOT perform this routing. It only persists. Routing is owned by the Chat Engine.

============================================================
J. MESSAGE EDIT / CORRECTION SEMANTICS
============================================================

J.1 Edit Capability

Default: no edits to past messages.

If edits are supported:

User edit:
- creates a new user message with metadata.edit_of=message_id

Assistant correction:
- creates a new assistant message with metadata.corrects=message_id

System override:
- creates a system message referencing affected message_id

J.2 Auditability

Original messages always preserved.

No overwrites.

============================================================
K. PERSISTENCE GUARANTEES
============================================================

K.1 Save Timing

User message is saved BEFORE any conversation state change.

Conversation state changes are derived from message existence only.

K.2 Save Failure Handling

If user message save fails:
- AI generation MUST NOT run
- UI shows error and retry

If assistant message save fails:
- do not show "completed" response
- retry save automatically
- UI shows failure state if needed

K.3 Durability

Messages are durable once saved.
System must support replay/loading later.

============================================================
L. RE-ENTRY BEHAVIOR
============================================================

L.1 Re-entry Load

On return:
- Determine which conversation to load:
  - If user.current_plan_id is not null → load plan_contextual conversation for that plan.
  - If user.current_plan_id is null AND active onboarding_interview exists → load onboarding_interview conversation.
  - If user.current_plan_id is null AND no active conversations → show onboarding entry screen.
- Load latest messages.
- Restore scroll position client-side (optional).

L.2 Resume Position

Default resume at latest message.

L.3 Greeting Suppression

Greeting must never show if message_count > 0.

L.4 State Reconstruction

Full chat state can be reconstructed from:
conversation metadata + ordered message list

For onboarding_interview conversations: interview state can be reconstructed from extraction records in message metadata.

============================================================
M. ERROR HANDLING
============================================================

M.1 Load Failure

If history fails to load:
- show error with retry
- do not render greeting unless confirmed message_count==0 from server

M.2 Save Failure

If save fails:
- retry with same idempotency key
- do not create duplicates

M.3 Consistency Failure

If ordering corrupted (should not happen):
- system reassigns sequence_number via repair job
- UI uses repaired order

M.4 Plan Linkage Failure

If plan creation succeeds but onboarding_interview conversation fails to link plan_id:
- Retry linkage.
- If retry fails: create a new plan_contextual conversation for the plan. The onboarding_interview conversation remains unlinked (orphaned). Log for admin investigation.
- Never fail plan creation because of conversation linkage failure.

============================================================
N. DEDUPLICATION
============================================================

N.1 Duplicate Prevention

Client sends:
client_message_id or idempotency_key

Server enforces uniqueness per conversation.

N.2 Retry Deduplication

Retry of same user message returns existing message.

N.3 Assistant Deduplication

Assistant responses deduped by:
- idempotency key tied to user_message_id + attempt_number
OR
- streaming_run_id uniqueness

============================================================
O. CROSS-SYSTEM DEPENDENCIES
============================================================

Systems that may read chat history:

Recommendation System (summary only)
Research System (summary only)
Interview System (derived answers only — extraction records)
Dashboard System (derived state only)
Guide Generation System (summary only)

Other systems must NOT ingest full raw history by default.
They should consume:
- latest N messages
- server-produced conversation summary artifact
- extracted structured answers (Interview System output)

Guarantee:
Other systems may rely on chat history for what was said,
but must not infer plan state from it.

Cross-system access must always filter by conversation_kind:
- Systems needing onboarding data should read onboarding_interview conversations.
- Systems needing plan chat data should read plan_contextual conversations.
- No system should blindly read all conversations for a user/plan without kind filtering.

============================================================
P. CONVERSATION STATE MODEL (CRITICAL)
============================================================

P.1 States

Conversation status enum:

empty — conversation exists but has no messages
active — conversation has messages and is accepting new messages
archived — conversation is read-only (plan archived or interview terminated)
completed — conversation's purpose is fulfilled (interview completed, interview terminated)

("completed" is a chat lifecycle concept here, NOT a plan concept.)

P.2 Transition Rules

empty → active
when message_count becomes > 0

active → archived
- explicit user action (archive plan)
- plan deletion (plan soft-deleted → conversation archived)
- plan archival (plan LifecycleState → ARCHIVED)

active → completed
- onboarding_interview: interview terminates (generation starts)
- plan_contextual: not typically used (chat remains active as long as plan is active)

State is owned by Chat History System.

Derived fields:
- message_count
- last_message_at

P.3 Conversation Kind × Status Matrix

| Conversation Kind      | empty | active | archived | completed |
|------------------------|-------|--------|----------|-----------|
| onboarding_interview   | YES   | YES    | YES      | YES       |
| plan_contextual        | YES   | YES    | YES      | NO*       |

* plan_contextual conversations don't use "completed" — they stay active or get archived when the plan lifecycle changes.

============================================================
Q. MESSAGE DELIVERY GUARANTEES
============================================================

Persistence delivery goal:
At-least-once delivery from client to server,
with server-side idempotency to achieve effectively exactly-once storage.

So:
- transport may be at-least-once
- storage is exactly-once per idempotency key

============================================================
R. IDENTITY & SECURITY
============================================================

All reads and writes require:
- authenticated user_id
- conversation.user_id == auth.user_id

For plan_contextual conversations:
- conversation.plan_id must be owned by user_id (validated via Plan System)

For onboarding_interview conversations:
- conversation.user_id must match auth.user_id
- plan_id (if set) must be owned by user_id

Authorization invariant:
A user can only access conversations where conversation.user_id == auth.user_id.

No cross-user conversation access. Ever.

============================================================
S. PERFORMANCE & SCALABILITY
============================================================

Expected scale:
- onboarding_interview: 10-50 messages per conversation (short, structured)
- plan_contextual: up to 10k messages per conversation (upper bound)

Performance requirements:
- Default load last 50 messages within <300ms server time (target)
- Pagination must be indexed by (conversation_id, sequence_number)
- onboarding_interview full load within <200ms (short conversations)

Indexes required:
- messages(conversation_id, sequence_number)
- conversations(user_id, conversation_kind) — for finding onboarding_interview conversations
- conversations(user_id, plan_id) — for finding plan_contextual conversations (unique per plan)
- conversations(plan_id) — for plan deletion cascade

============================================================
T. CACHE MODEL
============================================================

Client caches last loaded page locally.
Server may cache conversation metadata.

Cache invalidation triggers:
- new message persisted
- conversation status change
- plan_id linkage update (onboarding_interview → plan_id set)

Never cache greeting eligibility separately.
Always derived from message_count.

Cache must be keyed by conversation_id (NOT by plan_id alone, since multiple conversation kinds may exist for the same plan).

============================================================
U. DELETION SEMANTICS
============================================================

Default deletion is SOFT DELETE.

Messages:
- status=deleted
- content replaced with empty or "[deleted]"
- original retained in secure audit storage (optional)

Conversations:
- archived by default
- hard delete only if required by policy and compliant with audit rules
- hard delete cascades all messages

On plan hard-delete:
- All conversations linked to plan_id are cascade hard-deleted.
- All messages within those conversations are cascade hard-deleted.

============================================================
V. ANALYTICS & OBSERVABILITY
============================================================

Tracked events:
- conversation_created (with conversation_kind)
- conversation_plan_linked (onboarding_interview conversation linked to plan_id)
- message_persisted (with role, conversation_kind)
- message_failed
- conversation_archived
- conversation_completed
- pagination_loaded

Reason:
- debugging ordering issues
- measuring engagement per chat system
- detecting greeting bugs
- tracking onboarding interview completion rate

Logs must include:
conversation_id, conversation_kind, message_id, sequence_number, status, idempotency_key

============================================================
W. MIGRATION & VERSIONING
============================================================

Message schema can evolve via:
- metadata expansion
- version field on conversation and message

Old messages are read with backward compatible parsing.

Migration note for conversation_kind:
- Existing conversations created before conversation_kind was introduced should be classified:
  - If conversation has plan_id and was the primary chat → conversation_kind = "plan_contextual"
  - If conversation has no plan_id → conversation_kind = "onboarding_interview"
- This classification can be done via a one-time migration.

============================================================
X. OFFLINE BEHAVIOR (OPTIONAL)
============================================================

Offline compose allowed client-side.
Sync later using idempotency keys.

No offline assistant generation.

Offline messages are queued locally and submitted on reconnection.

============================================================
Y. SYSTEM INVARIANTS (CRITICAL — MUST HOLD)
============================================================

1) Conversation existence is determined ONLY by Chat History.
2) Greeting eligibility is determined ONLY by message_count (derived from history).
3) Greeting must NEVER appear if any message exists.
4) Message order must ALWAYS be deterministic (sequence_number).
5) Message persistence must ALWAYS occur before conversation state changes.
6) No other system may recreate conversation state independently.
7) Streaming chunks are never persisted as messages.
8) Completed messages are immutable.
9) conversation_kind is required on every conversation and determines which chat system owns behavioral logic.
10) An onboarding_interview conversation's plan_id is nullable (null during PRE_PLAN, set at plan creation).
11) A plan_contextual conversation's plan_id is NEVER nullable.
12) Shared persistence layer (Chat History System) does NOT merge system identity between Onboarding Interview System and Plan Contextual Chat System.

============================================================
Z. SOURCE OF TRUTH DEFINITION (CRITICAL)
============================================================

Chat History System is the ONLY source of truth for:
- conversation existence
- message existence
- continuity across sessions
- greeting eligibility
- retrieval ordering
- conversation kind classification

Frontend and Chat Engine must treat Chat History as authoritative.
They may display UI states, but may not invent state.

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Recommendation System (recommendation-system.md) | MINIMAL |
| Research System (research-system.md) | PARTIAL |
| Chat Interview System (chat-interview-system-definition.md) | PARTIAL |
| Dashboard System (dashboard.md) | PARTIAL |
| Guide Generation System (guide-generation.md) | PARTIAL |
| Plan System (plan-system.md) | PARTIAL |
| Plan Contextual Chat (plan-contextual-chat-system.md) | PARTIAL |
| Onboarding System (onboarding-system.md) | PARTIAL |

============================================================
END OF DEFINITION
============================================================