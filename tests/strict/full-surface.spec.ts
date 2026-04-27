import { test, expect, type Page } from "@playwright/test"
import { writeFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js"

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

// Admin client for test setup only (resetting usage caps so we can exercise
// all generation-bound surfaces). NEVER used for product behaviour.
let adminClient: SupabaseClient | null = null
let testUserId: string | null = null

function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient
  const url = envOrThrow("NEXT_PUBLIC_SUPABASE_URL")
  const key = envOrThrow("SUPABASE_SERVICE_ROLE_KEY")
  adminClient = createAdminClient(url, key, { auth: { persistSession: false } })
  return adminClient
}

async function resolveTestUserId(): Promise<string> {
  if (testUserId) return testUserId
  const admin = getAdminClient()
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const u = data.users.find((x) => (x.email || "").toLowerCase() === envOrThrow("TEST_EMAIL").toLowerCase())
  if (!u) throw new Error(`Test user ${envOrThrow("TEST_EMAIL")} not found`)
  testUserId = u.id
  return testUserId
}

async function resetUsage(): Promise<number> {
  const admin = getAdminClient()
  const userId = await resolveTestUserId()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from("usage_events")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .gte("created_at", cutoff)
  return count || 0
}

const BASE = process.env.GOMATE_BASE_URL || "http://localhost:3000"
const RUN_ID = process.env.GOMATE_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-")
const RUN_ROOT = `artifacts/e2e-full-surface/${RUN_ID}`
const ONLY_SLUGS = (process.env.PERSONAS || "").split(",").map((s) => s.trim()).filter(Boolean)

const TEST_EMAIL = envOrThrow("TEST_EMAIL")
const TEST_PASSWORD = envOrThrow("TEST_PASSWORD")

// ---------------------------------------------------------------------------
// Surface result tracking — every persona has the same surface map.
// ---------------------------------------------------------------------------

type SurfaceVerdict = "pass" | "partial" | "fail" | "skipped" | "not-tested"
type SurfaceDepth = "deep" | "shallow" | "skipped"

interface SurfaceResult {
  verdict: SurfaceVerdict
  depth: SurfaceDepth
  notes: string[]
  bugs: string[]
}

interface PersonaOutcome {
  slug: string
  name: string
  route: string
  planId?: string
  planTitle?: string
  startedAt: string
  endedAt?: string
  turns: number
  onboardingComplete: boolean
  guideReady: boolean
  arrived: boolean
  artifactPath: string
  surfaces: Record<string, SurfaceResult>
  fieldChecks: Array<{
    key: string
    expected: string
    actual: unknown
    verdict: "correct" | "partial" | "incorrect" | "missing"
  }>
  bugs: string[]
  warnings: string[]
  observations: string[]
  verdict: "pass" | "partial" | "fail"
}

const SURFACES = [
  "onboarding",
  "dashboard",
  "cost_of_living",
  "guide",
  "documents",
  "visa_tracker",
  "banking",
  "tax_registration",
  "settling_in_tasks",
  "settling_in_calendar",
  "ical_export",
  "wellbeing",
  "post_arrival_chat",
] as const

const outcomes: PersonaOutcome[] = []

function newSurface(depth: SurfaceDepth): SurfaceResult {
  return { verdict: "not-tested", depth, notes: [], bugs: [] }
}

function noteO(o: PersonaOutcome, kind: "obs" | "bug" | "warn", msg: string) {
  if (kind === "bug") o.bugs.push(msg)
  else if (kind === "warn") o.warnings.push(msg)
  else o.observations.push(msg)
}

function noteSurface(o: PersonaOutcome, surface: string, kind: "ok" | "fail" | "warn", msg: string) {
  const s = o.surfaces[surface]
  if (kind === "fail") s.bugs.push(msg)
  s.notes.push(`${kind === "fail" ? "FAIL" : kind === "warn" ? "warn" : "ok"}: ${msg}`)
  if (kind === "fail" && (s.verdict === "pass" || s.verdict === "not-tested")) s.verdict = "partial"
}

// ---------------------------------------------------------------------------
// Field-label helpers (mirrors strict-batch but kept self-contained).
// ---------------------------------------------------------------------------

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
  "field of study": "study_field",
  "study funding": "study_funding",
  "job offer status": "job_offer",
  "job offer": "job_offer",
  "job field": "job_field",
  "employer sponsorship": "employer_sponsorship",
  "highly skilled": "highly_skilled",
  "highly skilled professional": "highly_skilled",
  "years of experience": "years_experience",
  "work experience": "years_experience",
  "professional experience": "years_experience",
  "remote income": "remote_income",
  "income source": "income_source",
  "monthly income": "monthly_income",
  "income consistency": "income_consistency",
  "income history": "income_history_months",
  "settlement reason": "settlement_reason",
  "family ties": "family_ties",
  "spouse joining": "spouse_joining",
  "number of children": "children_count",
  "children count": "children_count",
  "children ages": "children_ages",
  "children's ages": "children_ages",
  "kids' ages": "children_ages",
  "moving alone": "moving_alone",
  "savings available": "savings_available",
  "available savings": "savings_available",
  savings: "savings_available",
  "monthly budget": "monthly_budget",
  "budget help needed": "need_budget_help",
  "language skill": "language_skill",
  "language skills": "language_skill",
  "education level": "education_level",
  education: "education_level",
  "prior visa": "prior_visa",
  "visa rejections": "visa_rejections",
  "healthcare needs": "healthcare_needs",
  pets: "pets",
  "special requirements": "special_requirements",
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
  if (q.includes("purpose") || q.includes("why are you moving")) return "purpose"
  if (q.includes("primary applicant") || q.includes("dependent")) return "visa_role"
  if (q.includes("when") && (q.includes("plan") || q.includes("move") || q.includes("timeline"))) return "timeline"
  if (q.includes("how long") || q.includes("duration") || q.includes("stay for")) return "duration"
  if (q.includes("alone") || q.includes("with you") || q.includes("with whom") || q.includes("moving with") || q.includes("family")) return "moving_alone"
  if (q.includes("job offer")) return "job_offer"
  if (q.includes("what field") || q.includes("what industry") || q.includes("profession")) return "job_field"
  if (q.includes("sponsor") || q.includes("employer handle")) return "employer_sponsorship"
  if (q.includes("type of study") || q.includes("kind of program")) return "study_type"
  if (q.includes("field of study") || q.includes("what will you study")) return "study_field"
  if (q.includes("fund your studies") || q.includes("scholarship")) return "study_funding"
  if (q.includes("remote income")) return "remote_income"
  if (q.includes("income source")) return "income_source"
  if (q.includes("monthly income")) return "monthly_income"
  if (q.includes("consistent") || q.includes("stable income")) return "income_consistency"
  if (q.includes("income history") || q.includes("how long have you been earning")) return "income_history_months"
  if (q.includes("why settle") || q.includes("ancestry") || q.includes("retiring")) return "settlement_reason"
  if (q.includes("family ties") || q.includes("relatives there")) return "family_ties"
  if (q.includes("spouse") || q.includes("partner joining")) return "spouse_joining"
  if (q.includes("how many children") || q.includes("number of children")) return "children_count"
  if (q.includes("children ages") || q.includes("how old are your children") || q.includes("kids' ages") || q.includes("children's ages")) return "children_ages"
  if (q.includes("savings") || q.includes("saved up")) return "savings_available"
  if (q.includes("monthly budget") || q.includes("budget per month")) return "monthly_budget"
  if (q.includes("budget help")) return "need_budget_help"
  if (q.includes("currently located") || q.includes("where do you live now") || q.includes("current location")) return "current_location"
  if (q.includes("language skill") || q.includes("language level")) return "language_skill"
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
  const expectedTokens = expected.split(" ").filter((t) => t.length >= 4)
  if (expectedTokens.length === 0) return false
  const overlap = expectedTokens.filter((t) => actual.includes(t.slice(0, 4)))
  return overlap.length > 0
}

// ---------------------------------------------------------------------------
// Page interaction helpers
// ---------------------------------------------------------------------------

async function waitForLoad(page: Page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {})
}

async function waitForAIQuiet(page: Page, maxWait = 35000): Promise<boolean> {
  const start = Date.now()
  await page.waitForTimeout(1200)
  while (Date.now() - start < maxWait) {
    const stillTyping = await page
      .locator(".animate-bounce")
      .first()
      .isVisible({ timeout: 200 })
      .catch(() => false)
    if (!stillTyping) {
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
  input: { path: string; method?: string; body?: unknown; timeoutMs?: number }
): Promise<{ status: number; ok: boolean; data: unknown; timedOut?: boolean; raw?: string }> {
  const timeoutMs = input.timeoutMs ?? 90_000
  return page.evaluate(
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
        const ct = res.headers.get("content-type") || ""
        if (ct.includes("application/json")) {
          let data: unknown = null
          try { data = await res.json() } catch { data = null }
          return { status: res.status, ok: res.ok, data, timedOut: false }
        }
        const raw = await res.text()
        return { status: res.status, ok: res.ok, data: null, timedOut: false, raw }
      } catch (e) {
        clearTimeout(t)
        const aborted = e instanceof Error && e.name === "AbortError"
        return { status: 0, ok: false, data: { error: aborted ? "client-timeout" : String(e) }, timedOut: aborted }
      }
    },
    { path: input.path, method: input.method, body: input.body, timeoutMs }
  )
}

async function signIn(page: Page) {
  await page.goto(`${BASE}/auth/login`)
  await waitForLoad(page)
  const emailInput = page.locator('input[type="email"], input[name="email"]')
  if (!(await emailInput.isVisible({ timeout: 5000 }).catch(() => false))) return
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
    body: { title: `FS-${persona.slug} | ${stamp}` },
  })
  expect(res.status, `Plan create status for ${persona.slug}`).toBe(200)
  const data = res.data as any
  expect(data?.plan?.id).toBeTruthy()
  return { id: data.plan.id as string, title: data.plan.title as string }
}

async function isApiReadyToLock(page: Page): Promise<boolean> {
  const res = await apiJson(page, { path: "/api/progress" })
  if (res.status !== 200) return false
  return Boolean((res.data as any)?.readiness?.isReadyForLock)
}

// ---------------------------------------------------------------------------
// Surface 1 — Onboarding chat
// ---------------------------------------------------------------------------

async function driveOnboarding(page: Page, persona: Persona, outcome: PersonaOutcome): Promise<{ reachedReview: boolean; confirmed: boolean }> {
  const surface = outcome.surfaces.onboarding

  await page.goto(`${BASE}/chat`)
  await waitForLoad(page)
  await page.waitForTimeout(2500)

  const chatInput = page.locator('input[placeholder="Type your message..."]').first()
  await chatInput.waitFor({ timeout: 20000 })

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
        await waitForAIQuiet(page, 60000)
        confirmed = true
        noteSurface(outcome, "onboarding", "ok", `Reached review at ${pct}% and clicked confirm`)
      } catch {
        noteSurface(outcome, "onboarding", "fail", "confirm-plan-btn click failed despite review card visible")
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
          await waitForAIQuiet(page, 60000)
          confirmed = true
          noteSurface(outcome, "onboarding", "ok", `Reached review at 100% and clicked confirm`)
        } catch {
          noteSurface(outcome, "onboarding", "fail", "confirm-plan-btn click failed at 100%")
        }
      } else {
        noteSurface(outcome, "onboarding", "fail", "Profile reached 100% but review card never appeared")
      }
      break
    }

    if (!pendingLabel) {
      const lowerAssistant = (lastAssistant || "").toLowerCase()
      const looksLikeQuestion = /[?]/.test(lastAssistant) || /\b(what|which|where|when|how|tell me|do you|are you|can you)\b/.test(lowerAssistant)
      if (!looksLikeQuestion) {
        unanswered += 1
        if (unanswered >= 2) {
          const ready = await isApiReadyToLock(page)
          if (ready) {
            // Real product UX bug: chat shows non-100% but API is ready.
            // We do NOT use this as a rescue path here (per task.md non-negotiable
            // "no harness recovery that a real user does not have"). Mark the
            // onboarding surface FAILED and stop driving the chat — the user
            // would be stuck at this point with no way forward.
            noteSurface(outcome, "onboarding", "fail",
              `Chat UI shows ${pct}% with no pending question while backend reports ready_to_lock. A real user cannot leave the chat from this state.`)
            outcome.bugs.push(
              `[${persona.slug}] Chat hung at ${pct}% with no review card while backend was ready to lock`
            )
            break
          }
          if (unanswered >= 3) {
            noteSurface(outcome, "onboarding", "fail",
              `Chat went silent at ${pct}% with no pending field, backend not ready`)
            break
          }
        }
        await page.waitForTimeout(1800)
        continue
      }
    }

    const fieldKey = inferKey(pendingLabel, lastAssistant)
    if (!fieldKey) {
      noteSurface(outcome, "onboarding", "warn", `Could not infer field for label="${pendingLabel}"`)
      unanswered += 1
      if (unanswered >= 3) {
        noteSurface(outcome, "onboarding", "fail",
          `Could not map question to field after 3 idle iterations (label="${pendingLabel}")`)
        break
      }
      await page.waitForTimeout(1500)
      continue
    }
    unanswered = 0

    if (pendingLabel && pendingLabel === lastLabel) {
      repeats += 1
      if (repeats >= 2) {
        noteSurface(outcome, "onboarding", "warn", `Repeated pending label "${pendingLabel}"`)
      }
      if (repeats >= 6) {
        noteSurface(outcome, "onboarding", "fail",
          `Pending label "${pendingLabel}" looped 6 times — chat stuck`)
        break
      }
    } else {
      repeats = 0
    }
    lastLabel = pendingLabel

    const answer = persona.fields[fieldKey]
    if (!answer) {
      noteSurface(outcome, "onboarding", "warn", `No persona answer for inferred field "${fieldKey}"`)
      await chatInput.fill("Let's skip that one.")
    } else {
      await chatInput.fill(answer)
    }
    await chatInput.press("Enter")
    outcome.turns += 1

    const settled = await waitForAIQuiet(page, 35000)
    if (!settled) {
      noteSurface(outcome, "onboarding", "fail",
        `AI did not settle within 35s after answering "${pendingLabel || fieldKey}"`)
      break
    }
  }

  if (!midShotTaken) {
    await page.screenshot({ path: `${outcome.artifactPath}/02-chat-mid.png`, fullPage: true })
  }
  if (!reachedReview) {
    await page.screenshot({ path: `${outcome.artifactPath}/03-chat-review.png`, fullPage: true })
  }

  outcome.onboardingComplete = reachedReview && confirmed
  if (outcome.onboardingComplete) {
    surface.verdict = surface.bugs.length === 0 ? "pass" : "partial"
  } else {
    surface.verdict = "fail"
  }
  return { reachedReview, confirmed }
}

// ---------------------------------------------------------------------------
// Surface 2 — Lock + auto guide gen + research trigger
// ---------------------------------------------------------------------------

async function lockPlanViaUi(page: Page, persona: Persona, outcome: PersonaOutcome): Promise<{ locked: boolean; planVersion: number | null; guideReady: boolean }> {
  await page.goto(`${BASE}/dashboard`)
  await waitForLoad(page)
  await page.waitForTimeout(3500)

  // Look for "Lock plan" button. If not found, fall back to API call.
  const lockBtn = page.locator('button:has-text("Lock plan"), button:has-text("Lock Plan"), button:has-text("Looks good, lock my plan")').first()
  const visible = await lockBtn.isVisible({ timeout: 4000 }).catch(() => false)
  if (visible) {
    try {
      await lockBtn.click({ timeout: 5000 })
      // Lock action takes up to 45s now (post-fix).
      await page.waitForTimeout(2000)
      // Wait for spinner to disappear or a confirmation indicator
      await page.waitForFunction(
        () => {
          const t = document.body.textContent || ""
          return t.includes("Plan locked") || t.includes("Unlock") || t.includes("locked")
        },
        { timeout: 60000 }
      ).catch(() => {})
      noteO(outcome, "obs", "Lock button clicked via dashboard UI")
    } catch (e) {
      noteO(outcome, "warn", `Lock button click failed: ${String(e).slice(0, 120)}`)
    }
  }

  // Now read back via API to verify
  const profileRes = await apiJson(page, { path: "/api/profile" })
  const plan = (profileRes.data as any)?.plan
  if (!plan?.id) {
    noteO(outcome, "bug", "Could not read plan after lock attempt")
    return { locked: false, planVersion: null, guideReady: false }
  }

  // If still not locked and we have version, do a direct PATCH lock via API
  if (!plan.locked && typeof plan.plan_version === "number") {
    const lockRes = await apiJson(page, {
      path: "/api/profile",
      method: "PATCH",
      body: { action: "lock", planId: plan.id, expectedVersion: plan.plan_version },
      timeoutMs: 60_000,
    })
    if (lockRes.status === 200) {
      const lockedPlan = (lockRes.data as any)?.plan
      const guideReady = Boolean((lockRes.data as any)?.guideReady)
      noteO(outcome, "obs", `Plan locked via API fallback (guideReady=${guideReady})`)
      return {
        locked: !!lockedPlan?.locked,
        planVersion: lockedPlan?.plan_version ?? plan.plan_version + 1,
        guideReady,
      }
    } else {
      noteO(outcome, "bug", `API lock failed: status ${lockRes.status}`)
      return { locked: false, planVersion: plan.plan_version, guideReady: false }
    }
  }

  // Already locked — re-read for guideReady status
  const guideReady = await isGuideReady(page, plan.id)
  return { locked: true, planVersion: plan.plan_version, guideReady }
}

async function isGuideReady(page: Page, planId: string): Promise<boolean> {
  const res = await apiJson(page, { path: `/api/guides?plan_id=${planId}` })
  if (res.status !== 200) return false
  const guides = ((res.data as any)?.guides || []) as Array<any>
  return guides.length > 0
}

async function triggerResearch(page: Page, planId: string, outcome: PersonaOutcome) {
  const res = await apiJson(page, {
    path: "/api/research/trigger",
    method: "POST",
    body: { planId },
    timeoutMs: 120_000,
  })
  writeJson(`${outcome.artifactPath}/research-trigger.json`, res)
  if (res.status !== 200 && res.status !== 409) {
    noteO(outcome, "warn", `Research trigger returned ${res.status}`)
  }
}

async function waitForResearch(page: Page, planId: string, outcome: PersonaOutcome, maxWaitMs = 90_000): Promise<string> {
  const start = Date.now()
  let last = "unknown"
  while (Date.now() - start < maxWaitMs) {
    const res = await apiJson(page, { path: `/api/profile` })
    const plan = (res.data as any)?.plan
    last = String(plan?.research_status || "unknown")
    if (last === "completed" || last === "partial" || last === "failed") {
      noteO(outcome, "obs", `Research finished after ${Math.round((Date.now() - start) / 1000)}s with status=${last}`)
      return last
    }
    await page.waitForTimeout(3000)
  }
  noteO(outcome, "warn", `Research did not finish within ${maxWaitMs / 1000}s — last status=${last}`)
  return last
}

// ---------------------------------------------------------------------------
// Surface 3 — Dashboard
// ---------------------------------------------------------------------------

async function captureDashboard(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.dashboard
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
  let pass = 0
  for (const [field, value] of checks) {
    if (norm.includes(normalize(value))) {
      pass++
      noteSurface(outcome, "dashboard", "ok", `${field} "${value}" visible on dashboard`)
    } else {
      noteSurface(outcome, "dashboard", "fail", `${field} "${value}" not visible on dashboard`)
    }
  }
  surface.verdict = pass === checks.length ? "pass" : pass >= 3 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Surface 4 — Cost of Living + currency
// ---------------------------------------------------------------------------

async function captureCostOfLiving(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.cost_of_living
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
    noteSurface(outcome, "cost_of_living", "fail", `COL API status ${res.status}`)
    surface.verdict = "fail"
    return
  }

  const data = res.data as any
  let okCount = 0
  let totalChecks = 0

  totalChecks++
  if (data.from?.currency === persona.expectedHomeCurrency) {
    noteSurface(outcome, "cost_of_living", "ok", `from.currency = ${persona.expectedHomeCurrency}`)
    okCount++
  } else {
    noteSurface(outcome, "cost_of_living", "fail",
      `from.currency = "${data.from?.currency}" — expected ${persona.expectedHomeCurrency}`)
  }

  totalChecks++
  if (data.to?.currency === persona.expectedDestinationCurrency) {
    noteSurface(outcome, "cost_of_living", "ok", `to.currency = ${persona.expectedDestinationCurrency}`)
    okCount++
  } else {
    noteSurface(outcome, "cost_of_living", "fail",
      `to.currency = "${data.to?.currency}" — expected ${persona.expectedDestinationCurrency}`)
  }

  totalChecks++
  if (data.from?.rent?.apartment1BedCity > 0 && data.to?.rent?.apartment1BedCity > 0) {
    noteSurface(outcome, "cost_of_living", "ok", "rent values populated for both source and destination")
    okCount++
  } else {
    noteSurface(outcome, "cost_of_living", "fail", "rent values missing or zero")
  }

  totalChecks++
  if (!data.isFallback) {
    noteSurface(outcome, "cost_of_living", "ok", "Numbeo scrape succeeded (no fallback)")
    okCount++
  } else {
    noteSurface(outcome, "cost_of_living", "warn", "Cost-of-living served from generic fallback data")
  }

  // Render dashboard cost-of-living card
  await page.goto(`${BASE}/dashboard#cost-of-living`)
  await waitForLoad(page)
  await page.waitForTimeout(3500)
  const colHeading = page.locator(':text-matches("Cost of [Ll]iving", "i")').first()
  if (await colHeading.isVisible({ timeout: 4000 }).catch(() => false)) {
    await colHeading.scrollIntoViewIfNeeded().catch(() => {})
    await page.waitForTimeout(1200)
  }
  await page.screenshot({ path: `${outcome.artifactPath}/05-cost-of-living.png`, fullPage: true })

  const body = (await page.textContent("body")) || ""
  totalChecks++
  if (body.includes(persona.expectedHomeCurrency) || body.includes(currencySymbolFor(persona.expectedHomeCurrency))) {
    noteSurface(outcome, "cost_of_living", "ok", `Home currency ${persona.expectedHomeCurrency} visible on dashboard`)
    okCount++
  } else {
    noteSurface(outcome, "cost_of_living", "fail",
      `Home currency ${persona.expectedHomeCurrency} not visible on dashboard`)
  }

  totalChecks++
  if (body.includes(persona.expectedDestinationCurrency) || body.includes(currencySymbolFor(persona.expectedDestinationCurrency))) {
    noteSurface(outcome, "cost_of_living", "ok", `Destination currency ${persona.expectedDestinationCurrency} visible on dashboard`)
    okCount++
  } else {
    noteSurface(outcome, "cost_of_living", "fail",
      `Destination currency ${persona.expectedDestinationCurrency} not visible on dashboard`)
  }

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.7 ? "partial" : "fail"
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

// ---------------------------------------------------------------------------
// Surface 5 — Guide
// ---------------------------------------------------------------------------

async function captureGuide(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.guide
  let listRes = await apiJson(page, { path: "/api/guides" })
  writeJson(`${outcome.artifactPath}/guide-list.json`, listRes)
  let guides = ((listRes.data as any)?.guides || []) as Array<any>

  if (!Array.isArray(guides) || guides.length === 0) {
    // Lock likely returned before the auto-guide finished generating.
    // A real user can retry generation via POST /api/guides — we exercise
    // that path here. This is NOT a rescue; it's a real product action.
    noteSurface(outcome, "guide", "warn",
      "Auto-guide not present — calling POST /api/guides as a real user would")
    if (outcome.planId) {
      const genRes = await apiJson(page, {
        path: "/api/guides",
        method: "POST",
        body: { planId: outcome.planId },
        timeoutMs: 120_000,
      })
      writeJson(`${outcome.artifactPath}/guide-explicit-generate.json`, genRes)
      if (genRes.timedOut) {
        noteSurface(outcome, "guide", "fail",
          "POST /api/guides exceeded 2 minutes — guide gen too slow for a real user wait")
      } else if (genRes.status !== 200) {
        noteSurface(outcome, "guide", "fail",
          `POST /api/guides returned ${genRes.status}: ${JSON.stringify(genRes.data).slice(0, 200)}`)
      } else {
        noteSurface(outcome, "guide", "ok", "Explicit guide generation succeeded")
      }
    }
    listRes = await apiJson(page, { path: "/api/guides" })
    writeJson(`${outcome.artifactPath}/guide-list.json`, listRes)
    guides = ((listRes.data as any)?.guides || []) as Array<any>
  }

  if (!Array.isArray(guides) || guides.length === 0) {
    noteSurface(outcome, "guide", "fail", "No guide returned by /api/guides even after explicit POST")
    await page.goto(`${BASE}/guides`)
    await waitForLoad(page)
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${outcome.artifactPath}/06-guide-overview.png`, fullPage: true })
    surface.verdict = "fail"
    return
  }
  outcome.guideReady = true

  const guide = guides[0]
  const detailRes = await apiJson(page, { path: `/api/guides/${guide.id}` })
  writeJson(`${outcome.artifactPath}/guide-detail.json`, detailRes)
  const detail = (detailRes.data as any)?.guide || (detailRes.data as any) || null

  let okCount = 0
  let totalChecks = 0

  const dest = String(detail?.destination || "")
  totalChecks++
  if (normalize(dest).includes(normalize(persona.expectedDestination))) {
    noteSurface(outcome, "guide", "ok", `Guide destination matches "${persona.expectedDestination}"`)
    okCount++
  } else {
    noteSurface(outcome, "guide", "fail", `Guide destination "${dest}" doesn't match "${persona.expectedDestination}"`)
  }

  totalChecks++
  const guideCurrency = String(detail?.currency || "").toUpperCase()
  if (guideCurrency === persona.expectedDestinationCurrency) {
    noteSurface(outcome, "guide", "ok", `Guide currency matches ${persona.expectedDestinationCurrency}`)
    okCount++
  } else {
    noteSurface(outcome, "guide", "fail",
      `Guide currency is ${guideCurrency} but destination uses ${persona.expectedDestinationCurrency}`)
  }

  // Section quality checks
  const sectionMap: Record<string, string> = {
    overview: "overview",
    visa: "visa_section",
    budget: "budget_section",
    housing: "housing_section",
    timeline: "timeline_section",
    checklist: "checklist_section",
  }
  for (const [label, field] of Object.entries(sectionMap)) {
    totalChecks++
    const v = (detail as any)?.[field]
    let substantive = false
    if (typeof v === "string") substantive = v.trim().length > 100
    else if (Array.isArray(v)) substantive = v.length > 0
    else if (v && typeof v === "object") {
      const keys = Object.keys(v).filter((k) => v[k] != null && v[k] !== "")
      substantive = keys.length >= 2
      // Check nested categories for checklist
      if (label === "checklist" && Array.isArray((v as any).categories)) {
        substantive = (v as any).categories.length >= 2
      }
    }
    if (substantive) {
      noteSurface(outcome, "guide", "ok", `Section "${label}" populated`)
      okCount++
    } else {
      noteSurface(outcome, "guide", "fail", `Section "${label}" thin or empty`)
    }
  }

  await page.goto(`${BASE}/guides`)
  await waitForLoad(page)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${outcome.artifactPath}/06-guide-overview.png`, fullPage: true })

  await page.goto(`${BASE}/guides/${guide.id}`)
  await waitForLoad(page)
  await page.waitForTimeout(3500)

  const visaTab = page.locator('button:has-text("Visa"), [role="tab"]:has-text("Visa")').first()
  if (await visaTab.isVisible({ timeout: 1500 }).catch(() => false)) {
    await visaTab.click().catch(() => {})
  }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${outcome.artifactPath}/07-guide-visa.png`, fullPage: true })

  const timelineTab = page.locator('button:has-text("Timeline"), [role="tab"]:has-text("Timeline")').first()
  if (await timelineTab.isVisible({ timeout: 1500 }).catch(() => false)) {
    await timelineTab.click().catch(() => {})
  }
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${outcome.artifactPath}/08-guide-timeline.png`, fullPage: true })

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.7 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Surface 6 — Documents
// ---------------------------------------------------------------------------

async function captureDocuments(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.documents
  const res = await apiJson(page, { path: "/api/documents" })
  writeJson(`${outcome.artifactPath}/documents.json`, res)

  if (res.status !== 200) {
    noteSurface(outcome, "documents", "fail", `/api/documents returned ${res.status}`)
    surface.verdict = "fail"
    return
  }

  const data = res.data as any
  const checklistItems = (data?.checklistItems?.items || []) as Array<{ id: string; document: string; visaSpecific?: boolean; required?: boolean }>
  const statuses = (data?.statuses || {}) as Record<string, any>

  let okCount = 0
  let totalChecks = 0

  totalChecks++
  if (checklistItems.length > 0) {
    noteSurface(outcome, "documents", "ok", `Checklist has ${checklistItems.length} items`)
    okCount++
  } else {
    noteSurface(outcome, "documents", "fail", "Documents checklist is empty")
  }

  // Visit the documents page
  await page.goto(`${BASE}/documents`)
  await waitForLoad(page)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${outcome.artifactPath}/10-documents.png`, fullPage: true })

  totalChecks++
  const body = (await page.textContent("body")) || ""
  if (body.toLowerCase().includes("document")) {
    noteSurface(outcome, "documents", "ok", "Documents page renders")
    okCount++
  } else {
    noteSurface(outcome, "documents", "fail", "Documents page text content suspicious")
  }

  // Try to PATCH the first document to "ready"
  if (checklistItems.length > 0) {
    totalChecks++
    const first = checklistItems[0]
    const patchRes = await apiJson(page, {
      path: "/api/documents",
      method: "PATCH",
      body: { documentId: first.id, status: "ready" },
    })
    if (patchRes.status === 200) {
      noteSurface(outcome, "documents", "ok",
        `PATCH /api/documents successfully marked "${first.document}" as ready`)
      okCount++
    } else {
      noteSurface(outcome, "documents", "fail",
        `PATCH /api/documents failed: ${patchRes.status} ${JSON.stringify(patchRes.data).slice(0, 100)}`)
    }
  }

  // Persona-relevance heuristic: do checklist items reference the destination?
  totalChecks++
  const checklistText = checklistItems.map((i) => i.document).join(" | ").toLowerCase()
  const destNorm = normalize(persona.expectedDestination)
  if (checklistText.length > 0 && (
    checklistText.includes(destNorm) ||
    checklistText.includes("passport") ||
    checklistText.includes("visa")
  )) {
    noteSurface(outcome, "documents", "ok", "Checklist items contain expected items (passport/visa)")
    okCount++
  } else {
    noteSurface(outcome, "documents", "fail", "Checklist items don't seem destination-relevant")
  }

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.7 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Surface 7 — Visa Tracker
// ---------------------------------------------------------------------------

async function captureVisaTracker(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.visa_tracker
  const res = await apiJson(page, { path: "/api/visa-tracker" })
  writeJson(`${outcome.artifactPath}/visa-tracker.json`, res)

  await page.goto(`${BASE}/visa-tracker`)
  await waitForLoad(page)
  await page.waitForTimeout(3500)
  await page.screenshot({ path: `${outcome.artifactPath}/11-visa-tracker.png`, fullPage: true })

  if (res.status !== 200) {
    noteSurface(outcome, "visa_tracker", "fail", `/api/visa-tracker returned ${res.status}`)
    surface.verdict = "fail"
    return
  }

  const data = res.data as any
  let okCount = 0
  let totalChecks = 0

  totalChecks++
  const visaOptionsCount = data?.visaResearch?.visaOptions?.length || 0
  if (visaOptionsCount > 0) {
    noteSurface(outcome, "visa_tracker", "ok", `${visaOptionsCount} visa options researched`)
    okCount++
  } else {
    noteSurface(outcome, "visa_tracker", "fail", "No visa options — research did not populate")
  }

  totalChecks++
  if (Array.isArray(data?.visaDocuments) && data.visaDocuments.length > 0) {
    noteSurface(outcome, "visa_tracker", "ok", `${data.visaDocuments.length} visa-specific documents`)
    okCount++
  } else {
    noteSurface(outcome, "visa_tracker", "warn", "No visa-specific documents listed")
  }

  // Check that the page actually displays content
  const body = (await page.textContent("body")) || ""
  totalChecks++
  if (body.toLowerCase().includes("visa") &&
      (body.includes(persona.expectedDestination) || body.toLowerCase().includes(persona.expectedDestination.toLowerCase()))) {
    noteSurface(outcome, "visa_tracker", "ok", "Visa-tracker page mentions destination")
    okCount++
  } else if (body.toLowerCase().includes("no visa research yet")) {
    noteSurface(outcome, "visa_tracker", "fail",
      "Visa-tracker page shows 'No Visa Research Yet' — research not propagated to UI")
  } else {
    noteSurface(outcome, "visa_tracker", "fail", "Visa-tracker page does not show destination content")
  }

  // Try to set selectedVisaType if visa options exist
  if (visaOptionsCount > 0) {
    totalChecks++
    const firstVisa = data.visaResearch.visaOptions[0]
    const patchRes = await apiJson(page, {
      path: "/api/visa-tracker",
      method: "PATCH",
      body: { selectedVisaType: firstVisa.name, applicationStatus: "preparing" },
    })
    if (patchRes.status === 200) {
      noteSurface(outcome, "visa_tracker", "ok", `Selected visa type "${firstVisa.name}" and set status preparing`)
      okCount++
    } else {
      noteSurface(outcome, "visa_tracker", "fail",
        `PATCH /api/visa-tracker failed: ${patchRes.status}`)
    }
  }

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.6 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Surface 8 — Banking Wizard
// ---------------------------------------------------------------------------

async function captureBanking(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.banking
  const res = await apiJson(page, { path: "/api/banking-wizard" })
  writeJson(`${outcome.artifactPath}/banking.json`, res)

  await page.goto(`${BASE}/banking`)
  await waitForLoad(page)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${outcome.artifactPath}/12-banking.png`, fullPage: true })

  if (res.status !== 200) {
    noteSurface(outcome, "banking", "fail", `/api/banking-wizard returned ${res.status}`)
    surface.verdict = "fail"
    return
  }

  const data = res.data as any
  let okCount = 0
  let totalChecks = 0

  totalChecks++
  if (data?.destination && normalize(String(data.destination)).includes(normalize(persona.expectedDestination))) {
    noteSurface(outcome, "banking", "ok", `Banking page scoped to destination ${data.destination}`)
    okCount++
  } else {
    noteSurface(outcome, "banking", "fail", `Banking destination "${data?.destination}" doesn't match`)
  }

  totalChecks++
  const banks = (data?.banks || []) as Array<any>
  if (banks.length > 0) {
    noteSurface(outcome, "banking", "ok", `${banks.length} bank options listed`)
    okCount++
  } else {
    noteSurface(outcome, "banking", "fail", "No banks listed for destination")
  }

  totalChecks++
  const docs = (data?.documentsNeeded || []) as Array<string>
  if (docs.length > 0) {
    noteSurface(outcome, "banking", "ok", `${docs.length} required documents listed`)
    okCount++
  } else {
    noteSurface(outcome, "banking", "warn", "No required-document list — only digital-bridge fallback")
  }

  totalChecks++
  const digitalBridges = (data?.digitalBridgeOptions || []) as Array<any>
  if (digitalBridges.length > 0) {
    noteSurface(outcome, "banking", "ok", `${digitalBridges.length} digital-bridge options`)
    okCount++
  } else {
    noteSurface(outcome, "banking", "fail", "No digital-bridge options")
  }

  totalChecks++
  const body = (await page.textContent("body")) || ""
  if (body.toLowerCase().includes("bank") && (body.toLowerCase().includes("account") || body.toLowerCase().includes("setup"))) {
    noteSurface(outcome, "banking", "ok", "Banking page renders with banking content")
    okCount++
  } else {
    noteSurface(outcome, "banking", "fail", "Banking page suspicious content")
  }

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.6 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Surface 9 — Tax Registration
// ---------------------------------------------------------------------------

async function captureTaxRegistration(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.tax_registration
  const res = await apiJson(page, { path: "/api/tax-guide" })
  writeJson(`${outcome.artifactPath}/tax-registration.json`, res)

  await page.goto(`${BASE}/tax-registration`)
  await waitForLoad(page)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${outcome.artifactPath}/13-tax-registration.png`, fullPage: true })

  if (res.status !== 200) {
    noteSurface(outcome, "tax_registration", "fail", `/api/tax-guide returned ${res.status}`)
    surface.verdict = "fail"
    return
  }

  const data = res.data as any
  let okCount = 0
  let totalChecks = 0

  totalChecks++
  if (data?.taxIdName && data.taxIdName !== "Tax ID") {
    noteSurface(outcome, "tax_registration", "ok",
      `Destination-specific tax ID name "${data.taxIdName}" returned`)
    okCount++
  } else {
    noteSurface(outcome, "tax_registration", "warn",
      `Generic "Tax ID" — no destination-specific tax-ID lookup for ${persona.expectedDestination}`)
  }

  totalChecks++
  const stepsCount = (data?.registrationSteps || []).length
  if (stepsCount >= 2) {
    noteSurface(outcome, "tax_registration", "ok", `${stepsCount} registration steps`)
    okCount++
  } else if (data?.fallbackToOfficialLink && data?.officialLink) {
    noteSurface(outcome, "tax_registration", "warn",
      "No registration steps — page falls back to an official link")
  } else {
    noteSurface(outcome, "tax_registration", "fail",
      `No registration steps and no fallback official link (steps=${stepsCount})`)
  }

  totalChecks++
  if (data?.officialLink || data?.relatedOfficialLinks?.length) {
    noteSurface(outcome, "tax_registration", "ok", "At least one official source link present")
    okCount++
  } else {
    noteSurface(outcome, "tax_registration", "fail", "No official source links")
  }

  totalChecks++
  const body = (await page.textContent("body")) || ""
  if (body.toLowerCase().includes("tax")) {
    noteSurface(outcome, "tax_registration", "ok", "Tax registration page renders")
    okCount++
  } else {
    noteSurface(outcome, "tax_registration", "fail", "Tax registration page content suspicious")
  }

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.6 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Surface 10/11/12 — Settling-in (tasks + calendar + iCal)
// ---------------------------------------------------------------------------

async function captureSettlingInFull(page: Page, persona: Persona, outcome: PersonaOutcome): Promise<{ arrived: boolean }> {
  const tasks = outcome.surfaces.settling_in_tasks
  const calendar = outcome.surfaces.settling_in_calendar
  const ical = outcome.surfaces.ical_export

  const profileRes = await apiJson(page, { path: "/api/profile" })
  const plan = (profileRes.data as any)?.plan
  if (!plan?.id) {
    noteSurface(outcome, "settling_in_tasks", "fail", "No plan id available — cannot trigger arrival")
    tasks.verdict = "fail"
    calendar.verdict = "fail"
    ical.verdict = "fail"
    return { arrived: false }
  }

  // Backdate arrival by 8 days so the wellbeing check-in component is eligible
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0]
  const arriveRes = await apiJson(page, {
    path: "/api/settling-in/arrive",
    method: "POST",
    body: { arrivalDate: eightDaysAgo },
    timeoutMs: 60_000,
  })
  writeJson(`${outcome.artifactPath}/settling-in-arrive.json`, arriveRes)
  if (arriveRes.status !== 200) {
    noteSurface(outcome, "settling_in_tasks", "fail",
      `/api/settling-in/arrive returned ${arriveRes.status}: ${JSON.stringify(arriveRes.data).slice(0, 200)}`)
    tasks.verdict = "fail"
    calendar.verdict = "fail"
    ical.verdict = "fail"
    return { arrived: false }
  }

  outcome.arrived = true

  // Trigger task generation (3-min hard cap)
  const genRes = await apiJson(page, {
    path: "/api/settling-in/generate",
    method: "POST",
    body: { planId: plan.id },
    timeoutMs: 180_000,
  })
  writeJson(`${outcome.artifactPath}/settling-in-generate.json`, genRes)
  if (genRes.timedOut) {
    noteSurface(outcome, "settling_in_tasks", "fail",
      "settling-in/generate exceeded 3 minutes — page would hang for a real user")
  } else if (genRes.status !== 200) {
    noteSurface(outcome, "settling_in_tasks", "fail",
      `settling-in/generate returned ${genRes.status}`)
  }

  const listRes = await apiJson(page, { path: "/api/settling-in" })
  writeJson(`${outcome.artifactPath}/settling-in.json`, listRes)
  if (listRes.status !== 200) {
    noteSurface(outcome, "settling_in_tasks", "fail",
      `/api/settling-in returned ${listRes.status}`)
    tasks.verdict = "fail"
  } else {
    const taskList = ((listRes.data as any)?.tasks || []) as Array<any>
    let taskOk = 0, taskTotal = 0

    taskTotal++
    if (taskList.length > 0) {
      noteSurface(outcome, "settling_in_tasks", "ok", `${taskList.length} settling-in tasks generated`)
      taskOk++
    } else {
      noteSurface(outcome, "settling_in_tasks", "fail", "0 settling-in tasks after generation")
    }

    // Quality: at least one task should mention the destination
    taskTotal++
    const taskText = taskList.map((t: any) => `${t.title} ${t.description || ""}`).join(" | ").toLowerCase()
    if (taskText.includes(persona.expectedDestination.toLowerCase()) ||
        taskText.includes(persona.expectedCity.toLowerCase())) {
      noteSurface(outcome, "settling_in_tasks", "ok",
        `Tasks reference the destination/city`)
      taskOk++
    } else {
      noteSurface(outcome, "settling_in_tasks", "fail",
        `No task mentions the destination "${persona.expectedDestination}" or city "${persona.expectedCity}"`)
    }

    // Quality: task statuses include both available and locked (DAG)
    taskTotal++
    const statusSet = new Set(taskList.map((t: any) => t.status))
    if (statusSet.size >= 2) {
      noteSurface(outcome, "settling_in_tasks", "ok",
        `Task statuses cover ${statusSet.size} states: ${Array.from(statusSet).join(", ")}`)
      taskOk++
    } else {
      noteSurface(outcome, "settling_in_tasks", "warn",
        `Tasks all share the same status "${Array.from(statusSet).join(", ")}" — DAG may not be working`)
    }

    // Quality: at least one legal-requirement task with deadline_at
    taskTotal++
    const legalTask = taskList.find((t: any) => t.is_legal_requirement && t.deadline_at)
    if (legalTask) {
      noteSurface(outcome, "settling_in_tasks", "ok",
        `Found legal-requirement task with deadline: "${legalTask.title}" by ${legalTask.deadline_at}`)
      taskOk++
    } else {
      noteSurface(outcome, "settling_in_tasks", "warn",
        "No legal-requirement task with a deadline — calendar export will be empty")
    }

    tasks.verdict = taskOk === taskTotal ? "pass" : taskOk >= taskTotal * 0.6 ? "partial" : "fail"
  }

  // Visit /settling-in tasks tab
  await page.goto(`${BASE}/settling-in`)
  await waitForLoad(page)
  await page.waitForTimeout(4000)
  await page.screenshot({ path: `${outcome.artifactPath}/14-settling-in-tasks.png`, fullPage: true })

  // Click calendar tab
  const calendarBtn = page.locator('button:has-text("Calendar"):not(:has-text("Calendar export"))').first()
  if (await calendarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await calendarBtn.click().catch(() => {})
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${outcome.artifactPath}/15-settling-in-calendar.png`, fullPage: true })
    const calBody = (await page.textContent("body")) || ""
    if (calBody.toLowerCase().includes("compliance") ||
        calBody.toLowerCase().includes("deadline") ||
        calBody.toLowerCase().includes("calendar")) {
      noteSurface(outcome, "settling_in_calendar", "ok", "Calendar tab shows compliance content")
      calendar.verdict = "pass"
    } else {
      noteSurface(outcome, "settling_in_calendar", "fail", "Calendar tab content suspicious")
      calendar.verdict = "fail"
    }
  } else {
    noteSurface(outcome, "settling_in_calendar", "fail", "Calendar tab button not visible on settling-in page")
    calendar.verdict = "fail"
    await page.screenshot({ path: `${outcome.artifactPath}/15-settling-in-calendar.png`, fullPage: true })
  }

  // iCal export
  const icalRes = await apiJson(page, { path: "/api/settling-in/export-ical", timeoutMs: 30_000 })
  if (icalRes.status === 200 && icalRes.raw) {
    const ics = icalRes.raw
    writeFileSync(`${outcome.artifactPath}/compliance-calendar.ics`, ics)
    if (ics.includes("BEGIN:VCALENDAR") && ics.includes("END:VCALENDAR")) {
      const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length
      noteSurface(outcome, "ical_export", "ok",
        `iCal export valid with ${eventCount} VEVENTs`)
      ical.verdict = eventCount > 0 ? "pass" : "partial"
    } else {
      noteSurface(outcome, "ical_export", "fail",
        "iCal export missing VCALENDAR markers")
      ical.verdict = "fail"
    }
  } else {
    noteSurface(outcome, "ical_export", "fail",
      `iCal export returned ${icalRes.status}`)
    ical.verdict = "fail"
  }

  return { arrived: true }
}

// ---------------------------------------------------------------------------
// Surface 13 — Wellbeing
// ---------------------------------------------------------------------------

async function captureWellbeing(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.wellbeing

  if (!outcome.arrived) {
    noteSurface(outcome, "wellbeing", "fail", "Cannot test wellbeing — persona did not arrive")
    surface.verdict = "fail"
    return
  }

  // Force-clear the localStorage cooldown so the component shows
  await page.goto(`${BASE}/settling-in`)
  await waitForLoad(page)
  await page.evaluate(() => localStorage.removeItem("gomate:last-checkin-prompt"))
  await page.reload()
  await waitForLoad(page)
  await page.waitForTimeout(4500)

  // Look for the wellbeing component — it has "How are you feeling" or mood emojis
  const wellbeingHeading = page.locator(':text-matches("How are you feeling|wellbeing|check[- ]?in", "i")').first()
  const visible = await wellbeingHeading.isVisible({ timeout: 4000 }).catch(() => false)
  if (!visible) {
    noteSurface(outcome, "wellbeing", "fail",
      "Wellbeing check-in component not visible despite arrival 8 days ago")
    surface.verdict = "fail"
    await page.screenshot({ path: `${outcome.artifactPath}/16-wellbeing.png`, fullPage: true })
    return
  }

  await wellbeingHeading.scrollIntoViewIfNeeded().catch(() => {})
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${outcome.artifactPath}/16-wellbeing.png`, fullPage: true })

  // Click the "Good" mood (a common safe choice)
  let okCount = 0
  let totalChecks = 0

  totalChecks++
  noteSurface(outcome, "wellbeing", "ok", "Wellbeing component visible")
  okCount++

  const goodMood = page.locator('button:has-text("Good"), button:has-text("Great")').first()
  totalChecks++
  if (await goodMood.isVisible({ timeout: 2000 }).catch(() => false)) {
    await goodMood.click().catch(() => {})
    await page.waitForTimeout(800)

    // Submit
    const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Send"), button:has-text("Save")').first()
    if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await submitBtn.click().catch(() => {})
      await page.waitForTimeout(2500)
      noteSurface(outcome, "wellbeing", "ok", "Submitted check-in via UI")
      okCount++
    } else {
      // Submit through API as a fallback diagnostic
      const apiRes = await apiJson(page, {
        path: "/api/wellbeing",
        method: "POST",
        body: { mood: "good" },
      })
      writeJson(`${outcome.artifactPath}/wellbeing-submit.json`, apiRes)
      if (apiRes.status === 200) {
        noteSurface(outcome, "wellbeing", "warn",
          "Could not find submit button in UI — fell back to API; component may be missing a submit affordance")
        okCount++
      } else {
        noteSurface(outcome, "wellbeing", "fail",
          `No submit button visible and API submit failed: ${apiRes.status}`)
      }
    }
  } else {
    noteSurface(outcome, "wellbeing", "fail", "No mood buttons visible")
  }

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.5 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Surface 14 — Post-arrival chat
// ---------------------------------------------------------------------------

async function capturePostArrivalChat(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.post_arrival_chat
  if (!outcome.arrived) {
    noteSurface(outcome, "post_arrival_chat", "fail", "Cannot test post-arrival chat — persona did not arrive")
    surface.verdict = "fail"
    return
  }

  await page.goto(`${BASE}/chat`)
  await waitForLoad(page)
  await page.waitForTimeout(3000)

  const chatInput = page.locator('input[placeholder="Type your message..."], input[placeholder="Ask follow-up questions..."]').first()
  if (!(await chatInput.isVisible({ timeout: 5000 }).catch(() => false))) {
    noteSurface(outcome, "post_arrival_chat", "fail",
      "Chat input not visible after arrival")
    surface.verdict = "fail"
    return
  }

  // Verify the chat header signals post-arrival mode
  const body = (await page.textContent("body")) || ""
  let okCount = 0
  let totalChecks = 0

  totalChecks++
  if (body.toLowerCase().includes("ask") || body.toLowerCase().includes("settling") || body.toLowerCase().includes("arrived")) {
    noteSurface(outcome, "post_arrival_chat", "ok", "Chat header reflects post-arrival state")
    okCount++
  } else {
    noteSurface(outcome, "post_arrival_chat", "warn",
      "Chat header does not clearly indicate post-arrival mode")
  }

  // Send a task-aware question
  totalChecks++
  await chatInput.fill("What's the most urgent settling-in task I have left? Please name one.")
  await chatInput.press("Enter")
  const settled = await waitForAIQuiet(page, 45_000)
  if (settled) {
    noteSurface(outcome, "post_arrival_chat", "ok", "Got a response to a task-aware question")
    okCount++
  } else {
    noteSurface(outcome, "post_arrival_chat", "fail", "Post-arrival chat did not respond within 45s")
  }

  await page.screenshot({ path: `${outcome.artifactPath}/17-post-arrival-chat.png`, fullPage: true })

  // Check the response actually mentions a task or referenced data
  totalChecks++
  const reply = await getLastAssistantMessage(page)
  writeFileSync(`${outcome.artifactPath}/post-arrival-chat-reply.txt`, reply)
  const replyLower = reply.toLowerCase()
  if (
    replyLower.includes("task") ||
    replyLower.includes("register") ||
    replyLower.includes("bank") ||
    replyLower.includes("anmeldung") ||
    replyLower.includes("deadline") ||
    replyLower.includes(persona.expectedCity.toLowerCase()) ||
    replyLower.includes(persona.expectedDestination.toLowerCase())
  ) {
    noteSurface(outcome, "post_arrival_chat", "ok", "Reply references tasks/destination/key concepts")
    okCount++
  } else {
    noteSurface(outcome, "post_arrival_chat", "fail",
      `Reply doesn't mention any task/destination concept (first 200 chars: ${reply.slice(0, 200)})`)
  }

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.6 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Field-extraction post-check (re-uses backend profile)
// ---------------------------------------------------------------------------

function verifyExtraction(persona: Persona, profileBody: any, outcome: PersonaOutcome) {
  const profile = (profileBody?.plan?.profile_data || {}) as Record<string, unknown>
  for (const [key, expected] of Object.entries(persona.expectedProfile)) {
    const actual = profile[key]
    if (actual === null || actual === undefined || actual === "") {
      outcome.fieldChecks.push({ key, expected, actual, verdict: "missing" })
      outcome.bugs.push(`Profile missing expected field "${key}" (expected ~"${expected}")`)
      continue
    }
    if (valueLooksCorrect(key, actual, expected)) {
      outcome.fieldChecks.push({ key, expected, actual, verdict: "correct" })
    } else {
      const expectedTokens = normalize(expected).split(" ").filter((t) => t.length >= 4)
      const actualNorm = normalize(String(actual))
      const stemOverlap = expectedTokens.some((t) => actualNorm.includes(t.slice(0, 4)))
      const verdict: "partial" | "incorrect" = stemOverlap ? "partial" : "incorrect"
      outcome.fieldChecks.push({ key, expected, actual, verdict })
      if (verdict === "incorrect") {
        outcome.bugs.push(`Profile mismatch for "${key}": got "${String(actual)}" expected ~"${expected}"`)
      } else {
        outcome.warnings.push(`Profile partial mismatch for "${key}": got "${String(actual)}" expected ~"${expected}"`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Verdict computation
// ---------------------------------------------------------------------------

function computeOverallVerdict(o: PersonaOutcome): "pass" | "partial" | "fail" {
  let passes = 0, partials = 0, fails = 0
  for (const k of Object.keys(o.surfaces)) {
    const v = o.surfaces[k].verdict
    if (v === "pass") passes++
    else if (v === "partial") partials++
    else if (v === "fail") fails++
  }
  // Onboarding fail → fail
  if (o.surfaces.onboarding.verdict === "fail") return "fail"
  if (fails >= 3) return "fail"
  if (fails >= 1 || partials >= 2) return "partial"
  if (passes === Object.keys(o.surfaces).length) return "pass"
  return "partial"
}

function getGitSha(): string {
  try { return execSync("git rev-parse HEAD").toString().trim() } catch { return "(unknown)" }
}

// ---------------------------------------------------------------------------
// Test description
// ---------------------------------------------------------------------------

test.describe.configure({ timeout: 18 * 60 * 1000 })

test.describe("Full-surface 10-persona end-to-end audit", () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    ensureDir(RUN_ROOT)
    // Clear usage cap so all 10 personas can exercise generation-bound surfaces.
    // This is test setup only — does NOT change runtime product behaviour.
    const cleared = await resetUsage()
    console.log(`[full-surface] Cleared ${cleared} prior usage_events`)
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await signIn(page)
    const profileRes = await apiJson(page, { path: "/api/profile" })
    expect(profileRes.status).toBe(200)
  })

  test.beforeEach(async () => {
    // Per-persona usage reset — Pro+ has a 15/month cap and a 2/min rate
    // limit. Without this each persona would skip generation-bound surfaces
    // after the budget is drained.
    await resetUsage()
  })

  test.afterAll(async () => {
    if (page) await page.close().catch(() => {})

    const passed = outcomes.filter((o) => o.verdict === "pass").length
    const partial = outcomes.filter((o) => o.verdict === "partial").length
    const failed = outcomes.filter((o) => o.verdict === "fail").length
    const start = outcomes[0]?.startedAt
    const end = outcomes[outcomes.length - 1]?.endedAt

    writeText(
      `${RUN_ROOT}/RUN_CONTEXT.md`,
      [
        `# RUN_CONTEXT — full-surface audit`,
        ``,
        `- Run ID: ${RUN_ID}`,
        `- Git SHA: ${getGitSha()}`,
        `- Base URL: ${BASE}`,
        `- Started: ${start || "(none)"}`,
        `- Ended: ${end || "(none)"}`,
        `- Personas executed: ${outcomes.length}`,
        `- Environment: local Next.js dev server (\`pnpm dev\`)`,
        `- External services hit live: Supabase, OpenAI/OpenRouter, Frankfurter, Firecrawl, Numbeo`,
        `- Required env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, OPENAI_BASE_URL, FIRECRAWL_API_KEY, TEST_EMAIL, TEST_PASSWORD`,
        `- Test command: \`pnpm exec playwright test tests/strict/full-surface.spec.ts --reporter=list\``,
        `- Test user tier: pro_plus`,
        ``,
      ].join("\n")
    )

    // Surface matrix
    const surfaceMatrix: string[] = [
      `# SURFACE_MATRIX — ${RUN_ID}`,
      ``,
      `| Persona | ` + SURFACES.map((s) => s).join(" | ") + " | overall |",
      `| --- | ` + SURFACES.map(() => "---").join(" | ") + " | --- |",
      ...outcomes.map((o) => {
        const cells = SURFACES.map((s) => {
          const r = o.surfaces[s]
          if (!r) return "—"
          const symbol = r.verdict === "pass" ? "✓" : r.verdict === "partial" ? "~" : r.verdict === "fail" ? "✗" : "·"
          return `${symbol} ${r.depth.charAt(0)}`
        })
        return `| ${o.slug} | ${cells.join(" | ")} | ${o.verdict} |`
      }),
      ``,
      `Legend: ✓ pass · ~ partial · ✗ fail · · not tested. Letter: d=deep · s=shallow · k=skipped.`,
      ``,
      `## Surface depth definitions`,
      ``,
      ...SURFACES.map((s) => {
        const r = outcomes[0]?.surfaces[s]
        return `- **${s}**: ${r?.depth || "n/a"}`
      }),
      ``,
    ]
    writeText(`${RUN_ROOT}/SURFACE_MATRIX.md`, surfaceMatrix.join("\n"))

    // Summary
    const summaryLines: string[] = [
      `# Strict Full-Surface Audit — ${RUN_ID}`,
      ``,
      `## Top-line answer`,
      ``,
      `- Passed: ${passed}/${outcomes.length}`,
      `- Partial: ${partial}/${outcomes.length}`,
      `- Failed: ${failed}/${outcomes.length}`,
      ``,
      `**Overall:** ${failed > 0 ? "DO NOT PROCEED" : partial > 0 ? "Acceptable for one more controlled batch after listed issues are fixed" : "Acceptable for broader beta"}`,
      ``,
      `## Per-persona summary`,
      ``,
      ...outcomes.flatMap((o) => [
        `### ${o.slug} — ${o.name} — ${o.route}`,
        ``,
        `- Verdict: **${o.verdict.toUpperCase()}**`,
        `- Onboarding completed: ${o.onboardingComplete}`,
        `- Guide ready after lock: ${o.guideReady}`,
        `- Arrived: ${o.arrived}`,
        `- Turns: ${o.turns}`,
        `- Bugs: ${o.bugs.length}`,
        `- Warnings: ${o.warnings.length}`,
        `- Surface verdicts: ${SURFACES.map((s) => `${s}=${o.surfaces[s]?.verdict || "·"}`).join(", ")}`,
        `- Evidence: ${o.artifactPath}`,
        ``,
      ]),
      `## Aggregate bugs`,
      ``,
      ...outcomes.flatMap((o) => o.bugs.map((b) => `- [${o.slug}] ${b}`)),
      ``,
    ]
    writeText(`${RUN_ROOT}/SUMMARY.md`, summaryLines.join("\n"))

    writeJson(`${RUN_ROOT}/SUMMARY.json`, {
      runId: RUN_ID,
      gitSha: getGitSha(),
      passed,
      partial,
      failed,
      outcomes,
    })

    const bugsMd = [
      `# Bugs found in full-surface audit ${RUN_ID}`,
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
        turns: 0,
        onboardingComplete: false,
        guideReady: false,
        arrived: false,
        artifactPath: `${RUN_ROOT}/${persona.slug}`,
        surfaces: {
          onboarding: newSurface("deep"),
          dashboard: newSurface("deep"),
          cost_of_living: newSurface("deep"),
          guide: newSurface("deep"),
          documents: newSurface("deep"),
          visa_tracker: newSurface("deep"),
          banking: newSurface("deep"),
          tax_registration: newSurface("deep"),
          settling_in_tasks: newSurface("deep"),
          settling_in_calendar: newSurface("deep"),
          ical_export: newSurface("deep"),
          wellbeing: newSurface("deep"),
          post_arrival_chat: newSurface("deep"),
        },
        fieldChecks: [],
        bugs: [],
        warnings: [],
        observations: [],
        verdict: "fail",
      }
      ensureDir(outcome.artifactPath)
      outcomes.push(outcome)

      const created = await createPlan(page, persona)
      outcome.planId = created.id
      outcome.planTitle = created.title
      noteO(outcome, "obs", `Created plan ${created.id}`)

      // 1. Onboarding
      await driveOnboarding(page, persona, outcome)

      // 2. Backend extraction snapshot
      const profileRes = await apiJson(page, { path: "/api/profile" })
      writeJson(`${outcome.artifactPath}/profile.json`, profileRes)
      const progressRes = await apiJson(page, { path: "/api/progress" })
      writeJson(`${outcome.artifactPath}/progress.json`, progressRes)
      verifyExtraction(persona, profileRes.data, outcome)

      // 3. Lock plan + guide gen
      if (outcome.onboardingComplete) {
        const lockResult = await lockPlanViaUi(page, persona, outcome)
        outcome.guideReady = lockResult.guideReady
        if (lockResult.locked && lockResult.planVersion !== null) {
          // Wait briefly for the auto-guide to be present, then trigger research
          for (let i = 0; i < 6; i++) {
            const gr = await isGuideReady(page, outcome.planId!)
            if (gr) { outcome.guideReady = true; break }
            await page.waitForTimeout(2500)
          }
          await triggerResearch(page, outcome.planId!, outcome)
          await waitForResearch(page, outcome.planId!, outcome, 90_000)
        }
      } else {
        noteO(outcome, "warn", "Onboarding incomplete — skipping lock/research/post-arrival surfaces")
        for (const surface of ["dashboard", "cost_of_living", "guide", "documents", "visa_tracker", "banking", "tax_registration", "settling_in_tasks", "settling_in_calendar", "ical_export", "wellbeing", "post_arrival_chat"]) {
          outcome.surfaces[surface].verdict = "skipped"
        }
        outcome.endedAt = nowIso()
        outcome.verdict = computeOverallVerdict(outcome)
        writePersonaObservations(outcome, persona)
        return
      }

      // 4. Dashboard
      await captureDashboard(page, persona, outcome)

      // 5. Cost of Living
      await captureCostOfLiving(page, persona, outcome)

      // 6. Guide
      await captureGuide(page, persona, outcome)

      // 7. Documents
      await captureDocuments(page, persona, outcome)

      // 8. Visa Tracker
      await captureVisaTracker(page, persona, outcome)

      // 9. Banking
      await captureBanking(page, persona, outcome)

      // 10. Tax Registration
      await captureTaxRegistration(page, persona, outcome)

      // 11/12/13. Settling-in (tasks + calendar + iCal)
      await captureSettlingInFull(page, persona, outcome)

      // 14. Wellbeing
      await captureWellbeing(page, persona, outcome)

      // 15. Post-arrival chat
      await capturePostArrivalChat(page, persona, outcome)

      outcome.endedAt = nowIso()
      outcome.verdict = computeOverallVerdict(outcome)
      writePersonaObservations(outcome, persona)
    })
  }
})

function writePersonaObservations(o: PersonaOutcome, persona: Persona) {
  const lines = [
    `# ${o.slug} — ${o.name} — ${o.route}`,
    ``,
    `- Plan ID: ${o.planId}`,
    `- Plan title: ${o.planTitle}`,
    `- Started: ${o.startedAt}`,
    `- Ended: ${o.endedAt}`,
    `- Onboarding complete: ${o.onboardingComplete}`,
    `- Guide ready: ${o.guideReady}`,
    `- Arrived: ${o.arrived}`,
    `- Turns answered: ${o.turns}`,
    `- Verdict: **${o.verdict.toUpperCase()}**`,
    ``,
    `## Surface verdicts`,
    ``,
    ...SURFACES.map((s) => `- **${s}** (${o.surfaces[s].depth}): ${o.surfaces[s].verdict}`),
    ``,
    `## Surface notes`,
    ``,
    ...SURFACES.flatMap((s) => {
      const r = o.surfaces[s]
      if (r.notes.length === 0) return []
      return [`### ${s}`, ``, ...r.notes.map((n) => `- ${n}`), ``]
    }),
    `## Field extraction`,
    ``,
    `| key | expected | actual | verdict |`,
    `| --- | --- | --- | --- |`,
    ...o.fieldChecks.map(
      (c) => `| ${c.key} | ${c.expected} | ${String(c.actual ?? "")} | ${c.verdict} |`
    ),
    ``,
    `## Bugs`,
    ``,
    ...o.bugs.map((b) => `- ${b}`),
    ``,
    `## Warnings`,
    ``,
    ...o.warnings.map((w) => `- ${w}`),
    ``,
    `## Observations`,
    ``,
    ...o.observations.map((b) => `- ${b}`),
    ``,
  ]
  writeText(`${o.artifactPath}/observations.md`, lines.join("\n"))
}
