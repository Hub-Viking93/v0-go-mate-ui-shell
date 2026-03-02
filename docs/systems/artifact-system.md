# Artifact System — System Document (Placeholder)

**Phase:** 5.3
**Status:** Placeholder — system does not exist
**Current substitute:** `guides` table + JSONB columns in `relocation_plans`
**Target contract:** GoMate — Artifact Schemas & Dashboard Rendering Contract
**Last audited:** 2026-02-25

---

## 1. Status

**This system does not exist.**

No generic artifact containers, no metadata envelopes, no dashboard templates, no rendering directives, and no artifact schemas are implemented in GoMate. Structured research outputs are stored as raw JSONB in table-specific columns. There is no unified artifact layer.

---

## 2. Current Reality: Column-Per-Output Storage

GoMate currently stores structured outputs in two ways:

### 2.1 guides Table

Dedicated columns per guide section (all JSONB):

| Column | Content |
|---|---|
| `overview` | `GuideOverview` object |
| `visa_section` | `VisaSection` object |
| `budget_section` | `BudgetSection` object |
| `housing_section` | `HousingSection` object |
| `banking_section` | `BankingSection` object |
| `healthcare_section` | `HealthcareSection` object |
| `culture_section` | `CultureSection` object |
| `jobs_section` | `JobsSection` object (null if not applicable) |
| `education_section` | `EducationSection` object (null if not applicable) |
| `timeline_section` | `TimelineSection` object |
| `checklist_section` | `ChecklistSection` object |
| `official_links` | Array of `{name, url, category}` |
| `useful_tips` | Array of strings |

See Phase 4.1 (Guide Generation SystemDoc) for full schema.

### 2.2 relocation_plans Table — Research Output Columns

Research results are stored as individual JSONB columns on `relocation_plans`:

| Column | Content | Notes |
|---|---|---|
| `visa_research` | `{ visaOptions, generalRequirements, importantNotes }` | Undocumented column (not in migrations) |
| `local_requirements_research` | `{ categories: [...], generalTips, importantDeadlines }` | Undocumented column (not in migrations) |
| `checklist_items` | `ChecklistItem[]` | In migration 002 |
| `profile_data` | Full `Profile` object | In migration 002 |

### 2.3 What the Current Approach Lacks

The current storage approach is schema-per-output:
- Each output type has its own DB column or table
- No common envelope — outputs are not queryable by type, version, or creation date
- No metadata attached to outputs (when was this generated, from what source, with what model, at what confidence level?)
- No versioning — overwriting a column loses previous output
- No rendering directives — the UI must hardcode which component to use for each output type

---

## 3. Target Architecture (Artifact Schemas & Dashboard Rendering Contract)

The artifact contract describes a generic, unified output layer. None of this is implemented.

### 3.1 Artifact Schema (Target)

A generic container with metadata envelope:

```typescript
interface Artifact {
  id: string
  type: ArtifactType               // "visa_research" | "guide_section" | "checklist" | "budget" | ...
  version: number                  // Increments on each regeneration
  user_id: string
  plan_id: string
  schema_version: string           // e.g. "1.0.0" — for schema evolution
  generated_at: string
  generator: string                // "claude-sonnet-4" | "gpt-4o-mini" | "static"
  confidence: number | null        // 0–1, null for deterministic outputs
  source_trace_id: string | null   // Links to observability trace
  status: "generating" | "complete" | "stale" | "failed"
  payload: Record<string, unknown> // The actual data
  rendering_directive: RenderingDirective
}
```

### 3.2 Rendering Directive (Target)

Each artifact carries a rendering directive that tells the dashboard how to display it:

```typescript
interface RenderingDirective {
  component: string        // e.g. "VisaCard" | "BudgetBreakdown" | "DocumentChecklist"
  layout: "card" | "table" | "timeline" | "list" | "chart"
  priority: number         // Display order in dashboard
  collapsible: boolean
  headline_field: string   // Which payload field to use as the card title
}
```

This decouples data generation from UI rendering — the dashboard renders whatever artifacts are present without hardcoding output types.

### 3.3 ArtifactType Registry (Target)

```typescript
type ArtifactType =
  | "visa_research"              // Currently: relocation_plans.visa_research
  | "local_requirements"         // Currently: relocation_plans.local_requirements_research
  | "document_checklist"         // Currently: relocation_plans.checklist_items
  | "guide_visa"                 // Currently: guides.visa_section
  | "guide_budget"               // Currently: guides.budget_section
  | "guide_housing"              // Currently: guides.housing_section
  | "guide_banking"              // Currently: guides.banking_section
  | "guide_healthcare"           // Currently: guides.healthcare_section
  | "guide_culture"              // Currently: guides.culture_section
  | "guide_jobs"                 // Currently: guides.jobs_section
  | "guide_education"            // Currently: guides.education_section
  | "guide_timeline"             // Currently: guides.timeline_section
  | "cost_of_living"             // Currently: no persistent storage
  | "flight_search_results"      // Currently: no persistent storage
  | "profile_enrichment"         // Currently: profile_data JSONB
```

### 3.4 Dashboard Template (Target)

A dashboard template is a list of artifact types to display for a given plan stage and purpose:

```typescript
interface DashboardTemplate {
  stage: PlanStage
  purpose: string
  slots: Array<{
    artifact_type: ArtifactType
    required: boolean
    fallback_component?: string
  }>
}
```

Example: a `complete` stage `work` plan would have slots for visa_research, local_requirements, document_checklist, guide_visa, guide_budget, guide_jobs, guide_timeline.

### 3.5 Artifacts Table (Target)

```sql
CREATE TABLE artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES relocation_plans(id) ON DELETE CASCADE,
  schema_version text NOT NULL DEFAULT '1.0.0',
  generated_at timestamptz DEFAULT now(),
  generator text,
  confidence numeric(3,2),
  source_trace_id uuid,
  status text NOT NULL DEFAULT 'complete',
  payload jsonb NOT NULL DEFAULT '{}',
  rendering_directive jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_artifacts_plan ON artifacts(plan_id, type);
CREATE INDEX idx_artifacts_user ON artifacts(user_id, type, status);
```

---

## 4. Migration Path

The target artifact system would unify the current storage columns into a single `artifacts` table. The migration path:

| Current storage | Target artifact type | Migration action |
|---|---|---|
| `relocation_plans.visa_research` | `"visa_research"` | Migrate existing JSONB rows to artifact rows |
| `relocation_plans.local_requirements_research` | `"local_requirements"` | Same |
| `relocation_plans.checklist_items` | `"document_checklist"` | Same |
| `guides.visa_section` | `"guide_visa"` | Same |
| `guides.budget_section` | `"guide_budget"` | Same |
| ... (all guide sections) | Corresponding artifact types | Same |

The `guides` table and `relocation_plans` research columns would be deprecated once artifact storage is in place.

---

## 5. Gap Summary

| Requirement | Current | Gap |
|---|---|---|
| Generic artifact container | Column-per-output | Need `artifacts` table with type field |
| Metadata envelope | None | Need generated_at, generator, confidence, trace_id |
| Versioning | Overwrite | Need version counter per artifact |
| Rendering directives | Hardcoded in UI | Need rendering_directive per artifact |
| Dashboard templates | Hardcoded in UI | Need template registry per stage/purpose |
| Queryable by type | Not possible | Need artifact type index |
| Schema evolution | No versioning | Need schema_version field |
| Stale detection | None (except local-req 7-day) | Need status="stale" + staleness contract |
