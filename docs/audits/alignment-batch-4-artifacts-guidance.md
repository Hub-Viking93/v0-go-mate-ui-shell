# Batch 4 Alignment Audit — Artifacts, Guides, and Recommendations

> Batch: 4
> Scope: Guide Generation / Guide Viewer / Recommendation System / Artifact System
> Authority: `docs/audits/document-authority.md`
> Method: definitions -> code/database/runtime/frontend, with system docs used as supporting evidence
> Closure Rule: audit -> patch stale docs/code -> re-audit -> PASS
> Final Result: PASS

---

## 1. Systems Audited

This batch audited the guidance/artifact surface across:

- guide generation
- guide viewer
- recommendation output where it feeds the guide
- artifact-system expectations vs actual persistence

Primary inputs used:

- `docs/definitions/guide-generation.md`
- `docs/definitions/guide-viewer.md`
- `docs/definitions/recommendation-system.md`
- `docs/systems/guide-generation.md`
- `docs/systems/artifact-system.md`
- `docs/systems/master-index.md`
- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`
- `app/api/guides/route.ts`
- `app/api/guides/[id]/route.ts`
- `app/(app)/guides/page.tsx`
- `app/(app)/guides/[id]/page.tsx`
- `lib/gomate/guide-generator.ts`
- `lib/gomate/pdf-generator.ts`
- `lib/gomate/profile-summary.ts`
- `lib/gomate/visa-recommendations.ts`

---

## 2. Audit Loop Performed

### Pass 1

Mapped the canonical Batch 4 target against the actual runtime/model.

Main result:

- the guide system is more implemented than the old docs claimed
- guide metadata now exists (`guide_version`, `plan_version_at_generation`, `is_stale`)
- the viewer already renders stale state and explicit regenerate/delete/PDF actions
- the deeper mismatch is not “no guide system” but “mutable guide rows without frozen artifact identity”

### Patch Pass

Corrected stale Batch 4 docs and fixed the live viewer regeneration defect.

Patched code:

- `app/api/guides/route.ts`
- `app/(app)/guides/[id]/page.tsx`

Patched docs:

- `docs/definitions/guide-generation.md`
- `docs/definitions/guide-viewer.md`
- `docs/systems/guide-generation.md`
- `docs/systems/artifact-system.md`
- `docs/systems/master-index.md`
- `docs/audits/backend-audit.md`
- `docs/audits/definitions-vs-system-audit.md`

Patch themes:

- corrected stale claims that guide generation still lives in `settling-in-generator.ts`
- corrected stale claims that guide data lives on `relocation_plans`
- corrected stale claims that no staleness indicator exists in the viewer
- corrected stale claims that no guide versioning/invalidation exists at all
- corrected stale claims that artifact outputs have zero metadata across the board
- fixed the viewer regenerate action so it targets the viewed guide/plan rather than always the current plan

### Runtime Verification Pass

Authenticated localhost runtime verification was executed against `http://localhost:3000` using the configured test account from `.env.local`.

Verified cases:

1. Current plan reality
- `GET /api/plans` returned current plan `614e8c86-a98f-479a-a031-5ad88c809073`
- current plan destination/purpose was `Germany / work`
- non-current plan `04e28c30-dd79-4067-be41-7ea0059e0f94` also currently resolved to `Germany / work`

2. Existing guide inventory
- `GET /api/guides` returned many duplicate `Japan / study` guides for the same `plan_id`
- no DB-level current-pointer or uniqueness protection exists for logical guide identity

3. Pre-fix viewer risk, reproduced via API behavior
- `GET /api/guides/822165d8-9c8e-4532-9d87-7eb3300f70ad` returned a guide whose content was still `Japan / study`
- `POST /api/guides` with empty body created a new guide for the current plan instead:
  - destination/purpose: `Germany / work`
  - plan_id: current plan
- this proved the old viewer implementation was wrong: clicking regenerate while viewing a non-current guide would hit the current-plan generation path

4. Post-fix exact-guide regeneration
- `POST /api/guides` with `{ planId, guideId }` updated the viewed guide row itself
- returned the same guide id: `822165d8-9c8e-4532-9d87-7eb3300f70ad`
- `guide_version` incremented from `1` to `2`
- follow-up `GET /api/guides/:id` confirmed the same row was updated

5. Deeper snapshot-binding finding exposed by the re-test
- after exact-guide regeneration, the viewed guide became `Germany / work`
- that happened because regeneration uses the owning plan’s current `profile_data`, not a frozen guide snapshot
- this is a real canonical gap, not a regression from the fix

### Re-Audit Pass

Re-scanned the Batch 4 docs after patching and compared them against code plus live results.

No remaining unclassified in-scope Batch 4 mismatch remained after the second pass.

The major remaining Batch 4 issues are now explicitly classified below rather than left as stale contradictions.

That satisfies the Batch 4 closure rule.

---

## 3. Canonical Target Summary

Canonical Batch 4 target, condensed:

- guide is the canonical relocation guidance artifact
- guide is bound to immutable upstream snapshots
- each generation creates immutable history, with a stable current pointer
- viewer renders one chosen version and never silently switches artifact identity
- recommendation output is a canonical snapshot input to guide generation
- artifacts share a coherent metadata/version/staleness model

---

## 4. Current Reality Summary

Actual Batch 4 runtime, condensed:

- guide generation is deterministic TypeScript, synchronous, and route-local
- guide data is stored in mutable rows in `guides`, not immutable versions
- `guide_version` and `is_stale` are real, but they are metadata on mutable rows
- viewer now regenerates the exact viewed guide row when `guideId` is supplied
- regeneration still reads live `relocation_plans.profile_data`
- recommendation logic is fragmented across guide helpers, visa helpers, and research outputs
- no generic artifact layer exists; only output-specific tables/columns do

---

## 5. Audit Questions Answered

### What is the canonical artifact for relocation guidance?

Canonically it is an immutable, versioned guide artifact with clear upstream pointers.

In reality it is a mutable `guides` row with JSONB section columns plus partial metadata.

So the guide is the practical guidance artifact today, but not yet the canonical artifact model described in the definitions.

### What inputs is the guide actually bound to?

Not to a frozen guide snapshot.

The guide is regenerated from:

- current `relocation_plans.profile_data`
- helper functions for cost, visa, and official sources
- static `COUNTRY_DATA`

That means guide regeneration is bound to the plan’s current state, not the guide’s historical state.

### Is staleness/versioning real or simulated?

Partially real.

`guide_version`, `plan_version_at_generation`, `is_stale`, `stale_at`, and `stale_reason` are real persisted fields.

But versioning is still simulated on a mutable row:

- no immutable history
- no version navigator
- no current-pointer model

### Is recommendation output canonical or merely helpful metadata?

Merely helpful metadata in v1.

There is no canonical recommendation snapshot table or pointer model. Recommendation logic is spread across:

- `lib/gomate/profile-summary.ts`
- `lib/gomate/visa-recommendations.ts`
- research outputs on `relocation_plans`
- inline guide-generation helpers

So recommendations inform the guide, but they are not yet independent canonical artifacts.

### Which artifact-system requirements are truly v2 versus required for v1 alignment?

Required for v1 alignment:

- correct guide/viewer behavior
- honest metadata/staleness documentation
- explicit classification of mutable-row limits

Reasonable v2 deferrals:

- generic `artifacts` table
- rendering directives/templates
- immutable cross-output artifact history
- recommendation snapshot tables

---

## 6. Classified Batch 4 Gaps

### B4-001 Guide Viewer Regenerate Was Bound To Current Plan Instead Of Viewed Guide

- Classification: `code_fix_now`
- Status: resolved in this batch
- Evidence: old viewer posted `{}` to `POST /api/guides`; live empty-body POST created a Germany/work guide for the current plan while a non-current guide was being inspected
- Resolution: viewer now sends `{ planId, guideId }`, and the route supports exact-guide regeneration

### B4-002 Guide Regeneration Is Not Snapshot-Bound

- Classification: `phase_candidate`
- Status: open, explicitly classified
- Evidence: exact-guide regeneration changed guide `822165d8-9c8e-4532-9d87-7eb3300f70ad` from Japan/study content to Germany/work content because the owning plan’s current profile data had changed
- Meaning: guide identity is not frozen to historical inputs

### B4-003 Logical Guide Identity Has No DB-Level Uniqueness Or Current Pointer

- Classification: `phase_candidate`
- Status: open, explicitly classified
- Evidence: localhost `GET /api/guides` returned many duplicate Japan/study guides for the same plan; no unique constraint exists on the mutable-v1 identity shape
- Meaning: guide rows can drift into duplicate inventories with no canonical selector

### B4-004 Recommendation System Is Still A Non-Canonical Helper Layer

- Classification: `intentional_v1_minimal`
- Status: accepted for current scope
- Evidence: no recommendation snapshots or pointer tables exist; guide generation embeds recommendation-like output inline
- Meaning: the current system is below canonical recommendation design, but still coherent as a v1 minimal model once documented honestly

### B4-005 Generic Artifact System Is Not Implemented

- Classification: `defer_v2`
- Status: explicitly deferred
- Evidence: no `artifacts` table, no rendering directives, no artifact registry in code
- Meaning: current output-specific storage remains the accepted v1 substitute

---

## 7. Patch Outcome

What changed in functional behavior:

- guide detail regeneration is now bound to the viewed guide row instead of implicitly targeting the current plan
- exact-guide regeneration increments `guide_version` and clears stale flags on that specific row

What changed in audit/document accuracy:

- Batch 4 docs now describe the implemented guide metadata and stale banner correctly
- the guide system is now documented as mutable-row versioning rather than “no versioning”
- artifact docs now describe partial output metadata instead of a total metadata vacuum
- the global gap register now includes the duplicate-guide/current-pointer gap

---

## 8. Batch 4 PASS Rationale

Batch 4 can honestly be marked `PASS` because:

- the scoped audit was completed against definitions, code, frontend, and live runtime
- the live in-scope defect in guide regeneration was fixed
- stale Batch 4 docs were patched until the active doc set matched reality
- remaining Batch 4 mismatches are all explicitly classified as `phase_candidate`, `intentional_v1_minimal`, or `defer_v2`
- the re-audit did not find any additional unclassified in-scope contradiction

Final Result: PASS
