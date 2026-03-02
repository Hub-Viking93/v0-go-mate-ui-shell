# Final System Coverage — Enterprise Standard Contract (v2.1)

## Status: ACTIVE AND MANDATORY
## Classification: Global System Contract — Final Acceptance Authority
## Scope: Applies to ALL repositories, ALL projects, ALL systems (current and future)
## Supersedes: Final System Coverage v2.0

---

# 0. Contract Preamble

This document is a binding system contract.

It is not a guide. It is not documentation. It is not a recommendation.

It is the mandatory final acceptance authority that governs how a completed system is verified as correct, complete, and production-grade before it may be declared done or shipped.

This contract is permanent, reusable, and system-agnostic.

It applies in full to every project that uses the Phase Implementation Protocol.

No deviation, abbreviation, or substitution is permitted.

---

# 1. Purpose

This contract defines the mandatory final system audit procedure that governs how a fully-built system is verified as complete, correct, and production-grade.

This is a global contract. It is not tailored to any single repository, team, or technology stack.

This contract exists to guarantee that:

- The implemented system matches real system behavior, not only documentation or artifact claims
- All Phase artifacts are treated as evidence of prior verification, not as final truth
- All critical end-to-end flows are verified across all Phases against live or statically-inspected reality
- System invariants hold under both success and failure conditions
- The system is auditable, regression-safe, and shippable
- Final release authority requires independent User sign-off on all Critical and High severity items

This process MUST produce exactly ONE output file:

**`final-system-audit.md`**

No system may be declared done, shipped, or complete until `final-system-audit.md` exists, bears a **FINAL SYSTEM PASS** declaration, and contains a completed User Sign-Off per Section 15A, as defined in this contract.

---

# 2. Contract Authority and Precedence

## 2.1 Supreme Authority Declaration

This contract is the supreme authority for final system acceptance.

It overrides all of the following without exception:

- Phase gate artifacts (`backend-acceptance-phase-N.md`, `frontend-wiring-report-phase-N.md`, `regression-report-phase-N.md`)
- Phase specifications and documentation
- Informal assumptions about system completeness
- Developer or team claims of implementation completeness
- Prior audit results that have not been superseded by a current `final-system-audit.md` bearing FINAL SYSTEM PASS

If any of the above contradict the findings of this contract's audit process, this contract governs.

## 2.2 Authority Precedence Chain

When conflicts exist between sources, precedence is strictly:

1. `final-system-coverage.md` — this contract (supreme authority)
2. Phase specifications — system blueprint under `/phases` or equivalent
3. Phase gate artifacts — evidence of prior gate verification
4. Implementation — codebase and runtime behavior

## 2.3 Artifacts as Evidence, Not Truth

Phase gate artifacts are evidence that prior verification was performed at a point in time.

They are not proof that the system is currently correct.

If Phase artifacts declare PASS but current runtime verification fails, the system is NOT complete.

The state of the real system at the time of final audit governs all status determinations.

No PASS declaration in any Phase artifact overrides a FAIL finding in this audit.

## 2.4 Reality as Final Arbiter

The real system — actual code, actual endpoints, actual runtime behavior — is the final arbiter of system correctness.

Documentation that describes functionality not present in the real system does not constitute coverage.

Runtime behavior that contradicts documentation constitutes a FAIL, not a PASS.

---

# 3. Non-Negotiable Execution Rules

Claude Code MUST follow these rules without exception, deviation, or interpretation.

## 3.1 Mandatory Actions

Claude Code MUST:

- Treat this contract as the final acceptance authority for all coverage determinations
- Verify against the real system: actual code, actual runtime behavior, actual API responses
- Use Phase gate artifacts as inputs and evidence, not as final truth
- Produce exactly one output file: `final-system-audit.md`
- Assign explicit PASS, PARTIAL, FAIL, or BLOCKED status to every required coverage item
- Provide concrete evidence for every PASS claim
- Provide explicit, actionable fix actions for every FAIL, PARTIAL, or BLOCKED finding
- Execute the Audit Completion Verification Protocol defined in Section 14 before finalizing
- Re-run the final audit after fixes until FINAL SYSTEM PASS is achieved or the User explicitly halts the process
- Log all Assumptions explicitly per Section 12

## 3.2 Prohibited Actions

Claude Code MUST NOT:

- Declare system completion based on Phase artifacts alone
- Assume coverage without direct verification
- Invent endpoints, UI elements, or runtime behaviors that do not exist in code
- Skip any Phase
- Skip any Phase gate artifact review
- Skip runtime verification without documenting the specific reason and marking affected items BLOCKED
- Produce a placeholder, partial, or draft `final-system-audit.md` and declare the audit complete
- Assign PASS status to any item without concrete supporting evidence
- Declare FINAL SYSTEM PASS while any Critical or High severity gap remains unresolved
- Declare FINAL SYSTEM PASS without User Sign-Off per Section 15A

---

# 4. Contract Trigger — When This Contract Applies

This contract is executed ONLY when ALL of the following conditions are satisfied:

- All Phases intended for the system have been implemented
- Phase Completion has been declared for each Phase per Phase Implementation Protocol
- All required Phase gate artifacts exist for each Phase

This is the final gate after all Phases are complete.

This contract MUST NOT be executed prematurely while Phases remain incomplete.

---

# 5. Required Inputs

Claude Code MUST ingest and fully process all of the following inputs before producing any audit output.

## 5.1 Phase Specifications (System Blueprint)

Claude Code MUST scan all system and Phase specifications under:

- `/phases`
- `/docs`

If these paths do not exist, Claude Code MUST locate equivalent directories by searching the repository.

Allowed file types: `.md`, `.txt`

Claude Code MUST enumerate the complete list of Phases to be verified before proceeding.

## 5.2 Phase Gate Artifacts (Evidence Registry)

For each Phase N, Claude Code MUST locate and read all of the following artifacts:

- `backend-acceptance-phase-N.md`
- `frontend-wiring-report-phase-N.md`
- `regression-report-phase-N.md`

If any required artifact is missing, the final audit for that Phase MUST be marked **BLOCKED** immediately.

A missing artifact does not permit the audit to assume the corresponding gate passed.

## 5.3 Frontend Wiring Authority

Where a frontend exists, Claude Code MUST reference:

- `frontend-coverage-audit.md`

as the wiring authority context for frontend coverage verification.

## 5.4 Real System (Mandatory Reality Verification)

Claude Code MUST verify against the actual system:

- Actual codebase: routes, handlers, services, state machines, schemas
- Actual runtime behavior via: API calls (preferred), UI flows (if UI exists), logs or traces (if present)

If the system cannot be executed, Claude Code MUST:

- Mark Execution Mode as Static Only in the audit metadata
- Perform static verification via deterministic inspection of request and response shapes, routing logic, and state machine definitions
- Document all Static Only limitations explicitly as Assumptions
- Mark all items requiring runtime proof as BLOCKED with explicit reason and required fix action

Static-only verification does not satisfy runtime verification requirements. Items verified statically and not at runtime MUST be marked BLOCKED, not PASS.

---

# 6. Coverage Model

Final coverage is defined as verification across FOUR mandatory layers.

Claude Code MUST verify all four layers. No layer may be omitted.

**Layer 1 — Phase Evidence Coverage:** All required Phase gate artifacts exist, are complete, and are internally consistent.

**Layer 2 — Spec Coverage:** All capabilities defined in Phase specifications are accounted for in the real implementation.

**Layer 3 — Runtime Coverage:** Actual system behavior matches specifications and artifact claims.

**Layer 4 — Invariant Coverage:** Global system guarantees hold across all Phases under success and failure conditions.

---

# 7. Coverage Status Taxonomy

This taxonomy is locked. Claude Code MUST use ONLY the following status labels.

No additional statuses may be invented or substituted.

---

## ✅ PASS — Verified in Reality

The claim is verified against real system behavior (API response, UI flow, or code) AND is consistent with Phase artifacts and specifications.

Concrete evidence MUST be provided. A PASS without evidence is not valid and MUST be reclassified.

---

## ⚠️ PARTIAL — Present but Incomplete

Implementation exists but one or more requirements are incomplete, including wiring gaps, missing edge case handling, incomplete failure handling, incorrect state management, incomplete UI rendering, or unverified behavior.

Explicit fix actions MUST be provided.

---

## ❌ FAIL — Missing or Incorrect

The requirement is missing, incorrect, unsafe, contradicts specifications, or contradicts contract requirements.

A FAIL finding means the system is NOT complete for this item.

No system with an unresolved Critical or High FAIL may be declared done.

Explicit fix actions MUST be provided.

---

## ⛔ BLOCKED — Cannot Verify

Verification cannot be completed because prerequisites are missing, the system cannot be executed, or required configurations are absent.

The specific reason for the block MUST be stated explicitly.

The exact steps required to unblock MUST be stated explicitly.

BLOCKED items are not PASS items. A system with BLOCKED items is not complete.

---

# 8. Mandatory Audit Checks

Claude Code MUST perform ALL checks defined in this section. No check may be skipped.

## 8.1 Artifact Integrity Check (Per Phase)

For each Phase N, Claude Code MUST:

- Confirm all three required artifacts exist and are not placeholder documents
- Confirm each artifact is complete and internally consistent
- Confirm artifacts do not contradict each other in critical ways
- Extract and record all declared endpoints, flows, wiring claims, and regression scope from artifacts
- Identify any stale claims (artifact declares PASS for functionality not present in current code)

If any artifact is missing or is a placeholder: mark the Phase as **BLOCKED**.

If artifacts contradict each other on a critical claim: mark the affected capabilities as **FAIL** pending resolution.

## 8.2 Spec-to-System Coverage (Per Phase)

For each Phase N, Claude Code MUST:

- Enumerate all Phase capabilities from Phase specifications
- Map each capability to its backend surface: endpoint, service, event, or state machine
- Map each capability to its frontend surface: route, component, control (if applicable)
- Confirm each capability exists in the real implementation
- Assign Coverage Status per the taxonomy in Section 7

## 8.3 Runtime Verification — End-to-End Reality

Claude Code MUST execute or simulate end-to-end flows that cover:

- Primary success paths for every Phase
- All state transitions defined in Phase specifications
- Event propagation flows where applicable
- UI-to-API wiring correctness where frontend exists
- Persistence correctness: database writes, reads, and idempotency guarantees

Minimum requirement: at least one end-to-end flow per Phase that exercises its core value path.

Runtime verification results MUST be documented with concrete evidence per Section 9.

If a flow cannot be executed, it MUST be marked BLOCKED with explicit reason.

## 8.4 Failure Mode Verification (Safety)

Claude Code MUST verify that the system fails safely and predictably under all of the following conditions:

- Invalid input to any endpoint
- Unauthorized access attempts
- Invalid state transitions
- Missing or malformed resources
- Interrupted or partially completed execution
- Unexpected or malformed upstream responses

For each failure condition, the system MUST:

- Return a predictable, safe error response
- Not crash or enter an undefined state
- Not corrupt persistent state

If any failure condition causes unsafe behavior: mark as **FAIL**.

## 8.5 Cross-Phase Invariants Verification

Claude Code MUST verify global system invariants across the complete Phase sequence, including:

- All flows from Phase 0 through Phase N remain unbroken
- Backwards compatibility of all critical contracts across Phase boundaries
- Stable state machine behavior across all state transitions in all Phases
- Consistent identity and authorization model across all Phases
- Deterministic execution guarantees where promised by specifications
- Regression safety claims from Phase regression artifacts hold in current reality

Each invariant MUST be assigned a Coverage Status with supporting evidence.

## 8.6 Documentation-to-Reality Integrity

Claude Code MUST identify every instance where documentation, specifications, or Phase artifacts claim functionality that does not exist in the real system.

Each such instance MUST be marked FAIL or PARTIAL with an explicit remediation action.

The absence of documented functionality in the real system is a FAIL, not a gap to be deferred.

---

# 9. Evidence Requirements

A PASS claim is invalid without concrete evidence.

Every PASS claim MUST include at least ONE of the following forms of evidence:

- API request and response shape summary (endpoint, method, request body, response body)
- UI flow description referencing real route and component names
- Code reference (file path and function or class name)
- Event emission proof (log or trace summary where applicable)
- State machine transition trace referencing real state definitions

If evidence cannot be produced for a claim, the status MUST be reclassified as PARTIAL, FAIL, or BLOCKED.

Asserting PASS without evidence is a prohibited action under Section 3.2.

---

# 10. Audit Integrity Protections

## 10.1 No Phase Skipping

Every Phase that is part of the system MUST be included in the audit.

A Phase may not be omitted because it is a foundation Phase, an infrastructure Phase, or because its artifacts exist.

Artifact existence does not substitute for audit inclusion.

## 10.2 No False PASS

A PASS status may only be assigned when concrete evidence exists and has been documented.

Claude Code MUST NOT assign PASS based on any of the following alone:

- Artifact declarations
- Documentation claims
- Developer assertions
- Prior audit results
- Assumed continuity from prior phases

## 10.3 No Incomplete Audit Output

`final-system-audit.md` is not complete until the Audit Completion Verification Protocol in Section 14 has been fully executed and all checklist items have passed.

An incomplete audit output MUST NOT be declared final.

An incomplete audit output MUST NOT be used to declare system completion.

## 10.4 No Runtime Skip Without Documentation

Runtime verification MUST NOT be skipped without explicit documentation of the reason and the resulting BLOCKED classification for all affected items.

Omitting runtime verification silently is a prohibited action under Section 3.2.

---

# 11. Audit Immutability and Traceability

## 11.1 Audit as Permanent Record

`final-system-audit.md` is a permanent audit record.

Once a FINAL SYSTEM PASS declaration is made and confirmed, the audit record MUST NOT be modified, overwritten, or deleted.

## 11.2 Reproducibility Requirement

The audit MUST be reproducible.

All inputs used during the audit MUST be recorded in the audit metadata: specification paths, artifact file locations, branch, commit hash, and runtime execution context.

Given the same inputs and system state, the audit MUST produce the same result.

## 11.3 Re-audit on System Change

If the system changes materially after `final-system-audit.md` is produced — including code changes, dependency updates, configuration changes, or schema migrations — the audit MUST be re-executed.

Re-execution produces a new version of `final-system-audit.md`.

Prior PASS declarations do not carry forward to a changed system.

## 11.4 Audit Versioning

Each execution of `final-system-audit.md` MUST record:

- The date and time of audit execution
- The branch and commit hash of the system at audit time
- The version of this contract under which the audit was performed

---

# 12. Assumption Logging Contract

## 12.1 Mandatory Assumption Disclosure

Every Assumption made during audit execution MUST be explicitly logged.

No hidden Assumptions are permitted.

Assumptions may not be omitted from audit output.

## 12.2 Assumption Record Format

Each logged Assumption MUST include:

- Assumption identifier (sequential: A-001, A-002, etc.)
- Location or context where the Assumption was required
- The specific Assumption made
- The reason the Assumption was necessary
- The risk introduced by the Assumption
- The recommended action to resolve or validate the Assumption

## 12.3 Assumption Limitation on PASS

A PASS status may not rest solely on an Assumption.

If a coverage determination depends on an Assumption rather than verified evidence, the status MUST be PARTIAL or BLOCKED, not PASS.

---

# 13. Required Output File — `final-system-audit.md`

Claude Code MUST produce `final-system-audit.md` as the sole output of this audit process.

Claude Code MUST follow this EXACT structural template. No sections may be omitted.

---

## Section 1: Metadata

REQUIRED fields:

- Repository name
- Branch and commit hash at time of audit
- Audit date and time (ISO 8601 format)
- Auditor identity (Claude Code)
- Contract version under which audit was performed (this contract: v2.1)
- Execution mode: Runtime Verified / Static Only
- System run context (local / dev / staging) if applicable
- All Assumptions logged per Section 12
- All limitations affecting audit completeness

---

## Section 2: Contract Authority Declaration

This section MUST include the following declaration verbatim:

> This document is the Final System Audit for this system, produced under Final System Coverage Standard Contract v2.1. It is the final acceptance authority for this system. No system completion claim is valid without a FINAL SYSTEM PASS declaration AND a completed User Sign-Off in this document. All Phase artifacts, specifications, and implementation claims are subordinate to the findings of this audit.

---

## Section 3: Executive Summary

REQUIRED fields:

- Total Phases audited
- Total capabilities audited
- Overall status: PASS / PARTIAL / FAIL / BLOCKED
- Coverage breakdown: count and percentage of PASS / PARTIAL / FAIL / BLOCKED
- Top critical blockers (maximum 10, ordered by severity)
- User Sign-Off status: SIGNED / NOT SIGNED
- Audit readiness declaration: SHIPPABLE or NOT SHIPPABLE with explicit reason

---

## Section 4: Inputs Used

REQUIRED fields:

- Specification paths scanned
- Artifact files found (listed per Phase, with FOUND / MISSING status for each)
- Frontend wiring authority reference (if applicable)
- Runtime verification method used
- Execution environment details

---

## Section 5: Phase-by-Phase Audit

For EACH Phase N, this section MUST include:

### Phase N — Artifact Integrity

- `backend-acceptance-phase-N.md`: FOUND / MISSING + completeness notes
- `frontend-wiring-report-phase-N.md`: FOUND / MISSING + completeness notes
- `regression-report-phase-N.md`: FOUND / MISSING + completeness notes
- Consistency assessment: any contradictions between artifacts or between artifacts and current reality

### Phase N — Capability Coverage Matrix

For each capability within Phase N, the following fields are REQUIRED:

- Capability identifier and name
- Specification reference (file and section)
- Backend mapping (endpoint / service / event / state)
- Frontend mapping (route / component / control) if applicable
- Runtime verification evidence (API call, UI path, or code pointer)
- Coverage Status: ✅ / ⚠️ / ❌ / ⛔
- Gap explanation (required for all non-PASS items)
- Required fix action (explicit and implementable, required for all non-PASS items)

---

## Section 6: Cross-Phase Invariants Checklist

REQUIRED fields for each invariant:

- Invariant name and description
- Verification method used
- Evidence
- Status: PASS / PARTIAL / FAIL / BLOCKED

---

## Section 7: Critical Gap Backlog

This section MUST aggregate ALL non-PASS items from all Phases.

For each gap, the following fields are REQUIRED:

- Reference (Phase N / Capability identifier)
- Severity: Critical / High / Medium / Low
- Coverage Status
- Gap description (specific, not generic)
- Exact fix action (implementable, not aspirational)
- Verification step to confirm the fix

No non-PASS item may be absent from this backlog.

If no gaps exist, this section MUST state: "No gaps identified. All capabilities are PASS."

---

## Section 8: Fix-Then-Reaudit Plan

REQUIRED fields:

- Ordered fix sequence (Critical first, then High, then Medium, then Low)
- Re-audit procedure for each fix category
- Exit criteria for FINAL SYSTEM PASS

---

## Section 8A: User Sign-Off (Two-Key PASS)

This section is REQUIRED for FINAL SYSTEM PASS eligibility.

If this section is absent or bears NOT SIGNED status, FINAL SYSTEM PASS is prohibited.

REQUIRED fields:

- Sign-off status: SIGNED / NOT SIGNED
- Sign-off date and time (ISO 8601 format)
- User identifier
- List of Critical and High severity items verified (Phase/Capability references and Invariant references)
- Short verification evidence summary per item: what the User actually did to verify each item
- If NOT SIGNED: explicit reason and exact steps required to obtain sign-off

The User sign-off statement MUST include the following declaration verbatim:

> I independently verified the items listed above against the real running system and confirm each item is PASS.

If the User has reservations about any item, those items MUST be listed as exceptions and the overall sign-off status MUST be NOT SIGNED until reservations are resolved.

---

## Section 9: Final Declaration

Claude Code MUST declare exactly one of the following:

- ✅ FINAL SYSTEM PASS
- ⚠️ FINAL SYSTEM PARTIAL
- ❌ FINAL SYSTEM FAIL
- ⛔ FINAL SYSTEM BLOCKED

The declaration MUST be accompanied by 2–5 lines stating the basis for the declaration, including the count of unresolved gaps by severity and the User Sign-Off status.

FINAL SYSTEM PASS requires ALL of the following to be true:

- All capabilities carry PASS status
- No Critical or High severity gaps remain in the Gap Backlog
- Section 8A bears SIGNED status with no unresolved exceptions
- All checklist items in Section 14 have passed

No system may be declared shippable under any declaration other than FINAL SYSTEM PASS.

---

# 14. Audit Completion Verification Protocol

Before finalizing `final-system-audit.md`, Claude Code MUST execute the following checklist in full.

Every item MUST be confirmed. No item may be skipped.

---

## Checklist

**Phase Coverage**
- [ ] All Phases present in specifications are included in the audit
- [ ] No Phase has been skipped

**Artifact Integrity**
- [ ] All three required artifacts have been reviewed for each Phase
- [ ] All missing artifacts are marked BLOCKED
- [ ] All artifact inconsistencies are documented

**Capability Coverage**
- [ ] All capabilities from all Phases are included in the audit
- [ ] No capability has been skipped
- [ ] Every capability has an assigned Coverage Status

**Evidence Requirements**
- [ ] Every PASS status has concrete supporting evidence documented
- [ ] No PASS status rests solely on an Assumption
- [ ] No PASS status rests solely on artifact declarations

**Non-PASS Items**
- [ ] Every PARTIAL item has an explicit fix action
- [ ] Every FAIL item has an explicit fix action
- [ ] Every BLOCKED item has an explicit reason and unblocking action

**Gap Backlog**
- [ ] Gap Backlog contains all PARTIAL capabilities
- [ ] Gap Backlog contains all FAIL capabilities
- [ ] Gap Backlog contains all BLOCKED capabilities
- [ ] No non-PASS item is absent from the Gap Backlog
- [ ] No duplicate entries exist in the Gap Backlog

**Cross-Phase Invariants**
- [ ] All defined invariants have been verified
- [ ] All invariants have assigned status with evidence

**Assumption Log**
- [ ] All Assumptions are logged per Section 12
- [ ] No hidden Assumptions exist
- [ ] No PASS status depends solely on an Assumption

**Two-Key PASS**
- [ ] Section 8A (User Sign-Off) exists in `final-system-audit.md`
- [ ] Section 8A bears SIGNED status for FINAL SYSTEM PASS
- [ ] All Critical and High severity items are listed in the sign-off scope
- [ ] No Critical or High severity gaps remain unresolved in the Gap Backlog
- [ ] User declaration statement is present verbatim in Section 8A

**Output File**
- [ ] `final-system-audit.md` contains all required sections
- [ ] No section is absent or incomplete
- [ ] Contract Authority Declaration is present verbatim in Section 2
- [ ] Final Declaration is present in Section 9
- [ ] Final Declaration status is consistent with all findings and with User Sign-Off status

---

If any checklist item fails, Claude Code MUST resolve the failure before declaring the audit complete.

`final-system-audit.md` is not complete until every checklist item passes.

---

# 15. Release Gate Enforcement

## 15.1 Release Gate Authority

This contract is the release gate authority for all systems governed by the Phase Implementation Protocol.

A system MUST NOT be declared done, shipped, production-ready, or complete under any of the following conditions:

- `final-system-audit.md` does not exist
- `final-system-audit.md` exists but does not declare FINAL SYSTEM PASS
- `final-system-audit.md` declares FINAL SYSTEM PASS but unresolved Critical or High severity gaps remain in the Gap Backlog
- `final-system-audit.md` declares FINAL SYSTEM PASS but Section 8A bears NOT SIGNED status
- The audit was produced under a prior system state and the system has changed materially since

## 15.2 No Informal Release Authorization

A release cannot be authorized by:

- Phase artifact declarations alone
- Developer or team assertions of completeness
- Partial audit results
- Time pressure or business urgency
- Claude Code's unilateral declaration without User Sign-Off

Only a valid `final-system-audit.md` bearing FINAL SYSTEM PASS with a completed and SIGNED Section 8A constitutes release authorization under this contract.

## 15.3 FAIL Authority

If any capability is assigned FAIL status in the audit, the system is NOT complete for that capability.

A FAIL finding is not a deferral. It is not a known issue. It is not a backlog item.

It is a blocking finding that must be resolved before FINAL SYSTEM PASS can be declared.

A system with any unresolved Critical or High FAIL finding MUST NOT be released.

---

# 15A. Two-Key PASS Requirement (Independent Sign-Off)

## 15A.1 Purpose

This section enforces independent verification as a condition of final release authority.

Claude Code is not permitted to unilaterally declare FINAL SYSTEM PASS for Critical and High severity items.

The Two-Key PASS rule exists because Claude Code implements, tests, and produces artifacts for the same system it audits. Independent User verification of Critical and High severity items is the structural safeguard that prevents self-certified release.

## 15A.2 Two-Key PASS Rule (Locked)

For the system to declare FINAL SYSTEM PASS, ALL of the following must be true:

1. No unresolved Critical or High severity gaps remain in the Gap Backlog, AND
2. All Critical and High severity items carry PASS status in the audit with concrete evidence, AND
3. The User has independently verified and signed off on the Critical and High severity scope as defined in Section 15A.3

If the User sign-off is absent or NOT SIGNED, the system MUST be declared:

⚠️ FINAL SYSTEM PARTIAL

This applies even if all items carry PASS status in Claude Code's audit findings.

## 15A.3 Scope of Required User Sign-Off (Locked)

User sign-off MUST cover:

- Every item in the audit marked Severity Critical or High
- Every Cross-Phase Invariant marked Critical or High
- Every previously FAIL or PARTIAL item that was remediated and reclassified as PASS with Severity Critical or High

User sign-off MUST be based on direct, independent verification against the real running system.

User sign-off MUST NOT be based on Claude Code's audit findings alone.

## 15A.4 Sign-Off Format (Locked)

The User sign-off is recorded in Section 8A of `final-system-audit.md` and MUST contain:

- Sign-off status: SIGNED / NOT SIGNED
- Date and time of sign-off (ISO 8601 format)
- User identifier
- List of every Critical and High severity item verified (Phase/Capability references)
- Short verification evidence summary per item describing what the User did to verify
- The following declaration verbatim: "I independently verified the items listed above against the real running system and confirm each item is PASS."
- Any exceptions or reservations (presence of any exception converts status to NOT SIGNED)

If the User declines sign-off for any reason, FINAL SYSTEM PASS is prohibited until the reason is resolved.

---

# 16. Remediation Loop

After `final-system-audit.md` is produced:

- Claude Code MUST implement fixes for ALL Critical and High severity gaps
- Claude Code MUST re-execute the final audit after implementing fixes
- Claude Code MUST update `final-system-audit.md` to reflect the new system state
- User MUST re-verify any Critical or High severity items that were remediated before sign-off is valid
- This cycle repeats until FINAL SYSTEM PASS is declared or the User explicitly and formally halts the process

No shipment claim is valid without FINAL SYSTEM PASS.

If the User halts the remediation loop before FINAL SYSTEM PASS, the system MUST be documented as NOT COMPLETE and MUST NOT be declared shipped.

---

# 17. Stop Conditions and Ambiguity Handling

Claude Code MUST NOT block or abandon the audit due to ambiguity.

If a requirement is unclear:

- Claude Code MUST select the most reasonable interpretation
- Document the interpretation as an Assumption per Section 12
- Verify against that interpretation
- Mark as PARTIAL if material uncertainty remains after verification

If runtime execution is impossible:

- Mark Execution Mode as Static Only in audit metadata
- Mark all items requiring runtime proof as BLOCKED with explicit reason
- Provide the exact steps required to enable runtime verification
- Do not assign PASS to any item that requires runtime proof when executing in Static Only mode

---

# 18. Enforcement Rule

## 18.1 Mandatory Compliance

This contract is mandatory.

Compliance is not optional and is not subject to discretion.

## 18.2 System Completion Gate

No system may be declared complete unless:

- `final-system-audit.md` exists
- `final-system-audit.md` declares FINAL SYSTEM PASS
- All Critical and High severity gaps are resolved
- Section 8A bears SIGNED status
- The audit was produced against the current state of the system

## 18.3 Contract Permanence

This contract is a permanent global standard.

It is not project-specific. It is not bound to any single repository, team, or technology stack.

It is designed for perpetual reuse across all future systems that use the Phase Implementation Protocol.

## 18.4 Contract Amendment

Amendments to this contract must be made to the contract document itself with a version increment.

Informal overrides, verbal exceptions, and per-project modifications are not permitted.

Any required exception must be formally documented as a contract amendment and versioned accordingly.

## 18.5 Scope of Application

This contract applies to ALL systems, ALL repositories, ALL teams, and ALL future projects.

No system, team, or project is exempt.

---

# END OF CONTRACT
