# Phase Implementation Protocol — Locked Standard (v1.2)

## Status: ACTIVE AND MANDATORY
## Scope: Applies to ALL phases, ALL repositories, ALL projects (current and future)
## Supersedes: Phase Implementation Protocol v1.1

---

# How to Start This Protocol

Before using this document, confirm which Phase is next by reading `docs/phase-status.md`.

Then read the current Phase section in `docs/build-protocol.md` to understand what must be built.

Then return here and execute the gates defined in this document in exact order.

---

# 0. Purpose

This document defines the mandatory protocol that governs how every Phase is implemented, verified, audited, wired to frontend, and accepted.

This protocol exists to guarantee:

- Deterministic implementation
- Complete backend/frontend alignment
- Full end-to-end verification
- Regression safety across all prior phases
- Production-grade system integrity
- Artifact-enforced gate completion
- Independent User reality-check at acceptance

This protocol is the single source of truth for Phase implementation lifecycle.

No Phase is considered complete until ALL gates defined in this protocol have passed.

No Phase is considered complete until ALL required gate artifacts exist.

No subsequent Phase may begin until the current Phase has officially passed Phase Completion.

This protocol is project-agnostic and reusable across all systems.

---

# 1. Roles and Responsibilities

## Claude Code Responsibilities

Claude Code is solely responsible for:

- Phase implementation
- Backend acceptance and audit
- Frontend wiring
- Writing User Test Specification
- Fixing all bugs discovered during gates
- Producing all Claude Code-owned gate artifacts

Claude Code owns Steps 1 through 4 fully.

Claude Code participates jointly in Step 6.

---

## User Responsibilities

The User is solely responsible for:

- Executing User Acceptance Gate as an independent reality-check
- Reporting bugs discovered during acceptance testing

The User participates jointly in Step 6.

---

## Shared Responsibility

Claude Code and User jointly perform:

- Regression Gate
- Final verification before Phase Completion

---

# 2. Phase Lifecycle Overview

Each Phase MUST pass the following gates, in exact order:

1. Implementation Gate
2. Backend Acceptance Gate
3. Frontend Wiring Gate
4. User Test Spec Gate
5. User Acceptance Gate
6. Regression Gate
7. Phase Completion

No steps may be skipped.

No steps may be reordered.

Each gate that requires a mandatory artifact MUST produce that artifact before the gate is considered complete.

---

# 3. Implementation Gate

## Owner: Claude Code

Claude Code implements the Phase according to Phase specifications.

Implementation includes all required system components, including but not limited to:

- Backend logic
- API endpoints
- Database schema and migrations
- Event emission systems
- Execution and orchestration logic
- State machines
- Contracts and validation layers

Claude Code must ensure implementation matches the Phase specification exactly.

## 3.1 Migration Delivery Rule (Locked)

If the Phase includes any database migrations, Claude Code MUST:

1. Write the migration file to `scripts/0XX_name.sql`
2. Print the full SQL inline in the chat so the User can copy-paste it directly into the Supabase SQL editor

The inline SQL block MUST appear before Backend Acceptance Gate begins, since the migration must be applied to the database before any API testing can occur.

Format:

```
## Run this in Supabase SQL editor before testing Phase N

[full SQL content here]
```

Backend Acceptance Gate MUST NOT begin until the User confirms the migration has been applied.

## Output

Working backend implementation of the Phase.

This implementation may still contain bugs.

Backend Acceptance Gate is required to validate correctness.

---

# 4. Backend Acceptance Gate

## Owner: Claude Code

This is a full backend audit and verification process.

Frontend Wiring Gate MUST NOT begin until Backend Acceptance Gate has passed.

Backend Acceptance Gate has NOT passed until the mandatory artifact has been produced.

Backend Acceptance Gate consists of THREE mandatory verification stages.

---

## 4.1 Contract Verification

Claude Code verifies that ALL functionality defined in the Phase specification exists and is correctly implemented.

Verification includes:

- All API endpoints exist
- All request formats are accepted correctly
- All response formats are correct
- All database structures exist and behave correctly
- All events emit correctly
- All state transitions function correctly

Claude Code must fix ALL contract violations.

Contract Verification must PASS before proceeding.

---

## 4.2 Functional Verification (Backend End-to-End Testing)

Claude Code performs complete end-to-end backend testing via API.

Claude Code simulates full system flows.

Example flows include:

- Creation flows
- Execution flows
- State transitions
- Event flows
- Completion flows

Claude Code MUST document ALL discovered bugs in:

`bug-phase-N.md`

Claude Code fixes ALL critical bugs.

Claude Code repeats Functional Verification.

This cycle repeats until backend behaves correctly.

---

## 4.3 Failure Verification

Claude Code tests backend under invalid and failure conditions.

Examples include:

- Invalid input
- Invalid identifiers
- Invalid state transitions
- Missing data
- Authorization failures
- Execution interruptions

Backend MUST fail safely and predictably.

Backend MUST NOT crash or enter undefined states.

Claude Code fixes ALL failure handling issues.

Claude Code repeats Functional Verification and Failure Verification.

This loop continues until backend operates correctly and safely.

---

## 4.4 Backend Acceptance Gate Artifact

### Artifact: `backend-acceptance-phase-N.md`

This artifact is REQUIRED.

This artifact MUST be produced by Claude Code only AFTER all three verification stages have fully passed and all discovered bugs have been resolved.

Backend Acceptance Gate is NOT COMPLETE until this artifact exists.

This artifact must confirm:

- Contract Verification passed
- Functional Verification passed
- Failure Verification passed
- All bugs documented in `bug-phase-N.md` were resolved
- Backend is declared stable and accepted

This artifact serves as permanent proof that Backend Acceptance Gate was completed correctly.

---

## Backend Acceptance Gate Output

Backend is declared:

**Backend Accepted**

`backend-acceptance-phase-N.md` artifact exists and is complete.

Only after this output may Frontend Wiring Gate begin.

---

# 5. Frontend Wiring Gate

## Owner: Claude Code

Claude Code connects frontend to backend.

Claude Code MUST use:

`frontend-coverage-audit.md`

as the PRIMARY wiring authority.

Frontend wiring includes:

- Connecting UI controls to backend endpoints
- Ensuring correct request generation
- Ensuring correct response handling
- Ensuring correct state updates
- Ensuring event propagation and rendering
- Ensuring UI reflects backend state accurately

If frontend components do not exist, Claude Code MUST create them.

Claude Code must perform:

- Functional Verification via frontend
- Failure Verification via frontend
- End-to-end testing via frontend

Claude Code fixes ALL wiring bugs.

This process repeats until frontend and backend operate correctly as a unified system.

Frontend Wiring Gate has NOT passed until the mandatory artifact has been produced.

---

## 5.1 Frontend Wiring Gate Artifact

### Artifact: `frontend-wiring-report-phase-N.md`

This artifact is REQUIRED.

This artifact MUST be produced by Claude Code only AFTER frontend wiring is complete and all wiring verification has passed.

Frontend Wiring Gate is NOT COMPLETE until this artifact exists.

This artifact must confirm:

- `frontend-coverage-audit.md` was applied as the primary wiring authority
- All UI controls are wired to correct backend endpoints
- Functional Verification via frontend passed
- Failure Verification via frontend passed
- End-to-end frontend-to-backend testing passed
- All wiring bugs were resolved
- Frontend and backend operate correctly as a unified system

This artifact serves as permanent proof that Frontend Wiring Gate was completed correctly.

---

## Frontend Wiring Gate Output

Frontend and backend are declared:

**Frontend Wired and Verified**

`frontend-wiring-report-phase-N.md` artifact exists and is complete.

---

# 6. User Test Spec Gate

## Owner: Claude Code

Claude Code writes:

`PHASE_N_USER_TEST.md`

This document is a **deterministic User Acceptance contract**.

This document MUST enable an independent User to verify reality without relying on Claude Code judgment.

---

## 6.1 Mandatory Structure (Locked)

`PHASE_N_USER_TEST.md` MUST contain the following sections, in this exact order:

1. Purpose
2. Environment and Preconditions
3. Test Data and Deterministic Inputs
4. Happy Path Tests (End-to-End)
5. Negative Tests (Failure / Safety)
6. Time-to-Reproduce Rule
7. Pass/Fail Criteria
8. Bug Reporting Template

No section may be omitted.

No section may be reordered.

---

## 6.2 Deterministic Inputs Requirement (Locked)

Every test MUST specify:

- Exact input values
- Exact identifiers (or exact procedure to create them)
- Exact request payloads for API tests (if applicable)
- Exact UI steps (route and control) for UI tests (if applicable)
- Expected output shapes: what fields must exist, what values must match, what is allowed to vary

Tests MUST NOT use vague language such as:

- "should work"
- "verify it looks correct"
- "ensure it behaves"

Vague language in any test constitutes a test spec deficiency and MUST be corrected before User Acceptance Gate begins.

---

## 6.3 Mandatory Negative Tests (Locked)

`PHASE_N_USER_TEST.md` MUST include at least the following Negative Test categories:

- Invalid input (schema or type violations)
- Unauthorized access attempt (auth and RBAC)
- Invalid state transition attempt
- Missing resource or unknown identifier
- Interruption or partial execution (where applicable to the Phase)

Each negative test MUST define:

- Input
- Expected error shape
- Expected safe system behavior (no crash, no corrupted state)

---

## 6.4 Time-to-Reproduce Rule (Locked)

Every critical flow MUST be reproducible by the User in 5 minutes or less, following the test spec exactly as written.

If a critical flow cannot be reproduced within 5 minutes, it is classified as:

**FAIL — Test Spec Invalid**

Claude Code MUST update `PHASE_N_USER_TEST.md` until all critical flows are reproducible within the time limit.

The User Test Spec Gate is NOT COMPLETE until this condition is satisfied.

---

## User Test Spec Gate Output

`PHASE_N_USER_TEST.md` exists and is complete per the mandatory structure.

This document becomes the official User Acceptance contract.

---

# 7. User Acceptance Gate

## Owner: User

User executes all steps in:

`PHASE_N_USER_TEST.md`

---

## 7.1 Independent Reality Check (Locked)

User Acceptance is the independent verification point in the Phase lifecycle.

The User MUST validate reality using the deterministic inputs and expected outputs defined in the test spec.

The User MUST NOT rely on Claude Code's judgment, assurances, or prior artifact claims when executing this gate.

If expected results do not occur, acceptance has not passed.

---

## 7.2 Bug Recording (Locked)

User documents ALL discovered bugs in:

`user-bugs-phase-N.md`

Each bug MUST include:

- Reproduction steps (copied from test spec with any deviation noted)
- Expected result
- Actual result
- Severity: Critical / High / Medium / Low
- Evidence (screenshot, response snippet, or error message)

---

## 7.3 Cannot Reproduce in 5 Minutes Equals FAIL (Locked)

If the User cannot reproduce any critical flow in 5 minutes or less, exactly as specified in `PHASE_N_USER_TEST.md`, the User MUST log the following in `user-bugs-phase-N.md`:

**TEST-SPEC-FAIL**

A TEST-SPEC-FAIL entry blocks User Acceptance Gate.

Claude Code MUST update the test spec and/or implementation to resolve the TEST-SPEC-FAIL before the User resumes testing.

---

## 7.4 Fix Loop (Locked)

Claude Code MUST fix ALL reported bugs.

User repeats testing.

This cycle repeats until User confirms all tests pass and no bugs remain.

---

## User Acceptance Gate Output

User declares:

**User Acceptance PASSED**

---

# 8. Regression Gate

## Owner: Claude Code and User

Regression Gate verifies ALL prior phases remain fully functional.

All prior phases MUST be tested.

This includes:

Phase 0 → Phase N

Claude Code and User verify:

- Core flows still work
- No regressions exist
- No prior functionality is broken

Claude Code fixes ALL regressions.

Regression Gate repeats until system is stable.

Regression Gate has NOT passed until the mandatory artifact has been produced.

---

## 8.1 Regression Gate Artifact

### Artifact: `regression-report-phase-N.md`

This artifact is REQUIRED.

This artifact MUST be produced only AFTER Regression Gate has fully passed and no regressions remain.

Regression Gate is NOT COMPLETE until this artifact exists.

This artifact must confirm:

- All phases from Phase 0 through Phase N were tested
- All regression tests passed
- No regressions were found, or all discovered regressions were resolved
- System is declared regression-safe

This artifact serves as permanent proof that Regression Gate was completed correctly.

---

## Regression Gate Output

System declared:

**Regression Safe**

`regression-report-phase-N.md` artifact exists and is complete.

---

# 9. Phase Completion

Phase Completion occurs ONLY after ALL gates have passed.

Phase Completion MUST NOT be declared unless ALL of the following required artifacts exist and are complete:

- `backend-acceptance-phase-N.md`
- `frontend-wiring-report-phase-N.md`
- `regression-report-phase-N.md`

If any required artifact is absent, Phase Completion is blocked.

At this point, Phase is declared:

**PHASE COMPLETE**

Only now may the next Phase begin.

---

# 10. Special Rule — Foundation Phases

Some phases contain only backend foundation and may not expose direct UI functionality.

Examples include:

- Infrastructure setup
- Database initialization
- Execution engine setup
- Internal contract systems

In these cases:

User Test Spec focuses on system-level verification, including:

- System startup success
- Endpoint functionality
- Event propagation
- State integrity

User Acceptance verifies system readiness rather than UI behavior.

The 5-minute reproducibility rule and negative test requirements apply to foundation phases without exception. Test specs for foundation phases must define deterministic inputs and expected outputs at the API and system level.

For Frontend Wiring Gate in foundation phases where no UI surface exists, the `frontend-wiring-report-phase-N.md` artifact must still be produced and must explicitly document that no frontend wiring was applicable for this phase, along with the reason.

Foundation phases MUST still pass ALL gates.

No exceptions.

---

# 11. Enforcement Rule

This protocol is mandatory.

No Phase may skip any gate.

No Phase may proceed to next Phase without passing Phase Completion.

No Phase may be declared complete unless all required gate artifacts exist.

This protocol governs ALL projects and ALL repositories.

---

# 12. Gate Completion Artifact Enforcement

## Purpose

This section defines the artifact enforcement rules that apply globally across all gates, all phases, all projects, and all repositories.

Artifact enforcement exists to guarantee that gate completion is deterministic, verifiable, and permanently auditable.

---

## 12.1 Mandatory Artifact Registry

The following artifacts are mandatory outputs of their respective gates:

| Gate | Mandatory Artifact | Owner |
|---|---|---|
| Backend Acceptance Gate | `backend-acceptance-phase-N.md` | Claude Code |
| Frontend Wiring Gate | `frontend-wiring-report-phase-N.md` | Claude Code |
| Regression Gate | `regression-report-phase-N.md` | Claude Code and User |

---

## 12.2 Artifact Production Rules

Every gate that requires a mandatory artifact MUST produce that artifact.

An artifact MUST NOT be produced before all verification and resolution activities for its gate are fully complete.

An artifact MUST NOT be produced as a placeholder, draft, or partial document.

An artifact is only valid when it fully documents that all required gate activities passed.

---

## 12.3 Gate Completion Dependency

A gate is NOT complete until its required artifact exists.

Gate completion cannot be declared verbally, implicitly, or by assumption.

Gate completion is proven solely by the existence of the required artifact in its final, complete form.

No subsequent gate may begin until all prior gates are complete, including artifact production.

---

## 12.4 Artifact as Permanent Audit Record

All gate artifacts serve as permanent audit records for the Phase.

Artifacts must be retained for the full lifetime of the project.

Artifacts must not be deleted, overwritten, or modified after they have been declared complete.

If a gate must be re-executed due to regression or discovered failure, a new artifact supersedes the prior artifact and must clearly document the re-execution event and its outcome.

---

## 12.5 Phase Completion Artifact Enforcement

Phase Completion is BLOCKED if any required artifact is absent or incomplete.

Claude Code must verify all required artifacts exist before declaring Phase Completion.

The User must confirm all required artifacts exist before accepting Phase Completion.

Phase Completion is only valid when all of the following are true:

- All gates have passed
- All required gate artifacts exist and are complete
- No outstanding bugs or regressions remain

---

# END OF PROTOCOL
