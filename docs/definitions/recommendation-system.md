Recommendation System — System Definition (Canonical Spec)
GoMate Recommendation System = deterministic decision layer that converts (Profile + Research + Rules) into actionable, versioned Recommendation snapshots with explainability, confidence, and safe constraints.

============================================================
V1 IMPLEMENTATION SCOPE (REBASELINE)
============================================================

V1 Status: MINIMAL

V1 Implementation Reality:
- Of the 10 recommendation types defined (Section A.5), only visa_route has
  any implementation
- No unified recommendations table or recommendations_current pointer table
- No recommendation snapshots, versioning, or idempotency keys
- Visa recommendations are generated as part of the guide generation pipeline
  and embedded in the guide output — not stored as independent artifacts
- No recommendation lifecycle states (pending_inputs, queued, generating, etc.)
- No recommendation confidence scoring, ranking, or explainability output
- No user override / alternative selection flow

V1 Deviations from Canonical Spec:
- Section A.5 (10 recommendation types): 9 of 10 NOT_IMPLEMENTED —
  budget_model, timeline_plan, housing_path, local_admin_path,
  job_search_strategy, tax_residency_admin, language_education,
  insurance_plan, first_week_pack do not exist as recommendation artifacts
- Section B (entity model): NOT_IMPLEMENTED — no recommendation_id,
  profile_snapshot_hash, research_bundle_id, ruleset_version, or any of the
  snapshot identity fields
- Section J (versioning & regeneration): NOT_IMPLEMENTED — no supersession,
  no major/minor classification, no pointer updates
- Section L (persistence model): NOT_IMPLEMENTED — no recommendations or
  recommendations_current tables
- Section O (lifecycle states): NOT_IMPLEMENTED — no state machine

V1 Cross-Reference Adjustments:
- Event System references: no recommendation events emitted
- Data Update System DAG references: recommendations are not a DAG node
- Guide coupling (Section P): in v1, visa recommendation is generated inline
  during guide generation — not a frozen snapshot referenced by the guide
- Research dependency (Section Q): research feeds into guide generation
  directly, not into a recommendation step first

V1 Fallback Behavior:
- Visa recommendation: generated as part of the guide generation pipeline
  using GPT-4o / Claude Sonnet 4; output is embedded in the guide
- Other 9 recommendation types: do not exist; the guide content covers some
  of this ground implicitly (budget, timeline, admin steps)
- No stored recommendation artifacts that dashboard or chat can reference

============================================================

================================================================================
0) Scope & non-goals (guardrails)
================================================================================
0.1 In-scope
- Decisioning: produce “what to do next” recommendations (primary + ranked alternatives) across enumerated types.
- Explainability: produce structured reasons, assumptions, blockers, and tradeoffs (both internal/audit and user-safe).
- Action hints: output “required_actions” as structured next-step intents (NOT full how-to guides).
- Validation: enforce safety constraints (no guarantees), schema validation, and confidence gating.
- Versioning + idempotency: guarantee stable “current pointer” per (plan_id, recommendation_type).

0.2 Out-of-scope
- Content writing: no full guide prose, no long-form instructions, no UI copy beyond short user-safe explanations.
- UI rendering: Recommendation System returns data objects only; UI decides layout and tone.
- Chat persona: no conversational behavior; chat consumes snapshots.
- Legal advice: no eligibility guarantees, no “you qualify”, no “approval likely” phrasing as certainty.
- Booking execution: does not book flights/housing; may recommend “book X” as an action.

0.3 Hard constraints (safety)
- Never present guaranteed outcomes (“guaranteed approval”, “you will be granted”, “this visa is assured”).
- Never fabricate costs, processing times, or requirements.
- If citing sources: citations must be explicit references to official sources (stored as URLs + metadata) OR marked “unverified”.
- Must always surface uncertainty:
  - If eligibility uncertain: mark as “unknown” and require follow-up info.
  - If research is stale: reduce confidence and show “needs refresh”.
- Must never contradict authoritative constraints:
  - Research bundles can contain “hard constraints” (e.g., “not available”); recommendations must respect them.

0.4 What must NEVER happen (system invariants)
- Hallucinated eligibility claims.
- Fabricated costs/timelines.
- “Guaranteed approval” language.
- Producing “current recommendation pointer” that references a nonexistent snapshot.
- Two different “current” snapshots for same (plan_id, recommendation_type).
- UI divergence: chat/dashboard/guide referencing different recommendation_ids for same type.

================================================================================
A) Purpose & decision authority (role clarity)
================================================================================
A.1 Single sentence mission
“Select the safest, most feasible primary path and ranked alternatives for the user’s goal, with explicit assumptions, tradeoffs, blockers, and next actions—without over-claiming.”

A.2 Decision authority level
Selectable alternatives (ranked options) by default.
- System proposes: primary + alternatives.
- User selects: final path (“user_choice”) when choice is required.
- System adapts: downstream plan/timeline/modules based on the active selection.

A.3 Consuming surfaces (read-only)
- Chat: shows summary and asks for missing info / selection.
- Dashboard: shows “Your path” cards per recommendation_type.
- Plan Builder: uses active recommendation + user choice to generate tasks/timeline.
- Guide Generator: uses selected/frozen snapshot (see P).
- Export/PDF: uses stored snapshot IDs only.

A.4 System-owned vs user-owned decisions
System-owned:
- Ranking, confidence, safety gating, required actions, and “needs info” questions.
User-owned:
- Choosing among alternatives when multiple feasible routes exist.
- Confirming assumptions (move date, budget tolerance, risk tolerance).
- Overriding with acknowledgement when feasible-but-risky.

A.5 Recommendation categories (canonical enum)
recommendation_type (enum):
1) visa_route
2) budget_model
3) timeline_plan
4) housing_path
5) local_admin_path (residency registration, IDs, healthcare registration)
6) job_search_strategy
7) tax_residency_admin
8) language_education
9) insurance_plan
10) first_week_pack (“do first”)
Extensibility rule: new types must be added via versioned schema + tests (see T).

================================================================================
B) Recommendation entity model (data contract)
================================================================================
B.1 Definition
A Recommendation is a versioned snapshot object produced by deterministic rules (and optional AI summarization) that:
- proposes a primary option,
- provides ranked alternatives,
- includes structured reasoning, assumptions, blockers, and required actions,
- has an explicit confidence model and citations.

B.2 Minimal shape (downstream contract)
Downstream systems can rely on:
- identity + linkage fields
- primary option
- ranked alternatives
- required_actions
- blockers
- confidence
- assumptions
- citations (possibly empty, but then confidence must reflect that)

B.3 Identity & linkage (required)
- recommendation_id: UUID (snapshot id)
- recommendation_type: enum
- user_id: UUID
- plan_id: UUID (REQUIRED; recommendation is plan-scoped)
- destination_key: string (country/region code; supports multi-destination via separate plan or separate destination_key snapshots)
- created_at: timestamp
- profile_snapshot_hash: string (sha256 of canonical profile subset used)
- research_bundle_id: UUID (nullable only if allowed per type; see Q)
- research_version: string (e.g., “2026-03-01T10:00Z”)
- ruleset_version: string (SEMVER, REQUIRED)
- engine_version: string (Recommendation System version)
- model_version: string (nullable; only if LLM used for explanation compression)
- prompt_version: string (nullable; only if LLM used)

B.4 Storage semantics
- Recommendations are immutable snapshots (append-only).
- A separate pointer table defines “current” per (plan_id, recommendation_type, destination_key).
- Supersession is explicit (previous marked superseded).

B.5 Multi-destination support
- Canonical stance: one destination_key per snapshot.
- If user compares countries, either:
  (a) create multiple plans, or
  (b) keep one plan with multiple destination_keys, each with its own pointer set.
Decision: default to (b) only if UI/plan model supports it; otherwise enforce one destination per plan.

================================================================================
C) Triggers & generation lifecycle (when + why)
================================================================================
C.1 Trigger sources (domain events — see event-trigger-system.md C.2)
- profile.version_created (new profile snapshot; triggers minor or major regen per J.4 classification)
- research.completed (research bundle ready; triggers regen for types that depend on research)
- plan.created (triggers initial bundle generation — see C.5)
- plan.destination_changed / plan.destination_set (MAJOR — triggers full regen with candidate confirmation)
- plan.move_date_changed / plan.move_date_set (MAJOR if >30 day shift for timeline-sensitive types)
- user.preference_changed (risk tolerance, speed vs cost — MINOR auto-regen)
- ruleset.published (new ruleset_version — MAJOR if SEMVER major bump)
- external_data.refreshed (dataset updated — MAJOR if breaking changes)
- artifact.refresh_requested (recommendation) / plan.refresh_requested (manual user trigger)

C.2 Generation mode
Hybrid:
- Fast draft pass (sync): produce “blocked_needs_info” or “draft” within UI latency budget.
- Full generation (async worker): produce “generated_current” snapshot(s) after research and validation.

C.3 Manual generation
- User can trigger “Regenerate recommendations” per type or “Regenerate bundle”.
- Admin can trigger with override to bypass debounce for debugging.
- System can trigger automatically on major changes.

C.4 Minimum completeness to generate
Per recommendation_type:
- Each type defines required_profile_fields and required_research_artifacts.
- If missing: produce state blocked_needs_info with “questions” and no primary (or primary = null).

C.5 Bundle semantics (“interview done”)
- When “interview” completes for a goal:
  - Generate a “primary path bundle” covering: visa_route + timeline_plan + budget_model + local_admin_path + first_week_pack.
  - Optional based on persona: housing_path, job_search_strategy, insurance_plan, language_education, tax_residency_admin.

================================================================================
D) Inputs & dependencies (source of truth rules)
================================================================================
D.1 Input taxonomy
1) Profile: user-provided facts + preferences (source-of-truth for personal data).
2) Research outputs: structured claims + citations + constraints.
3) External datasets: cost tables, FX rates, visa catalog metadata (versioned).
4) Preferences: risk tolerance, speed vs cost, budget sensitivity, bureaucracy tolerance.
5) Policy constraints: safety rules, disclaimers, allowed claims thresholds.

D.2 Precedence rules
- Hard constraints from Research > user preferences.
- User facts (Profile) > generic assumptions.
- If profile conflicts with research feasibility:
  - Output “infeasible” blockers and ask for correction/confirmation.
- If user preference conflicts with feasibility:
  - Keep preference, but output feasible options first; show preference tradeoff.

D.3 Missing inputs handling
Three-tier approach:
- Hard fail only when a recommendation_type cannot be safely produced without a required field.
- Otherwise degrade:
  - Provide “needs more info” questions.
  - Provide “conditional alternatives” clearly labeled.
- Also emit “request_missing_info” tasks as actions (structured).

D.4 Confidence computation (canonical)
confidence_score in [0, 1] computed from weighted factors:
- profile_completeness (0..1)
- research_freshness (0..1 via TTL)
- source_credibility (0..1 from citation policy)
- rule_match_strength (0..1)
- uncertainty_penalty (0..1)
confidence_explanation = structured breakdown.

D.5 Freshness & TTL
Define TTL per research artifact type:
- Visa requirements: 30 days
- Processing times: 30 days
- Cost of living: 180 days
- FX rates: 7 days (or from dataset refresh)
When TTL expires:
- Mark snapshot “generated_outdated”.
- Reduce confidence; trigger refresh if auto policy allows.

================================================================================
E) Output structure (contract + explainability)
================================================================================
E.1 Universal required fields (every snapshot)
- recommendation_id
- recommendation_type
- plan_id, user_id, destination_key
- primary: Option | null
- alternatives: Option[]
- reasoning_internal: ReasonBlock[] (auditable, detailed)
- reasoning_user: ReasonBlock[] (safe, shorter)
- tradeoffs: Tradeoff[]
- assumptions: Assumption[]
- blockers: Blocker[]
- required_actions: ActionIntent[]
- questions: Question[] (needs more info)
- confidence: { score, breakdown, explanation }
- citations: Citation[] (can be empty, but then confidence must reflect)
- safety_flags: { no_legal_advice: true, no_guarantees: true, stale_research?: true }

E.2 Visibility
- reasoning_internal: admin/debug + audit only.
- reasoning_user: UI-safe, short, non-legal, no certainty.

E.3 Optional enrichment fields (allowed if data exists)
- estimated_cost_range: { min, max, currency, basis }
- estimated_timeline_range: { min_days, max_days, basis }
- effort_rating: 1..5 (paperwork complexity)
- risk_rating: 1..5 (eligibility uncertainty, data uncertainty)

E.4 Localization
- Storage uses canonical units:
  - currency: store base_currency + conversion metadata
  - dates: ISO-8601
- UI localizes to locale (SEK/EUR) outside this system.

================================================================================
F) Visa recommendation specifics (scope + ranking)
================================================================================
F.0 Subsystem Positioning
Visa recommendation is implemented by the Visa Recommendation Module (visa-recommendation.md).
The module is a SUBSYSTEM of the Recommendation System, implementing recommendation_type = visa_route.
It is NOT an independent system.

Single Owner Rule:
- Recommendation System owns: snapshot contract, current pointer semantics, versioning, idempotency, lifecycle states.
- Visa Recommendation Module owns: visa-specific decision logic, eligibility factor schema, ranking criteria, visa catalog reference.

Data Model Alignment:
- visa_route recommendations MUST be stored as Recommendation snapshots (same table, same schema).
- recommendations_current pointer row is the canonical selector for “current visa route” per (plan_id, destination_key, recommendation_type=visa_route).
- Visa-specific fields (eligibility_factors, assumptions, sources, rejected options) are embedded into the standard snapshot shape as typed fields or a namespaced payload block.

F.1 Ownership
Visa recommendation is produced by the Visa Recommendation Module but MUST reference a canonical Visa Catalog (“visa_route_id”).
- If a dedicated Visa Engine exists, the module calls it and wraps the result into the Recommendation snapshot contract.

F.2 Visa option representation
- Primary and alternatives use canonical visa_route_id (stable).
- Free-text allowed only inside reasoning_user, never as the identifier.

F.3 Ranking criteria (explicit)
Compute a score per option:
- eligibility_match (hard gate; if unknown, mark as conditional)
- processing_time_score
- cost_score
- stability_score (duration, renewal complexity if known)
- uncertainty_penalty
- user_priority_alignment (weights from preferences)
Return ranked list with score breakdown.

F.4 Ambiguity handling
- Multiple feasible visas: rank, ask for preference if close.
- Unknown eligibility: mark conditional + ask questions; do not over-claim.
- Destination not chosen: produce “blocked_needs_info” for visa_route.

================================================================================
G) Budget recommendation specifics (model + assumptions)
================================================================================
G.1 Output shape
Scenario-based ranges:
- best_case, typical, worst_case
Each includes:
- one_time_costs
- monthly_costs
- buffer_target
- total_required_cash_estimate (if relevant)

G.2 Components
- relocation one-time (travel, initial housing setup)
- deposits/fees
- insurance
- visa/admin fees (only if cited)
- monthly recurring costs
- emergency buffer

G.3 Cost research integration
- Only use cost items that have a source or dataset version reference.
- Normalize by:
  - household size
  - city-tier (if available)
  - inflation assumptions (explicit, versioned)
- If no solid data: widen ranges + lower confidence.

G.4 Currency/FX
- Store:
  - base_currency (destination default or user default)
  - fx_rate_used + timestamp + source
- UI can convert; snapshot remains auditable.

G.5 Personalization
- Profile income affects:
  - affordability flags
  - buffer recommendations
Not a “you can afford” guarantee; only indicates mismatch risk.

================================================================================
H) Timeline recommendation specifics (generation + dependencies)
================================================================================
H.1 Output model
Timeline as phased plan + dependency graph:
- phases: pre_move, arrival_week, first_month, first_90_days
- each phase has milestones and critical dependencies.

H.2 Dependencies
- Visa processing gates residency registration.
- Admin steps depend on arrival date and local rules.
- Tie to move_date if set; otherwise output move_date_window with assumptions.

H.3 Move date window
- earliest_feasible, safest_feasible, recommended_window
- each based on:
  - processing time ranges
  - buffer time
  - user constraints (job start)

H.4 Not full tasks
- Timeline outputs “ActionIntent” objects and milestone labels; Task System materializes tasks.

================================================================================
I) Housing recommendation specifics (if included)
================================================================================
I.1 Output
- approach: temporary_first vs direct_long_term
- document_checklist (generic, sourced if possible)
- deposit_range (only if sourced)
- “where to look” channels (high-level)

I.2 Neighborhood specificity
- Default: city-level guidance only.
- No safety/defamation claims; no “dangerous areas”.
- If user requests neighborhood advice: respond with “official/public sources” links and generic cautions; keep claims non-specific.

================================================================================
J) Versioning, regeneration & supersession rules
================================================================================
J.1 Outdated causes
- profile_snapshot_hash changes in relevant fields
- research_bundle_id changes or research_version updates
- ruleset_version changes
- destination_key changes
- user selects alternative (creates new “active choice”)
- TTL expiry

J.2 History model
- Append-only snapshots.
- Mark previous as superseded_by = new recommendation_id.
- Pointer table updated atomically.

J.3 Equivalence & dedup
If idempotency key matches exactly, return existing snapshot (no new row).
If only timestamps differ but inputs same: dedup to same snapshot.

J.4 Automatic vs explicit regeneration (Major/Minor Classification)

Recommendations do NOT follow the Guide pattern. Recommendations are decision snapshots and must stay fresh with minimal friction.

MINOR changes (auto-regenerate + auto-advance current allowed):
- Small budget edits
- Household detail refinement (non-structural)
- Preference tuning (risk tolerance, speed vs cost)
- Adding optional fields that improve confidence without changing feasibility class

For MINOR changes:
- System MAY auto-regenerate and MAY auto-advance “current” pointer if confidence remains above threshold and no major-choice impact occurs.
- UX: show “Updated based on your latest info” banner + link to reasoning changes.

MAJOR changes (candidate snapshot + user confirmation required):
- Destination change (plan.destination_changed)
- Move date change beyond threshold (e.g., >30 days shift) for timeline-sensitive types
- Visa policy / dataset major update (external_data.refreshed with breaking changes)
- Ruleset major SEMVER bump
- User switches primary goal/purpose (e.g., study → work)
- User selects different alternative (explicit choice — see N)

For MAJOR changes:
- System MAY generate candidate snapshots automatically.
- System MUST require explicit user confirmation before updating the “current” pointer.
- UX: show “We found an updated path — review to apply” CTA.
- Until user confirms, previous “current” snapshot remains active.

Guide consistency contract:
- Any recommendation pointer change (minor auto-advance or major user-confirmed) that affects a frozen guide MUST mark the guide as STALE via guide.outdated event.
- Guide never auto-regenerates (see guide-generation.md C.2).

J.5 Schema migration
- Old snapshots must remain readable via versioned JSON schema.
- Provide “schema_version” field on snapshot; migration layer adapts for UI.

================================================================================
K) Deduplication & idempotency (no double-spam)
================================================================================
K.1 Idempotency key (canonical)
idempotency_key = sha256(
  user_id + plan_id + destination_key + recommendation_type +
  profile_snapshot_hash + research_bundle_id + research_version +
  ruleset_version + engine_version
)

K.2 Retry behavior
- If same idempotency_key: return same recommendation_id.
- Job retries must be safe: “upsert by idempotency_key”.

K.3 Storm prevention
- Debounce window (e.g., 30–120 seconds) per (plan_id, type).
- Coalesce triggers into a single “generate bundle” job.
- “Latest wins” for queued jobs:
  - cancel outdated queued jobs when new profile/research arrives.

================================================================================
L) Persistence model (storage + access patterns)
================================================================================
L.1 Persisted snapshots (recommended)
- Always store snapshots; never compute purely on-demand for “current”.
- On-demand is allowed only for “preview/draft” without updating pointers.

L.2 Read model
- recommendations_current table:
  - (plan_id, destination_key, recommendation_type) -> recommendation_id
- recommendations table: immutable snapshots
- endpoints:
  - GET /plans/{plan_id}/recommendations/current
  - GET /plans/{plan_id}/recommendations/{type}/history
  - POST /plans/{plan_id}/recommendations/regenerate (bundle/type)
  - POST /plans/{plan_id}/recommendations/choose (user override)

L.3 Storage schema
- Snapshot stored as JSONB + indexed fields (type, plan_id, created_at, idempotency_key).
- Citations stored:
  - either embedded in JSONB,
  - or normalized table (recommended if heavy reuse).
Canonical: embed + optional normalized cache for analytics.

L.4 Retention & GDPR
- Keep history for audit unless user deletes account.
- User deletion:
  - hard delete or anonymize per policy; export supported.

L.5 Caching
- UI may cache current snapshots with ETag = recommendation_id.
- Cache invalidation: pointer change invalidates.

================================================================================
M) UX & presentation (where it lives + sync)
================================================================================
M.1 Display surfaces
- Dashboard: cards per type.
- Chat: short “path summary” + questions + selection prompts.
- Plan page: shows selected route and next actions.
- Guide: frozen coupling rules (see P).

M.2 Single source of truth
- UI must render from stored snapshot id referenced by recommendations_current pointer.
- Chat and dashboard must both call the same “current” endpoint.

M.3 Divergence prevention
- If chat shows X and dashboard shows Y: that is a bug.
- Invariant: one pointer per (plan_id, destination_key, type).

M.4 Presentation variants
- quick_summary: uses reasoning_user truncated
- deep_dive: includes full tradeoffs and breakdown
- compare: shows top N options with score breakdown

================================================================================
N) User override behavior (selection & consequences)
================================================================================
N.1 Selecting alternatives
- User can select any feasible alternative.
- Selecting conditional alternative requires acknowledge_risk.

N.2 Recording choice
- Create user_choice record:
  - choice_id, plan_id, type, selected_option_id, timestamp
- Update “active_choice” pointer that Plan System reads.

N.3 Consequences
- Plan/timeline/tasks regenerate based on new active_choice.
- Previous recommendation snapshots remain; pointer updates.

N.4 Infeasible picks
- Block if research indicates “not available” hard constraint.
- Allow with warning only if “unknown” feasibility, not “known impossible”.

N.5 Audit trail
- Store who selected what and when; include prior active choice.

================================================================================
O) Lifecycle states (state machine)
================================================================================
O.1 State enum
- pending_inputs
- queued
- generating
- generated_current
- generated_outdated
- superseded
- blocked_needs_info
- failed

O.2 Allowed transitions
pending_inputs -> blocked_needs_info (if missing required)
pending_inputs -> queued (if enough inputs)
queued -> generating
generating -> generated_current
generated_current -> generated_outdated (TTL expiry)
generated_current -> superseded (new current snapshot)
blocked_needs_info -> queued (when inputs arrive)
generating -> failed (validation/model/external)
failed -> queued (manual retry or auto retry policy)

O.3 Definition of “current”
- Determined by recommendations_current pointer row only.

O.4 UI behavior per state
- pending_inputs/blocked: show questions + “complete profile” CTA
- queued/generating: show spinner + last known snapshot if exists
- failed: show error + retry
- generated_outdated: show banner “may be outdated” + refresh button

================================================================================
P) Relationship to Guide (snapshot coupling)
================================================================================
P.1 Canonical coupling
Guide must be generated from a frozen recommendation snapshot bundle.
- guide references recommendation_ids used at generation time.

P.2 When recommendation changes
- Do NOT auto-rewrite existing guide content silently.
- Show “Guide may be outdated” banner if current pointer differs from guide’s bundle.
- Offer explicit “Regenerate guide” action.

P.3 Guide regeneration requirement
- Requires user confirmation.
- Generates new guide_version referencing new recommendation_ids.

================================================================================
Q) Relationship to Research (hard/soft dependency)
================================================================================
Q.1 Can recommendation exist without research?
- Draft allowed for limited types:
  - first_week_pack (generic), language_education (generic), job_search_strategy (generic)
- Visa_route, local_admin_path, timeline_plan require minimum research bundle OR must be blocked_needs_info.

Q.2 Partial research
- Allow “draft” snapshots with missing citations only if:
  - labeled clearly,
  - confidence lowered,
  - blockers include “research incomplete”.

Q.3 Auto-upgrade
- When research completes, generate new snapshots and supersede drafts automatically (subject to major-change confirmation policy).

Q.4 Source attribution storage
- Store citations at recommendation time inside snapshot to prevent “citation drift”.

================================================================================
R) Failure handling (reliability)
================================================================================
R.1 Failure taxonomy (error_code)
- MISSING_PROFILE_FIELDS
- RESEARCH_UNAVAILABLE
- EXTERNAL_DATA_DOWN
- RULESET_NOT_FOUND
- OUTPUT_VALIDATION_FAILED
- MODEL_ERROR (only if used)
- CONCURRENCY_CONFLICT

R.2 Retry policy
- Automatic retry for transient external failures (max 3, exponential backoff).
- No auto retry for missing profile fields or validation errors (requires fix).

R.3 User-facing behavior
- Safe message + what to do next (complete fields / retry later).
- No internal stack traces.

R.4 Developer observability
- Structured logs keyed by idempotency_key, plan_id, type.
- Store debug payload (internal-only) for failed jobs.

================================================================================
S) Consistency guarantees (prevent divergence across systems)
================================================================================
S.1 Invariants (must hold)
1) Current recommendation determined by single pointer per (plan_id, destination_key, type).
2) All UI surfaces render from same snapshot id for a given type.
3) Plan generation references the same recommendation_id as UI pointer.
4) Snapshots are immutable; only pointers change.
5) Idempotency prevents duplicates for identical inputs.

S.2 Validation gates
- Strict JSON schema validation (recommendation_schema_versioned).
- Rules applied deterministically and recorded via ruleset_version.
- Confidence must be present and computed.

S.3 Concurrency winner policy
- Use atomic pointer update with compare-and-swap:
  - Prefer snapshots with higher “completeness_score”
  - If tie: latest created_at wins
- Cancel older queued jobs when a newer input hash appears.

S.4 Cross-system contracts (endpoints + guarantees)
- GET current: returns pointer + snapshot.
- POST regenerate: returns job_id + eventual snapshot id.
- POST choose: updates active_choice and triggers dependent regeneration.

S.5 Consistency tests (integration)
- Chat + dashboard simultaneous load: same recommendation_id.
- Plan generation uses same id.
- Race: two jobs produce snapshots; pointer ends with winner policy and no divergence.

================================================================================
T) Extensibility & governance (future-proofing)
================================================================================
T.1 Add new recommendation_type safely
Steps:
- Add enum
- Define required inputs
- Define scoring model and output schema
- Add UI card mapping
- Add triggers
- Add must-pass tests

T.2 Rules ownership
- Rulesets are versioned artifacts shipped by admins/devs.
- ruleset_version required on every snapshot.
- Breaking changes require major SEMVER bump.

T.3 Explainability requirement
- Every rule must map to:
  - internal reason_code
  - user-readable explanation template
- No “black box” rule allowed for critical decisions.

T.4 Safety/Compliance enforcement
- Disclaimers always on.
- Claims restricted by confidence thresholds:
  - if confidence < 0.6: do not present a single “primary” as definitive; present multiple + “needs info”.
  - if citations empty for regulated claims: block or draft-only.

================================================================================
U) Test scenarios (must-pass suite)
================================================================================
U.1 Minimal profile + no research
- visa_route: blocked_needs_info with questions; confidence low.
- first_week_pack: draft generic actions; confidence medium-low; citations optional.

U.2 Full profile + fresh research
- Generate bundle; set pointers; state generated_current for each.
- Confidence high; alternatives ranked; citations present.

U.3 Destination change
- Invalidate all destination-bound types:
  - visa_route, timeline_plan, local_admin_path, budget_model (if location-based), housing_path.
- Mark outdated; generate new candidates; require confirmation if major.

U.4 Research refresh changes processing time
- timeline_plan superseded; guide shows outdated banner if frozen on old snapshot.

U.5 User selects alternative visa
- Create user_choice; regenerate dependent timeline/admin; supersede pointers.

U.6 Worker retry triggers same job twice
- Same idempotency_key returns same recommendation_id; no duplicates.

U.7 UI loads chat + dashboard
- Both call current endpoint and receive identical recommendation_id.

U.8 Schema/ruleset update
- Old snapshots readable; new snapshots created with new versions; pointers updated per policy.

================================================================================
V) Cross-system references
================================================================================
V.1 Upstream (inputs to recommendations)
- Profile System (profile-system.md) — profile_version_id snapshot, Layer 1 + Layer 2 fields
- Research System (research-system.md) — research outputs (Layer 1 generic + Layer 2 user-specific) as research_bundle_id
- Event/Trigger System (event-trigger-system.md) — domain event routing: profile.version_created, plan.destination_changed, research.completed
- Data Update System (data-update-system.md) — cascade orchestration; recommendations are a DAG node

V.2 Downstream (consumes recommendation output)
- Guide Generation System (guide-generation.md) — uses frozen recommendation snapshot; recommendation pointer change marks guide STALE
- Timeline System — uses recommendation for visa processing time estimates and phase planning
- Task/Checklist System — uses recommendation for task materialization
- Dashboard System — displays "Your path" cards per recommendation_type
- Chat System — shows summary and selection prompts
- Cost of Living System (cost-of-living.md) — budget_model recommendations consume cost artifacts

V.3 Subsystems (modules owned by Recommendation System)
- Visa Recommendation Module (visa-recommendation.md) — implements recommendation_type = visa_route

V.4 Event Contract (normalized to Event System taxonomy)
All recommendation types emit the same event names:
- recommendation.generated (payload includes recommendation_type to distinguish visa_route, budget_model, etc.)
- recommendation.selected_current (pointer update — triggers guide.outdated if guide exists)
- recommendation.superseded
- recommendation.failed
- recommendation.outdated (optional staleness marker)

No type-specific event names (e.g., visa_recommendation_created) are allowed.

V.5 Shared Contracts
- Profile versioning: profile_version_id defined in profile-system.md Section G
- Current pointer model: recommendations_current follows event-trigger-system.md Section F.0
- Research two-layer model: research-system.md Section A.5
- Guide staleness: recommendation.selected_current → guide.outdated (event-trigger-system.md F.1)

================================================================================
Deliverables produced by this spec (implementation checklist)
================================================================================
1) State machine + transitions exactly as in O.
2) DB schema:
   - recommendations (immutable, JSONB, indexed)
   - recommendations_current (pointer)
   - user_choices (override)
   - recommendation_jobs (optional queue tracking)
3) Deterministic ruleset artifacts (versioned) + reason_code mapping.
4) Endpoints listed in L + choose + preview.
5) Required inputs matrix per recommendation_type.
6) Consistency + idempotency enforcement (K + S).
7) Must-pass integration test suite (U).

V1 Cross-Reference Status:
| Referenced System | V1 Status |
|---|---|
| Profile System (profile-system.md) | PARTIAL |
| Research System (research-system.md) | PARTIAL |
| Event Trigger System (event-trigger-system.md) | NOT_IMPLEMENTED |
| Data Update System (data-update-system.md) | NOT_IMPLEMENTED |
| Guide Generation System (guide-generation.md) | PARTIAL |
| Timeline System (timeline-system.md) | NOT_IMPLEMENTED |
| Settling-in Tasks (settling-in-tasks.md) | PARTIAL |
| Dashboard System (dashboard.md) | PARTIAL |
| Plan Contextual Chat (plan-contextual-chat-system.md) | PARTIAL |
| Cost of Living System (cost-of-living.md) | PARTIAL |
| Visa Recommendation (visa-recommendation.md) | PARTIAL |