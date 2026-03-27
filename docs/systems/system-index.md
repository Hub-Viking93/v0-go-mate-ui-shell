# GoMate — System Document Index

Quick-reference map from system name → document file → status.

For the full gap register (55+ gap codes, source file cross-reference, correction register, implementation priority), read `docs/systems/master-index.md`.

---

## How to Use This Index

1. Find the system you want to work on.
2. Read its system doc (linked below) for full context on what exists, what's broken, and what gaps are documented.
3. Read `docs/audits/document-authority.md` to understand which document layer is authoritative for your question.
4. Read `docs/audits/backend-audit.md` for current system behavior and `docs/audits/definitions-vs-system-audit.md` for the current gap register.
5. Treat `docs/audit.md` as the original baseline classification, not the current universal authority.
6. Check the relevant phase or audit-driven scope document before making changes.

---

## System Document Map

31 documents total. All files are in `docs/systems/`.

| # | System | Document | Status |
|---|---|---|---|
| 1.1 | Profile Schema | `profile-schema.md` | Reality-based |
| 1.2 | Interview State Machine | `interview-state-machine.md` | Reality-based |
| 1.3 | Persistence Layer | `persistence-layer.md` | Reality-based |
| 2.1 | Chat Engine | `chat-engine.md` | Reality-first |
| 2.2 | System Prompt Architecture | `system-prompt.md` | Reality-first |
| 2.3 | Visa Logic | `visa-logic.md` | Reality-first |
| 3.1 | Research Orchestration | `research-orchestration.md` | Reality-first |
| 3.2 | Cost of Living | `cost-of-living.md` | Reality-first |
| 3.3 | Source Fetch Layer | `source-fetch-layer.md` | Reality-first + Placeholder |
| 3.4 | Extraction Layer | `extraction-layer.md` | Reality-first + Placeholder |
| 3.5 | Country / Destination Data | `country-destination-data.md` | Reality-first |
| 4.1 | Guide Generation + PDF Export | `guide-generation.md` | Reality-first |
| 4.2 | Plans System | `plans-system.md` | Reality-first |
| 4.3 | Subscription System | `subscription-system.md` | Reality-first |
| 4.4 | Flight Search | `flight-search.md` | Reality-first |
| 4.5 | Checklist Generation | `checklist-generation.md` | Reality-first |
| 5.1 | Job System | `job-system.md` | Placeholder — does not exist |
| 5.2 | Observability | `observability.md` | Placeholder — does not exist |
| 5.3 | Artifact System | `artifact-system.md` | Placeholder — does not exist |
| 5.4 | Reliability Contracts | `reliability-contracts.md` | Reality-first + Placeholder |
| 6.1 | Auth and Sessions | `auth-sessions.md` | Reality-first |
| 6.2 | End-to-End Flow | `end-to-end-flow.md` | Reality-first |
| 7.1 | Frontend / UI Layer | `frontend-ui-layer.md` | Reality-first |
| 9.1 | Post-Arrival Stage & Arrival | `post-arrival-stage.md` | Reality-first |
| 9.2 | Settling-In Persistence | `settling-in-persistence.md` | Reality-first |
| 9.3 | Settling-In Checklist Engine | `settling-in-engine.md` | Reality-first |
| 9.4 | Task Graph & Dependency | `task-graph.md` | Reality-first |
| 9.5 | Why-It-Matters Enrichment | `why-it-matters.md` | Reality-first |
| 10.1 | Post-Arrival Chat Mode | `post-arrival-chat-mode.md` | Reality-first |
| 10.2 | Task Completion via Chat | `task-completion-via-chat.md` | Reality-first |
| 10.3 | Compliance Timeline & Alerting | `compliance-timeline.md` | Reality-first |

---

## Status Legend

| Status | Meaning |
|---|---|
| **Reality-based** | Fully implemented. Document describes what exists. No significant gaps. |
| **Reality-first** | Exists but has documented gaps vs. target architecture. |
| **Reality-first + Placeholder** | Partially exists. Target architecture section describes what to build. |
| **Placeholder — does not exist** | System is absent. Document describes the gap and target contract. |

---

## Systems by Historical Baseline Classification (from `docs/audit.md`)

### WORKING (3)
- 1.1 Profile Schema
- 2.1 Chat Engine
- 9.5 Why-It-Matters Enrichment

### PARTIAL (20)
- 1.2 Interview State Machine
- 1.3 Persistence Layer
- 2.2 System Prompt Architecture
- 2.3 Visa Logic
- 3.1 Research Orchestration
- 3.2 Cost of Living
- 3.3 Source Fetch Layer
- 3.4 Extraction Layer
- 3.5 Country / Destination Data
- 4.2 Plans System
- 4.4 Flight Search
- 4.5 Checklist Generation
- 5.4 Reliability Contracts
- 6.1 Auth and Sessions
- 6.2 End-to-End Flow
- 7.1 Frontend / UI Layer
- 9.1 Post-Arrival Stage & Arrival
- 9.2 Settling-In Persistence
- 9.3 Settling-In Checklist Engine
- 9.4 Task Graph & Dependency
- 10.1 Post-Arrival Chat Mode
- 10.2 Task Completion via Chat
- 10.3 Compliance Timeline & Alerting

### BROKEN — P0 (2)
- **4.1 Guide Generation + PDF Export** — PDF renders 4 fields as `undefined` for all users (G-4.1-G)
- **4.3 Subscription System** — Any user can self-upgrade for free (G-4.3-D); no expiry enforcement (G-4.3-B)

### MISSING — deferred to v2 (3)
- 5.1 Job System
- 5.2 Observability
- 5.3 Artifact System

---

## Unreadable Contract Files

Three files in this directory exist as binary Microsoft Word documents masquerading as `.md` files. They cannot be read as text.

| File | Expected Content |
|---|---|
| `batch5-contracts.md` | GoMate Batch 5 — Foundation Completion contracts |
| `batch6-contracts.md` | GoMate Batch 6 — Feature Expansion contracts |
| `full-system-architecture.md` | GoMate Full System Architecture document |

These are referenced in `master-index.md` section 9. Their target-state content is summarised in `docs/roadmap.md`.

---

## Related Documents

| Document | Purpose |
|---|---|
| `docs/systems/master-index.md` | Full gap register (55+ codes), source file map, correction register, implementation priority |
| `docs/audits/document-authority.md` | Governance authority model for definitions, systems, audits, phases, and final acceptance |
| `docs/audits/backend-audit.md` | Current system behavior |
| `docs/audits/definitions-vs-system-audit.md` | Current target-vs-reality gap register |
| `docs/audit.md` | Original baseline classification table + original v1 invariants |
| `docs/glossary.md` | Term definitions |
| `docs/build-protocol.md` | Phase specifications |
