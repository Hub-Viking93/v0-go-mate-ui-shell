# GoMate — Why-It-Matters Enrichment

**Phase:** 9.5
**Status:** Reality-first
**Contract source:** `docs/gomate-settling-in-engine-layer.md` § 8.3
**Last audited:** 2026-02-25

---

## 1. Purpose

This document describes the on-demand AI enrichment feature that generates a personalized "Why it matters" explanation for individual settling-in tasks. It covers the endpoint contract, the cache model, the LLM call, and what is and is not implemented compared to the contract.

---

## 2. Endpoint

```
POST /api/settling-in/[id]/why-it-matters
```

Where `[id]` is the `settling_in_tasks.id` UUID (not the `task_key`).

Source: `app/api/settling-in/[id]/why-it-matters/route.ts`

---

## 3. Request

**Method:** POST
**Auth:** Required (401 if not authenticated)
**Tier:** `pro_plus` required (403 otherwise)
**URL parameter:** `id` — task UUID
**Request body:** Empty (no body required or used)

---

## 4. Cache-Hit Path

Before calling the LLM, the endpoint checks if `why_it_matters` is already populated:

```typescript
if (task.why_it_matters) {
  return NextResponse.json({ whyItMatters: task.why_it_matters, cached: true })
}
```

If the field is non-null (any truthy string), the cached value is returned immediately. There is no TTL, expiry, or mechanism to force regeneration.

**Trigger model:** Enrichment is entirely user-initiated. The "Why does this matter?" button appears inside the expanded task card only for non-locked tasks. Auto-generation at checklist creation time is not implemented.

Source: `components/settling-in-task-card.tsx:259–288`

---

## 5. LLM Call

Source: `app/api/settling-in/[id]/why-it-matters/route.ts:55–76`

```typescript
const result = await generateText({
  model: "anthropic/claude-sonnet-4-20250514",
  maxTokens: 300,
  prompt: `...`,
})
```

**Model:** `anthropic/claude-sonnet-4-20250514` via the `ai` package (v6.0.57) with `@ai-sdk/openai` adapter. As with the checklist generator, the `anthropic/` prefix indicates OpenRouter as the provider.

**Token limit:** 300 tokens maximum.

**Prompt template:**

```
You are a relocation expert. A person is moving from {citizenship} to {destination} for {purpose}.

They need to complete this post-arrival task:
- Task: {title}
- Description: {description}
- Category: {category}
[- This is a LEGAL REQUIREMENT.  (if applicable)]
[- Deadline: {deadline_days} days after arrival.  (if applicable)]

Write a brief, personalized explanation (2-3 sentences) of why this task matters for THEM specifically...
Be direct, conversational, not generic. Do NOT use bullet points or headers. Just write a short paragraph.
```

The prompt injects:
- The user's citizenship and destination (from plan `profile_data`)
- The task's title, description, category, `is_legal_requirement`, and `deadline_days`
- The user's purpose

**What the prompt enforces:**
- Output format: plain paragraph (no bullets, no headers)
- Length: 2–3 sentences
- Focus: practical consequences, personal situation, hidden benefits

**What the prompt does NOT enforce:**
- Hedging language (no "please consult an official source" language)
- Prohibition on legal claims
- Refusal to guarantee outcomes

---

## 6. Storage

On successful generation:

```typescript
await supabase
  .from("settling_in_tasks")
  .update({ why_it_matters: whyItMatters, updated_at: new Date().toISOString() })
  .eq("id", taskId)
  .eq("user_id", user.id)
```

The text is saved to `settling_in_tasks.why_it_matters`. This is the canonical cache. Once written, the value persists until the task row is deleted.

---

## 7. Failure Handling

If `generateText()` throws:

```typescript
return NextResponse.json({ error: "Failed to generate explanation" }, { status: 500 })
```

The error is logged to console. No partial text is stored. The `why_it_matters` field remains NULL. The client displays nothing additional (the button remains visible for retry).

---

## 8. Response

**Success (newly generated):**
```json
{ "whyItMatters": "...", "cached": false }
```

**Success (cached):**
```json
{ "whyItMatters": "...", "cached": true }
```

**Error:**
```json
{ "error": "Failed to generate explanation" }
```
HTTP 500.

---

## 9. Rate Limiting

**Not implemented.** There is no per-user daily limit, per-task limit, or global rate limit on the enrichment endpoint. A user can request enrichment for all tasks in rapid succession.

---

## 10. Idempotency on Duplicate Requests

If two concurrent requests arrive for the same task before either completes:

1. Both find `why_it_matters = NULL`.
2. Both make an LLM call.
3. Both write to `why_it_matters`.

The second write overwrites the first. No error occurs. The result is two wasted LLM calls. There is no locking mechanism to prevent this.

---

## 11. Audit Events

**Not implemented.** No event is emitted when enrichment is generated or served from cache.

---

## 12. Gap Analysis

| Gap | Contract specification | Current implementation | Severity |
|---|---|---|---|
| G-9.5-A | Per-user daily rate limit enforced at threshold | No rate limiting | P2 — Unconstrained LLM spend per user |
| G-9.5-B | Hedging language in prompt to prevent hallucinated legal guarantees | No hedging enforced in prompt | P2 — Model may make implicit legal claims |
| G-9.5-C | Audit events on generation and cache-hit | No audit events | P2 — No observability |
| G-9.5-D | Idempotency protection against concurrent requests | No locking; concurrent requests both make LLM calls and both write | P3 — Double spend risk on rapid re-click |
| G-9.5-E | `task_key` used as URL identifier | UUID used as URL parameter | P3 — Contract terminology divergence; UUID is more robust |
| G-9.5-F | Partial text stored on generation failure | No partial storage; NULL remains on failure | P3 — User must retry with no persistence |

---

## 13. Target State (from contract § 8.3)

The target architecture defines:

- Per-user daily rate limit (specific threshold to be determined) enforced in the endpoint
- Prompt includes mandatory hedging: language instructing the model not to assert legal guarantees
- Audit event emitted on generation (`task.enriched` event with `task_id`, `user_id`, `cached`, `tokens`)
- Locking or conditional update to prevent concurrent regeneration
- Optional: auto-generation at checklist creation for high-priority tasks

---

## 14. Primary Source Files

| File | Role |
|---|---|
| `app/api/settling-in/[id]/why-it-matters/route.ts` | Enrichment endpoint |
| `components/settling-in-task-card.tsx:259–288` | "Why does this matter?" button and display |
| `scripts/010_settling_in_checklist.sql` | `why_it_matters text` column definition |
