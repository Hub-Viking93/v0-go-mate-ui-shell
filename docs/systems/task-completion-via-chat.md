# GoMate — Task Completion via Chat

**Phase:** 10.2
**Status:** Reality-first
**Contract source:** `docs/gomate-uI-chat-integration-and-compliance-layer.md` § 9.2
**Last audited:** 2026-02-25

---

## 1. Purpose

This document describes how settling-in tasks can be marked as completed through the chat interface: the `[TASK_DONE:]` marker protocol, how the LLM is instructed to emit markers, how the frontend parses and processes them, and what server-side verification is performed.

---

## 2. Marker Format — Reality vs. Contract

**Contract specification:**

```
[TASK_DONE:<task_id>]
```

Where `<task_id>` is the task UUID.

**Actual implementation:**

```
[TASK_DONE:<task title>]
```

Where `<task title>` is the exact string value of `settling_in_tasks.title`.

The implementation uses the task **title** (a human-readable string) rather than the UUID. The system prompt instructs the AI:

> Include the marker `[TASK_DONE:exact task title]` at the END of your message (on its own line)

This is a deliberate architectural deviation. Titles are legible in the prompt context (the AI has titles, not UUIDs). The cost is fragility on title rename: if a task title changes, existing [TASK_DONE:] emissions would fail to match.

---

## 3. LLM Prompt Instructions

Source: `lib/gomate/system-prompt.ts:632–644`

The post-arrival system prompt contains:

```
## Task Completion Protocol
When the user tells you they have completed a task (e.g. "I registered at the town hall" or
"Done with the bank account"), you MUST:
1. Congratulate them briefly
2. Include the marker [TASK_DONE:exact task title] at the END of your message (on its own line)
3. The task title must match EXACTLY one of the pending tasks listed above
4. Only emit this marker when the user explicitly confirms completion — never assume
```

**Trigger examples provided in prompt:**
- "I registered at the town hall"
- "Done with the bank account"

**No explicit list of trigger phrases.** The contract mentions phrases like "I completed..." and "I have done..." — the implementation relies on the AI's general comprehension rather than a phrase list.

**Marker position:** The prompt specifies the marker at the END of the message on its own line. The frontend regex does not enforce this — it matches the marker anywhere in the message text.

---

## 4. Frontend Parsing

Source: `components/chat/chat-message-content.tsx`

### 4.1 Regex

```typescript
const TASK_DONE_REGEX = /\[TASK_DONE:(.+?)\]/g;
```

Extracts the content between `[TASK_DONE:` and `]`. The `.+?` lazy match stops at the first `]`. Multi-line task titles would be truncated, but task titles are single-line strings in practice.

### 4.2 Text cleaning

```typescript
const cleanText = text.replace(TASK_DONE_REGEX, "").trimEnd();
```

The marker is stripped from the displayed message. The user sees the AI's congratulation text only.

### 4.3 Badge rendering

If one or more markers are extracted, a badge is shown below the message text:

```jsx
<div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-xs">
  <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
  <span className="text-primary font-medium">Task completed: {title}</span>
</div>
```

The badge uses the extracted **title string**, not a UUID.

### 4.4 Deduplication (per-render)

```typescript
const processedRef = useRef<Set<string>>(new Set());
```

A `useRef` Set tracks titles that have already triggered an API call within the current component lifetime. If the same marker appears in the same component instance (e.g. on re-render), it is not re-processed.

This is per-render-instance protection only. If the component is remounted (e.g. page navigation), the ref resets and the same marker could fire again. The server-side check (§5.2) handles this case.

---

## 5. API Flow

### 5.1 Task lookup

```typescript
const listRes = await fetch("/api/settling-in")
const data = await listRes.json()
const task = data.tasks?.find(
  (t) => t.title.toLowerCase() === taskTitle.toLowerCase() && t.status !== "completed"
)
```

The frontend fetches the full task list, then does a case-insensitive title match, excluding already-completed tasks.

**Risks:**
- Two tasks with the same title in the same plan would both match; only the first is completed.
- If the task title has been modified after the AI was prompted (e.g. different casing), the match fails silently.
- Network failure on the GET call causes the marker to silently not fire.

### 5.2 PATCH call

```typescript
await fetch(`/api/settling-in/${task.id}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status: "completed" }),
})
```

This calls the standard task status update endpoint. All server-side verification in that endpoint applies.

### 5.3 Server verification (PATCH `/api/settling-in/[id]`)

Source: `app/api/settling-in/[id]/route.ts`

| Verification | Implementation |
|---|---|
| Auth | `supabase.auth.getUser()` — 401 if not authenticated |
| Tier | `getUserTier()` — 403 if not pro_plus |
| Task ownership | `.eq("user_id", user.id)` — 404 if not owned |
| Locked check | `task.status === "locked" && newStatus === "completed"` → 400 |
| Plan stage check | **Not performed** — PATCH does not verify `plan.stage === "arrived"` |
| Idempotency | Task is found with status `!= "completed"` by client before calling; server does not block double-complete |

---

## 6. Completion Transaction

When PATCH receives `{ status: "completed" }`:

1. Fetch task (ownership check).
2. Guard: reject if `status === "locked"`.
3. UPDATE `status = "completed"`, `completed_at = now()`.
4. Fetch all plan tasks.
5. `computeAvailableTasks()` — compute newly unlockable tasks.
6. Batch UPDATE dependents to `status = "available"`.

This is the same two-step completion flow used by manual task completion in the UI. The chat-triggered path uses the same endpoint with no special handling.

---

## 7. Idempotency

### 7.1 Client-side

`processedRef` prevents re-processing within one component lifetime. Not persistent across navigation.

### 7.2 Server-side

The PATCH endpoint does not prevent completing an already-completed task — it would simply re-set `completed_at` and re-run `computeAvailableTasks()`. The client guards against this by checking `t.status !== "completed"` in the title lookup step, but this is a client-side check only.

---

## 8. Spoof Protection

The marker format `[TASK_DONE:title]` could theoretically be injected by a user typing this text in the chat. The frontend applies `parseTaskMarkers` to **all** assistant messages, not user messages:

```typescript
const { cleanText, markers } = role === "assistant"
  ? parseTaskMarkers(content)
  : { cleanText: content, markers: [] as string[] }
```

User messages are never parsed for markers. Only assistant-generated content can trigger task completion.

However, the AI could be prompt-injected via a user message that causes it to emit a false `[TASK_DONE:]` marker. This is a known limitation of the marker protocol design and is addressed only by the "only emit when user explicitly confirms" instruction in the system prompt.

Final protection layer: the server's ownership verification and locked-status check. A user cannot complete another user's tasks, and a locked task cannot be completed regardless of how the marker was generated.

---

## 9. Gap Analysis

| Gap | Contract specification | Current implementation | Severity |
|---|---|---|---|
| G-10.2-A | Marker format `[TASK_DONE:<uuid>]` using task UUID | `[TASK_DONE:<title>]` using title string | **V1 design decision — intentional.** CLAUDE.md declares the title-based format canonical for v1 ("This is intentional. Do not change the format without updating both the system prompt and the frontend parser."). The UUID target is V2+ only. Not a defect to fix in v1. |
| G-10.2-B | Explicit trigger phrase list in prompt | General comprehension instruction only | P2 — LLM may miss some completion confirmations |
| G-10.2-C | Plan stage check in PATCH endpoint | Not performed | P1 — Task completion possible before arrival |
| G-10.2-D | `processedRef` reset on remount | Per-component-lifetime only; resets on navigation | P3 — Duplicate completion on remount (server-side benign but wasteful) |
| G-10.2-E | `optional completion_confirmation` flag (contract v1.1) | Not implemented | N/A — Optional |
| G-10.2-F | Silent failure on network error in fire-and-forget | No user feedback if GET or PATCH fails | P2 — User sees badge but task may not be updated |

---

## 10. Target State (from contract § 9.2)

**V1 note:** The title-based marker format (`[TASK_DONE:<title>]`) is the **locked v1 design**. CLAUDE.md declares it intentional and prohibits changing the format without updating both the system prompt and the frontend parser simultaneously. Do not migrate to UUID-based markers in v1.

The contract's target architecture (V2+ considerations only):

- V2: Marker uses `task_id` (UUID) — not title string — to be stable on rename
- Explicit trigger phrase list in prompt to improve marker emission recall
- Server-side PATCH verifies `plan.stage === "arrived"` before allowing completion (planned for Phase 2)
- `completion_confirmation` flag stored on task to distinguish chat vs. manual completions
- Audit event emitted: `task.completed` with `method = "chat"`

---

## 11. Primary Source Files

| File | Role |
|---|---|
| `lib/gomate/system-prompt.ts:632–644` | Marker protocol instructions in post-arrival system prompt |
| `components/chat/chat-message-content.tsx` | Frontend marker parsing, stripping, badge, API calls |
| `app/api/settling-in/[id]/route.ts` | PATCH endpoint — task status update and dependency unlock |
| `app/api/settling-in/route.ts` | GET endpoint used by frontend to resolve title → task id |
