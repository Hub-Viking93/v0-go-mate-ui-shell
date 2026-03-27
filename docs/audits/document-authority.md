# Document Authority and Governance Contract

> Status: Active governance contract
> Date: 2026-03-14
> Purpose: Resolve documentation authority conflicts across `docs/definitions/`, `docs/systems/`, `docs/audits/`, phase documents, and implementation evidence
> Scope: All current and future GoMate audits, phase plans, system documentation, and alignment work

---

## 1. Why This Document Exists

GoMate currently has multiple documentation layers that use words like "canonical", "source of truth", "authoritative", and "supreme authority", but those claims were written for different purposes:

- `docs/definitions/` describes the target system design
- `docs/systems/` describes current implementation reality
- `docs/audits/definitions-vs-system-audit.md` describes the gap between target and reality
- `docs/phase-implementation-protocol.md` governs how a phase is executed
- `docs/final-system-coverage.md` governs final release acceptance
- `docs/frontend-coverage-map.md` governs frontend coverage and wiring audit production
- `docs/audit.md` is an older baseline system audit with broad supremacy language

Without a unifying authority model, different documents can all appear to be "the" source of truth while actually answering different questions.

This contract resolves that ambiguity.

It does **not** replace design definitions, system documents, audits, phase specs, or final release contracts.

It defines:

- which documentation layer is authoritative for which decision
- how to resolve conflicts between layers
- how future audits and phases must be derived
- how documentation may evolve without silently rewriting system intent

---

## 2. Core Governance Principle

GoMate does **not** have one universal source of truth for every question.

Instead, GoMate uses a **domain-scoped authority model**:

- one authority for target behavior
- one authority for current reality
- one authority for gap analysis
- one authority for phase execution
- one authority for frontend wiring
- one authority for final release acceptance

Any document claiming authority outside its own domain is overreaching and must be interpreted through this contract.

---

## 3. Authority Domains

### 3.1 Target Design Authority

**Authority:** `docs/definitions/`

This layer defines what the system is supposed to be.

It is authoritative for:

- target architecture
- target data models
- target ownership rules
- target invariants
- target lifecycle/state models
- target authority boundaries between subsystems
- target behavior that future implementation should align toward

It is **not** authoritative for:

- claims about what is currently implemented
- claims that a target requirement already exists in code
- final acceptance of current runtime behavior

Special rule:

- If a definition document contains an explicit V1 scope block, alignment note, or explicit deferral note, that note is part of the canonical definition for the current product scope and must be honored.

### 3.2 Current Reality Authority

**Authority:** actual code, actual database schema, actual runtime behavior

This is the final arbiter for what the system currently does.

Supporting documentation for current reality:

- `docs/audits/backend-audit.md`
- `docs/systems/`
- runtime verification evidence
- live API behavior
- database inspection

Current reality authority is authoritative for:

- whether something exists now
- current request/response shapes
- actual state transitions
- actual storage model
- actual backend/frontend behavior

It is **not** authoritative for:

- what the system should become
- whether current implementation is acceptable
- whether a divergence from design is approved

### 3.3 Gap Analysis Authority

**Authority:** `docs/audits/definitions-vs-system-audit.md`

This layer is the authoritative diff between:

- canonical target behavior in `docs/definitions/`
- actual current behavior in code/runtime

It is authoritative for:

- identifying mismatches
- classifying mismatch type
- severity ranking
- recommended fix strategy
- deciding whether a gap is code work, definition alignment, or v2 deferral

It is **not** itself a design layer.

It may not silently redefine canonical behavior.

### 3.4 Phase Execution Authority

**Authority:** `docs/phase-implementation-protocol.md`

This layer is authoritative for:

- gate order
- artifact requirements
- implementation acceptance procedure
- who owns which verification step

It is **not** authoritative for:

- what the system should do
- what gaps exist
- which design model is canonical

Phase content authority comes from:

- phase spec documents in `docs/phases/`
- which themselves must be derived from the audit layer

### 3.5 Frontend Wiring Authority

**Authority:** `docs/frontend-coverage-audit.md` for a given audited scope

This layer is authoritative for:

- wiring obligations between documented capabilities and frontend implementation
- traceable frontend coverage decisions

It is subordinate to:

- canonical capability requirements in `docs/definitions/`
- scope decisions in phase documents
- this document's authority model

It may not invent new product behavior.

### 3.6 Final Release Acceptance Authority

**Authority:** `docs/final-system-coverage.md` and the most current `final-system-audit.md`

This layer is authoritative for:

- whether the system may be declared complete
- how final coverage is judged
- whether prior phase artifacts are sufficient evidence
- final pass/fail acceptance status

It is **domain-supreme for final release only**.

It does **not** replace:

- definitions as target design authority
- systems docs as current-state documentation
- the audit layer as the working gap register during implementation

### 3.7 Session Entry Authority

**Authority:** `CLAUDE.md`

This file is authoritative only for:

- what a new implementation session should read first
- how the repository expects work to begin

It is not a substitute for the authority layers above.

It must point to them accurately.

---

## 4. Precedence by Decision Type

The following table is the actual precedence model for the repository.

| Decision Type | Primary Authority | Secondary Evidence | Notes |
|---|---|---|---|
| What the system should do | `docs/definitions/` | explicit V1 scope notes inside definition docs | Canonical target model |
| What the system currently does | code + runtime + DB | `docs/audits/backend-audit.md`, `docs/systems/` | Reality-first |
| Whether target and reality differ | `docs/audits/definitions-vs-system-audit.md` | definitions + backend/system evidence | Canonical diff layer |
| How a phase must be executed | `docs/phase-implementation-protocol.md` | phase artifacts | Process authority only |
| What a specific phase must build | `docs/phases/phase-*.md` | audit gap references | Must be derived, not invented |
| Frontend wiring obligations | `docs/frontend-coverage-audit.md` | definitions, phase scope, code review | Wiring authority, not product authority |
| Whether the product is finally complete | `docs/final-system-coverage.md` + current `final-system-audit.md` | all prior artifacts and runtime evidence | Release gate authority |

This table supersedes any flatter, more absolute wording elsewhere.

---

## 5. Directory Roles

### 5.1 `docs/definitions/`

Role:

- canonical design and target behavior

Required qualities:

- explicit about target invariants
- explicit about authority boundaries
- explicit when describing V1-minimal behavior versus target architecture

Forbidden uses:

- describing implementation as if it exists when it does not
- silently changing canonical behavior to match code drift without an explicit alignment decision

### 5.2 `docs/systems/`

Role:

- descriptive current-state documentation

Required qualities:

- reality-first
- evidence-based
- explicit about actual file paths, API shapes, and runtime behavior
- explicit about gaps and inconsistencies

Forbidden uses:

- declaring target behavior
- redefining canonical architecture by documenting whatever the code currently does
- being treated as the approval source for long-term design decisions

### 5.3 `docs/audits/`

Role:

- governance, verification, and gap analysis

Sub-roles:

- `backend-audit.md`: what the backend/system actually does
- `definitions-vs-system-audit.md`: where target and reality diverge
- this file: which document layers are authoritative for which decisions

Forbidden uses:

- silently rewriting definitions
- acting as substitute implementation docs without linking evidence

### 5.4 `docs/phases/`

Role:

- ordered implementation slices derived from audit findings

Required qualities:

- explicit gap references
- explicit dependency ordering
- explicit acceptance criteria

Forbidden uses:

- inventing scope not grounded in audit findings
- overriding canonical definitions without an explicit governance decision

---

## 6. Statement Classification Rules

Every major documentation claim should be interpretable as one of four statement types:

### 6.1 Canonical

Meaning:

- the intended target behavior/model that GoMate is aligning toward

Home:

- `docs/definitions/`

Example:

- "The Progress Tracking System is the sole authority on all progress metrics."

### 6.2 Current Reality

Meaning:

- what the system actually does today

Home:

- code, runtime, DB
- `docs/systems/`
- `docs/audits/backend-audit.md`

Example:

- "The dashboard computes some display state locally."

### 6.3 Gap

Meaning:

- where canonical behavior and current reality differ

Home:

- `docs/audits/definitions-vs-system-audit.md`

Example:

- "Dashboard reads some progress locally instead of only from Progress Tracking."

### 6.4 Decision

Meaning:

- an explicit governance call about whether to implement, defer, align docs, or treat current behavior as v1-acceptable

Home:

- audit layer
- phase docs
- explicit alignment notes inside definitions

Example:

- "Keep JSONB checklist snapshot for v1; defer normalized checklist tables to later."

---

## 7. Conflict Resolution Rules

### 7.1 Definitions vs Systems

If `docs/definitions/` and `docs/systems/` disagree:

- `definitions` wins for target behavior
- `systems` wins for current behavior description
- the disagreement must be recorded as a gap in `docs/audits/definitions-vs-system-audit.md`

No one may "resolve" the conflict by silently treating the system document as new canon.

### 7.2 Definitions vs Code

If code diverges from definitions:

- code is reality
- definitions remain target unless explicitly changed
- the mismatch must be classified as:
  - code fix
  - definition alignment
  - intentional v1 deviation
  - v2 deferral

### 7.3 Systems vs Code

If a system document disagrees with code/runtime:

- code/runtime wins
- the system document must be updated
- no phase planning may rely on the stale system document alone

### 7.4 Old Audit vs New Audit

If `docs/audit.md` conflicts with newer audit documents:

- treat `docs/audit.md` as historical baseline
- treat the newer audit layer as current governance input
- do not reuse supremacy language from `docs/audit.md` outside its original baseline context

### 7.5 Phase Artifact vs Current Runtime

If a phase artifact says PASS but runtime verification fails now:

- runtime wins
- the artifact becomes historical evidence only
- the current gap must be reopened in the audit layer

### 7.6 Final Acceptance vs Working Audit

If `final-system-coverage.md` or a current `final-system-audit.md` is in scope:

- those documents govern final release acceptance only
- they do not redefine the target model for ongoing design alignment

---

## 8. How New Phase Documents Must Be Produced

Every future phase pack must follow this derivation chain:

```text
definitions
  -> backend/system audit of current reality
  -> definitions-vs-system gap register
  -> prioritized phase docs
  -> implementation
  -> re-audit
```

Direct derivation from `docs/systems/` alone is forbidden.

Direct derivation from "what the code seems to do" alone is forbidden.

Every new phase document must answer:

- which canonical definition requirement is being aligned
- what current reality does instead
- why this gap is being handled now
- whether the fix is code, docs, or deliberate deferral

---

## 9. Documentation Update Rules

### 9.1 When Code Changes

After a code change:

- update `docs/systems/` if current behavior changed
- update `docs/audits/definitions-vs-system-audit.md` if a gap was closed or changed severity
- update phase status/artifacts as required by the execution protocol
- update `docs/definitions/` only if the intended target behavior changed

### 9.2 When Definitions Change

Changing a definition document is a design decision, not a documentation cleanup.

It must be explicit whether the change is:

- clarification only
- canonical target change
- V1 alignment note
- v2 deferral note

A definition must never be changed merely to hide implementation drift.

### 9.3 When System Docs Change

System docs may be updated whenever code/runtime reality changes.

They must not:

- declare new canon
- erase evidence of divergence without the audit layer being updated

### 9.4 When Audit Docs Change

Audit docs may:

- open a gap
- close a gap
- downgrade or upgrade severity
- reclassify a mismatch from code-work to definition-alignment or vice versa

But they must always cite:

- canonical source
- current reality evidence
- decision rationale

---

## 10. Required Audit Loop for Future Alignment Work

For any major alignment initiative, the following loop is mandatory:

### Loop A — Discovery

1. Read relevant definition docs.
2. Read current system docs and backend audit.
3. Inspect actual code, API behavior, and database structures.
4. Record every mismatch.

### Loop B — Classification

For each mismatch, classify:

- mismatch type
- severity
- code fix vs definition alignment vs deferral
- dependency ordering

### Loop C — Draft Decision

Write the proposed fix strategy into the audit layer.

### Loop D — Re-Audit

Re-scan the same surface looking specifically for:

- missed authority conflicts
- hidden dependency conflicts
- stale system-doc claims
- mismatches accidentally normalized by wording

### Loop E — Closure Test

The loop stops only when:

- no new mismatch categories appear in a fresh pass
- every known mismatch has an explicit decision path
- no unresolved authority conflict remains for the scoped area

This is the required method for producing post-phase full-alignment work.

---

## 11. Current Governance Conflicts Identified By This Audit

This document is being introduced because the following real governance conflicts exist today.

### GOV-001

- Location: `docs/audit.md`
- Conflict: claims to be the single source of truth for system state and says it wins over system docs and aspirational specs
- Problem: this overreaches beyond its role as an older baseline audit
- Resolution under this contract: treat `docs/audit.md` as historical baseline, not universal supremacy

### GOV-002

- Location: `CLAUDE.md`
- Conflict: mixes current audit-based workflow with an older instruction to read `docs/audit.md` for system-specific work
- Problem: this can send implementation sessions to a stale authority layer
- Resolution under this contract: session entry must prefer `docs/audits/backend-audit.md`, `docs/audits/definitions-vs-system-audit.md`, and this document

### GOV-003

- Location: `docs/frontend-coverage-map.md`
- Conflict: states that system and phase documentation are the supreme source of truth for frontend capability requirements
- Problem: without this contract, it is unclear whether "system documentation" means definitions, systems docs, or both
- Resolution under this contract: frontend capability requirements derive from canonical definitions and scoped phase docs; system docs are current-state evidence, not canon

### GOV-004

- Location: `docs/final-system-coverage.md`
- Conflict: defines a precedence chain that does not mention definitions or systems docs
- Problem: this looks incomplete if misread as a universal governance order
- Resolution under this contract: treat that precedence chain as final-release acceptance precedence only

### GOV-005

- Location: `docs/roadmap.md`
- Conflict: rightly says "REAL SYSTEM -> DOCUMENT ACCURATELY -> ALIGN WITH TARGET", but does not define which folder is authoritative for target vs reality vs gap
- Problem: philosophy exists, authority mechanism does not
- Resolution under this contract: definitions = target, systems = current reality, audits = diff/decision

---

## 12. Repository-Wide Operating Rules

From this point forward:

1. `docs/definitions/` is the canonical target model.
2. `docs/systems/` is the descriptive current-state layer.
3. `docs/audits/definitions-vs-system-audit.md` is the canonical gap register.
4. New phase docs must be derived from that gap register.
5. No document may silently convert current implementation into canon.
6. No audit may claim PASS by matching `docs/systems/` alone when `docs/definitions/` requires more.
7. No stale artifact may override present runtime evidence.
8. Final release acceptance is governed separately by the final coverage contract.

---

## 13. Practical Reading Order

### 13.1 For Ongoing Implementation

Read in this order:

1. `CLAUDE.md`
2. `docs/audits/document-authority.md`
3. `docs/audits/definitions-vs-system-audit.md`
4. `docs/audits/backend-audit.md`
5. relevant `docs/definitions/*`
6. relevant `docs/systems/*`
7. relevant phase doc(s), if work is phase-based

### 13.2 For Full Alignment Audit

Read in this order:

1. this document
2. relevant definition docs
3. relevant system docs
4. backend audit
5. actual code/runtime
6. existing gap register

### 13.3 For Final Release Audit

Read in this order:

1. this document
2. `docs/final-system-coverage.md`
3. current runtime/code
4. all required artifacts and evidence

---

## 14. Immediate Follow-Up Actions

This contract establishes the authority model, but several repository documents should be aligned to reference it explicitly.

Recommended immediate follow-ups:

1. Update `CLAUDE.md` to include this document in the Fresh Session Script and Governance Documents table.
2. Remove or qualify stale supremacy wording in future revisions of `docs/audit.md` by marking it explicitly historical.
3. Clarify in future revisions of `docs/frontend-coverage-map.md` that canonical frontend capability requirements originate from definitions/phase scope, not from current-state system docs.
4. Use this contract as the entry document for the planned post-phase full definitions-to-implementation audit.

---

## 15. Final Decision

For GoMate governance:

- **Definitions are canonical target authority.**
- **Code/runtime is current-reality authority.**
- **Audits are the mandatory reconciliation and decision layer.**
- **Systems docs are evidence of current reality, not canon.**
- **Phase docs are derived execution slices, not root authority.**
- **Final coverage contract governs release acceptance only.**

Any future work that does not follow this model is out of governance compliance.
