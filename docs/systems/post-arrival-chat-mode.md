# GoMate — Post-Arrival Chat Mode

**Phase:** 10.1
**Status:** Reality-first
**Contract source:** `docs/gomate-uI-chat-integration-and-compliance-layer.md` § 9.1
**Last audited:** 2026-02-25

---

## 1. Purpose

This document describes how the chat route selects the post-arrival mode, what context it injects into the system prompt, how the post-arrival system prompt is built, and what behavioural rules it enforces.

---

## 2. Mode Determination

Source: `app/api/chat/route.ts:88–179`

The chat route reads plan state from Supabase on every request:

```typescript
const { data: plan } = await supabase
  .from("relocation_plans")
  .select("id, locked, profile_data, stage, arrival_date")
  .eq("user_id", user.id)
  .eq("is_current", true)
  .maybeSingle()

if (plan) {
  planStage = plan.stage
  arrivalDate = plan.arrival_date
}
```

Mode selection:

```typescript
if (planStage === "arrived" && planId) {
  // Post-arrival mode
  systemPrompt = buildPostArrivalSystemPrompt(profileContext, settlingTasks)
} else {
  // Pre-arrival interview mode
  systemPrompt = buildSystemPrompt(profile, pendingFieldKey, interviewState)
}
```

**Mode determination is fully server-authoritative.** The client sends `profile` and `confirmed` in the request body, but these are only used for pre-arrival mode. The stage check reads directly from the database. The client cannot influence which mode is selected.

**Auth failure silently defaults to pre-arrival mode.** The plan lookup is wrapped in a try/catch that continues without error if auth fails. If the Supabase call fails, `planStage` remains `null` and the pre-arrival path is taken.

---

## 3. Task Context Injection

When `planStage === "arrived"`, the route fetches settling-in tasks:

```typescript
const { data: tasks } = await supabase
  .from("settling_in_tasks")
  .select("title, category, status, deadline_days, is_legal_requirement")
  .eq("plan_id", planId)
  .order("sort_order")
```

**Fields injected per task:**
- `title` — task name (used for `[TASK_DONE:]` marker matching)
- `category` — for grouping in the prompt
- `status` — so the AI knows what is pending vs. completed
- `deadline_days` — for deadline awareness
- `is_legal_requirement` — for urgency flagging

**What is NOT injected:** `id`, `depends_on`, `description`, `steps`, `documents_needed`, `why_it_matters`, `official_link`.

**No token limit is enforced.** The contract specifies a maximum of 50 tasks injected. The implementation injects all tasks from the plan, ordered by `sort_order`. A plan with 25 tasks (the AI generation target) is well within practical token limits, but there is no hard cap.

---

## 4. `buildPostArrivalSystemPrompt()`

Source: `lib/gomate/system-prompt.ts:560–648`

```typescript
export function buildPostArrivalSystemPrompt(
  profile: {
    destination?: string
    nationality?: string
    occupation?: string
    arrivalDate?: string
  },
  settlingTasks: Array<{
    title: string; category: string; status: string;
    deadline_days?: number | null; is_legal_requirement?: boolean;
  }>
): string
```

### 4.1 Profile context injected

| Contract field | Implementation | Source in chat route |
|---|---|---|
| `destination` | `profile.destination` | `plan.profile_data.destination` |
| `nationality` | `profile.nationality` | `plan.profile_data.nationality` |
| `occupation` | `profile.occupation` | `plan.profile_data.occupation` |
| `arrivalDate` | `arrivalDate` (from plan) | `plan.arrival_date` |

Note: the chat route passes `nationality` and `occupation` from profile fields. The profile schema uses `citizenship` (not `nationality`) and the occupation field may or may not exist depending on what the user disclosed. The prompt falls back to `"unspecified"` for absent values.

### 4.2 Task summary format

Tasks are grouped by category. For each category, the prompt includes:

```
  {category}: {done}/{total} complete ({N} legal requirement(s) pending)
```

Pending tasks (not completed, not skipped) are listed individually:

```
  - "{title}" [{category}]
  - "{title}" [{category}] (LEGAL REQUIREMENT)
  - "{title}" [{category}] (LEGAL REQUIREMENT) — deadline: {N} days after arrival
```

Completed tasks are listed by title only.

### 4.3 Behavioural rules enforced in prompt

The system prompt instructs the AI to:

1. Help navigate the first weeks in the destination city
2. Answer practical questions about daily life, bureaucracy, local norms
3. Guide through settling-in tasks in priority order
4. Flag urgent legal deadlines and compliance requirements
5. Provide emotional support

**Task completion protocol (covered in detail in Phase 10.2 document):**

> When the user tells you they have completed a task, you MUST:
> 1. Congratulate them briefly
> 2. Include the marker `[TASK_DONE:exact task title]` at the END of your message

**Explicit prohibitions in prompt:** "never assume" task completion (must be user-explicit confirmation). No prohibition on inventing tasks, claiming legal guarantees, or directly citing task UUIDs.

**What the prompt does NOT enforce:**
- No prohibition on inventing new tasks not on the checklist
- No prohibition on making legal guarantees
- No token budget management
- No instructions to cite official sources (beyond "always cite official sources when discussing legal/regulatory matters" — no specific source list provided in prompt)

---

## 5. Missing-Tasks Fallback

If no checklist has been generated (`settlingTasks` is empty):

The task summary renders as:

```
## Settling-In Progress Summary
  No tasks generated yet.

## Pending Tasks
  All tasks complete!

## Completed Tasks
  None yet.
```

The AI receives an empty task list and must operate without task context. There is no explicit instruction to prompt the user to generate their checklist.

---

## 6. Model Used

The post-arrival chat uses **GPT-4o** via raw `fetch()` to the OpenAI API, identical to the pre-arrival chat:

```typescript
const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
  body: JSON.stringify({ model: "gpt-4o", stream: true, messages: [...] })
})
```

The settling-in generator and why-it-matters enrichment use Claude Sonnet (via OpenRouter). The chat interface uses GPT-4o. This is an architectural inconsistency (see G-3.1-C in the master index).

---

## 7. Streaming and Metadata

The post-arrival response uses the same streaming transform as the pre-arrival chat. The `message-end` event includes the same `metadata` payload:

```typescript
const metadata = {
  profile,
  state: planLocked ? "complete" : interviewState,
  pendingField: pendingFieldKey || "",
  // ... all pre-arrival fields
  costOfLiving, budget, savings, researchReport,
  lastExtraction: ...
}
```

This metadata is computed for pre-arrival use cases. In post-arrival mode, `interviewState`, `pendingField`, `costOfLiving`, and similar fields are irrelevant. The metadata payload is identical regardless of mode.

---

## 8. Profile Extraction in Post-Arrival Mode

The pre-arrival profile extraction pipeline still runs in post-arrival mode:

```typescript
if (lastUserText && !userConfirmed && !planLocked) {
  extractionResultWithConfidence = await extractProfileData(lastUserText, profile)
}
```

Since `planLocked` is `true` for plans in `complete` or `arrived` stage, extraction is gated by `!planLocked`. For `arrived` plans, `planLocked = true`, so extraction is skipped. Post-arrival messages do not trigger profile extraction.

---

## 9. Gap Analysis

| Gap | Contract specification | Current implementation | Severity |
|---|---|---|---|
| G-10.1-A | Maximum 50 tasks injected (token budget management) | All tasks injected with no limit | P2 — No overflow handling for large checklists |
| G-10.1-B | Observability events on mode selection | No events emitted | P2 — No observability |
| G-10.1-C | Controlled task format (never raw DB JSON) | Tasks injected as structured text — not raw JSON | Compliant |
| G-10.1-D | Missing-tasks fallback with helpful prompt | Empty task state renders without prompt to generate | P2 — User confusion if checklist not yet generated |
| G-10.1-E | Prohibition on inventing tasks not on checklist | Not enforced in prompt | P2 — AI may invent tasks |
| G-10.1-F | LLM forbidden from making legal guarantees | "Always cite official sources" instruction present; no explicit prohibition on guarantees | P2 — Legal risk |
| G-10.1-G | Auth failure returns error | Auth failure silently falls back to pre-arrival mode | P1 — Session may silently operate in wrong mode |
| G-10.1-H | `nationality` field mismatch | Profile uses `citizenship`; prompt builder uses `nationality` — both field names are undefined-safe but may differ from what user entered | P3 — Prompt may show "unspecified" for known citizenship |

---

## 10. Target State (from contract § 9.1)

The target architecture defines:

- Token budget enforced: maximum 50 tasks injected; overflow handled by injecting a summary only
- Observability event emitted on each post-arrival mode selection
- Explicit prohibition in prompt: AI must not invent tasks not present in the pending list
- Explicit prohibition: AI must not assert legal guarantees or outcomes
- Missing-tasks state: prompt instructs user to generate their checklist
- `nationality` field resolved against canonical profile field name

---

## 11. Primary Source Files

| File | Role |
|---|---|
| `app/api/chat/route.ts:88–179` | Mode determination logic |
| `app/api/chat/route.ts:152–177` | Task context fetch and prompt selection |
| `lib/gomate/system-prompt.ts:560–648` | `buildPostArrivalSystemPrompt()` |
| `lib/gomate/system-prompt.ts:651–669` | `buildPostArrivalWelcome()` |
