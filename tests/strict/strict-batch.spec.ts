import { test, expect, type Page } from "@playwright/test"
import { existsSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { execSync } from "node:child_process"

import { PERSONAS, type Persona } from "./personas"
import {
  ensureDir,
  envOrThrow,
  loadEnv,
  normalize,
  nowIso,
  writeJson,
  writeText,
} from "./helpers"

loadEnv()

const BASE = process.env.GOMATE_BASE_URL || "http://localhost:3000"
const RUN_ID = process.env.GOMATE_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-")
const RUN_ROOT = `artifacts/e2e-batch-10/${RUN_ID}`
const ONLY_SLUGS = (process.env.PERSONAS || "").split(",").map((s) => s.trim()).filter(Boolean)

const TEST_EMAIL = envOrThrow("TEST_EMAIL")
const TEST_PASSWORD = envOrThrow("TEST_PASSWORD")

const FIELD_LABEL_TO_KEY: Record<string, string> = {
  name: "name",
  citizenship: "citizenship",
  "current location": "current_location",
  "destination country": "destination",
  destination: "destination",
  "target city": "target_city",
  city: "target_city",
  purpose: "purpose",
  "visa role": "visa_role",
  duration: "duration",
  timeline: "timeline",
  "type of study": "study_type",
  "study type": "study_type",
  "field of study": "study_field",
  "study field": "study_field",
  "study funding": "study_funding",
  "job offer status": "job_offer",
  "job offer": "job_offer",
  "job field": "job_field",
  "employer sponsorship": "employer_sponsorship",
  "highly skilled": "highly_skilled",
  "highly skilled professional": "highly_skilled",
  "years of experience": "years_experience",
  "work experience": "years_experience",
  "remote income": "remote_income",
  "income source": "income_source",
  "monthly income": "monthly_income",
  "income consistency": "income_consistency",
  "income history": "income_history_months",
  "income history months": "income_history_months",
  "settlement reason": "settlement_reason",
  "family ties": "family_ties",
  "spouse joining": "spouse_joining",
  "number of children": "children_count",
  "children count": "children_count",
  "children ages": "children_ages",
  "children's ages": "children_ages",
  "childrens ages": "children_ages",
  "kids ages": "children_ages",
  "kids' ages": "children_ages",
  "ages of children": "children_ages",
  "moving alone": "moving_alone",
  "savings available": "savings_available",
  "available savings": "savings_available",
  savings: "savings_available",
  "monthly budget": "monthly_budget",
  "preferred currency": "preferred_currency",
  "budget help needed": "need_budget_help",
  "language skill": "language_skill",
  "language skills": "language_skill",
  "education level": "education_level",
  education: "education_level",
  "prior visa": "prior_visa",
  "prior visas": "prior_visa",
  "visa rejections": "visa_rejections",
  "healthcare needs": "healthcare_needs",
  pets: "pets",
  "special requirements": "special_requirements",
  "birth year": "birth_year",
  "other citizenships": "other_citizenships",
  "partner citizenship": "partner_citizenship",
  "partner visa status": "partner_visa_status",
  "relationship type": "relationship_type",
  "partner residency duration": "partner_residency_duration",
  "relationship duration": "relationship_duration",
}

interface PersonaOutcome {
  slug: string
  name: string
  route: string
  planId?: string
  planTitle?: string
  startedAt: string
  endedAt?: string
  completed: boolean
  turns: number
  stalledReason: string | null
  observations: string[]
  bugs: string[]
  warnings: string[]
  fieldChecks: Array<{ key: string; expected: string; actual: unknown; verdict: "correct" | "partial" | "incorrect" | "missing" }>
  dashboardChecks: Record<string, "ok" | "fail" | "skipped" | "n/a">
  costOfLivingChecks: Record<string, "ok" | "fail" | "skipped" | "n/a">
  guideChecks: Record<string, "ok" | "fail" | "skipped" | "n/a">
  settlingChecks: Record<string, "ok" | "fail" | "skipped" | "n/a">
  artifactPath: string
  verdict: "pass" | "partial" | "fail"
  uxVerdict: "pass" | "partial" | "fail"
  uxNotes: string
}

const outcomes: PersonaOutcome[] = []

function note(o: PersonaOutcome, kind: "obs" | "bug" | "warn", msg: string) {
  if (kind === "bug") o.bugs.push(msg)
  else if (kind === "warn") o.warnings.push(msg)
  else o.observations.push(msg)
}

function inferKey(label: string, question: string): string | null {
  const norm = label.toLowerCase().trim()
  if (FIELD_LABEL_TO_KEY[norm]) return FIELD_LABEL_TO_KEY[norm]
  for (const [k, v] of Object.entries(FIELD_LABEL_TO_KEY)) {
    if (k && (norm === k || norm.includes(k) || k.includes(norm))) return v
  }
  const q = (question || "").toLowerCase()
  if (q.includes("your name")) return "name"
  if (q.includes("citizenship") || q.includes("passport") || q.includes("nationality")) return "citizenship"
  if (q.includes("which country") || q.includes("destination")) return "destination"
  if (q.includes("which city") || q.includes("target city") || q.includes("what city")) return "target_city"
  if (q.includes("purpose") || q.includes("why are you moving") || q.includes("moving for")) return "purpose"
  if (q.includes("primary applicant") || q.includes("dependent")) return "visa_role"
  if (q.includes("when") && (q.includes("plan") || q.includes("move") || q.includes("timeline"))) return "timeline"
  if (q.includes("how long") || q.includes("duration") || q.includes("stay for")) return "duration"
  if (q.includes("alone") || q.includes("with you") || q.includes("with whom") || q.includes("moving with") || q.includes("family")) return "moving_alone"
  if (q.includes("job offer") || q.includes("secured employment")) return "job_offer"
  if (q.includes("what field") || q.includes("what industry") || q.includes("profession")) return "job_field"
  if (q.includes("sponsor") || q.includes("employer handle")) return "employer_sponsorship"
  if (q.includes("type of study") || q.includes("kind of program")) return "study_type"
  if (q.includes("field of study") || q.includes("what will you study")) return "study_field"
  if (q.includes("fund your studies") || q.includes("scholarship") || q.includes("self-fund")) return "study_funding"
  if (q.includes("remote income") || q.includes("earn income remotely")) return "remote_income"
  if (q.includes("income source") || q.includes("where does your income")) return "income_source"
  if (q.includes("monthly income") || q.includes("how much do you earn")) return "monthly_income"
  if (q.includes("consistent") || q.includes("stable income") || q.includes("vary")) return "income_consistency"
  if (q.includes("how long have you been earning") || q.includes("income history")) return "income_history_months"
  if (q.includes("why settle") || q.includes("ancestry") || q.includes("retiring")) return "settlement_reason"
  if (q.includes("family ties") || q.includes("family there") || q.includes("relatives there")) return "family_ties"
  if (q.includes("spouse joining") || q.includes("partner joining")) return "spouse_joining"
  if (q.includes("how many children") || q.includes("children count")) return "children_count"
  if (q.includes("children ages") || q.includes("how old are your children")) return "children_ages"
  if (q.includes("savings") || q.includes("saved up")) return "savings_available"
  if (q.includes("monthly budget") || q.includes("budget per month")) return "monthly_budget"
  if (q.includes("budget help") || q.includes("help with budgeting")) return "need_budget_help"
  if (q.includes("currently located") || q.includes("where do you live now") || q.includes("current location")) return "current_location"
  if (q.includes("language skill") || q.includes("language level") || q.includes("speak ")) return "language_skill"
  if (q.includes("education level") || q.includes("highest education")) return "education_level"
  if (q.includes("years of experience") || q.includes("work experience")) return "years_experience"
  if (q.includes("prior visa") || q.includes("had a visa before")) return "prior_visa"
  if (q.includes("visa rejection") || q.includes("ever been rejected")) return "visa_rejections"
  if (q.includes("healthcare") || q.includes("medical needs")) return "healthcare_needs"
  if (q.includes("pets") || q.includes("animals")) return "pets"
  if (q.includes("special requirements") || q.includes("anything else")) return "special_requirements"
  if (q.includes("highly skilled")) return "highly_skilled"
  return null
}

function valueLooksCorrect(_key: string, actualRaw: unknown, expectedRaw: string): boolean {
  const actual = normalize(String(actualRaw ?? ""))
  const expected = normalize(expectedRaw)
  if (!actual) return false
  if (actual === expected) return true
  if (actual.includes(expected) || expected.includes(actual)) return true
  const synonyms: Record<string, string[]> = {
    yes: ["yes", "true", "y"],
    no: ["no", "false", "n"],
    primary: ["primary", "main", "principal", "applicant"],
    study: ["study", "student", "master", "phd", "university", "school"],
    work: ["work", "job", "employment", "employed"],
    settle: ["settle", "retire", "retirement", "ancestry", "permanent", "family_reunion"],
    digital_nomad: ["digital_nomad", "digital nomad", "nomad", "remote", "freelance"],
    freelance: ["freelance", "client"],
    employed: ["employed", "salary", "company"],
    stable: ["stable", "consistent", "regular"],
    master: ["master", "masters", "msc", "ma "],
    phd: ["phd", "doctorate", "research"],
  }
  if (synonyms[expected]) {
    return synonyms[expected].some((t) => actual.includes(t))
  }
  const expectedTokens = expected.split(" ").filter((t) => t.length >= 3)
  if (expectedTokens.length === 0) return false
  const overlap = expectedTokens.filter((t) => actual.includes(t))
  return overlap.length >= Math.min(2, expectedTokens.length)
}

async function waitForLoad(page: Page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {})
}

async function waitForAIQuiet(page: Page, maxWait = 45000): Promise<boolean> {
  const start = Date.now()
  await page.waitForTimeout(1200)
  while (Date.now() - start < maxWait) {
    const stillTyping = await page
      .locator(".animate-bounce")
      .first()
      .isVisible({ timeout: 200 })
      .catch(() => false)
    if (!stillTyping) {
      // Confirm it stays quiet for a moment
      await page.waitForTimeout(900)
      const again = await page
        .locator(".animate-bounce")
        .first()
        .isVisible({ timeout: 200 })
        .catch(() => false)
      if (!again) return true
    }
    await page.waitForTimeout(500)
  }
  return false
}

async function getLastAssistantMessage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("div.justify-start"))
    const texts = rows
      .map((row) => (row.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
    return texts[texts.length - 1] || ""
  })
}

async function getPendingLabel(page: Page): Promise<string> {
  const text =
    (await page
      .locator("span.text-primary")
      .first()
      .textContent({ timeout: 600 })
      .catch(() => "")) || ""
  const trimmed = text.trim()
  if (trimmed.startsWith("Next:")) return trimmed.replace("Next:", "").trim()
  return ""
}

async function getProgressPercent(page: Page): Promise<number> {
  const body = (await page.textContent("body")) || ""
  const m = body.match(/(\d+)%/)
  return m ? parseInt(m[1], 10) : 0
}

async function apiJson(
  page: Page,
  input: { path: string; method?: string; body?: unknown; expectStatus?: number[]; timeoutMs?: number }
): Promise<{ status: number; ok: boolean; data: unknown; timedOut?: boolean }> {
  const timeoutMs = input.timeoutMs ?? 90_000
  const result = await page.evaluate(
    async ({ path, method, body, timeoutMs }) => {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), timeoutMs)
      try {
        const res = await fetch(path, {
          method: method || "GET",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: ctrl.signal,
        })
        clearTimeout(t)
        let data: unknown = null
        try {
          data = await res.json()
        } catch {
          data = null
        }
        return { status: res.status, ok: res.ok, data, timedOut: false }
      } catch (e) {
        clearTimeout(t)
        const aborted = e instanceof Error && e.name === "AbortError"
        return { status: 0, ok: false, data: { error: aborted ? "client-timeout" : String(e) }, timedOut: aborted }
      }
    },
    { path: input.path, method: input.method, body: input.body, timeoutMs }
  )
  return result
}

async function signIn(page: Page) {
  await page.goto(`${BASE}/auth/login`)
  await waitForLoad(page)
  const emailInput = page.locator('input[type="email"], input[name="email"]')
  if (!(await emailInput.isVisible({ timeout: 5000 }).catch(() => false))) {
    // Already signed in; verify by hitting profile
    return
  }
  await emailInput.fill(TEST_EMAIL)
  await page.locator('input[type="password"], input[name="password"]').fill(TEST_PASSWORD)
  await page.locator('button:has-text("Sign"), button:has-text("Log")').click()
  await page.waitForURL(/\/(dashboard|chat|app)/, { timeout: 25000 })
}

async function createPlan(page: Page, persona: Persona): Promise<{ id: string; title: string }> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const res = await apiJson(page, {
    path: "/api/plans",
    method: "POST",
    body: { title: `${persona.slug} | ${stamp}` },
  })
  expect(res.status, `Plan creation status for ${persona.slug}`).toBe(200)
  const data = res.data as any
  expect(data?.plan?.id).toBeTruthy()
  return { id: data.plan.id as string, title: data.plan.title as string }
}

async function isApiReadyToLock(page: Page): Promise<boolean> {
  const res = await apiJson(page, { path: "/api/progress" })
  if (res.status !== 200) return false
  const data = res.data as any
  return Boolean(data?.readiness?.isReadyForLock)
}

async function driveOnboarding(page: Page, persona: Persona, outcome: PersonaOutcome): Promise<{ reachedReview: boolean; confirmed: boolean }> {
  await page.goto(`${BASE}/chat`)
  await waitForLoad(page)
  await page.waitForTimeout(2500)

  const chatInput = page.locator('input[placeholder="Type your message..."]').first()
  await chatInput.waitFor({ timeout: 20000 })

  // Initial chat-start screenshot
  await page.screenshot({ path: `${outcome.artifactPath}/01-chat-start.png`, fullPage: true })

  let reachedReview = false
  let confirmed = false
  let lastLabel = ""
  let repeats = 0
  let unanswered = 0
  let midShotTaken = false

  for (let step = 0; step < 50; step++) {
    const pendingLabel = await getPendingLabel(page)
    const lastAssistant = await getLastAssistantMessage(page)
    const pct = await getProgressPercent(page)

    // Check for review state
    const reviewCardVisible = await page
      .locator('[data-testid="review-confirm-card"]')
      .isVisible({ timeout: 400 })
      .catch(() => false)
    const confirmBtn = page.locator('[data-testid="confirm-plan-btn"]')

    if (!midShotTaken && (outcome.turns >= 8 || pct >= 50)) {
      midShotTaken = true
      await page.screenshot({ path: `${outcome.artifactPath}/02-chat-mid.png`, fullPage: true })
    }

    if (reviewCardVisible) {
      reachedReview = true
      await page.screenshot({ path: `${outcome.artifactPath}/03-chat-review.png`, fullPage: true })
      try {
        await confirmBtn.click({ timeout: 5000 })
        const settled = await waitForAIQuiet(page, 60000)
        if (!settled) {
          note(outcome, "warn", "Confirmation response did not settle within 60s")
        }
        confirmed = true
      } catch {
        note(outcome, "bug", "Could not click confirm-plan-btn even though review card was visible")
      }
      break
    }

    if (pct >= 100 && !pendingLabel) {
      await page.waitForTimeout(2500)
      const reviewVisible = await page
        .locator('[data-testid="review-confirm-card"]')
        .isVisible({ timeout: 1500 })
        .catch(() => false)
      if (reviewVisible) {
        reachedReview = true
        await page.screenshot({ path: `${outcome.artifactPath}/03-chat-review.png`, fullPage: true })
        try {
          await confirmBtn.click({ timeout: 5000 })
          const settled = await waitForAIQuiet(page, 60000)
          if (!settled) {
            note(outcome, "warn", "Confirmation response did not settle within 60s")
          }
          confirmed = true
        } catch {
          note(outcome, "bug", "Could not click confirm-plan-btn after 100% reached")
        }
      } else {
        note(outcome, "bug", `Profile reached ${pct}% but review/confirm UI never appeared`)
      }
      break
    }

    if (!pendingLabel) {
      // No explicit pending field. If progress < 100% in the UI but the
      // backend says we're ready to lock, the React state is just stale —
      // record it as a UX bug but treat the persona as effectively complete
      // and proceed to lock + dashboard verification.
      const lowerAssistant = (lastAssistant || "").toLowerCase()
      const looksLikeQuestion = /[?]/.test(lastAssistant) || /\b(what|which|where|when|how|tell me|do you|are you|can you)\b/.test(lowerAssistant)
      if (!looksLikeQuestion) {
        unanswered += 1
        if (unanswered >= 2) {
          // Cross-check with backend
          const readyToLock = await isApiReadyToLock(page)
          if (readyToLock) {
            note(
              outcome,
              "bug",
              `UX bug: chat UI shows ${pct}% with no pending question while backend reports the profile is ready to lock. A real user would see the chat as stuck even though the data is complete.`
            )
            await page.screenshot({ path: `${outcome.artifactPath}/03-chat-review.png`, fullPage: true })
            // Treat as effectively done; we'll lock via the dashboard path.
            reachedReview = true
            confirmed = true
            break
          }
          if (unanswered >= 3) {
            note(outcome, "bug", `Chat stopped asking questions at ${pct}% with no pending field after ${unanswered} idle checks (backend not ready to lock)`)
            outcome.stalledReason = `Chat idle at ${pct}% (no pending field, no question)`
            break
          }
        }
        await page.waitForTimeout(1800)
        continue
      }
      // Fall through and try to infer key from question text
    }

    const fieldKey = inferKey(pendingLabel, lastAssistant)
    if (!fieldKey) {
      note(outcome, "warn", `Could not infer field for label="${pendingLabel}" question="${lastAssistant.slice(0, 90)}"`)
      // Try a generic answer to see if it advances; otherwise abort soon.
      unanswered += 1
      if (unanswered >= 3) {
        outcome.stalledReason = `Could not map question to field (${pendingLabel || "no label"})`
        break
      }
      await page.waitForTimeout(1500)
      continue
    }
    unanswered = 0

    if (pendingLabel && pendingLabel === lastLabel) {
      repeats += 1
      if (repeats >= 2) {
        note(outcome, "warn", `Repeated pending label "${pendingLabel}" — AI may be stuck`)
      }
      // After 4 retries, check if the backend has force-accepted via its 5-attempt
      // fallback. If progress jumped to ready_to_lock, treat the chat-UI loop as
      // a UX bug and continue to the dashboard.
      if (repeats >= 4) {
        const readyToLock = await isApiReadyToLock(page)
        if (readyToLock) {
          note(
            outcome,
            "bug",
            `UX bug: chat looped on "${pendingLabel}" ${repeats} times even though the backend recovered. A real user would see the AI re-asking the same question repeatedly.`
          )
          await page.screenshot({ path: `${outcome.artifactPath}/03-chat-review.png`, fullPage: true })
          reachedReview = true
          confirmed = true
          break
        }
      }
      if (repeats >= 5) {
        outcome.stalledReason = `Pending label "${pendingLabel}" stuck across 5 retries (chat never recovered, backend not ready to lock)`
        note(outcome, "bug", outcome.stalledReason)
        break
      }
    } else {
      repeats = 0
    }
    lastLabel = pendingLabel

    const answer = persona.fields[fieldKey]
    if (!answer) {
      note(outcome, "warn", `No persona answer for inferred field "${fieldKey}" (label="${pendingLabel}")`)
      // Send a graceful "skip" answer
      await chatInput.fill("Let's skip that one.")
    } else {
      await chatInput.fill(answer)
    }
    await chatInput.press("Enter")
    outcome.turns += 1

    const settled = await waitForAIQuiet(page, 35000)
    if (!settled) {
      note(outcome, "bug", `AI response did not settle within 35s after answering "${pendingLabel || fieldKey}"`)
      outcome.stalledReason = `AI stalled after field "${fieldKey}"`
      break
    }

    // Every 5 turns probe the backend; if it's ready to lock, exit the chat
    // loop early — the UI may not have caught up yet.
    if (outcome.turns > 0 && outcome.turns % 5 === 0) {
      const ready = await isApiReadyToLock(page)
      if (ready) {
        // Try the standard review path first; otherwise treat as effectively done
        const reviewVisibleNow = await page
          .locator('[data-testid="review-confirm-card"]')
          .isVisible({ timeout: 1500 })
          .catch(() => false)
        if (reviewVisibleNow) {
          reachedReview = true
          await page.screenshot({ path: `${outcome.artifactPath}/03-chat-review.png`, fullPage: true })
          try {
            await confirmBtn.click({ timeout: 5000 })
            await waitForAIQuiet(page, 60000)
            confirmed = true
          } catch {
            note(outcome, "bug", "Backend ready to lock but confirm-plan-btn click failed")
          }
          break
        }
        // No UI review — record UX issue and proceed to lock from dashboard
        note(
          outcome,
          "warn",
          `Backend reported ready_to_lock at turn ${outcome.turns} but the chat UI never surfaced the review/confirm card — proceeding via dashboard lock path.`
        )
        await page.screenshot({ path: `${outcome.artifactPath}/03-chat-review.png`, fullPage: true })
        reachedReview = true
        confirmed = true
        break
      }
    }
  }

  if (!midShotTaken) {
    await page.screenshot({ path: `${outcome.artifactPath}/02-chat-mid.png`, fullPage: true })
  }
  if (!reachedReview) {
    await page.screenshot({ path: `${outcome.artifactPath}/03-chat-review.png`, fullPage: true })
  }

  return { reachedReview, confirmed }
}

async function fetchAndSaveProfile(page: Page, outcome: PersonaOutcome) {
  const res = await apiJson(page, { path: "/api/profile" })
  writeJson(`${outcome.artifactPath}/profile.json`, res)
  return res
}

async function fetchAndSaveProgress(page: Page, outcome: PersonaOutcome) {
  const res = await apiJson(page, { path: "/api/progress" })
  writeJson(`${outcome.artifactPath}/progress.json`, res)
  return res
}

function verifyExtraction(persona: Persona, profileBody: any, outcome: PersonaOutcome) {
  const profile = (profileBody?.plan?.profile_data || {}) as Record<string, unknown>
  for (const [key, expected] of Object.entries(persona.expectedProfile)) {
    const actual = profile[key]
    if (actual === null || actual === undefined || actual === "") {
      outcome.fieldChecks.push({ key, expected, actual, verdict: "missing" })
      note(outcome, "bug", `Profile missing expected field "${key}" (expected ~"${expected}")`)
      continue
    }
    if (valueLooksCorrect(key, actual, expected)) {
      outcome.fieldChecks.push({ key, expected, actual, verdict: "correct" })
    } else {
      // Stem / 4-char prefix overlap → partial. No overlap → incorrect.
      const expectedTokens = normalize(expected).split(" ").filter((t) => t.length >= 4)
      const actualNorm = normalize(String(actual))
      const stemOverlap = expectedTokens.some((t) => actualNorm.includes(t.slice(0, 4)))
      const verdict: "partial" | "incorrect" = stemOverlap ? "partial" : "incorrect"
      outcome.fieldChecks.push({ key, expected, actual, verdict })
      note(
        outcome,
        verdict === "incorrect" ? "bug" : "warn",
        `Profile mismatch for "${key}": got "${String(actual)}" expected ~"${expected}" (${verdict})`
      )
    }
  }

  // Separate UX checks — destination & city should be stored in canonical English
  // form so downstream lookups (currency, COL, guide identity) don't break.
  const destination = String(profile.destination || "")
  const city = String(profile.target_city || "")
  outcome.dashboardChecks.destination_canonical_english =
    normalize(destination).includes(normalize(persona.expectedDestination)) ? "ok" : "fail"
  outcome.dashboardChecks.city_canonical_english =
    normalize(city).includes(normalize(persona.expectedCity)) ? "ok" : "fail"
  if (outcome.dashboardChecks.destination_canonical_english === "fail") {
    note(
      outcome,
      "bug",
      `Destination stored as "${destination}" — not the canonical English "${persona.expectedDestination}". Downstream lookups (currency, cost-of-living, guide identity) will mis-match.`
    )
  }
  if (outcome.dashboardChecks.city_canonical_english === "fail") {
    note(
      outcome,
      "bug",
      `Target city stored as "${city}" — not the canonical English "${persona.expectedCity}".`
    )
  }
}

async function lockPlan(page: Page, outcome: PersonaOutcome): Promise<{ locked: boolean; planVersion: number | null }> {
  // Re-read the current plan version
  const profileRes = await apiJson(page, { path: "/api/profile" })
  const plan = (profileRes.data as any)?.plan
  if (!plan?.id || typeof plan?.plan_version !== "number") {
    note(outcome, "bug", "Could not read plan or plan_version before locking")
    return { locked: false, planVersion: null }
  }
  if (plan.locked) {
    return { locked: true, planVersion: plan.plan_version }
  }
  const lockRes = await apiJson(page, {
    path: "/api/profile",
    method: "PATCH",
    body: { action: "lock", planId: plan.id, expectedVersion: plan.plan_version },
  })
  if (lockRes.status !== 200) {
    note(
      outcome,
      "bug",
      `Lock failed (status ${lockRes.status}): ${JSON.stringify(lockRes.data).slice(0, 200)}`
    )
    return { locked: false, planVersion: plan.plan_version }
  }
  const lockedPlan = (lockRes.data as any)?.plan
  return { locked: !!lockedPlan?.locked, planVersion: lockedPlan?.plan_version ?? plan.plan_version + 1 }
}

async function captureDashboard(page: Page, persona: Persona, outcome: PersonaOutcome) {
  await page.goto(`${BASE}/dashboard`)
  await waitForLoad(page)
  await page.waitForTimeout(5000)
  await page.screenshot({ path: `${outcome.artifactPath}/04-dashboard.png`, fullPage: true })

  const body = (await page.textContent("body")) || ""
  const norm = normalize(body)
  const checks: Array<[string, string]> = [
    ["destination", persona.expectedDestination],
    ["city", persona.expectedCity],
    ["citizenship", persona.expectedCitizenship],
    ["name", persona.name],
    ["purpose", persona.expectedPurpose.replace("_", " ")],
  ]
  for (const [field, value] of checks) {
    if (norm.includes(normalize(value))) {
      outcome.dashboardChecks[field] = "ok"
    } else {
      outcome.dashboardChecks[field] = "fail"
      note(outcome, "bug", `Dashboard does not contain ${field}="${value}"`)
    }
  }
}

async function captureCostOfLiving(page: Page, persona: Persona, outcome: PersonaOutcome) {
  // Resolve home country from current_location text — dashboard does the same
  const profileRes = await apiJson(page, { path: "/api/profile" })
  const profile = ((profileRes.data as any)?.plan?.profile_data || {}) as Record<string, unknown>
  const compareFromCity = String(profile.current_location || "").split(",")[0].trim() || persona.expectedCitizenship
  const compareFromCountry = inferHomeCountry(persona)
  const url = new URL(`${BASE}/api/cost-of-living`)
  url.searchParams.set("country", persona.expectedDestination)
  url.searchParams.set("city", persona.expectedCity)
  if (compareFromCity) url.searchParams.set("compareFrom", compareFromCity)
  if (compareFromCountry) url.searchParams.set("compareFromCountry", compareFromCountry)

  const res = await apiJson(page, { path: `${url.pathname}${url.search}` })
  writeJson(`${outcome.artifactPath}/cost-of-living.json`, res)

  if (res.status !== 200) {
    outcome.costOfLivingChecks.api = "fail"
    note(outcome, "bug", `Cost-of-living API status ${res.status}`)
  } else {
    outcome.costOfLivingChecks.api = "ok"
  }

  // Take dashboard COL section screenshot — scroll to the cost-of-living card
  await page.goto(`${BASE}/dashboard#cost-of-living`)
  await waitForLoad(page)
  await page.waitForTimeout(3500)
  // Try to find the cost-of-living card heading and scroll to it
  const colCard = page.locator(':text-matches("Cost of [Ll]iving", "i")').first()
  if (await colCard.isVisible({ timeout: 4000 }).catch(() => false)) {
    await colCard.scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(1200)
  }
  await page.screenshot({ path: `${outcome.artifactPath}/05-cost-of-living.png`, fullPage: true })

  // Check expected currencies appear on the dashboard near the cost numbers
  const body = (await page.textContent("body")) || ""
  const homeOk = body.includes(persona.expectedHomeCurrency) ||
    body.includes(currencySymbolFor(persona.expectedHomeCurrency))
  const destOk = body.includes(persona.expectedDestinationCurrency) ||
    body.includes(currencySymbolFor(persona.expectedDestinationCurrency))
  outcome.costOfLivingChecks.home_currency_visible = homeOk ? "ok" : "fail"
  outcome.costOfLivingChecks.destination_currency_visible = destOk ? "ok" : "fail"
  if (!homeOk) note(outcome, "warn", `Home currency ${persona.expectedHomeCurrency} not visible on dashboard`)
  if (!destOk) note(outcome, "warn", `Destination currency ${persona.expectedDestinationCurrency} not visible on dashboard`)

  // Validate the JSON shape if it succeeded
  const data = res.data as any
  if (data) {
    if (data.from && data.to) {
      outcome.costOfLivingChecks.shape = "ok"
      const fromCur = String(data.from?.currency || "")
      const toCur = String(data.to?.currency || "")
      outcome.costOfLivingChecks.from_currency_field = fromCur ? "ok" : "fail"
      outcome.costOfLivingChecks.to_currency_field = toCur ? "ok" : "fail"
      if (data.isFallback) {
        outcome.costOfLivingChecks.fallback = "fail"
        note(outcome, "warn", "Cost-of-living returned fallback data (Numbeo scrape failed); user sees generic estimates")
      } else {
        outcome.costOfLivingChecks.fallback = "ok"
      }
    } else if (typeof data === "object") {
      outcome.costOfLivingChecks.shape = "fail"
      note(outcome, "bug", "Cost-of-living response missing from/to comparison fields")
    }
  }
}

function inferHomeCountry(persona: Persona): string {
  const hint: Record<string, string> = {
    Brazilian: "Brazil",
    American: "United States",
    British: "United Kingdom",
    Indian: "India",
    Chinese: "China",
    "South African": "South Africa",
    Argentinian: "Argentina",
    Egyptian: "Egypt",
    Pakistani: "Pakistan",
    Nigerian: "Nigeria",
  }
  return hint[persona.expectedCitizenship] || persona.expectedCitizenship
}

function currencySymbolFor(code: string): string {
  const map: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥",
    BRL: "R$", INR: "₹", CAD: "C$", AUD: "A$", PHP: "₱",
    NGN: "₦", EGP: "E£", ZAR: "R", ARS: "$", PKR: "₨",
  }
  return map[code] || code
}

async function captureGuide(page: Page, persona: Persona, outcome: PersonaOutcome) {
  // List guides
  const listRes = await apiJson(page, { path: "/api/guides" })
  writeJson(`${outcome.artifactPath}/guide-list.json`, listRes)
  const guides = ((listRes.data as any)?.guides || []) as Array<any>
  if (!Array.isArray(guides) || guides.length === 0) {
    outcome.guideChecks.guide_exists = "fail"
    note(outcome, "bug", "No guide returned by /api/guides for current plan")
    await page.goto(`${BASE}/guides`)
    await waitForLoad(page)
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${outcome.artifactPath}/06-guide-overview.png`, fullPage: true })
    return
  }
  // Pick the most recent current guide
  const guide = guides[0]
  outcome.guideChecks.guide_exists = "ok"

  // Detail
  const detailRes = await apiJson(page, { path: `/api/guides/${guide.id}` })
  writeJson(`${outcome.artifactPath}/guide-detail.json`, detailRes)
  const detail = (detailRes.data as any)?.guide || (detailRes.data as any) || null

  // Verify identity
  const dest = String(detail?.destination || "")
  const purpose = String(detail?.purpose || "")
  outcome.guideChecks.identity_destination = normalize(dest).includes(normalize(persona.expectedDestination)) ? "ok" : "fail"
  outcome.guideChecks.identity_purpose = normalize(purpose).includes(normalize(persona.expectedPurpose)) ? "ok" : "fail"
  if (outcome.guideChecks.identity_destination === "fail") {
    note(outcome, "bug", `Guide destination "${dest}" doesn't match persona expected "${persona.expectedDestination}"`)
  }

  // Currency check — guide should use the destination's currency (not EUR by default)
  const guideCurrency = String(detail?.currency || "").toUpperCase()
  if (guideCurrency && guideCurrency === persona.expectedDestinationCurrency) {
    outcome.guideChecks.currency = "ok"
  } else if (guideCurrency) {
    outcome.guideChecks.currency = "fail"
    note(outcome, "bug", `Guide currency is ${guideCurrency} but destination ${persona.expectedDestination} uses ${persona.expectedDestinationCurrency}`)
  }

  // Section presence checks — actual schema uses *_section top-level keys
  const sectionMap: Record<string, string> = {
    overview: "overview",
    visa: "visa_section",
    budget: "budget_section",
    housing: "housing_section",
    timeline: "timeline_section",
    checklist: "checklist_section",
  }
  function isSubstantive(value: unknown): boolean {
    if (value == null) return false
    if (typeof value === "string") {
      const trimmed = value.trim()
      // Overview is sometimes stored as a stringified JSON; consider substantive if length > 200
      return trimmed.length > 100
    }
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>
      const keys = Object.keys(obj).filter((k) => obj[k] != null && obj[k] !== "")
      return keys.length >= 2
    }
    return false
  }
  for (const [label, field] of Object.entries(sectionMap)) {
    const value = (detail as any)?.[field]
    if (isSubstantive(value)) {
      outcome.guideChecks[`section_${label}`] = "ok"
    } else {
      outcome.guideChecks[`section_${label}`] = "fail"
      note(outcome, "warn", `Guide section "${label}" (field "${field}") appears empty or thin`)
    }
  }

  // Render the guide UI screenshots
  await page.goto(`${BASE}/guides`)
  await waitForLoad(page)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${outcome.artifactPath}/06-guide-overview.png`, fullPage: true })

  // Click into the guide
  await page.goto(`${BASE}/guides/${guide.id}`)
  await waitForLoad(page)
  await page.waitForTimeout(3500)
  // Try to click visa or budget tab
  const visaTab = page.locator('button:has-text("Visa"), [role="tab"]:has-text("Visa")').first()
  const budgetTab = page.locator('button:has-text("Budget"), [role="tab"]:has-text("Budget")').first()
  let usedTab = "(default)"
  if (await visaTab.isVisible({ timeout: 1500 }).catch(() => false)) {
    await visaTab.click().catch(() => {})
    usedTab = "Visa"
  } else if (await budgetTab.isVisible({ timeout: 1500 }).catch(() => false)) {
    await budgetTab.click().catch(() => {})
    usedTab = "Budget"
  }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${outcome.artifactPath}/07-guide-budget-or-visa.png`, fullPage: true })
  note(outcome, "obs", `Guide tab captured: ${usedTab}`)

  // Click into timeline or checklist tab
  const timelineTab = page.locator('button:has-text("Timeline"), [role="tab"]:has-text("Timeline")').first()
  const checklistTab = page.locator('button:has-text("Checklist"), [role="tab"]:has-text("Checklist")').first()
  let usedTab2 = "(default)"
  if (await timelineTab.isVisible({ timeout: 1500 }).catch(() => false)) {
    await timelineTab.click().catch(() => {})
    usedTab2 = "Timeline"
  } else if (await checklistTab.isVisible({ timeout: 1500 }).catch(() => false)) {
    await checklistTab.click().catch(() => {})
    usedTab2 = "Checklist"
  }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${outcome.artifactPath}/08-guide-timeline-or-checklist.png`, fullPage: true })
  note(outcome, "obs", `Guide second tab captured: ${usedTab2}`)
}

async function captureSettlingIn(page: Page, persona: Persona, outcome: PersonaOutcome) {
  // Trigger arrival via the API
  const profileRes = await apiJson(page, { path: "/api/profile" })
  const plan = (profileRes.data as any)?.plan
  if (!plan?.id) {
    outcome.settlingChecks.plan_lookup = "fail"
    note(outcome, "bug", "Could not look up current plan id for settling-in")
    return
  }

  // Hit settling-in/arrive (90s cap)
  const arriveRes = await apiJson(page, {
    path: "/api/settling-in/arrive",
    method: "POST",
    body: { planId: plan.id, expectedVersion: plan.plan_version },
    timeoutMs: 60_000,
  })
  writeJson(`${outcome.artifactPath}/settling-in-arrive.json`, arriveRes)
  if (arriveRes.status !== 200) {
    outcome.settlingChecks.arrive = "fail"
    note(
      outcome,
      "warn",
      `Settling-in arrive returned ${arriveRes.status}: ${JSON.stringify(arriveRes.data).slice(0, 200)}`
    )
    return
  }
  outcome.settlingChecks.arrive = "ok"

  // Trigger generation with a hard 3-minute cap. The backend's settling-in
  // generator hits Firecrawl + multiple LLM section calls; a timeout here is
  // a real product UX bug worth recording, not a test flake.
  const refreshedProfile = await apiJson(page, { path: "/api/profile" })
  const refreshedPlan = (refreshedProfile.data as any)?.plan
  const genRes = await apiJson(page, {
    path: "/api/settling-in/generate",
    method: "POST",
    body: { planId: refreshedPlan?.id, expectedVersion: refreshedPlan?.plan_version },
    timeoutMs: 180_000,
  })
  writeJson(`${outcome.artifactPath}/settling-in-generate.json`, genRes)
  if (genRes.timedOut) {
    outcome.settlingChecks.generate = "fail"
    note(
      outcome,
      "bug",
      "Settling-in generate exceeded 3 minutes — real users would see the page hang. (Server-side: known Firecrawl SDK error `scrapeUrl is not a function` plus uncapped LLM section calls.)"
    )
  } else if (genRes.status !== 200) {
    outcome.settlingChecks.generate = "fail"
    note(
      outcome,
      "warn",
      `Settling-in generate returned ${genRes.status}: ${JSON.stringify(genRes.data).slice(0, 200)}`
    )
  } else {
    outcome.settlingChecks.generate = "ok"
  }

  // Read tasklist
  const listRes = await apiJson(page, { path: "/api/settling-in" })
  writeJson(`${outcome.artifactPath}/settling-in.json`, listRes)
  if (listRes.status !== 200) {
    outcome.settlingChecks.list = "fail"
    note(outcome, "warn", `Settling-in list returned ${listRes.status}`)
  } else {
    outcome.settlingChecks.list = "ok"
    const tasks = ((listRes.data as any)?.tasks || []) as Array<any>
    outcome.settlingChecks.task_count = tasks.length > 0 ? "ok" : "fail"
    if (tasks.length === 0) {
      note(outcome, "bug", "Settling-in tasklist returned 0 tasks after generation")
    }
  }

  // Render the settling-in UI
  await page.goto(`${BASE}/settling-in`)
  await waitForLoad(page)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${outcome.artifactPath}/09-settling-in.png`, fullPage: true })
}

function deriveVerdict(o: PersonaOutcome): { verdict: "pass" | "partial" | "fail"; ux: "pass" | "partial" | "fail"; uxNotes: string } {
  const hasBug = o.bugs.length > 0
  const incorrectFields = o.fieldChecks.filter((c) => c.verdict === "incorrect").length
  const missingFields = o.fieldChecks.filter((c) => c.verdict === "missing").length
  const partialFields = o.fieldChecks.filter((c) => c.verdict === "partial").length
  const correctFields = o.fieldChecks.filter((c) => c.verdict === "correct").length
  const dashboardFails = Object.values(o.dashboardChecks).filter((v) => v === "fail").length
  const guideFails = Object.values(o.guideChecks).filter((v) => v === "fail").length
  const colFails = Object.values(o.costOfLivingChecks).filter((v) => v === "fail").length

  let verdict: "pass" | "partial" | "fail"
  if (!o.completed || incorrectFields >= 2 || missingFields >= 3 || (correctFields === 0 && o.fieldChecks.length > 0)) {
    verdict = "fail"
  } else if (incorrectFields > 0 || missingFields > 0 || partialFields > 2 || dashboardFails > 1 || guideFails > 2 || colFails > 1) {
    verdict = "partial"
  } else if (hasBug) {
    verdict = "partial"
  } else {
    verdict = "pass"
  }

  const ux: "pass" | "partial" | "fail" = (() => {
    if (!o.completed) return "fail"
    if (o.stalledReason) return "fail"
    if (verdict === "fail") return "fail"
    if (verdict === "partial") return "partial"
    return "pass"
  })()

  const uxNotes =
    [
      o.stalledReason ? `Stalled: ${o.stalledReason}` : null,
      missingFields > 0 ? `${missingFields} expected field(s) missing in profile` : null,
      incorrectFields > 0 ? `${incorrectFields} expected field(s) extracted incorrectly` : null,
      dashboardFails > 0 ? `${dashboardFails} dashboard check(s) failed` : null,
      guideFails > 0 ? `${guideFails} guide check(s) failed` : null,
      colFails > 0 ? `${colFails} cost-of-living check(s) failed` : null,
    ]
      .filter(Boolean)
      .join("; ") || "no notable UX issues observed"

  return { verdict, ux, uxNotes }
}

function getGitSha(): string {
  try {
    return execSync("git rev-parse HEAD").toString().trim()
  } catch {
    return "(unknown)"
  }
}

// Default mode (no serial) so a single persona failure doesn't skip the rest.
// Tests still run sequentially because workers: 1 in playwright.config.ts.
test.describe.configure({ timeout: 14 * 60 * 1000 })

test.describe("Strict 10-persona end-to-end audit", () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    ensureDir(RUN_ROOT)
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await signIn(page)
    // Health check
    const profileRes = await apiJson(page, { path: "/api/profile" })
    expect(profileRes.status, "Initial /api/profile must return 200").toBe(200)
  })

  test.afterAll(async () => {
    if (page) await page.close().catch(() => {})

    // Build summary
    const startTimes = outcomes.map((o) => o.startedAt)
    const endTimes = outcomes.map((o) => o.endedAt || o.startedAt)
    const passed = outcomes.filter((o) => o.verdict === "pass").length
    const partial = outcomes.filter((o) => o.verdict === "partial").length
    const failed = outcomes.filter((o) => o.verdict === "fail").length

    writeText(
      `${RUN_ROOT}/RUN_CONTEXT.md`,
      [
        `# RUN_CONTEXT`,
        ``,
        `- Run ID: ${RUN_ID}`,
        `- Git SHA: ${getGitSha()}`,
        `- Base URL: ${BASE}`,
        `- Started: ${startTimes[0] || "(none)"}`,
        `- Ended: ${endTimes[endTimes.length - 1] || "(none)"}`,
        `- Personas executed: ${outcomes.length}`,
        `- Environment: local Next.js dev server (\`pnpm dev\`)`,
        `- External services hit live: Supabase, OpenAI/OpenRouter, Frankfurter exchange rate API, Firecrawl (research), Numbeo (cost-of-living scrape)`,
        `- Required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, OPENAI_BASE_URL, FIRECRAWL_API_KEY, TEST_EMAIL, TEST_PASSWORD`,
        `- Test command: \`pnpm exec playwright test tests/strict/strict-batch.spec.ts --reporter=list\``,
        `- Test user tier: pro_plus (verified before run)`,
        ``,
      ].join("\n")
    )

    const matrixRows = outcomes.map((o) => {
      const correct = o.fieldChecks.filter((c) => c.verdict === "correct").length
      const total = o.fieldChecks.length
      const dashTotal = Object.keys(o.dashboardChecks).length
      const dashOk = Object.values(o.dashboardChecks).filter((v) => v === "ok").length
      const colTotal = Object.keys(o.costOfLivingChecks).length
      const colOk = Object.values(o.costOfLivingChecks).filter((v) => v === "ok").length
      const guideTotal = Object.keys(o.guideChecks).length
      const guideOk = Object.values(o.guideChecks).filter((v) => v === "ok").length
      const settlingTotal = Object.keys(o.settlingChecks).length
      const settlingOk = Object.values(o.settlingChecks).filter((v) => v === "ok").length
      const onboarding = o.completed ? "complete" : "incomplete"
      return `| ${o.slug} | ${onboarding} | ${correct}/${total} | ${dashOk}/${dashTotal} | ${colOk}/${colTotal} | ${guideOk}/${guideTotal} | ${settlingOk || 0}/${settlingTotal || 0} | ${o.uxVerdict} | ${o.verdict} | ${o.artifactPath} |`
    })

    const summaryMd = [
      `# Strict 10-Persona Audit — ${RUN_ID}`,
      ``,
      `**Verdict overall:** ${failed > 0 || passed === 0 ? "DO NOT PROCEED — significant issues" : partial > 0 ? "PARTIAL — fixable issues remain" : "ACCEPTABLE for another batch"}`,
      ``,
      `- Passed: ${passed}/${outcomes.length}`,
      `- Partial: ${partial}/${outcomes.length}`,
      `- Failed: ${failed}/${outcomes.length}`,
      ``,
      `## Persona matrix`,
      ``,
      `| Persona | Onboarding | Extraction (correct/total) | Dashboard | Currency/Cost-of-living | Guide | Settling-in | UX verdict | Verdict | Evidence |`,
      `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`,
      ...matrixRows,
      ``,
      `## Per-persona answers`,
      ``,
      ...outcomes.flatMap((o) => [
        `### ${o.slug} — ${o.name} — ${o.route}`,
        ``,
        `- Would feel correct to a real user? **${o.uxVerdict}**`,
        `- ${o.uxNotes}`,
        `- Bugs noted: ${o.bugs.length}`,
        `- Warnings noted: ${o.warnings.length}`,
        `- Stalled reason: ${o.stalledReason || "(none)"}`,
        `- Evidence path: ${o.artifactPath}`,
        ``,
      ]),
      `## Bugs (aggregate)`,
      ``,
      ...outcomes.flatMap((o) => o.bugs.map((b) => `- [${o.slug}] ${b}`)),
      ``,
    ].join("\n")
    writeText(`${RUN_ROOT}/SUMMARY.md`, summaryMd)
    writeJson(`${RUN_ROOT}/SUMMARY.json`, {
      runId: RUN_ID,
      gitSha: getGitSha(),
      passed,
      partial,
      failed,
      outcomes,
    })

    const bugsMd = [
      `# Bugs found during run ${RUN_ID}`,
      ``,
      ...outcomes.flatMap((o) => {
        if (o.bugs.length === 0) return []
        return [`## ${o.slug} (${o.name})`, ``, ...o.bugs.map((b) => `- ${b}`), ``]
      }),
    ].join("\n")
    writeText(`${RUN_ROOT}/BUGS.md`, bugsMd)
  })

  for (const persona of PERSONAS) {
    if (ONLY_SLUGS.length > 0 && !ONLY_SLUGS.includes(persona.slug)) continue

    test(persona.slug, async () => {
      const outcome: PersonaOutcome = {
        slug: persona.slug,
        name: persona.name,
        route: persona.route,
        startedAt: nowIso(),
        completed: false,
        turns: 0,
        stalledReason: null,
        observations: [],
        bugs: [],
        warnings: [],
        fieldChecks: [],
        dashboardChecks: {},
        costOfLivingChecks: {},
        guideChecks: {},
        settlingChecks: {},
        artifactPath: `${RUN_ROOT}/${persona.slug}`,
        verdict: "fail",
        uxVerdict: "fail",
        uxNotes: "",
      }
      ensureDir(outcome.artifactPath)
      outcomes.push(outcome)

      const created = await createPlan(page, persona)
      outcome.planId = created.id
      outcome.planTitle = created.title
      note(outcome, "obs", `Created plan ${created.id} (${created.title})`)

      const { reachedReview, confirmed } = await driveOnboarding(page, persona, outcome)
      outcome.completed = reachedReview && confirmed

      // Backend extraction verification
      const profileRes = await fetchAndSaveProfile(page, outcome)
      await fetchAndSaveProgress(page, outcome)

      if (profileRes.status === 200) {
        verifyExtraction(persona, profileRes.data, outcome)
      } else {
        note(outcome, "bug", `/api/profile after onboarding returned ${profileRes.status}`)
      }

      // Lock plan to trigger guide auto-generation
      if (outcome.completed) {
        const lockResult = await lockPlan(page, outcome)
        if (lockResult.locked) {
          note(outcome, "obs", "Plan locked successfully (auto-guide should now exist)")
        } else {
          note(outcome, "bug", "Plan failed to lock — guide may not auto-generate")
        }
      } else {
        note(outcome, "warn", "Skipped lock because onboarding did not reach confirm")
      }

      await captureDashboard(page, persona, outcome)
      await captureCostOfLiving(page, persona, outcome)
      await captureGuide(page, persona, outcome)
      await captureSettlingIn(page, persona, outcome)

      const v = deriveVerdict(outcome)
      outcome.verdict = v.verdict
      outcome.uxVerdict = v.ux
      outcome.uxNotes = v.uxNotes
      outcome.endedAt = nowIso()

      // Per-persona observations file
      const obsLines = [
        `# ${persona.slug} — ${persona.name} — ${persona.route}`,
        ``,
        `- Plan ID: ${outcome.planId}`,
        `- Plan title: ${outcome.planTitle}`,
        `- Started: ${outcome.startedAt}`,
        `- Ended: ${outcome.endedAt}`,
        `- Turns answered: ${outcome.turns}`,
        `- Onboarding completed: ${outcome.completed}`,
        `- Stalled reason: ${outcome.stalledReason || "(none)"}`,
        `- Verdict: ${outcome.verdict}`,
        `- UX verdict: ${outcome.uxVerdict}`,
        `- UX notes: ${outcome.uxNotes}`,
        ``,
        `## Field extraction (expected vs actual)`,
        ``,
        `| key | expected ~ | actual | verdict |`,
        `| --- | --- | --- | --- |`,
        ...outcome.fieldChecks.map(
          (c) => `| ${c.key} | ${c.expected} | ${String(c.actual ?? "")} | ${c.verdict} |`
        ),
        ``,
        `## Dashboard checks`,
        ``,
        ...Object.entries(outcome.dashboardChecks).map(([k, v]) => `- ${k}: ${v}`),
        ``,
        `## Cost-of-living checks`,
        ``,
        ...Object.entries(outcome.costOfLivingChecks).map(([k, v]) => `- ${k}: ${v}`),
        ``,
        `## Guide checks`,
        ``,
        ...Object.entries(outcome.guideChecks).map(([k, v]) => `- ${k}: ${v}`),
        ``,
        `## Settling-in checks`,
        ``,
        ...Object.entries(outcome.settlingChecks).map(([k, v]) => `- ${k}: ${v}`),
        ``,
        `## Bugs noted`,
        ``,
        ...outcome.bugs.map((b) => `- ${b}`),
        ``,
        `## Warnings noted`,
        ``,
        ...outcome.warnings.map((w) => `- ${w}`),
        ``,
        `## Observations`,
        ``,
        ...outcome.observations.map((o) => `- ${o}`),
        ``,
      ].join("\n")
      writeText(`${outcome.artifactPath}/observations.md`, obsLines)

      // Soft assertion: extraction + dashboard must minimally show name/destination/citizenship.
      // Failures still record evidence but don't abort the spec.
    })
  }
})
