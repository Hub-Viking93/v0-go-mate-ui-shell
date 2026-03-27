# Phase 0 User Test Specification — Core State Authority

## 1. Purpose

Verify the Phase 0 fixes for:

- shared current-plan/state authority on profile, progress, and plans surfaces
- mandatory version conflict protection on active profile-state writes
- validated lock transitions
- normalized stage/lifecycle behavior for collecting vs locked plans

## 2. Environment and Preconditions

- Use a local server at `http://localhost:3000`
- You must have:
  - an authenticated GoMate account
  - browser dev tools or a terminal with `curl`
- Define these values before testing:
  - `<BASE_URL>`: `http://localhost:3000`
  - `<AUTH_COOKIE>`: authenticated cookie copied from the browser
  - `<ORIGINAL_PLAN_ID>`: current plan id before testing
  - `<TEST_PLAN_ID>`: plan id created in Section 4.1

Before testing, capture the current plan:

```bash
curl -s "<BASE_URL>/api/profile" \
  -H "Cookie: <AUTH_COOKIE>"
```

Record:

- `<ORIGINAL_PLAN_ID>` = `response.plan.id`
- `<ORIGINAL_PLAN_VERSION>` = `response.plan.plan_version`

## 3. Test Data and Deterministic Inputs

Use this exact create-plan payload in Section 4.1:

```json
{
  "title": "Phase 0 User Verification"
}
```

Use this exact profile payload in Section 4.4:

```json
{
  "name": "Phase Zero Tester",
  "citizenship": "United States",
  "current_location": "United States",
  "destination": "Germany",
  "target_city": "Berlin",
  "purpose": "work",
  "job_offer": "yes",
  "job_field": "software",
  "employer_sponsorship": "yes",
  "highly_skilled": "yes",
  "visa_role": "primary",
  "duration": "long_term",
  "timeline": "within_3_months",
  "moving_alone": "yes",
  "savings_available": "25000",
  "monthly_budget": "2500",
  "education_level": "bachelors",
  "years_experience": "6"
}
```

Expected required values after Section 4.4:

- `plan.stage = "collecting"`
- `plan.lifecycle = "ready_to_lock"`
- `plan.readiness.isReadyForLock = true`

## 4. Happy Path Tests (End-to-End)

### TEST-0.1: Create a dedicated test plan

Send:

```bash
curl -i -X POST "<BASE_URL>/api/plans" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d '{"title":"Phase 0 User Verification"}'
```

Expected result:

- HTTP status is `200`
- response JSON contains `plan.id`
- response JSON contains `plan.stage = "collecting"`
- response JSON contains `plan.lifecycle = "collecting"`

Record:

- `<TEST_PLAN_ID>` = `response.plan.id`
- `<TEST_PLAN_VERSION_1>` = `response.plan.plan_version`

### TEST-0.2: Verify missing conflict token is rejected

Send:

```bash
curl -i -X PATCH "<BASE_URL>/api/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d '{"planId":"<TEST_PLAN_ID>","profileData":{"name":"No Version"}}'
```

Expected result:

- HTTP status is `409`
- response JSON contains `error`
- response JSON contains `currentVersion`

### TEST-0.3: Verify incomplete plan cannot lock

Send:

```bash
curl -i -X PATCH "<BASE_URL>/api/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d '{"planId":"<TEST_PLAN_ID>","action":"lock","expectedVersion":<TEST_PLAN_VERSION_1>}'
```

Expected result:

- HTTP status is `409`
- response JSON contains `readiness`
- response JSON contains `readiness.isReadyForLock = false`

### TEST-0.4: Save a complete profile with version protection

Send:

```bash
curl -i -X PATCH "<BASE_URL>/api/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d '{
    "planId":"<TEST_PLAN_ID>",
    "expectedVersion":<TEST_PLAN_VERSION_1>,
    "profileData":{
      "name":"Phase Zero Tester",
      "citizenship":"United States",
      "current_location":"United States",
      "destination":"Germany",
      "target_city":"Berlin",
      "purpose":"work",
      "job_offer":"yes",
      "job_field":"software",
      "employer_sponsorship":"yes",
      "highly_skilled":"yes",
      "visa_role":"primary",
      "duration":"long_term",
      "timeline":"within_3_months",
      "moving_alone":"yes",
      "savings_available":"25000",
      "monthly_budget":"2500",
      "education_level":"bachelors",
      "years_experience":"6"
    }
  }'
```

Expected result:

- HTTP status is `200`
- response JSON contains `plan.stage = "collecting"`
- response JSON contains `plan.lifecycle = "ready_to_lock"`
- response JSON contains `plan.readiness.isReadyForLock = true`
- response JSON contains `plan.plan_version`

Record:

- `<TEST_PLAN_VERSION_2>` = `response.plan.plan_version`

### TEST-0.5: Lock the ready plan

Send:

```bash
curl -i -X PATCH "<BASE_URL>/api/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d '{"planId":"<TEST_PLAN_ID>","action":"lock","expectedVersion":<TEST_PLAN_VERSION_2>}'
```

Expected result:

- HTTP status is `200`
- response JSON contains `plan.stage = "complete"`
- response JSON contains `plan.lifecycle = "locked"`
- response JSON contains `plan.locked = true`
- response JSON contains `plan.onboarding_completed = true`

Record:

- `<TEST_PLAN_VERSION_3>` = `response.plan.plan_version`

### TEST-0.6: Verify progress and plans surfaces match the same authority model

Send:

```bash
curl -s "<BASE_URL>/api/progress?plan_id=<TEST_PLAN_ID>" \
  -H "Cookie: <AUTH_COOKIE>"

curl -s "<BASE_URL>/api/plans" \
  -H "Cookie: <AUTH_COOKIE>"
```

Expected result for `/api/progress`:

- response JSON contains `stage = "complete"`
- response JSON contains `lifecycle = "locked"`
- response JSON contains `interview_progress.readyToLock = true`

Expected result for `/api/plans`:

- the row with `id = <TEST_PLAN_ID>` contains `stage = "complete"`
- the row with `id = <TEST_PLAN_ID>` contains `lifecycle = "locked"`

### TEST-0.7: Restore your original current plan

Send:

```bash
curl -i -X PATCH "<BASE_URL>/api/plans" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d '{"planId":"<ORIGINAL_PLAN_ID>","action":"switch"}'
```

Expected result:

- HTTP status is `200`
- response JSON contains `plan.id = "<ORIGINAL_PLAN_ID>"`

Then verify:

```bash
curl -s "<BASE_URL>/api/profile" \
  -H "Cookie: <AUTH_COOKIE>"
```

Expected result:

- `response.plan.id = "<ORIGINAL_PLAN_ID>"`

## 5. Negative Tests (Failure / Safety)

### NEG-0.1: Unauthorized profile mutation

Send:

```bash
curl -i -X PATCH "<BASE_URL>/api/profile" \
  -H "Content-Type: application/json" \
  -d '{"profileData":{"name":"Unauthorized"},"expectedVersion":1}'
```

Expected result:

- HTTP status is `401`
- no authenticated plan state changes

### NEG-0.2: Missing conflict token

Reuse TEST-0.2.

Expected result:

- HTTP status is `409`
- no state change on `<TEST_PLAN_ID>`

### NEG-0.3: Stale conflict token

After TEST-0.4 succeeds, replay the old version:

```bash
curl -i -X PATCH "<BASE_URL>/api/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d '{"planId":"<TEST_PLAN_ID>","expectedVersion":<TEST_PLAN_VERSION_1>,"profileData":{"monthly_budget":"2600"}}'
```

Expected result:

- HTTP status is `409`
- response JSON contains `currentVersion`
- no corruption of the already-saved ready-to-lock plan

### NEG-0.4: Invalid lock transition on incomplete plan

Reuse TEST-0.3.

Expected result:

- HTTP status is `409`
- `readiness.isReadyForLock = false`
- plan remains unlocked

### NEG-0.5: Locked-plan edit attempt

After TEST-0.5 succeeds, send:

```bash
curl -i -X PATCH "<BASE_URL>/api/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d '{"planId":"<TEST_PLAN_ID>","expectedVersion":<TEST_PLAN_VERSION_3>,"profileData":{"monthly_budget":"2700"}}'
```

Expected result:

- HTTP status is `403`
- locked plan state remains unchanged

### NEG-0.6: Unknown plan id

Send:

```bash
curl -i -X PATCH "<BASE_URL>/api/profile" \
  -H "Content-Type: application/json" \
  -H "Cookie: <AUTH_COOKIE>" \
  -d '{"planId":"00000000-0000-0000-0000-000000000000","expectedVersion":1,"profileData":{"name":"Missing"}}'
```

Expected result:

- HTTP status is `404`
- no state change to any owned plan

## 6. Time-to-Reproduce Rule

Each critical Phase 0 flow must be reproducible in 5 minutes or less:

- create test plan
- reject missing version
- complete profile
- lock ready plan
- verify progress/plans authority
- restore original current plan

If any critical flow takes more than 5 minutes following this document exactly, the result is:

**FAIL — Test Spec Invalid**

## 7. Pass/Fail Criteria

Phase 0 user acceptance passes only if:

- TEST-0.1 through TEST-0.7 all pass exactly as written
- NEG-0.1 through NEG-0.6 all fail safely with the expected statuses
- the original current plan is restored at the end
- no response surfaces contradictory state such as:
  - unlocked incomplete plan with `stage = "complete"`
  - locked plan with `lifecycle = "collecting"`
  - accepted profile write without `expectedVersion`

Phase 0 user acceptance fails if any expected status, field, or restoration step does not match.

## 8. Bug Reporting Template

Use this exact template for any failure:

```md
## Phase 0 User Bug

- Step: TEST-0.X or NEG-0.X
- Date: YYYY-MM-DD
- Base URL: http://localhost:3000
- Input used:
- Expected result:
- Actual result:
- Response status:
- Response body:
- Did state change unexpectedly?: yes / no
- Notes:
```
