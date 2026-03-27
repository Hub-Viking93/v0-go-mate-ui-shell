# Phase 1 User Test Specification — Dashboard State And Progress Authority

## 1. Purpose

Verify that the dashboard now renders one canonical state model instead of local heuristics.

This user test validates:

- empty-plan dashboard state
- in-progress dashboard state after partial profile confirmation
- ready-to-lock dashboard state after a complete profile
- locked pre-arrival dashboard state
- arrived-mode setup state
- arrived-mode execution summary after settling-in generation

## 2. Environment And Preconditions

- Run against `http://localhost:3000`
- `.env.local` must already be configured
- Use the configured authenticated test account
- Open one signed-in browser tab on `/dashboard`
- Also have a terminal available for deterministic API setup via `curl`

You need these values:

- `<BASE_URL>` = `http://localhost:3000`
- `<AUTH_COOKIE>` = authenticated cookie copied from the browser
- `<PLAN_ID>` = the test plan created in Section 3

## 3. Deterministic Test Setup

Create a fresh dedicated Phase 1 test plan:

```bash
curl -s -X POST "<BASE_URL>/api/plans" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d '{"title":"Phase 1 User Acceptance"}'
```

Expected result:

- HTTP status `200`
- response JSON contains `plan.id`
- copy that id into `<PLAN_ID>`

Use these exact payloads in the next sections.

### PARTIAL_PROFILE_PAYLOAD

```json
{
  "planId": "<PLAN_ID>",
  "expectedVersion": 1,
  "profileData": {
    "name": "Phase One Runtime",
    "citizenship": "United States",
    "current_location": "United States",
    "destination": "Germany",
    "target_city": "Berlin"
  }
}
```

### FULL_PROFILE_PAYLOAD

```json
{
  "planId": "<PLAN_ID>",
  "expectedVersion": 2,
  "profileData": {
    "name": "Phase One Runtime",
    "citizenship": "United States",
    "current_location": "United States",
    "destination": "Germany",
    "target_city": "Berlin",
    "purpose": "work",
    "visa_role": "primary",
    "duration": "long_term",
    "timeline": "within_6_months",
    "job_offer": "no",
    "job_field": "software_engineering",
    "highly_skilled": "yes",
    "moving_alone": "yes",
    "savings_available": "25000",
    "monthly_budget": "2500",
    "need_budget_help": "no",
    "language_skill": "english_fluent",
    "education_level": "bachelors",
    "years_experience": "6",
    "prior_visa": "no",
    "visa_rejections": "no"
  }
}
```

## 4. User Acceptance Tests

### TEST-1.1 Empty plan shows the start state

1. Refresh `/dashboard`.
2. Confirm the new test plan is current in the plan switcher.

Expected UI:

- the dashboard state summary shows `Start your relocation profile`
- the main CTA says `Start planning`
- no lock CTA is visible
- no arrived summary card is visible

### TEST-1.2 Partial confirmed profile shows in-progress collection, not the start state

1. Run:

```bash
curl -i -X PATCH "<BASE_URL>/api/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d '<PARTIAL_PROFILE_PAYLOAD>'
```

2. Refresh `/dashboard`.

Expected result:

- HTTP status `200`
- dashboard state summary shows `Your profile is still in progress`
- the page no longer looks like the empty welcome/start state
- no lock CTA is visible yet

### TEST-1.3 Complete profile shows ready-to-lock state

1. Run:

```bash
curl -i -X PATCH "<BASE_URL>/api/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d '<FULL_PROFILE_PAYLOAD>'
```

2. Refresh `/dashboard`.

Expected UI:

- HTTP status `200`
- dashboard state summary shows `Your profile is ready to lock`
- a lock action is visible
- the progress card reflects full confirmation instead of an inferred local denominator

### TEST-1.4 Lock via the dashboard and confirm the pre-arrival state

1. Click the dashboard lock action.
2. Wait for the dashboard to refresh.

Expected UI:

- the dashboard state summary shows `Your plan is locked and ready`
- the arrival banner appears with `Have you arrived in Germany?`
- the arrival CTA `I've arrived!` is visible
- no edit-in-progress profile state is shown anymore

### TEST-1.5 Confirm arrival and verify arrived setup state

1. In the arrival banner, click `I've arrived!`
2. Leave the default date or set `2026-03-14`
3. Click `Confirm`
4. Navigate back to `/dashboard` if you are redirected to `/settling-in`

Expected UI:

- the dashboard state summary shows `You have arrived`
- the arrived summary card is visible
- the arrived summary card CTA points to `/settling-in`
- the card is still a setup state, not fake progress

### TEST-1.6 Generate settling-in tasks and verify real arrived execution summary

1. If you are not already on `/settling-in`, open it.
2. Generate the settling-in plan using the page CTA.
3. Return to `/dashboard`.

Expected UI:

- the dashboard state summary changes from `You have arrived` to `Post-arrival execution is underway` or `Post-arrival action needed`
- the summary card shows real counts like:
  - `X/Y complete`
  - `N active`
  - `% progress`
- the action CTA becomes `Continue settling-in` or `Review checklist`

## 5. Failure / Safety Checks

### TEST-1.N1 Missing version must fail safely

Run:

```bash
curl -i -X PATCH "<BASE_URL>/api/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d "{\"planId\":\"<PLAN_ID>\",\"profileData\":{\"monthly_budget\":\"2600\"}}"
```

Expected result:

- HTTP status `409`
- dashboard state does not silently regress

### TEST-1.N2 Locked plan edit must be rejected

Run this after TEST-1.4:

```bash
curl -i -X PATCH "<BASE_URL>/api/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d "{\"planId\":\"<PLAN_ID>\",\"expectedVersion\":4,\"profileData\":{\"monthly_budget\":\"2700\"}}"
```

Expected result:

- HTTP status `403`
- the dashboard still shows the locked/arrived flow correctly

## 6. Pass / Fail Rule

Pass this user gate only if all six acceptance tests and both failure checks behave exactly as described.

If any title, CTA, state transition, or failure contract differs, record:

- which test failed
- what was expected
- what actually happened
- whether the failure was visual-only, state-only, or both
