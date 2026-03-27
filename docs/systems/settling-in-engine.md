# GoMate — Settling-In Checklist Engine

**Phase:** 9.3
**Status:** Reality-first
**Contract source:** `docs/gomate-settling-in-engine-layer.md` § 8.1
**Last audited:** 2026-02-25

---

## 1. Purpose

This document describes how the settling-in checklist is generated: the pipeline stages, the inputs consumed, the AI model used, the fallback strategy, and the idempotency mechanism. It covers the generate endpoint, the generator library, and the web research layer.

---

## 2. Generation Trigger

### 2.1 How generation is triggered

Generation is **not automatic**. There are two ways:

1. **User action:** The settling-in page (`app/(app)/settling-in/page.tsx`) shows a "Generate checklist" button when `!generated`. Clicking it calls `POST /api/settling-in/generate`.
2. **Direct API call:** Any authenticated Pro+ user can POST to the generate endpoint directly.

Auto-trigger after arrival is not implemented. The arrival endpoint (`POST /api/settling-in/arrive`) does not enqueue or call the generation pipeline.

### 2.2 Stage check at generation time

The generate endpoint **does** verify `plan.stage === "arrived"` before generating. A user whose plan is in `complete` stage (pre-arrival) receives a 400 response.

The contract requires the endpoint to verify `plan.stage == 'arrived'` and return `STAGE_NOT_ARRIVED` if not. The check now exists, but it is route-local rather than shared through a central helper.

---

## 3. Idempotency

Idempotency is implemented via the `post_relocation_generated` boolean flag on `relocation_plans`.

Source: `app/api/settling-in/generate/route.ts:43–55`

```typescript
if (plan.post_relocation_generated) {
  const { data: existingTasks } = await supabase
    .from("settling_in_tasks")
    .select("id, title, category, status, depends_on, sort_order")
    .eq("plan_id", plan.id)
    .order("sort_order")
  return NextResponse.json({ tasks: existingTasks || [], cached: true, planId: plan.id })
}
```

If `post_relocation_generated` is `true`, the endpoint returns cached tasks without re-running the pipeline. There is no force-regeneration mechanism.

**Contract divergence:** The contract specifies a `job_key` format of `settling_in:${plan_id}:${arrival_date}` stored in a `settling_in_generation_runs` table. The implementation uses a boolean flag and has no generation run table.

---

## 4. Generation Inputs

Source: `app/api/settling-in/generate/route.ts:74–85`, `lib/gomate/settling-in-generator.ts:SettlingGeneratorInput`

Fields passed to the generator:

| Input | Source | Notes |
|---|---|---|
| `citizenship` | `profile_data.citizenship` | Defaults to `""` if absent |
| `destination` | `profile_data.destination` | Required; generation fails if absent |
| `destinationCity` | `profile_data.destinationCity` | Optional |
| `purpose` | `profile_data.purpose` | Defaults to `"general"` |
| `visaType` | `plan.visa_research.visaOptions[selected].type` | Optional; read from `visa_research` JSONB column |
| `visaName` | `plan.visa_research.visaOptions[selected].name` | Optional |
| `hasJobOffer` | `profile_data.hasJobOffer` | Defaults to `false` |
| `hasFamilyInDestination` | `profile_data.hasFamilyInDestination` | Defaults to `false` |
| `movingWithFamily` | `profile_data.movingWithFamily` | Defaults to `false` |
| `budget` | `profile_data.budget` | Defaults to `""` |

The `user_id`, `plan_id`, `nationality`, `occupation`, and `household info` fields specified by the contract's `GenerationContext` are not all passed to the generator. `arrival_date` is not passed into the generator function itself, but the route uses it immediately after generation to compute and persist `deadline_at`.

---

## 5. Pipeline — Actual Implementation

The contract specifies a six-stage pipeline. Below is the mapping between contract stages and what is actually implemented.

Source: `lib/gomate/settling-in-generator.ts`

### Stage 1 — Baseline task load

**Contract:** Load tasks from `country_baselines` table.

**Implementation:** `getDefaultSettlingTasks(input)` — a hardcoded TypeScript function that returns 8–10 tasks based on the user's `hasJobOffer` and `movingWithFamily` flags. There is no `country_baselines` table. This function is used only as a **fallback** when web research and AI both fail, not as the primary pipeline entry point.

### Stage 2 — Web research (Firecrawl)

**Contract:** Fetch official sources via Source Fetch system; extract tasks.

**Implementation:** Two operations run if `FIRECRAWL_API_KEY` is set:

**Search:** `searchSettlingRequirements()` runs 3 of 4 Firecrawl search queries:
```
"{destination} {city} what to do after arriving checklist new residents"
"{destination} city registration residence permit after arrival {citizenship}"
"{destination} open bank account foreign resident requirements"
```
Each returns up to 2 results, capped at 3,000 characters of markdown per result.

**Scrape:** `scrapeSettlingSources()` scrapes up to 2 official source URLs from `official-sources.ts` (`immigration` and `banking` categories), capping content at 4,000 characters each.

If `FIRECRAWL_API_KEY` is not set, Stages 2 and 3 are skipped and the baseline fallback is used.

### Stage 3 — AI personalization

**Contract:** LLM with strict extraction schema; provide baseline tasks + user profile + destination context.

**Implementation:** `generateSettlingTasksWithAI(input, research, scraped)` calls:

```typescript
await generateText({
  model: "anthropic/claude-sonnet-4-20250514",
  prompt: /* ... */,
  maxTokens: 6000,
})
```

**Model:** The `ai` package (v6.0.57) is used with the `@ai-sdk/openai` adapter. The model string `anthropic/claude-sonnet-4-20250514` is an OpenRouter model identifier, indicating the generation runs via OpenRouter rather than the Anthropic API directly. The `OPENAI_API_KEY` environment variable is used for the interview chat, but the settling-in generator likely requires a separate API key (`OPENAI_API_KEY` pointing to OpenRouter, or a dedicated `OPENROUTER_API_KEY`). The key management is not documented in the codebase.

The AI prompt instructs the model to output a JSON array of tasks with `tempId` references for dependency tracking. The output is parsed with a regex (`/\[[\s\S]*\]/`) rather than using structured output mode.

If the AI response cannot be parsed, `getDefaultSettlingTasks(input)` is returned as a fallback.

**Task count target:** The prompt specifies "Generate 15–25 tasks". No hard limit is enforced after generation.

### Stage 4 — Merge & validation

**Partially implemented.** There is still no separate merge or deduplication step. The AI output (or default tasks) is used directly, and validation remains shallow. However, the route now validates DAG acyclicity with `isValidDAG()` before insert and strips all dependencies if a cycle is detected.

### Stage 5 — Persist

Source: `app/api/settling-in/generate/route.ts:88–137`

After the generator returns tasks:

1. Pre-assign UUIDs to each task (`crypto.randomUUID()`), building a `tempId → UUID` map.
2. Call `resolveDependencies(result.tasks, tempIdToUuid)` to translate `dependsOnTempIds` → real UUIDs.
3. Set `status = "available"` on tasks with no dependencies; all others remain `status = "locked"`.
4. Batch INSERT all tasks into `settling_in_tasks`.
5. UPDATE `post_relocation_generated = true` on the plan.

Steps 4 and 5 are separate queries, not a transaction. If step 5 fails after step 4 succeeds, the tasks are persisted but the idempotency flag is not set, meaning the next generate call would attempt to re-generate (and fail with a unique constraint violation on `plan_id + task_key` — though since `task_key` is not populated, this constraint is currently inert).

### Stage 6 — Finalize (events)

**Not implemented.** No `settling_in.tasks.generated` event is emitted.

---

## 6. Fallback Behavior

| Condition | Behavior |
|---|---|
| `FIRECRAWL_API_KEY` not set | Skip web research; go directly to AI with empty research context |
| Research content empty | AI generation is skipped; `getDefaultSettlingTasks()` returned |
| AI JSON parse fails | `getDefaultSettlingTasks()` returned |
| AI call throws | `getDefaultSettlingTasks()` returned |
| Profile has no `destination` | `400` error — generation rejected |

A partial fallback checklist (baseline only) is always available. A checklist with no research context is generated rather than failing the entire operation.

---

## 7. API: `POST /api/settling-in/generate`

Source: `app/api/settling-in/generate/route.ts`

**Auth:** Required (401 if not authenticated)
**Tier:** `pro_plus` required (403 otherwise)
**Method:** POST, no request body
**Idempotent:** Returns cached tasks if `post_relocation_generated` is `true`

**Success response (new generation):**
```json
{
  "tasks": [ /* array of inserted task rows */ ],
  "cached": false,
  "planId": "uuid",
  "researchSources": [ "https://..." ]
}
```

**Success response (cached):**
```json
{
  "tasks": [ /* existing task rows with selected fields */ ],
  "cached": true,
  "planId": "uuid"
}
```

Note: the cached response returns fewer fields (`id, title, category, status, depends_on, sort_order` only) compared to the fresh generation response, which returns the full inserted row shape.

---

## 8. Gap Analysis

| Gap | Contract specification | Current implementation | Severity |
|---|---|---|---|
| G-9.3-A | Verify `plan.stage === 'arrived'` before generating | Route now returns 400 unless the current plan is `arrived` | Resolved |
| G-9.3-B | Auto-trigger after arrival | Not triggered — entirely manual | P2 — UX friction; checklist not ready on arrival |
| G-9.3-C | `country_baselines` table as Stage 1 primary source | Does not exist; hardcoded TypeScript fallback only | P2 — No country-specific baseline coverage |
| G-9.3-D | `job_key` idempotency in `settling_in_generation_runs` | Boolean flag only; no run table | P2 — No generation audit or replay capability |
| G-9.3-E | Stage 4 (merge/dedup/validate) | Merge/dedup still absent; DAG validation exists but is only a narrow safety check | P2 — AI duplicates and non-cycle structural issues still pass through |
| G-9.3-F | Stage 6 (event emission) | Not implemented | P2 — No observability |
| G-9.3-G | Structured output mode for AI response | Regex JSON extraction from freeform text | P2 — Parse failures possible |
| G-9.3-H | Separate merge of baseline + web + AI tasks | Single path: web research feeds AI directly; no merge | P2 — Architectural divergence from contract |
| G-9.3-I | Generation steps 4–5 in one transaction | Two separate queries; no transaction | P2 — Partial failure leaves inconsistent idempotency state |
| G-9.3-J | `arrival_date` passed to generator as input | Not passed — deadlines not anchored to arrival date during generation | P2 — Deadlines are relative (days), not computed |
| G-9.3-K | Model provider unclear — `anthropic/claude-sonnet-4-20250514` via `@ai-sdk/openai` | Likely OpenRouter; API key management undocumented | P2 — Operational risk |

---

## 9. Target State (from contract § 8.1)

The target architecture defines:

- `country_baselines` table as the primary task source, with AI personalization applied on top
- A six-stage pipeline: baseline load → web research → AI personalization → merge/dedup/validate → persist → emit
- `job_key` idempotency in a `settling_in_generation_runs` table
- Arrival stage verified before generation starts
- Partial generation supported (baseline checklist returned if web/AI fails)
- Structured output for AI response (never regex parsing)
- Generation auto-triggered after arrival transition

---

## 10. Primary Source Files

| File | Role |
|---|---|
| `app/api/settling-in/generate/route.ts` | Generate endpoint — orchestration and persistence |
| `lib/gomate/settling-in-generator.ts` | Core generation logic, AI call, Firecrawl research, fallback |
| `lib/gomate/official-sources.ts` | Source URL registry used for scraping |
| `scripts/010_settling_in_checklist.sql` | `post_relocation_generated` flag on plan |
| `app/(app)/settling-in/page.tsx:97–113` | Client-side generation trigger |
