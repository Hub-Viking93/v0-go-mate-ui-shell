# Frontend Coverage Map — Enterprise Standard Contract (v2.0)

## Status: ACTIVE AND MANDATORY
## Classification: Global System Contract — Implementation Authority
## Scope: Applies to ALL repositories, ALL projects, ALL systems, ALL teams
## Supersedes: Frontend Coverage Map v1.0

---

# 0. Contract Preamble

This document is a binding system contract.

It is not a guide. It is not a tutorial. It is not a recommendation.

It is a mandatory enforcement protocol that governs how frontend coverage audits are performed, documented, and enforced across all systems and repositories.

This contract defines the authoritative procedure for producing the Frontend Wiring Authority Document: `frontend-coverage-audit.md`.

This contract is permanent, reusable, and system-agnostic.

This contract will be applied in full to every project that uses the Phase Implementation Protocol.

No deviation, abbreviation, or substitution is permitted.

---

# 1. Purpose

This contract defines the mandatory procedure for auditing frontend coverage against system and Phase specifications.

This contract governs how Claude Code MUST analyze system documentation and frontend implementation and produce a complete, authoritative, and deterministic wiring authority document.

This process MUST produce exactly ONE output file:

**`frontend-coverage-audit.md`**

This output file is designated as the **Frontend Wiring Authority Document**.

It becomes the primary and binding reference for:

Phase Implementation Protocol → Section 5: Frontend Wiring Gate

This audit MUST be performed BEFORE any Phase implementation begins.

No Phase implementation may begin until `frontend-coverage-audit.md` has been created, completed, and verified.

---

# 2. Contract Authority

## 2.1 Documentation as Supreme Source of Truth

System and Phase documentation is the single, supreme source of truth for all frontend capability requirements.

This contract and the audit it governs override:

- Informal frontend assumptions
- Undocumented frontend implementations
- Incomplete Phase implementations
- Developer memory or convention
- Any prior audit that has not been formally superseded

If a discrepancy exists between frontend implementation and documentation, documentation governs.

If a frontend capability exists but is not documented, it is not recognized as a required capability unless documentation is updated.

If a documented capability has no frontend implementation, it is classified as Missing and must be wired.

No frontend implementation claim has authority unless it is validated by direct code inspection and mapped to documentation.

## 2.2 Audit as Deterministic Coverage Authority

The audit process defined by this contract is deterministic.

Given the same documentation and frontend codebase, the audit must always produce the same result.

The audit cannot be influenced by assumption, convention, precedent, or prior implementation history.

The audit result is solely determined by what exists in documentation and what exists in code at the time of audit execution.

## 2.3 Frontend Wiring Authority Document

`frontend-coverage-audit.md` is designated the **Frontend Wiring Authority Document** for the system it audits.

Once produced and verified, it governs all frontend wiring decisions for the implementation phase it precedes.

All frontend wiring actions performed during Phase Implementation Protocol → Frontend Wiring Gate MUST be traceable to entries in `frontend-coverage-audit.md`.

Any frontend wiring action not traceable to the Frontend Wiring Authority Document is unauthorized and must be reviewed.

---

# 3. Scope

This contract applies to:

- All repositories using Phase Implementation Protocol
- All frontend technologies and frameworks
- All Phase types, including foundation-only Phases
- All project sizes, from single-Phase to multi-Phase systems
- All teams executing Phase implementation

This contract applies without modification regardless of:

- Technology stack
- Team size
- Phase count
- Repository structure
- Project domain

---

# 4. Definitions

## 4.1 Capability

A **Capability** is defined as:

"A user-visible or system-critical feature exposed by the backend that the frontend must trigger, observe, or render."

Capabilities are not synonymous with Phases. A single Phase may expose multiple capabilities.

## 4.2 Frontend Capability

A **Frontend Capability** is a capability that requires one or more of the following:

- A UI trigger (button, form, link, or other interactive element)
- A visual rendering of backend state or output
- A real-time or polling-based event display
- An API request initiated from the frontend
- A state management update driven by backend response

## 4.3 Infrastructure Capability

An **Infrastructure Capability** is a capability that belongs to a foundation-only Phase.

Infrastructure Capabilities do not require UI implementation.

Infrastructure Capabilities MUST still be listed and classified in the audit.

## 4.4 User-Visible Capability

A **User-Visible Capability** is a Frontend Capability that directly produces visible output or interaction for the end user.

All User-Visible Capabilities MUST be fully wired and verified.

## 4.5 Coverage Status

Coverage Status is the classification assigned to each capability reflecting the completeness of its frontend implementation.

Valid Coverage Status values are defined exclusively in Section 7 of this contract.

## 4.6 Wiring Action

A **Wiring Action** is a specific, named implementation task required to bring a Partial or Missing capability to Covered status.

Wiring Actions are mandatory outputs of the audit for all non-Covered, non-Foundation-only capabilities.

## 4.7 Assumption

An **Assumption** is any inference made by Claude Code during audit execution where documentation or code does not provide explicit information.

All Assumptions are subject to the Assumption Logging Contract defined in Section 10.

---

# 5. Non-Negotiable Execution Rules

Claude Code MUST follow these rules without exception, deviation, or interpretation.

## 5.1 Mandatory Actions

Claude Code MUST:

- Scan ALL documentation under `/docs`, `/phases`, or equivalent documentation directories
- Scan ALL frontend code under the frontend root directory
- Treat system and Phase documentation as the single source of truth
- Extract capabilities at the capability level, not only at the Phase level
- Explicitly identify Phases that require no UI as "Foundation-Only / No UI Expected"
- Explicitly label coverage status for EVERY capability using only the taxonomy defined in Section 7
- Provide explicit, actionable Wiring Actions for EVERY capability with Partial or Missing status
- Log ALL Assumptions explicitly in the audit output
- Produce exactly one output file: `frontend-coverage-audit.md`
- Execute the Audit Completion Verification Protocol defined in Section 12 before finalizing

## 5.2 Prohibited Actions

Claude Code MUST NOT:

- Assume frontend coverage exists without direct code verification
- Invent, approximate, or infer components that do not exist in code (mark as Missing)
- Skip any Phase, including foundation-only Phases
- Skip any capability within any Phase
- Skip writing Wiring Actions for any Partial or Missing capability
- Produce a partial or draft `frontend-coverage-audit.md` and declare audit complete
- Proceed to Phase implementation if audit is incomplete or verification has failed
- Conceal or omit Assumptions

---

# 6. Required Inputs — Analysis Targets

Claude Code MUST analyze BOTH system documentation and frontend implementation before producing any audit output.

## 6.1 Documentation Analysis Targets

Claude Code MUST scan all documentation to extract Phases and capabilities.

Primary documentation paths:

- `/docs`
- `/phases`

If these paths do not exist, Claude Code MUST locate equivalent directories by searching the repository root for documentation structures.

Allowed documentation file types:

- `.md`
- `.txt`

Claude Code MUST extract Phases and capabilities using, but not limited to, the following capability indicator keywords:

Phase, Capability, Endpoint, API, Plan, Execution, Run, Approve, Event, Workspace, Gate, State, UI, Frontend, Backend, Trigger, Display, Render, Stream, Submit, Create, Update, Delete, View, List, Monitor, Notify, Upload, Download, Authenticate, Authorize

Claude Code MUST extract ALL Phases.

Claude Code MUST extract ALL capabilities within each Phase.

No Phase and no capability may be omitted.

## 6.2 Frontend Analysis Targets

Claude Code MUST scan the frontend root directory in full.

Standard frontend root paths include:

- `/frontend`
- `/apps/web`
- `/web`
- `/client`
- `/app`

If no standard path is found, Claude Code MUST locate the frontend root by scanning the repository structure and document the located path as an Assumption.

Claude Code MUST analyze:

- Routing structure (all routes and route definitions)
- Pages and route-level components
- UI components (all interactive and display components)
- API client layer (all API call definitions)
- State management systems (all stores, reducers, contexts)
- Event handling systems (polling, SSE, websocket, or equivalent)
- Authentication headers and API integration patterns
- Any abstraction layers between UI and backend communication

Claude Code MUST identify ALL frontend capabilities present in code.

---

# 7. Coverage Status Taxonomy

This taxonomy is locked. Claude Code MUST use ONLY the following status labels.

No additional statuses may be invented or substituted.

---

## ✅ Covered

Frontend fully supports the capability.

ALL of the following required elements exist and are verified:

- UI trigger exists and is correctly wired
- API request is correctly formed and dispatched
- State is correctly updated upon API response
- UI rendering correctly reflects state
- Event wiring functions correctly (if required by capability)

No Wiring Action is required.

---

## ⚠️ Partial

Frontend partially supports the capability.

At least ONE of the following is absent, incomplete, or incorrectly implemented:

- UI trigger missing or incorrectly wired
- API wiring missing or incorrect
- State update missing, incomplete, or incorrect
- UI rendering missing, incomplete, or incorrect
- Event wiring missing or incorrect (where required)

Wiring Action is REQUIRED.

Wiring Action MUST specify exactly which element is missing or incorrect and what action is required to resolve it.

---

## ❌ Missing

Frontend does not support the capability.

No meaningful frontend implementation exists for this capability.

Wiring Action is REQUIRED.

Wiring Action MUST specify all elements that must be created and wired.

---

## ➖ Foundation-Only / No UI Expected

Capability belongs to an Infrastructure Phase.

Frontend support is not required for this capability.

This capability MUST still be listed in the audit with this status.

No Wiring Action is required.

---

# 8. Required Output File — `frontend-coverage-audit.md`

Claude Code MUST produce `frontend-coverage-audit.md` as the sole output of this audit process.

Claude Code MUST follow this EXACT structural template. No sections may be omitted.

---

## Section 1: Metadata

The following fields are REQUIRED:

- Repository name
- Branch and commit hash at time of audit
- Audit date (ISO 8601 format)
- Auditor identity (Claude Code)
- Frontend root path confirmed during audit
- Documentation paths scanned during audit
- All Assumptions logged (see Section 10)

---

## Section 2: Contract Authority Declaration

This section MUST include the following declaration verbatim:

> This document is the Frontend Wiring Authority Document for this system, produced under Frontend Coverage Map Standard Contract v2.0. It governs all frontend wiring decisions for the Phase Implementation Protocol Frontend Wiring Gate. All wiring actions performed during implementation must be traceable to entries in this document.

---

## Section 3: Executive Summary

This section MUST include:

- Total Phases discovered
- Total capabilities discovered
- Coverage breakdown by status:
  - Count and percentage of Covered capabilities
  - Count and percentage of Partial capabilities
  - Count and percentage of Missing capabilities
  - Count and percentage of Foundation-Only capabilities
- Enumerated list of all critical frontend gaps (Missing and Partial capabilities)
- Audit readiness declaration: READY FOR WIRING or BLOCKED (with reason if blocked)

---

## Section 4: How to Use This Document

This section MUST state:

- This document is the PRIMARY and BINDING wiring authority for this system
- This document MUST be used as the governing reference for Phase Implementation Protocol → Frontend Wiring Gate
- All frontend wiring decisions must be traceable to this document
- Any capability not listed in this document must trigger a contract amendment before implementation

---

## Section 5: Frontend Inventory

This section MUST enumerate:

- All frontend routes discovered
- All frontend components discovered
- Complete API client structure (all endpoints referenced)
- All state management systems identified
- All event handling systems identified (polling, SSE, websocket, or equivalent)

---

## Section 6: Phase-by-Phase Coverage Matrix

This section MUST list EVERY Phase.

For EVERY capability within each Phase, the following fields are REQUIRED:

- Capability identifier (Phase N — Capability N.M format)
- Capability name (Verb + Object + Outcome format)
- Coverage Status (from Section 7 taxonomy only)
- UI entrypoint (route, page, or control — or "None" if not applicable)
- Component responsible (or "None / To Be Created")
- API request used (or "None / To Be Created")
- State update mechanism (or "None / To Be Created")
- Event wiring mechanism (or "None / Not Applicable")
- Wiring Actions required (mandatory for Partial and Missing; "None Required" for Covered and Foundation-Only)

No capability may be listed without all fields populated.

---

## Section 7: Gap Backlog

This section MUST aggregate ALL capabilities with Partial or Missing status.

For each gap, the following fields are REQUIRED:

- Capability reference (matching identifier from Section 6)
- Coverage Status
- Gap description (specific description of what is absent or incomplete)
- Required Wiring Action (specific, actionable implementation task)
- Priority classification: Critical (blocks Phase functionality) or Standard

No gap may be listed without all fields populated.

If no gaps exist, this section MUST state: "No gaps identified. All capabilities are Covered or Foundation-Only."

---

## Section 8: Wiring Recipes

This section MAY include reusable wiring patterns applicable to this system.

If included, patterns must be specific to the system being audited.

---

## Section 9: Verification Plan

This section MUST define the exact steps Claude Code and the User will follow to verify that all Wiring Actions have been correctly implemented after the Frontend Wiring Gate is complete.

---

## Section 10: Assumption Log

This section MUST enumerate every Assumption made during audit execution.

See Section 10 of this contract for full Assumption Logging requirements.

---

# 9. Capability Extraction and Numbering Standard

## 9.1 Extraction Method

Claude Code MUST extract capabilities from Phase documentation as the primary source.

Frontend code inspection informs coverage status but does NOT define required capabilities.

Required capabilities are defined solely by documentation.

## 9.2 Numbering Convention

Each capability MUST be assigned a unique identifier:

Format: `Phase N — Capability N.M`

Examples:

- Phase 2 — Capability 2.1
- Phase 2 — Capability 2.2
- Phase 3 — Capability 3.1

Capability numbering MUST be sequential within each Phase.

## 9.3 Capability Naming Convention

Capability names MUST follow Verb + Object + Outcome format.

Examples:

- Generate plan preview
- Approve execution plan
- Start execution run
- Stream execution events
- Display execution results
- Submit workspace configuration
- Render real-time event log

---

# 10. Assumption Logging Contract

## 10.1 Mandatory Assumption Disclosure

Every Assumption made during audit execution MUST be explicitly logged.

No hidden Assumptions are permitted.

Assumptions may not be omitted from the audit output.

## 10.2 Assumption Record Format

Each logged Assumption MUST include:

- Assumption identifier (sequential: A-001, A-002, etc.)
- Location or context where the Assumption was required
- The specific Assumption made
- The reason the Assumption was necessary (what was ambiguous or missing)
- The risk introduced by the Assumption
- The recommended action to resolve the Assumption (e.g., confirm with documentation)

## 10.3 Assumption Disclosure in Executive Summary

The total count of Assumptions logged MUST be disclosed in the Executive Summary.

If the number of Assumptions is high, the audit MUST flag this as a risk to audit accuracy.

## 10.4 Assumption Resolution Requirement

Assumptions made during audit do not invalidate the audit.

However, Assumptions that affect coverage status classifications MUST be flagged for review before Phase implementation begins.

---

# 11. Stop Conditions and Failure Handling

## 11.1 Audit Must Not Block on Ambiguity

Claude Code MUST NOT halt or abandon the audit due to ambiguity.

Ambiguity MUST be resolved by logging an Assumption and proceeding.

## 11.2 Incomplete `frontend-coverage-audit.md`

If `frontend-coverage-audit.md` is produced but does not satisfy the Audit Completion Verification Protocol defined in Section 12, it is NOT complete.

An incomplete `frontend-coverage-audit.md` MUST be corrected before Phase implementation begins.

Phase Implementation Protocol MUST NOT proceed while `frontend-coverage-audit.md` is incomplete.

## 11.3 Missing Capabilities

If Missing capabilities exist in the audit, Phase implementation may still proceed.

However, Claude Code MUST create the required frontend components and wiring as defined in the Wiring Actions for those capabilities during the Frontend Wiring Gate.

Missing capabilities that remain unresolved after the Frontend Wiring Gate constitute a wiring failure and MUST be resolved before the Frontend Wiring Gate artifact is produced.

## 11.4 Wiring Contradicting Documentation

If frontend wiring implemented during the Frontend Wiring Gate contradicts documentation or deviates from Wiring Actions defined in `frontend-coverage-audit.md`, Claude Code MUST:

- Document the contradiction
- Resolve the contradiction in favor of documentation unless a documented exception is approved
- Update `frontend-coverage-audit.md` to reflect the final wiring state

## 11.5 Audit Re-execution

If documentation or frontend code changes materially after `frontend-coverage-audit.md` is produced, the audit MUST be re-executed.

Re-execution produces a new version of `frontend-coverage-audit.md`.

The prior version is superseded and must be archived or overwritten.

Phase implementation must use only the most current `frontend-coverage-audit.md`.

---

# 12. Audit Completion Verification Protocol

Before finalizing `frontend-coverage-audit.md`, Claude Code MUST execute the following verification checklist in full.

Claude Code MUST confirm each item explicitly. No item may be skipped.

---

## Checklist

**Phase Coverage**
- [ ] All Phases present in documentation are listed in the audit
- [ ] No Phase has been skipped

**Capability Coverage**
- [ ] All capabilities within every Phase are listed in the audit
- [ ] No capability has been skipped

**Coverage Status**
- [ ] Every capability has been assigned a Coverage Status
- [ ] Only statuses from the Section 7 taxonomy have been used
- [ ] No capability has an undefined or blank Coverage Status

**Wiring Actions**
- [ ] Every Partial capability has at least one explicit Wiring Action
- [ ] Every Missing capability has at least one explicit Wiring Action
- [ ] No Partial or Missing capability is listed without Wiring Actions

**Gap Backlog**
- [ ] Gap Backlog contains all Partial capabilities
- [ ] Gap Backlog contains all Missing capabilities
- [ ] No gaps are absent from the Gap Backlog
- [ ] No duplicate entries exist in the Gap Backlog

**Assumption Log**
- [ ] All Assumptions made during audit are logged in Section 10
- [ ] No hidden Assumptions exist
- [ ] Each Assumption record is complete

**Output File**
- [ ] `frontend-coverage-audit.md` contains all required sections
- [ ] No section is absent or incomplete
- [ ] Contract Authority Declaration is present verbatim in Section 2
- [ ] Audit readiness declaration is present in Executive Summary

---

If any checklist item fails, Claude Code MUST resolve the failure before declaring the audit complete.

`frontend-coverage-audit.md` is not complete until every checklist item passes.

---

# 13. Frontend Wiring Authority Rule

## 13.1 Primary Reference Authority

`frontend-coverage-audit.md` is the PRIMARY and BINDING reference for all frontend wiring decisions made during Phase Implementation Protocol → Frontend Wiring Gate.

Approximately 90–95% of wiring work is defined by `frontend-coverage-audit.md`.

The remaining 5–10% of wiring work consists of implementation details resolved during actual wiring.

## 13.2 Residual Wiring Resolution

For the residual 5–10% of wiring work not explicitly defined in `frontend-coverage-audit.md`, Claude Code MUST:

- Resolve wiring in a manner consistent with documented capability requirements
- Create any missing frontend components required to complete wiring
- Complete all wiring actions to bring all Non-Foundation capabilities to Covered status
- Update `frontend-coverage-audit.md` to reflect the final wiring state of the system

## 13.3 Final State Obligation

Upon completion of the Frontend Wiring Gate, `frontend-coverage-audit.md` MUST reflect the final wiring state of the system.

All capabilities that were Partial or Missing at audit time MUST be updated to Covered (or remain Missing with documented justification if deferred).

---

# 14. Enforcement Rule

## 14.1 Mandatory Compliance

This contract is mandatory.

Compliance is not optional and is not subject to discretion.

## 14.2 Pre-Implementation Gate

`frontend-coverage-audit.md` MUST exist and be verified as complete before any Phase implementation begins.

If `frontend-coverage-audit.md` does not exist, Phase implementation is blocked.

If `frontend-coverage-audit.md` exists but has not passed the Audit Completion Verification Protocol, Phase implementation is blocked.

## 14.3 Wiring Gate Dependency

Phase Implementation Protocol → Frontend Wiring Gate depends on `frontend-coverage-audit.md` as its governing authority.

The Frontend Wiring Gate cannot be executed without a complete and verified `frontend-coverage-audit.md`.

## 14.4 Scope of Application

This contract applies to ALL systems.

This contract applies to ALL teams.

This contract applies to ALL Phases.

No system, team, or Phase is exempt.

---

# 15. Contract Permanence and Reusability

## 15.1 Permanent Global Standard

This contract is a permanent global standard.

It is not project-specific.

It is not bound to any single repository, team, or technology stack.

It is designed for perpetual reuse across all future systems that use the Phase Implementation Protocol.

## 15.2 Version Control

This contract is versioned.

The current version is v2.0.

If this contract is amended, the version number MUST be incremented.

All systems MUST reference the version of this contract under which their audit was performed.

## 15.3 Contract Amendment

Amendments to this contract must be made to the contract document itself.

Informal overrides, verbal exceptions, or per-project modifications are not permitted.

Any required exception must be formally documented as a contract amendment and versioned accordingly.

---

# END OF CONTRACT
