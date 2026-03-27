# Batch 2 Alignment Audit — Research and Relocation Intelligence

> Batch: 2
> Scope: Research / Visa / Local Requirements / Checklist
> Authority: `docs/audits/document-authority.md`
> Method: definitions -> code/database/runtime/frontend, with system docs used as supporting evidence
> Closure Rule: audit -> patch stale docs -> re-audit -> PASS
> Final Result: PASS

---

## 1. Systems Audited

This batch audited the relocation-intelligence layer across:

- research system
- visa recommendation / visa research
- local requirements
- document checklist
- source fetch and extraction behavior where they affect research correctness

Primary inputs used:

- `docs/definitions/research-system.md`
- `docs/definitions/visa-recommendation.md`
- `docs/definitions/local-requirements.md`
- `docs/definitions/document-checklist.md`
- `docs/definitions/recommendation-system.md`
- `docs/systems/research-orchestration.md`
- `docs/systems/visa-logic.md`
- `docs/systems/source-fetch-layer.md`
- `docs/systems/extraction-layer.md`
- `docs/systems/checklist-generation.md`
- `app/api/research/trigger/route.ts`
- `app/api/research/visa/route.ts`
- `app/api/research/local-requirements/route.ts`
- `app/api/research/checklist/route.ts`
- `app/api/documents/route.ts`
- `lib/gomate/research-visa.ts`
- `lib/gomate/research-local-requirements.ts`
- `lib/gomate/research-checklist.ts`
- `lib/gomate/checklist-generator.ts`
- `lib/gomate/official-sources.ts`
- `lib/gomate/web-research.ts`

---

## 2. Audit Loop Performed

### Pass 1

Mapped the canonical intelligence model against the actual runtime model.

Main result:

- Batch 2 is still fundamentally a flat, per-plan intelligence layer.
- Research exists and is live-functional, but it is not modeled as canonical, versioned intelligence artifacts.
- Checklist generation is not a first-class compliance model; it is a downstream-ish generated artifact beside a separate boolean document-status map.

### Patch Pass

Corrected stale Batch 2 documents that still described pre-fix or no-longer-true research behavior.

Patched files:

- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`
- `docs/definitions/research-system.md`
- `docs/definitions/local-requirements.md`
- `docs/definitions/document-checklist.md`
- `docs/systems/master-index.md`
- `docs/systems/job-system.md`
- `docs/systems/research-orchestration.md`
- `docs/systems/extraction-layer.md`
- `docs/systems/source-fetch-layer.md`

Patch themes:

- removed stale claims that research trigger still uses self-HTTP
- corrected stale claims that local requirements are not implemented at all
- corrected stale claims that no checklist generation exists
- corrected stale claims that visa/local-requirements extraction still depend on regex JSON parsing
- corrected stale system-index and job-system references that still described the old self-HTTP trigger architecture
- corrected stale forbidden-pattern/audit notes so Batch 2 no longer reports already-fixed routing behavior as open

### Runtime Verification Pass

Authenticated localhost runtime verification was executed against `http://localhost:3000` using the configured test account from `.env.local`.

Verified endpoints:

- `GET /api/profile`
- `GET /api/research/trigger`
- `GET /api/research/visa?planId=...`
- `GET /api/research/local-requirements?planId=...`
- `GET /api/research/checklist`
- `GET /api/documents`

Observed live results on the active plan:

- plan returned `research_status = "completed"`
- trigger status returned `hasVisaResearch = true` and `hasLocalRequirements = true`
- visa research returned a structured artifact shell, but `visaOptions.length = 0`
- local requirements returned categorized research with 7 populated categories
- checklist returned a 7-item artifact in generated-checklist shape
- checklist content was clearly the default fallback set, not visa-specific research output
- documents returned empty `statusKeys` and a separate checklist payload

Meaning:

- live system confirms that Batch 2 behavior is present and wired
- live system also confirms that plan-level `research_status = "completed"` does not guarantee useful sub-results
- checklist and documents remain split artifacts with weak identity coupling

### Re-Audit Pass

Re-read the patched docs and re-scanned the runtime/code relationships after the runtime verification.

No new unclassified Batch 2 mismatch type appeared on the second pass. The one new runtime-specific finding was the status-quality gap described below, and it is now explicitly classified.

That satisfies the Batch 2 closure rule.

---

## 3. Canonical Target Summary

Canonical Batch 2 target, condensed:

- research is the canonical intelligence layer, not an incidental helper
- research has a two-layer model: generic destination intelligence plus user-specific analysis
- research artifacts are versioned, snapshot-bound, and reusable
- visa recommendation is a stored recommendation snapshot with explicit assumptions, eligibility factors, and source references
- local requirements are authoritative obligation records or requirement sets, not just categorized notes
- checklist is a versioned compliance artifact downstream of visa/research/profile state
- documents and checklist share identity, dependency, and status semantics

---

## 4. Current Reality Summary

Actual Batch 2 runtime, condensed:

- research runs per plan and writes JSONB blobs directly onto `relocation_plans`
- there is no generic/shared research layer
- there is no research snapshot/version identity beyond timestamps and `plan_version` drift elsewhere
- trigger orchestration now uses direct helper calls, but still collapses all sub-research into one `research_status`
- visa research is structured, but not a recommendation snapshot and not guaranteed to produce options
- local requirements is categorized research output, not a requirement-set system
- checklist generation reads plan profile plus `visa_research` opportunistically and falls back silently to a default list
- document tracking is separate: `checklist_items` for generated items, `document_statuses` for completion booleans

---

## 5. Audit Questions Answered

### What is the canonical source of relocation intelligence?

Canonically it should be the Research System: versioned, traceable, reusable intelligence objects.

In reality it is a set of per-plan JSONB payloads written by route/service helpers.

### Is research bound to profile/plan state deterministically?

Only weakly.

Research is bound to `plan_id` and current `profile_data`, but not to immutable profile snapshots or a versioned research identity.

### Does visa output match the definition shape or just approximate it?

It approximates it.

The current `visa_research` artifact is structured, but it is not a canonical recommendation snapshot and it lacks several required explainability fields from the definition.

### Is local requirements modeled as authoritative obligations or loose research notes?

Loose research notes.

The output is categorized and useful, but it is not a formal requirement entity model with validation, lifecycle, or downstream enforcement.

### Is checklist generation a downstream artifact or an independent parallel research system?

It is a hybrid, but operationally closer to an independent parallel generator.

It can consume `visa_research` if available, but it is not deterministically downstream of a canonical visa/recommendation artifact. When that context is weak or missing, it silently falls back.

### Which parts are truly v1-minimal versus actually broken?

Truly v1-minimal:

- per-plan JSONB storage instead of generic/shared research tables
- lack of formal requirement-set entities
- absence of recommendation snapshot tables

Actually broken or misleading:

- `research_status = "completed"` can coexist with empty visa options
- checklist fallback is indistinguishable from researched checklist success at the plan-status layer
- document tracking and checklist generation do not share a proper identity/status contract

### What would it take to move checklist toward the definition without rebuilding data architecture?

Most feasible path:

- keep `checklist_items` JSONB
- treat it as a versioned checklist snapshot
- attach source metadata, generator metadata, and fallback/staleness flags
- bind checklist generation explicitly to existing `visa_research` and `local_requirements_research`
- keep `document_statuses` but expand it from boolean completion to a richer lifecycle object

That moves the system toward the document-checklist definition without requiring normalized document tables immediately.

---

## 6. Artifact Dependency Chain

Current Batch 2 dependency chain:

1. `profile_data` on the current plan
2. official sources registry + Firecrawl fetches
3. per-artifact AI extraction
4. plan JSONB writes:
   - `visa_research`
   - `local_requirements_research`
   - `checklist_items`
5. separate document tracking:
   - `document_statuses`

Weak points in the chain:

- no profile snapshot/version binding
- no canonical research bundle identity
- no deterministic visa recommendation pointer consumed by checklist generation
- no shared document identity between `checklist_items` and `document_statuses`
- one plan-level `research_status` collapses three independent outputs

---

## 7. V1-Minimal vs Canonical Distinctions

### Acceptable v1-minimal divergences

- research stored per plan in JSONB rather than in generic/shared research tables
- no Layer 1 shared cache for destination intelligence
- no formal requirement-set tables yet
- no full recommendation snapshot system yet

These are substantial canonical gaps, but they are coherent if documented honestly.

### Non-minimal runtime defects

- completed status without useful sub-results
- fallback checklist generation not surfaced as fallback
- split checklist/document state with no canonical shared identity

These are not just “smaller than the spec”. They distort the meaning of system state in live behavior.

---

## 8. Gap Table

| ID | Domain | Canonical Requirement | Current Reality | Impact | Outcome |
|---|---|---|---|---|---|
| B2-001 | Research architecture | Two-layer research model with reusable generic destination intelligence | All research is per-plan and written directly onto `relocation_plans` | No reuse, no shared research authority, no generic dataset layer | `defer_v2` |
| B2-002 | Research status semantics | Research state should reflect actual artifact readiness | One `research_status` field is shared by three sub-research flows and can be `"completed"` on partial or weak output | UI and downstream logic can over-trust research readiness | `code_fix_now` |
| B2-003 | Snapshot binding | Research artifacts should bind to profile/version snapshots | Research is tied only to the mutable plan row | No deterministic historical binding between inputs and intelligence outputs | `defer_v2` |
| B2-004 | Visa output model | Visa recommendation should be a canonical recommendation snapshot | Runtime has `visa_research` plus separate static recommendation logic plus guide-embedded advice | Visa intelligence is fragmented and not authoritative in one place | `phase_candidate` |
| B2-005 | Visa explainability shape | Visa output should include explicit factors, assumptions, and richer source references | Current output uses summary prose + `eligibilityReason` and top-level `officialSources` | Explainability is present but not canonical or structured enough | `phase_candidate` |
| B2-006 | Local requirements model | Local requirements should be authoritative obligations/requirement sets | Current output is categorized research notes | Useful content exists, but downstream systems cannot treat it as a requirement authority | `intentional_v1_minimal` |
| B2-007 | Checklist downstream binding | Checklist should be deterministically downstream of visa/research/profile state | Checklist opportunistically reads selected/first visa option and otherwise falls back to default items | Checklist quality can silently degrade while plan-level research still looks complete | `code_fix_now` |
| B2-008 | Document identity model | Checklist and document status should share formal document identity/version semantics | `checklist_items` and `document_statuses` are separate JSONB artifacts with weak name-based coupling | Compliance state is hard to trust and hard to evolve safely | `phase_candidate` |
| B2-009 | Compliance lifecycle | Documents should support richer compliance lifecycle and task blocking | Document tracking is boolean completion only | No verification, expiry, or blocker semantics | `defer_v2` |
| B2-010 | Extraction consistency | Extraction layer should use a coherent, reliable protocol | Checklist remains the only Claude + regex extraction path | Checklist remains more fragile than the other Batch 2 extractors | `phase_candidate` |
| B2-011 | Research source granularity | Research outputs should carry stronger per-claim or per-item source semantics | Current outputs mostly expose top-level source lists | Harder to judge which claim came from which authority | `phase_candidate` |
| B2-012 | Recommendation/checklist coupling | Visa route selection should bind cleanly into downstream document expectations | Static `visa-recommendations.ts`, `visa_research`, and checklist generation are separate tracks | Downstream document logic has no single visa authority to follow | `phase_candidate` |

---

## 9. Runtime-Verified Findings

These were verified in live localhost responses, not just inferred from code:

- `research_status = "completed"` did not imply useful visa output
- visa research can exist structurally while containing zero visa options
- checklist artifact shape can be generated while still clearly representing fallback/default content
- document statuses can remain empty even when a checklist exists

Inference from sources and runtime:

- the live system’s intelligence layer is “available” before it is “trustworthy”
- the current plan-level status model overstates readiness compared with actual artifact quality

---

## 10. Recommended Phase Candidates

### Candidate A — Research Status Integrity

- split plan-level research status from per-artifact readiness
- add explicit `partial`, `fallback`, or `degraded` semantics
- stop treating empty visa output as equivalent to successful research

### Candidate B — Checklist Snapshot Stabilization

- keep `checklist_items` JSONB
- add generator metadata, fallback flag, source references, and snapshot signatures
- make checklist explicitly downstream of current visa/local-requirements artifacts

### Candidate C — Document Lifecycle Upgrade

- keep `document_statuses` on the plan initially
- expand from boolean completion to richer document-status objects
- align document ids/statuses to checklist item identity

### Candidate D — Visa Intelligence Consolidation

- choose one canonical visa artifact for downstream consumption
- demote or remove static parallel visa recommendation paths where possible
- make checklist generation consume that artifact deterministically

### Candidate E — Research Bundle Model

- introduce a lightweight bundle or run identity before a full generic/shared research system
- group visa, local requirements, and checklist outputs under one run record
- preserve per-artifact result quality under a single trigger

---

## 11. Re-Audit Result

Final re-audit result:

- no unclassified Batch 2 mismatch remains
- no stale Batch 2 contradiction remains in the patched authority/audit docs touched by this run
- the relationship between research, visa output, local requirements, and checklist is explicitly mapped
- every remaining mismatch has one of the allowed outcomes
- runtime verification did not reveal any additional unclassified Batch 2 issue beyond the recorded research-status and checklist-binding gaps

This does not mean Batch 2 systems are aligned to the canonical definitions.

It means Batch 2 itself is audit-complete, internally coherent, and closed under the required loop.

---

## 12. Final Result

Final Result: PASS
