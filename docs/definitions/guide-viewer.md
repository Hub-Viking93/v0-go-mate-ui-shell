GoMate — Guide Viewer System
MASTER SYSTEM DEFINITION
Canonical Behavioral Contract
Version: 1.0
Authority: Guide Generation System (Data), Guide Viewer System (Presentation Only)

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: PARTIAL

V1 Implementation Reality:
- Guide viewer exists and renders generated guide content
  (app/(app)/guides/[id]/page.tsx)
- Renders guide sections from the JSONB guide content stored in the
  `guides` table
- PDF export exists (schema key fixed in Phase 1)
- Section-based navigation works
- No guide versioning display — only shows current guide content (there
  is no immutable guide_versions table or version navigator)
- STALE indicator exists when `guide.is_stale = true`
- Explicit user actions exist for regenerate, delete, and PDF export
- No guide comparison view (no version history to compare)

V1 Deviations from Canonical Spec:
- Section A (presentation system): COMPLIANT — guide viewer is read-only
  presentation
- Section B (version navigation): NOT_IMPLEMENTED — no guide versions to
  navigate; single guide content rendered
- Section C (staleness indicator): PARTIAL — STALE badge + regenerate CTA
  exist, but there is no immutable version history or current-pointer model
- Section D (section navigation): COMPLIANT — section-based navigation
  works
- Section E (PDF export): COMPLIANT — PDF generation works
- Section F (inline actions): PARTIAL — regenerate / delete / PDF actions
  exist, but no task-completion or booking actions are bound from guide content

V1 Cross-Reference Adjustments:
- Guide Generation: viewer reads JSONB guide content directly — no
  artifact versioning or snapshot binding
- Profile versioning: does not exist — viewer can display `is_stale`, but
  cannot resolve a true frozen profile version
- Task System: no guide → task linking in the viewer
- Booking System: no booking actions from guide content

V1 Fallback Behavior:
- Guide display: renders all generated guide sections with navigation
- PDF export: works for offline reference
- Limited interaction: regenerate, delete, and PDF export only

============================================================

============================================================
A. PURPOSE & RESPONSIBILITY BOUNDARY
============================================================

Primary Purpose

The Guide Viewer System is responsible exclusively for loading, rendering, and presenting guide data to the user.

It does NOT generate, modify, compute, or persist guide content.

It exists to:

- Retrieve guide data
- Render guide data
- Provide structured navigation
- Provide interaction with rendered guide artifacts
- Trigger allowed external system actions (via explicit user intent only)

It is a PRESENTATION SYSTEM.

It is NOT a data authority.


Responsibility Separation

Guide Generation System:

- Creates guide data
- Validates guide data
- Versions guide data
- Stores guide data

Guide Viewer System:

- Loads guide data
- Displays guide data
- Navigates guide data
- Handles viewer state


Modification Authority

Guide Viewer is STRICTLY READ-ONLY.

Guide Viewer may NEVER:

- Modify guide data
- Persist guide data
- Mutate guide state


Viewer Role Classification

Guide Viewer is:

- Read-only presentation layer
- Interactive navigation system
- Stateful client rendering system

Guide Viewer is NOT:

- Editable interface
- Data authority
- Generation authority


Explicitly OUTSIDE Guide Viewer Responsibility

Guide Viewer may NEVER:

- Generate guide
- Update guide
- Validate guide
- Store guide
- Modify guide schema


============================================================
B. GUIDE IDENTITY & LOADING
============================================================

Guide Selection Logic

Guide Viewer MUST load:

Latest COMPLETED guide version for current plan.


Identity Keys

Canonical identifiers:

plan_id (required)
guide_id (required)
version_id (required)


Version Resolution Rules

Default version resolution:

SELECT guide_version
WHERE plan_id = current_plan_id
AND status = "completed"
ORDER BY version_number DESC
LIMIT 1


Missing Guide Handling

If guide does not exist:

Display Empty State:

"Your guide is not ready yet."

Guide Viewer MUST NOT trigger generation automatically.


STALE Guide Handling

If guide status = STALE (guide-generation.md B.5, C.3):

Display STALE indicator badge on guide header.

Display contextual message:

"Your guide may be out of date. Some inputs have changed since it was generated."

Display CTA:

"Regenerate Guide"

Guide Viewer MUST NOT auto-regenerate. User MUST explicitly click regenerate.

Cross-reference: guide-generation.md Section C.3 (Upstream Change → STALE Lifecycle).


============================================================
C. TABS STRUCTURE CONTRACT
============================================================

Tab Definition

Tab is a logical navigation container grouping related sections.


Tab Schema

Each tab contains:

id
label
order
visibility
sections[]


Tab Ownership

Tabs are:

Version-specific
Dynamically generated by Guide Generation System


Minimum Required Tabs

Guide MUST support:

overview
visa
cost_of_living
housing
healthcare
tasks


Conditional Tabs

Tabs may vary based on:

destination
visa type
profile
guide version


Tab Ordering

Tab order is defined by Guide Generation System.

Viewer MUST NOT reorder.


============================================================
D. SECTION STRUCTURE CONTRACT
============================================================

Section Definition

Section is a structured content container within a tab.

Hierarchy:

Guide
→ Tab
→ Section
→ Block
→ Content


Section Schema

Section contains:

id
title
order
visibility
blocks[]
status


Missing Section Handling

If section empty:

Display empty state inside section.

If section hidden:

Do not render.


Content Types Supported

text
list
table
structured_data
tasks
actions


============================================================
E. NAVIGATION MODEL
============================================================

Navigation Methods

tab click
scroll
deep link


Scroll Behavior

Scroll position preserved:

Between refresh: YES
Between sessions: YES


Deep Linking

Supported:

/plan/:plan_id/guide?tab=:tab_id§ion=:section_id


Navigation State Storage

Stored in:

URL
Local storage


Refresh Behavior

Restore position from URL.


============================================================
F. VERSION HANDLING
============================================================

Version Availability

Multiple versions supported.


Version Identity

version_id
version_number
created_at


Version Selector

User CAN select version.


Default Version

Latest COMPLETED version.


Version Access Rules

User may access ALL versions belonging to plan.


============================================================
G. VERSION TRANSITIONS
============================================================

New Version Created

Viewer behavior:

Stay on current version.

Show notification:

"New guide available."


User Control

User manually switches version.


Consistency

All tabs must render same version.


============================================================
H. SYNC WITH GUIDE GENERATION
============================================================

Update Detection

Push event from server.


Cache Invalidation

Triggered on:

new version
plan change


Race Conditions

Current version remains stable.

User may manually switch.


============================================================
I. DATA LOADING & CACHING
============================================================

Loading Triggers

Page load
Version change


Loading Scope

Entire guide loaded at once.


Caching Layers

Client memory cache.


Cache Duration

Until:

version change
plan change


Memory Model

Stored in client state.


============================================================
J. UX STATES
============================================================

Loading State

Show loading skeleton.


Empty State

Show guide not ready message.


Generation State

Show generating indicator.


Failure State

Show retry button.


Partial State

Allowed.

Sections render independently.


============================================================
K. RELATIONSHIP TO OTHER SYSTEMS
============================================================

Task System

Tasks embedded as reference objects.


Requirement System

Requirements rendered as structured content.


Recommendation System

Rendered as structured blocks.


Timeline System

Referenced externally.


Navigation Integration

Viewer may link externally.


============================================================
L. EDIT / REGENERATE TRIGGERS
============================================================

User May Trigger Regenerate:

YES


Trigger Flow

User clicks regenerate

Viewer sends request

Viewer remains on old version

New version generated

User switches manually


User Feedback

Show generating status.


============================================================
M. ERROR HANDLING
============================================================

Load Failure

Show retry.


Partial Failure

Show section error only.


Recovery

User retry allowed.


Error Visibility

User sees generic message.


============================================================
N. STATE MODEL
============================================================

States

idle
loading
ready
error
stale
generating


State Ownership

Client-side.

State Derivation:

- idle: no guide requested
- loading: guide data being fetched
- ready: guide data loaded, status = COMPLETED
- error: guide fetch failed
- stale: guide exists but status = STALE (upstream inputs changed — guide-generation.md C.3)
- generating: guide regeneration in progress (user triggered via L)


============================================================
O. DATA CONTRACT WITH GUIDE GENERATION
============================================================

Schema:

guide:

guide_id
plan_id
version_id
version_number
status
created_at

tabs[]

tab:

id
label
order
sections[]

section:

id
title
order
blocks[]

block:

id
type
content


Viewer is schema-aware.

Forward compatible.


============================================================
P. PERMISSIONS & ACCESS CONTROL
============================================================

Access

User may access own plan guides only.


Validation

Plan ownership required.


============================================================
Q. PERFORMANCE & SCALABILITY
============================================================

Max Load Time

< 2 seconds


Lazy Loading

Not required initially.


============================================================
R. URL & ROUTING CONTRACT
============================================================

Routes:

/plan/:plan_id/guide

Deep Link:

?tab=
§ion=


============================================================
S. PERSISTENCE OF UI STATE
============================================================

Persisted:

tab
scroll
version

Stored:

local storage


============================================================
T. ANALYTICS
============================================================

Tracked:

tab view
section view
version change
regenerate click


============================================================
U. FUTURE EXTENSIBILITY
============================================================

Supports:

new tabs
new sections
new blocks


============================================================
V. FAILURE ISOLATION
============================================================

Viewer failure affects UI only.

Guide data unaffected.


============================================================
W. MOBILE VS DESKTOP
============================================================

Same logic.

Different layout only.


============================================================
X. SECURITY
============================================================

Guide data protected via authentication.

Never cached publicly.


============================================================
Y. OFFLINE BEHAVIOR
============================================================

Not supported initially.


============================================================
Z. SOURCE OF TRUTH
============================================================

Guide Viewer is PURE RENDERING LAYER.

Guide Generation System is SINGLE SOURCE OF TRUTH.

Guide Viewer MUST NEVER become data authority.

============================================================
AA. CROSS-SYSTEM REFERENCES
============================================================


AA.1 Upstream (Guide Viewer reads from)

- Guide Generation System (guide-generation.md) — sole data authority; viewer loads guide artifacts including status, version, tabs, sections, blocks
- Plan System (plan-system.md) — plan_id for guide resolution; plan lifecycle affects guide availability

AA.2 Downstream (Guide Viewer triggers)

- Guide Generation System (guide-generation.md) — guide.regenerate_requested event when user clicks "Regenerate Guide" (Section L); this is an explicit user trigger only
- Event/Trigger System (event-trigger-system.md) — regenerate event routed through Event System

AA.3 Systems Rendered Within Guide

- Settling-in Task System (settling-in-tasks.md) — tasks embedded as reference objects in tasks tab
- Local Requirements System (local-requirements.md) — requirements rendered as structured content
- Recommendation System (recommendation-system.md) — recommendations rendered as structured blocks
- Cost of Living System (cost-of-living.md) — cost data rendered in cost_of_living tab
- Timeline System (timeline-system.md) — referenced externally (linked, not embedded)

AA.4 Shared Contracts

- Guide staleness: guide-generation.md Section C.3 (STALE lifecycle); viewer displays STALE badge and regenerate CTA
- Guide schema: guide-generation.md Section K (data model); viewer is schema-aware and forward-compatible (Section O)
- No auto-generation: guide-generation.md C.2 (guide NEVER auto-generates); viewer MUST NOT trigger generation without explicit user action
- Plan scoping: guide is plan-scoped; viewer accesses only current plan's guide versions

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Guide Generation System (guide-generation.md) | PARTIAL |
| Plan System (plan-system.md) | PARTIAL |
| Event Trigger System (event-trigger-system.md) | NOT_IMPLEMENTED |
| Settling-in Tasks (settling-in-tasks.md) | PARTIAL |
| Local Requirements System (local-requirements.md) | NOT_IMPLEMENTED |
| Recommendation System (recommendation-system.md) | MINIMAL |
| Cost of Living System (cost-of-living.md) | PARTIAL |
| Timeline System (timeline-system.md) | NOT_IMPLEMENTED |


============================================================
AB. SYSTEM INVARIANTS
============================================================


Invariant 1: Guide Viewer is STRICTLY READ-ONLY — it MUST NEVER modify, persist, or mutate guide data.

Invariant 2: Guide Viewer MUST NOT trigger generation automatically — regeneration requires explicit user click.

Invariant 3: Guide Viewer displays STALE indicator when guide status = STALE — never hides staleness.

Invariant 4: All tabs MUST render the same guide version — no cross-version mixing within a session.

Invariant 5: Guide Generation System is the SINGLE SOURCE OF TRUTH — Guide Viewer is a pure rendering layer.

Invariant 6: Viewer failure affects UI only — guide data is unaffected (Section V).


============================================================
FINAL CONTRACT
============================================================

Guide Viewer is read-only rendering system.

Guide Viewer owns presentation.

Guide Generation owns data.

Guide Viewer must never mutate guide.

All GoMate systems must comply.
