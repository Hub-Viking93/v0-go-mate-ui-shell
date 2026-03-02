# GoMate — Post-Relocation (Batch 9) Contracts (v1)
Batch 9 = UI, Chat Integration, and Compliance Layer

Includes:
9.1 Post-Arrival Chat Mode Contract
9.2 Task Completion via Chat Contract
9.3 Compliance Timeline & Alerting Contract

Scope:
- Defines how the settling-in system integrates with chat, UI, and compliance monitoring.
- Depends on Batch 7 (Arrival + Persistence) and Batch 8 (Checklist Engine + DAG + Enrichment).
- Ensures deterministic, safe, and auditable interaction between AI and task system.

Non-negotiable:
- Chat never directly mutates DB without server validation.
- Task completion via chat is idempotent and spoof-safe.
- Compliance timeline and alerts are derived from server truth only.

================================================================================
9.1 POST-ARRIVAL CHAT MODE CONTRACT (v1)
================================================================================

## 9.1.1 Purpose

Switch GoMate chat from:

Pre-arrival mode: relocation interview

To:

Post-arrival mode: settling-in coach

In post-arrival mode, chat must:

- Know user’s settling-in tasks
- Provide guidance based on real tasks
- Never hallucinate tasks or deadlines
- Support task completion signaling (see 9.2)

## 9.1.2 Mode switching rule (server-authoritative)

Chat mode is determined ONLY by server:

IF plan.stage == 'arrived'
  mode = post_arrival
ELSE
  mode = interview

Client must never decide mode independently.

Chat route:

POST /api/chat

Must:

Fetch plan
Check stage
Build system prompt accordingly

## 9.1.3 System prompt builder contract

Function:

buildPostArrivalSystemPrompt(context)

Inputs:

- plan_id
- arrival_date
- destination
- settling_in_tasks (full list)
- profile snapshot

System prompt MUST include structured task data:

Example structure injected:

TASK LIST:

Task:
id: uuid
title: "Register address"
status: todo|done
locked: true|false
deadline_date: YYYY-MM-DD
is_legal_requirement: true|false

Hard rule:

Never inject raw DB JSON.
Always transform into controlled format.

## 9.1.4 Chat behavioral rules in post-arrival mode

Chat assistant must:

Allowed:

Explain tasks  
Advise on next steps  
Answer questions  
Acknowledge task completion  

Forbidden:

Invent new tasks  
Invent deadlines  
Claim legal guarantees  
Modify tasks directly  

All task mutations must go through API.

## 9.1.5 Missing task fallback

If no tasks exist:

Prompt must include:

"Checklist not generated yet."

Assistant must:

Suggest generating checklist.

Never hallucinate checklist.

## 9.1.6 Token safety

Maximum tasks injected:

Recommended:

50 tasks max

If more:

Inject only summary + next tasks.

Avoid token overflow.

## 9.1.7 Observability

Events:

chat.mode.post_arrival.entered
chat.mode.post_arrival.failed

Trace_id mandatory.

## 9.1.8 Definition of Done

Chat mode contract complete when:

Mode switches correctly  
Tasks injected safely  
No hallucinated tasks  
No direct DB mutations  

================================================================================
9.2 TASK COMPLETION VIA CHAT CONTRACT (v1)
================================================================================

## 9.2.1 Purpose

Allow users to complete tasks naturally via chat conversation.

Example:

User:

"I have opened my bank account"

Assistant internally signals completion.

Completion must be:

Safe  
Idempotent  
Spoof-resistant  

## 9.2.2 Marker protocol

Assistant must emit hidden marker:

[TASK_DONE:<task_id>]

Example:

[TASK_DONE:8c9a2f...]

Hard rule:

Must use task_id

Never use title.

Title not stable.

## 9.2.3 Marker generation rules (LLM prompt)

Prompt must instruct:

Only emit marker when:

User clearly confirms completion

Examples:

"I completed..."
"I have done..."
"I finished..."

Never emit on ambiguous statements.

## 9.2.4 Frontend parsing contract

Frontend:

components/chat/chat-message-content.tsx

Must:

Detect marker

Remove marker from visible text

Display badge:

"Task completed"

Then call:

PATCH /api/settling-in/{task_id}

Never trust marker blindly.

## 9.2.5 Server verification contract

PATCH /api/settling-in/{task_id}

Server must verify:

Task exists  
Task belongs to user  
Task belongs to current plan  
Task.locked == false  
Plan.stage == arrived  

Else:

Reject.

## 9.2.6 Completion transaction

Server must atomically:

Set:

status=done
completed_at=now()

Unlock dependents

Emit events.

Idempotency rule:

If already done:

Return success

No duplicate effects.

## 9.2.7 Spoof protection

User must not be able to spoof completion.

Protection layers:

Marker removed from visible UI  
Server verifies ownership  
Server verifies locked=false  

Optional v1.1:

Add completion_confirmation flag.

## 9.2.8 Observability

Events:

task.completed.via_chat
task.completed.idempotent
task.completed.rejected

Trace_id mandatory.

## 9.2.9 Definition of Done

Completion via chat complete when:

Markers parsed correctly  
Server validation enforced  
Dependents unlocked correctly  
Idempotent  

================================================================================
9.3 COMPLIANCE TIMELINE & ALERTING CONTRACT (v1)
================================================================================

## 9.3.1 Purpose

Provide visual timeline and alerts for legal tasks.

Goals:

Prevent missed deadlines  
Increase compliance  
Provide urgency awareness  

## 9.3.2 Timeline data model

Derived fields:

deadline_date:

deadline_date = arrival_date + deadline_days

days_remaining:

deadline_date - today

task_state:

overdue
due_soon
completed
upcoming

## 9.3.3 Timeline rendering rules

Color codes:

RED:

deadline_date < today
AND status != done

YELLOW:

deadline_date within 7 days

GREEN:

status == done

GRAY:

future

Server should calculate state or provide enough data for client.

Never trust client-only calculation.

## 9.3.4 Timeline ordering

Sort by:

deadline_date ascending

Legal tasks first.

## 9.3.5 Compliance alert system

Component:

ComplianceAlerts

Trigger:

On dashboard load

Endpoint:

GET /api/settling-in

No cron jobs required.

Check-on-read pattern.

## 9.3.6 Alert thresholds

Overdue:

deadline_date < today

Due soon:

deadline_date within 7 days

## 9.3.7 Alert rendering

RED banner:

"You have overdue compliance tasks"

YELLOW banner:

"You have tasks due soon"

Dismiss allowed.

## 9.3.8 Dismissal contract

Dismissal stored:

Option:

local storage OR server

Recommended:

Server:

Table:

compliance_alert_dismissals

Fields:

user_id
task_id
dismissed_until

Prevent alert fatigue.

## 9.3.9 Compliance invariants

Alerts must:

Never block UI  
Never break dashboard  
Work with partial task lists  

If tasks missing:

No alerts shown.

## 9.3.10 Observability

Events:

compliance.alert.shown
compliance.alert.dismissed

Trace_id required.

## 9.3.11 Definition of Done

Timeline and alert system complete when:

Deadlines correct  
Alerts accurate  
No false positives  
No UI blocking  

END