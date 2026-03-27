# GoMate — Compliance Timeline & Alerting

**Phase:** 10.3
**Status:** Reality-first
**Contract source:** `docs/gomate-uI-chat-integration-and-compliance-layer.md` § 9.3
**Last audited:** 2026-02-25

---

## 1. Purpose

This document describes the two compliance UI components — `ComplianceTimeline` and `ComplianceAlerts` — including how deadline fields are computed, what alert thresholds are used, and how dismissal works.

---

## 2. Components Overview

| Component | File | Role |
|---|---|---|
| `ComplianceTimeline` | `components/compliance-timeline.tsx` | Full timeline view on the settling-in page; shows all legal tasks with deadlines |
| `ComplianceAlerts` | `components/compliance-alerts.tsx` | Floating alert banners on the dashboard; shows only overdue and urgent items |

Both are client components (`"use client"`).

---

## 3. Data Source

Both components derive their data from the settling-in task list.

`ComplianceTimeline` receives tasks as props (passed from `app/(app)/settling-in/page.tsx` which fetches them from `GET /api/settling-in`).

`ComplianceAlerts` fetches directly:

```typescript
const res = await fetch("/api/settling-in")
const data = await res.json()
```

This is a check-on-read pattern. Neither component uses a cron job or push notification. Compliance state is computed fresh on every mount.

---

## 4. Deadline Computation

Deadline computation is now split across server and client paths.

### 4.1 Server-computed fields

`GET /api/settling-in` now computes and returns:

- `deadline_at`
- `days_until_deadline`
- `urgency`
- persisted `status = "overdue"` when deadline breach is detected

`ComplianceAlerts` uses these server-computed values directly.

### 4.2 Client-side fallback in `ComplianceTimeline`

`ComplianceTimeline` still recomputes `deadlineDate` and day deltas locally from:

- `arrivalDate`
- `task.deadline_days`
- `new Date()` at render time

So the compliance system is only **partially** server-authoritative today:

- alerts and task cards consume server-derived urgency
- the dedicated timeline component still derives its own status client-side

---

## 5. Task State Classification

### 5.1 `TimelineStatus` enum (`ComplianceTimeline`)

```typescript
type TimelineStatus = "overdue" | "urgent" | "upcoming" | "completed"
```

```typescript
function getDeadlineStatus(deadlineDate, today, completed): TimelineStatus {
  if (completed) return "completed"
  const daysLeft = daysBetween(today, deadlineDate)
  if (daysLeft < 0) return "overdue"
  if (daysLeft <= 7) return "urgent"
  return "upcoming"
}
```

| Status | Condition |
|---|---|
| `completed` | `task.status === "completed"` |
| `overdue` | `daysLeft < 0` (deadline has passed, task not completed) |
| `urgent` | `0 ≤ daysLeft ≤ 7` |
| `upcoming` | `daysLeft > 7` |

### 5.2 Alert type (`ComplianceAlerts`)

```typescript
type: daysLeft < 0 ? "overdue" : "urgent"
```

`ComplianceAlerts` shows only items with `daysLeft <= 7`. "Upcoming" items (more than 7 days away) are never shown in alerts. The separation between `overdue` and `urgent` within the alert uses `daysLeft < 0`.

---

## 6. Color Thresholds

### `ComplianceTimeline` status colours

| Status | Colour | Border | Icon |
|---|---|---|---|
| `overdue` | `text-destructive` (red) | `border-destructive/30` | `AlertTriangle` + `animate-pulse` |
| `urgent` | `text-amber-600` (amber) | `border-amber-500/30` | `Clock` |
| `upcoming` | `text-muted-foreground` (grey) | `border-border` | `Clock` |
| `completed` | `text-primary` (primary, green) | `border-primary/20` | `CheckCircle2` |

### `ComplianceAlerts` banner colours

| Type | Banner style |
|---|---|
| `overdue` | `bg-destructive/5`, `border-destructive/30`, `AlertTriangle` icon |
| `urgent` | `bg-amber-50`, `border-amber-500/30`, `Clock` icon |

Note: when both overdue and urgent alerts exist, only the overdue banner renders (not the urgent banner). This is controlled by `urgentAlerts.length > 0 && overdueAlerts.length === 0`.

---

## 7. Sort Order

### `ComplianceTimeline`

```typescript
.sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime())
```

Sorted by absolute deadline date ascending. Legal tasks are not sorted before non-legal tasks within the timeline. All tasks with `is_legal_requirement === true && deadline_days != null` are included.

### `ComplianceAlerts`

```typescript
foundAlerts.sort((a, b) => a.daysLeft - b.daysLeft)
```

Sorted by `daysLeft` ascending (most urgent first). Negative values (overdue) come first.

---

## 8. Task Filtering

### `ComplianceTimeline`

```typescript
tasks
  .filter(t => t.is_legal_requirement && t.deadline_days != null)
```

Only legal requirements with deadlines are shown in the timeline.

### `ComplianceAlerts`

```typescript
if (!task.is_legal_requirement || !task.deadline_days ||
    task.status === "completed" || task.status === "skipped") continue

if (daysLeft <= 7) { /* add to alerts */ }
```

Only uncompleted, unskipped legal requirements with `daysLeft <= 7` trigger alerts.

---

## 9. Alert Visibility Rules

`ComplianceTimeline` renders nothing (`return null`) if there are no legal requirement tasks with deadlines.

`ComplianceAlerts` renders nothing if:
- `planStage !== "arrived"` (checked via prop)
- No tasks meet the `daysLeft <= 7` threshold
- The component has been dismissed

---

## 10. Dismissal

### `ComplianceAlerts`

```typescript
const [dismissed, setDismissed] = useState(() => {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DISMISS_KEY) === 'true'
})
```

Dismissal is a single boolean React state variable. Clicking the `X` button sets `dismissed = true`, which hides the entire alert block.

**Persistence:** Dismissal state is persisted in `localStorage` under `gomate:compliance-alerts-dismissed`. It survives refreshes and navigation in the same browser, but there is still no server-side dismissal record.

The contract mentions a `compliance_alert_dismissals` server-side table as the target. This does not exist. The contract also mentions `localStorage` as an alternative. The implementation now uses the `localStorage` fallback only.

### Toast notification

When alerts are first detected (on mount), a toast is shown for the most urgent item:

```typescript
toast({
  title: first.type === "overdue" ? `Overdue: ${first.title}` : `Due soon: ${first.title}`,
  description: /* ... */,
  variant: first.type === "overdue" ? "destructive" : "default",
})
```

The toast uses the `useToast` hook from `hooks/use-toast.ts`. It fires once per component mount.

---

## 11. Compliance Invariants

| Invariant | Status |
|---|---|
| Alerts never block the UI | Compliant — alerts are banners, not modals; dismissed with one click |
| Works with partial task lists | Compliant — filters are additive; empty task list renders nothing |
| Shows nothing if tasks are missing | Compliant — both components return null for empty/filtered lists |
| No cron jobs | Compliant — check-on-read only |

---

## 12. `GET /api/settling-in` — Data Shape for Compliance

`ComplianceAlerts` relies on the GET response including `arrivalDate` and `tasks[].deadline_days`.

Source: `app/api/settling-in/route.ts:82–98`

```json
{
  "tasks": [ { "is_legal_requirement": true, "deadline_days": 14, "status": "locked", ... } ],
  "arrivalDate": "2026-03-15",
  "stage": "arrived",
  ...
}
```

If `data.arrivalDate` is null (plan has not gone through arrival transition), `ComplianceAlerts` returns early:

```typescript
if (!data.tasks || !data.arrivalDate) return
```

---

## 13. Gap Analysis

| Gap | Contract specification | Current implementation | Severity |
|---|---|---|---|
| G-10.3-A | `compliance_alert_dismissals` server-side table | Does not exist | P2 — Dismissals do not persist across browsers/devices or at the account level |
| G-10.3-B | `localStorage` as dismissal fallback (per contract) | Implemented for alerts; no server-side dismissal table exists | Partial |
| G-10.3-C | Server-computed deadline fields (`deadline_date`, `days_remaining`, `task_state`) | Alerts and task cards use server-computed urgency, but `ComplianceTimeline` still derives deadline state client-side | P2 — Compliance rendering is only partially server-authoritative |
| G-10.3-D | Observability events on alert generation | No events | P2 — No observability |
| G-10.3-E | Legal tasks sorted first in timeline | Not implemented; all tasks sorted by deadline date ascending | P3 — Legal tasks may appear in middle of timeline |
| G-10.3-F | Toast fires on every mount | Fire-and-forget on `useEffect` mount; repeated on remount | P3 — May feel intrusive on frequent navigation |

---

## 14. Target State (from contract § 9.3)

The target architecture defines:

- `deadline_date`, `days_remaining`, and `task_state` computed server-side in `GET /api/settling-in` response (or as a derived view), eliminating client-side timezone drift
- `compliance_alert_dismissals` table: `(user_id, task_id, dismissed_at)` — allows dismissal to persist across sessions
- Legal tasks sorted first within timeline before deadline-ascending ordering
- Observability event emitted when `overdue` state is detected on check-on-read

---

## 15. Primary Source Files

| File | Role |
|---|---|
| `components/compliance-timeline.tsx` | Full legal compliance timeline |
| `components/compliance-alerts.tsx` | Dashboard alert banners |
| `app/api/settling-in/route.ts` | Task list endpoint (provides `arrivalDate` and task data) |
| `app/(app)/settling-in/page.tsx:268–274` | `ComplianceTimeline` render in settling-in page |
| `components/settling-in-task-card.tsx:64–76` | Task-level deadline and urgency computation (card view) |
