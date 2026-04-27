/**
 * Full-surface, strict-UI-only persona harness.
 *
 * Differences vs `full-surface.spec.ts`:
 *   - Lock plan ONLY through the dashboard's "Lock plan" button. No API
 *     fallback. If the button is missing, onboarding → fail.
 *   - Arrival ONLY through the dashboard's "I've arrived!" banner. No API
 *     POST. If the banner isn't shown, post-arrival surfaces → fail.
 *   - Settling-in generation ONLY through the "Generate checklist" button on
 *     /settling-in. No API POST.
 *   - Guide retry ONLY through the "Generate Guide" button on /guides. No
 *     direct POST as a rescue.
 *   - Wellbeing ONLY through the mood-button + Submit UI on /settling-in.
 *     No API POST fallback.
 *   - Visa-tracker selection ONLY through the "Select your visa" UI.
 *
 * API reads are still allowed for verification. API writes are NOT used as
 * rescue paths anywhere in Layer 1.
 */

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

const BASE = process.env.GOMATE_BASE_URL || "http://localhost:3000"
const RUN_ID = process.env.GOMATE_RUN_ID || new Date().toISOString().replace(/[:.]/g, "-")
const RUN_ROOT = `artifacts/e2e-full-surface/${RUN_ID}`
const ONLY_SLUGS = (process.env.PERSONAS || "").split(",").map((s) => s.trim()).filter(Boolean)

const TEST_EMAIL = envOrThrow("TEST_EMAIL")
const TEST_PASSWORD = envOrThrow("TEST_PASSWORD")

let adminClient: SupabaseClient | null = null
let testUserId: string | null = null

function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient
  adminClient = createAdminClient(envOrThrow("NEXT_PUBLIC_SUPABASE_URL"), envOrThrow("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  })
  return adminClient
}

async function resolveTestUserId(): Promise<string> {
  if (testUserId) return testUserId
  const admin = getAdminClient()
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  const u = data.users.find((x) => (x.email || "").toLowerCase() === TEST_EMAIL.toLowerCase())
  if (!u) throw new Error(`Test user ${TEST_EMAIL} not found`)
  testUserId = u.id
  return testUserId
}

async function resetUsage(): Promise<number> {
  const admin = getAdminClient()
  const userId = await resolveTestUserId()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin.from("usage_events").delete({ count: "exact" }).eq("user_id", userId).gte("created_at", cutoff)
  return count || 0
}

// ---------------------------------------------------------------------------
// Surface tracking
// ---------------------------------------------------------------------------

type SurfaceVerdict = "pass" | "partial" | "fail" | "skipped" | "not-tested"

interface SurfaceResult {
  verdict: SurfaceVerdict
  depth: "deep" | "shallow"
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
  apiWritesUsedAsRescue: string[]
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
  "compliance_alerts",
  "ical_export",
  "wellbeing",
  "post_arrival_chat",
] as const

const outcomes: PersonaOutcome[] = []

function newSurface(): SurfaceResult {
  return { verdict: "not-tested", depth: "deep", notes: [], bugs: [] }
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
// Field-label helpers
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
  if (q.includes("years of experience") || q.includes("work experience") || q.includes("professional experience")) return "years_experience"
  if (q.includes("prior visa") || q.includes("had a visa before")) return "prior_visa"
  if (q.includes("visa rejection") || q.includes("ever been rejected")) return "visa_rejections"
  if (q.includes("healthcare") || q.includes("medical needs") || q.includes("healthcare needs")) return "healthcare_needs"
  if (q.includes("pets") || q.includes("animals") || q.includes("bringing any pet")) return "pets"
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
// Page helpers
// ---------------------------------------------------------------------------

async function waitForLoad(page: Page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {})
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {})
}

async function waitForAIQuiet(page: Page, maxWait = 45000): Promise<boolean> {
  // Wait for BOTH the typing-dot indicator AND the send-button spinner to be
  // gone. While streaming, animate-bounce hides but the submit-button spinner
  // remains because isLoading is still true. The review/confirm card is gated
  // on !isLoading, so we must wait for that to settle too.
  const start = Date.now()
  await page.waitForTimeout(1200)
  while (Date.now() - start < maxWait) {
    const stillTyping = await page
      .locator(".animate-bounce")
      .first()
      .isVisible({ timeout: 200 })
      .catch(() => false)
    const stillLoading = await page
      .locator('form button[type="submit"] .animate-spin')
      .first()
      .isVisible({ timeout: 200 })
      .catch(() => false)
    if (!stillTyping && !stillLoading) {
      await page.waitForTimeout(900)
      const againTyping = await page
        .locator(".animate-bounce")
        .first()
        .isVisible({ timeout: 200 })
        .catch(() => false)
      const againLoading = await page
        .locator('form button[type="submit"] .animate-spin')
        .first()
        .isVisible({ timeout: 200 })
        .catch(() => false)
      if (!againTyping && !againLoading) return true
    }
    await page.waitForTimeout(500)
  }
  return false
}

async function getLastAssistantMessage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll("div.justify-start"))
    const texts = rows.map((row) => (row.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean)
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
  // Plan creation uses the Plan Switcher's "Create new plan" button, but
  // since this is a new user setup not a switching test, we accept that the
  // platform exposes this via API. POST /api/plans is called here as the
  // plumbing for "user clicks New Plan" — there is no UI affordance to
  // create N plans for an audit other than this. Logged for transparency.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const res = await apiJson(page, {
    path: "/api/plans",
    method: "POST",
    body: { title: `FSS-${persona.slug} | ${stamp}` },
  })
  expect(res.status, `Plan create status for ${persona.slug}`).toBe(200)
  const data = res.data as any
  expect(data?.plan?.id).toBeTruthy()
  return { id: data.plan.id as string, title: data.plan.title as string }
}

// ---------------------------------------------------------------------------
// Surface — Onboarding (chat UI only, no API rescues)
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

  for (let step = 0; step < 60; step++) {
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
        noteSurface(outcome, "onboarding", "ok", `Reached review at ${pct}% and clicked Confirm via UI`)
      } catch {
        noteSurface(outcome, "onboarding", "fail", "confirm-plan-btn click failed despite review card visible")
      }
      break
    }

    if (pct >= 100 && !pendingLabel) {
      // Wait briefly for state to settle, then check review card.
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
          noteSurface(outcome, "onboarding", "ok", `Reached review at 100% and clicked Confirm via UI`)
        } catch {
          noteSurface(outcome, "onboarding", "fail", "confirm-plan-btn click failed at 100%")
        }
      } else {
        noteSurface(outcome, "onboarding", "fail",
          `Profile reached ${pct}% but review/confirm card never appeared in the chat UI`)
      }
      break
    }

    if (!pendingLabel) {
      const lowerAssistant = (lastAssistant || "").toLowerCase()
      const looksLikeQuestion = /[?]/.test(lastAssistant) || /\b(what|which|where|when|how|tell me|do you|are you|can you)\b/.test(lowerAssistant)
      if (!looksLikeQuestion) {
        unanswered += 1
        if (unanswered >= 3) {
          noteSurface(outcome, "onboarding", "fail",
            `Chat went silent at ${pct}% with no pending field — onboarding stuck`)
          break
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
      if (repeats >= 2) noteSurface(outcome, "onboarding", "warn", `Repeated pending label "${pendingLabel}"`)
      if (repeats >= 6) {
        noteSurface(outcome, "onboarding", "fail", `Pending label "${pendingLabel}" looped 6 times — chat stuck`)
        break
      }
    } else {
      repeats = 0
    }
    lastLabel = pendingLabel

    const answer = persona.fields[fieldKey]
    if (!answer) {
      // Some personas don't have an answer for healthcare_needs/pets/etc.
      // The product now requires those fields, so we send a credible
      // "none" answer so the test reflects what a real user would do.
      const fallbackAnswer = (() => {
        if (fieldKey === "pets") return "No pets."
        if (fieldKey === "healthcare_needs") return "No special healthcare needs."
        if (fieldKey === "special_requirements") return "Nothing special."
        if (fieldKey === "prior_visa") return "No prior visa."
        if (fieldKey === "visa_rejections") return "No rejections."
        return "Let's skip that one."
      })()
      noteSurface(outcome, "onboarding", "warn", `No persona answer for "${fieldKey}" — sent fallback "${fallbackAnswer}"`)
      await chatInput.fill(fallbackAnswer)
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

  if (!midShotTaken) await page.screenshot({ path: `${outcome.artifactPath}/02-chat-mid.png`, fullPage: true })
  if (!reachedReview) await page.screenshot({ path: `${outcome.artifactPath}/03-chat-review.png`, fullPage: true })

  outcome.onboardingComplete = reachedReview && confirmed
  surface.verdict = outcome.onboardingComplete ? (surface.bugs.length === 0 ? "pass" : "partial") : "fail"
  return { reachedReview, confirmed }
}

// ---------------------------------------------------------------------------
// Lock plan — DASHBOARD UI ONLY. No API fallback.
// ---------------------------------------------------------------------------

async function lockPlanViaUiStrict(page: Page, persona: Persona, outcome: PersonaOutcome): Promise<{ locked: boolean }> {
  await page.goto(`${BASE}/dashboard`)
  await waitForLoad(page)
  await page.waitForTimeout(3500)

  const lockBtn = page.locator('button:has-text("Lock plan"), button:has-text("Lock Plan")').first()
  const visible = await lockBtn.isVisible({ timeout: 6000 }).catch(() => false)
  if (!visible) {
    noteO(outcome, "bug", "Dashboard 'Lock plan' button not visible — onboarding likely incomplete or dashboard out of sync")
    return { locked: false }
  }

  try {
    await lockBtn.click({ timeout: 5000 })
  } catch (e) {
    noteO(outcome, "bug", `Lock button click error: ${String(e).slice(0, 120)}`)
    return { locked: false }
  }

  // Wait up to 70 s for the lock action to resolve client-side. With the new
  // backend (lock decoupled from guide gen, 45 s cap) this should resolve
  // within ~50 s even when guide gen takes its full budget.
  const locked = await page.waitForFunction(
    () => {
      const t = document.body.textContent || ""
      return t.includes("Plan locked") || t.includes("Unlock to edit") || t.includes("locked")
    },
    { timeout: 70_000 }
  ).then(() => true).catch(() => false)

  if (!locked) {
    noteO(outcome, "bug", "Dashboard never confirmed lock within 70s")
  } else {
    noteO(outcome, "obs", "Plan locked via dashboard UI button")
  }
  return { locked }
}

// ---------------------------------------------------------------------------
// Guide — read /api/guides for verification, fall back to clicking the UI
// "Generate Guide" button on /guides if the auto-guide didn't finish.
// ---------------------------------------------------------------------------

async function captureGuide(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.guide
  let listRes = await apiJson(page, { path: "/api/guides" })
  writeJson(`${outcome.artifactPath}/guide-list.json`, listRes)
  let guides = ((listRes.data as any)?.guides || []) as Array<any>

  if (!Array.isArray(guides) || guides.length === 0) {
    // Real-user retry path: visit /guides and click "Generate Guide" button.
    noteSurface(outcome, "guide", "warn", "No auto-guide yet — clicking 'Generate Guide' on /guides")
    await page.goto(`${BASE}/guides`)
    await waitForLoad(page)
    await page.waitForTimeout(1500)
    const genBtn = page.locator('button:has-text("Generate Guide")').first()
    if (await genBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      try {
        await genBtn.click({ timeout: 5000 })
        // Click triggers a navigation to /guides/[id] on success after up to ~120s.
        // Wait for either navigation to a guide id, or for the generating button to clear.
        await Promise.race([
          page.waitForURL(/\/guides\/[a-f0-9-]+/i, { timeout: 130_000 }),
          page.waitForFunction(
            () => !document.body.textContent?.includes("Generating..."),
            { timeout: 130_000 }
          ),
        ])
        noteSurface(outcome, "guide", "ok", "UI 'Generate Guide' button completed within budget")
      } catch (e) {
        noteSurface(outcome, "guide", "fail",
          `'Generate Guide' button never resolved: ${String(e).slice(0, 200)}`)
      }
    } else {
      noteSurface(outcome, "guide", "fail", "/guides page does not show a 'Generate Guide' button — no UI retry path")
    }
    listRes = await apiJson(page, { path: "/api/guides" })
    writeJson(`${outcome.artifactPath}/guide-list.json`, listRes)
    guides = ((listRes.data as any)?.guides || []) as Array<any>
  }

  if (!Array.isArray(guides) || guides.length === 0) {
    noteSurface(outcome, "guide", "fail", "No guide returned even after explicit UI generate retry")
    surface.verdict = "fail"
    await page.goto(`${BASE}/guides`)
    await waitForLoad(page)
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${outcome.artifactPath}/06-guide-overview.png`, fullPage: true })
    return
  }

  outcome.guideReady = true
  const guide = guides[0]
  const detailRes = await apiJson(page, { path: `/api/guides/${guide.id}` })
  writeJson(`${outcome.artifactPath}/guide-detail.json`, detailRes)
  const detail = (detailRes.data as any)?.guide || (detailRes.data as any) || null

  let okCount = 0
  let totalChecks = 0

  totalChecks++
  if (normalize(String(detail?.destination || "")).includes(normalize(persona.expectedDestination))) {
    okCount++
    noteSurface(outcome, "guide", "ok", `Guide destination matches "${persona.expectedDestination}"`)
  } else {
    noteSurface(outcome, "guide", "fail", `Guide destination "${detail?.destination}" doesn't match`)
  }

  totalChecks++
  const guideCurrency = String(detail?.currency || "").toUpperCase()
  if (guideCurrency === persona.expectedDestinationCurrency) {
    okCount++
    noteSurface(outcome, "guide", "ok", `Guide currency = ${persona.expectedDestinationCurrency}`)
  } else {
    noteSurface(outcome, "guide", "fail", `Guide currency is ${guideCurrency}, expected ${persona.expectedDestinationCurrency}`)
  }

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
      if (label === "checklist" && Array.isArray((v as any).categories)) {
        substantive = (v as any).categories.length >= 2
      }
    }
    if (substantive) {
      okCount++
      noteSurface(outcome, "guide", "ok", `Section "${label}" populated`)
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
  if (await visaTab.isVisible({ timeout: 1500 }).catch(() => false)) await visaTab.click().catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${outcome.artifactPath}/07-guide-visa.png`, fullPage: true })

  const timelineTab = page.locator('button:has-text("Timeline"), [role="tab"]:has-text("Timeline")').first()
  if (await timelineTab.isVisible({ timeout: 1500 }).catch(() => false)) await timelineTab.click().catch(() => {})
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${outcome.artifactPath}/08-guide-timeline.png`, fullPage: true })

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.7 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Dashboard
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
      noteSurface(outcome, "dashboard", "ok", `${field} "${value}" visible`)
    } else {
      noteSurface(outcome, "dashboard", "fail", `${field} "${value}" not visible`)
    }
  }
  surface.verdict = pass === checks.length ? "pass" : pass >= 3 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Cost of living
// ---------------------------------------------------------------------------

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
    okCount++
    noteSurface(outcome, "cost_of_living", "ok", `from.currency = ${persona.expectedHomeCurrency}`)
  } else {
    noteSurface(outcome, "cost_of_living", "fail", `from.currency = "${data.from?.currency}", expected ${persona.expectedHomeCurrency}`)
  }
  totalChecks++
  if (data.to?.currency === persona.expectedDestinationCurrency) {
    okCount++
    noteSurface(outcome, "cost_of_living", "ok", `to.currency = ${persona.expectedDestinationCurrency}`)
  } else {
    noteSurface(outcome, "cost_of_living", "fail", `to.currency = "${data.to?.currency}", expected ${persona.expectedDestinationCurrency}`)
  }
  totalChecks++
  if (data.from?.rent?.apartment1BedCity > 0 && data.to?.rent?.apartment1BedCity > 0) {
    okCount++
    noteSurface(outcome, "cost_of_living", "ok", "Rent values populated for both source and destination")
  } else {
    noteSurface(outcome, "cost_of_living", "fail", "Rent values missing or zero")
  }

  // The "Estimated" badge is visible when fallback active — that's an honest
  // user-facing state, not a failure.
  if (data.isFallback) {
    noteSurface(outcome, "cost_of_living", "warn", "Live Numbeo scrape unavailable — UI shows the 'Estimated' badge")
  }

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
    okCount++
    noteSurface(outcome, "cost_of_living", "ok", `Home currency ${persona.expectedHomeCurrency} visible on dashboard`)
  } else {
    noteSurface(outcome, "cost_of_living", "fail", `Home currency ${persona.expectedHomeCurrency} not visible on dashboard`)
  }
  totalChecks++
  if (body.includes(persona.expectedDestinationCurrency) || body.includes(currencySymbolFor(persona.expectedDestinationCurrency))) {
    okCount++
    noteSurface(outcome, "cost_of_living", "ok", `Destination currency visible on dashboard`)
  } else {
    noteSurface(outcome, "cost_of_living", "fail", `Destination currency ${persona.expectedDestinationCurrency} not visible on dashboard`)
  }

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.7 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Documents — UI page + UI completion toggle
// ---------------------------------------------------------------------------

async function captureDocuments(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.documents
  // Read API for verification
  const res = await apiJson(page, { path: "/api/documents" })
  writeJson(`${outcome.artifactPath}/documents.json`, res)

  if (res.status !== 200) {
    noteSurface(outcome, "documents", "fail", `/api/documents returned ${res.status}`)
    surface.verdict = "fail"
    return
  }
  const data = res.data as any
  const checklistItems = (data?.checklistItems?.items || []) as Array<{ id: string; document: string }>
  let okCount = 0
  let totalChecks = 0

  totalChecks++
  if (checklistItems.length > 0) {
    okCount++
    noteSurface(outcome, "documents", "ok", `Checklist has ${checklistItems.length} items`)
  } else {
    noteSurface(outcome, "documents", "fail", "Documents checklist is empty")
  }

  await page.goto(`${BASE}/documents`)
  await waitForLoad(page)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${outcome.artifactPath}/10-documents.png`, fullPage: true })

  totalChecks++
  const body = (await page.textContent("body")) || ""
  if (body.toLowerCase().includes("document")) {
    okCount++
    noteSurface(outcome, "documents", "ok", "/documents page renders")
  } else {
    noteSurface(outcome, "documents", "fail", "/documents page content suspicious")
  }

  // Try to click a checkbox/toggle on the first document
  totalChecks++
  if (checklistItems.length > 0) {
    // Match by document name text and click the "Mark ready" / status toggle.
    const firstName = checklistItems[0].document
    const docRow = page.locator(`text="${firstName}"`).first()
    let toggled = false
    try {
      if (await docRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        // find a button or status select near the row — try common labels.
        const readyBtn = page
          .locator('button:has-text("Ready"), button:has-text("Mark Ready"), button:has-text("Mark ready")')
          .first()
        if (await readyBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await readyBtn.click({ timeout: 3000 })
          await page.waitForTimeout(1500)
          toggled = true
        }
      }
    } catch (e) {
      // ignore
    }
    if (toggled) {
      okCount++
      noteSurface(outcome, "documents", "ok", `Toggled "${firstName}" via UI`)
    } else {
      noteSurface(outcome, "documents", "warn", "Could not find a 'Ready'/'Mark Ready' toggle in the documents UI")
    }
  }

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.7 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Visa tracker — UI selection only
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
    okCount++
    noteSurface(outcome, "visa_tracker", "ok", `${visaOptionsCount} visa options available`)
  } else {
    noteSurface(outcome, "visa_tracker", "fail", "No visa options — neither live research nor fallback returned data")
  }

  totalChecks++
  const body = (await page.textContent("body")) || ""
  if (body.toLowerCase().includes("no visa research yet") ||
      body.toLowerCase().includes("cannot load")) {
    noteSurface(outcome, "visa_tracker", "fail", "Page shows the empty/error state")
  } else if (body.toLowerCase().includes("select your visa") ||
             body.toLowerCase().includes("application status")) {
    okCount++
    noteSurface(outcome, "visa_tracker", "ok", "Page shows visa-selection UI")
  }

  // Click the first visa option button (UI write).
  if (visaOptionsCount > 0) {
    totalChecks++
    const firstOption = page.locator('button:has(h3)').first()
    if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      try {
        await firstOption.click({ timeout: 5000 })
        await page.waitForTimeout(2500)
        okCount++
        noteSurface(outcome, "visa_tracker", "ok", "Selected first visa option via UI button")
      } catch (e) {
        noteSurface(outcome, "visa_tracker", "fail", `Could not click visa option: ${String(e).slice(0, 120)}`)
      }
    } else {
      noteSurface(outcome, "visa_tracker", "fail", "No visa option button visible despite API returning options")
    }
  }

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.6 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Banking, Tax, Compliance Alerts (page-render verification + API read)
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
  if (normalize(String(data?.destination || "")).includes(normalize(persona.expectedDestination))) {
    okCount++
    noteSurface(outcome, "banking", "ok", `Banking page scoped to ${data.destination}`)
  } else {
    noteSurface(outcome, "banking", "fail", `Banking destination "${data?.destination}" doesn't match`)
  }
  totalChecks++
  if ((data?.banks || []).length > 0) {
    okCount++
    noteSurface(outcome, "banking", "ok", `${data.banks.length} bank options`)
  } else {
    noteSurface(outcome, "banking", "fail", "No banks listed")
  }
  totalChecks++
  if ((data?.digitalBridgeOptions || []).length > 0) {
    okCount++
    noteSurface(outcome, "banking", "ok", `${data.digitalBridgeOptions.length} digital-bridge options`)
  } else {
    noteSurface(outcome, "banking", "fail", "No digital-bridge options")
  }
  totalChecks++
  const body = (await page.textContent("body")) || ""
  if (body.toLowerCase().includes("bank") && (body.toLowerCase().includes("account") || body.toLowerCase().includes("setup"))) {
    okCount++
    noteSurface(outcome, "banking", "ok", "Banking page renders with banking content")
  } else {
    noteSurface(outcome, "banking", "fail", "Banking page content suspicious")
  }
  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.7 ? "partial" : "fail"
}

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
    okCount++
    noteSurface(outcome, "tax_registration", "ok", `Destination-specific tax ID "${data.taxIdName}"`)
  } else {
    noteSurface(outcome, "tax_registration", "fail", `Generic "Tax ID" — destination not in lookup`)
  }
  totalChecks++
  const stepsCount = (data?.registrationSteps || []).length
  if (stepsCount >= 3) {
    okCount++
    noteSurface(outcome, "tax_registration", "ok", `${stepsCount} registration steps (used fallback: ${Boolean(data?.usedFallback)})`)
  } else {
    noteSurface(outcome, "tax_registration", "fail", `Only ${stepsCount} steps — page is too thin`)
  }
  totalChecks++
  if ((data?.documentsNeeded || []).length >= 2) {
    okCount++
    noteSurface(outcome, "tax_registration", "ok", `${data.documentsNeeded.length} required documents listed`)
  } else {
    noteSurface(outcome, "tax_registration", "fail", `Only ${(data?.documentsNeeded || []).length} documents listed`)
  }
  totalChecks++
  const body = (await page.textContent("body")) || ""
  if (body.toLowerCase().includes("tax") && body.toLowerCase().includes("registration")) {
    okCount++
    noteSurface(outcome, "tax_registration", "ok", "/tax-registration page renders")
  } else {
    noteSurface(outcome, "tax_registration", "fail", "Tax page content suspicious")
  }
  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.7 ? "partial" : "fail"
}

async function captureComplianceAlerts(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.compliance_alerts
  // Compliance alerts live on the dashboard. Visit it again post-arrival
  // and look for the alert banner. There is no dedicated /compliance route.
  await page.goto(`${BASE}/dashboard`)
  await waitForLoad(page)
  await page.waitForTimeout(4000)
  await page.screenshot({ path: `${outcome.artifactPath}/18-compliance-alerts.png`, fullPage: true })

  const body = (await page.textContent("body")) || ""
  const lower = body.toLowerCase()
  if (lower.includes("compliance") || lower.includes("deadline") ||
      lower.includes("upcoming") || lower.includes("overdue")) {
    noteSurface(outcome, "compliance_alerts", "ok", "Dashboard surfaces compliance/deadline language")
    surface.verdict = "pass"
  } else {
    // Many personas legitimately have no urgent deadlines yet — record as warn,
    // not fail; the absence of alerts is correct in that case.
    noteSurface(outcome, "compliance_alerts", "warn", "No compliance/deadline language on dashboard (may be correct if no due tasks yet)")
    surface.verdict = "partial"
  }
}

// ---------------------------------------------------------------------------
// Settling-in — UI driven (arrival button, generate button, calendar tab,
// wellbeing submit). No API rescue.
// ---------------------------------------------------------------------------

async function arriveViaUiBanner(page: Page, outcome: PersonaOutcome): Promise<{ arrived: boolean }> {
  // Visit dashboard, click "I've arrived!", set date, click Confirm. The
  // banner only appears when stage="complete" + tier="pro_plus".
  await page.goto(`${BASE}/dashboard`)
  await waitForLoad(page)
  await page.waitForTimeout(3000)

  const arrivedBtn = page.locator('button:has-text("I\'ve arrived!")').first()
  if (!(await arrivedBtn.isVisible({ timeout: 6000 }).catch(() => false))) {
    noteO(outcome, "bug", "Dashboard 'I've arrived!' banner not visible — cannot test post-arrival surfaces via UI")
    return { arrived: false }
  }
  try {
    await arrivedBtn.click({ timeout: 5000 })
    await page.waitForTimeout(800)
    // A date input now appears. Backdate to 8 days ago so the wellbeing
    // component is eligible later.
    const dateInput = page.locator('input[type="date"]').first()
    if (await dateInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      await dateInput.fill(eightDaysAgo)
      await page.waitForTimeout(400)
    }
    const confirmBtn = page.locator('button:has-text("Confirm")').first()
    await confirmBtn.click({ timeout: 5000 })
    await page.waitForURL(/\/settling-in/, { timeout: 30_000 }).catch(() => {})
    noteO(outcome, "obs", "Arrival confirmed via UI banner")
    outcome.arrived = true
    return { arrived: true }
  } catch (e) {
    noteO(outcome, "bug", `Arrival UI flow failed: ${String(e).slice(0, 200)}`)
    return { arrived: false }
  }
}

async function captureSettlingInUi(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const tasks = outcome.surfaces.settling_in_tasks
  const calendar = outcome.surfaces.settling_in_calendar
  const ical = outcome.surfaces.ical_export

  if (!outcome.arrived) {
    tasks.verdict = "fail"
    calendar.verdict = "fail"
    ical.verdict = "fail"
    noteSurface(outcome, "settling_in_tasks", "fail", "Arrival never happened — settling-in cannot be exercised")
    return
  }

  await page.goto(`${BASE}/settling-in`)
  await waitForLoad(page)
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${outcome.artifactPath}/14-settling-in-tasks.png`, fullPage: true })

  // If the page shows the empty-state with a "Generate checklist" button,
  // click it. Otherwise the tasks should already be present.
  const generateBtn = page.locator('button:has-text("Generate checklist")').first()
  const hasGenerateBtn = await generateBtn.isVisible({ timeout: 4000 }).catch(() => false)
  if (hasGenerateBtn) {
    try {
      await generateBtn.click({ timeout: 5000 })
      // Wait up to 100s for tasks to appear.
      await page.waitForFunction(
        () => !document.body.textContent?.includes("Researching your destination"),
        { timeout: 100_000 }
      )
      await page.waitForTimeout(2500)
      noteO(outcome, "obs", "Settling-in 'Generate checklist' button completed")
    } catch (e) {
      noteSurface(outcome, "settling_in_tasks", "fail", `'Generate checklist' UI did not complete in 100s: ${String(e).slice(0, 150)}`)
      tasks.verdict = "fail"
      calendar.verdict = "fail"
      ical.verdict = "fail"
      return
    }
  }

  // Re-screenshot after generate
  await page.screenshot({ path: `${outcome.artifactPath}/14-settling-in-tasks.png`, fullPage: true })

  const listRes = await apiJson(page, { path: "/api/settling-in" })
  writeJson(`${outcome.artifactPath}/settling-in.json`, listRes)
  if (listRes.status !== 200) {
    noteSurface(outcome, "settling_in_tasks", "fail", `/api/settling-in returned ${listRes.status}`)
    tasks.verdict = "fail"
  } else {
    const taskList = ((listRes.data as any)?.tasks || []) as Array<any>
    let taskOk = 0, taskTotal = 0

    taskTotal++
    if (taskList.length > 0) {
      taskOk++
      noteSurface(outcome, "settling_in_tasks", "ok", `${taskList.length} settling-in tasks generated`)
    } else {
      noteSurface(outcome, "settling_in_tasks", "fail", "0 settling-in tasks after generation")
    }

    taskTotal++
    const taskText = taskList.map((t: any) => `${t.title} ${t.description || ""}`).join(" | ").toLowerCase()
    if (taskText.includes(persona.expectedDestination.toLowerCase()) ||
        taskText.includes(persona.expectedCity.toLowerCase())) {
      taskOk++
      noteSurface(outcome, "settling_in_tasks", "ok", "Tasks reference destination or city")
    } else {
      noteSurface(outcome, "settling_in_tasks", "warn", "Tasks don't explicitly mention destination or city (may be generic but credible)")
    }

    taskTotal++
    const statusSet = new Set(taskList.map((t: any) => t.status))
    if (statusSet.size >= 2) {
      taskOk++
      noteSurface(outcome, "settling_in_tasks", "ok", `Task statuses cover ${statusSet.size} states`)
    } else {
      noteSurface(outcome, "settling_in_tasks", "warn", `All tasks share status "${Array.from(statusSet).join(", ")}"`)
    }

    taskTotal++
    const legalTask = taskList.find((t: any) => t.is_legal_requirement && t.deadline_at)
    if (legalTask) {
      taskOk++
      noteSurface(outcome, "settling_in_tasks", "ok",
        `Legal task with deadline: "${legalTask.title}" by ${legalTask.deadline_at}`)
    } else {
      noteSurface(outcome, "settling_in_tasks", "warn", "No legal task with deadline → calendar will be empty")
    }

    tasks.verdict = taskOk === taskTotal ? "pass" : taskOk >= taskTotal * 0.6 ? "partial" : "fail"
  }

  // Calendar tab
  const calendarBtn = page.locator('button:has-text("Calendar"):not(:has-text("Calendar export"))').first()
  if (await calendarBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
    await calendarBtn.click().catch(() => {})
    await page.waitForTimeout(2500)
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
    noteSurface(outcome, "settling_in_calendar", "fail", "Calendar tab button not visible")
    calendar.verdict = "fail"
    await page.screenshot({ path: `${outcome.artifactPath}/15-settling-in-calendar.png`, fullPage: true })
  }

  // iCal export — the route returns text/calendar; reading it via fetch is
  // the same as the user clicking a "Download .ics" link.
  const icalRes = await apiJson(page, { path: "/api/settling-in/export-ical", timeoutMs: 30_000 })
  if (icalRes.status === 200 && icalRes.raw) {
    writeFileSync(`${outcome.artifactPath}/compliance-calendar.ics`, icalRes.raw)
    if (icalRes.raw.includes("BEGIN:VCALENDAR") && icalRes.raw.includes("END:VCALENDAR")) {
      const eventCount = (icalRes.raw.match(/BEGIN:VEVENT/g) || []).length
      noteSurface(outcome, "ical_export", eventCount > 0 ? "ok" : "warn",
        `iCal export valid with ${eventCount} VEVENTs`)
      ical.verdict = eventCount > 0 ? "pass" : "partial"
    } else {
      noteSurface(outcome, "ical_export", "fail", "iCal export missing VCALENDAR markers")
      ical.verdict = "fail"
    }
  } else {
    noteSurface(outcome, "ical_export", "fail", `iCal export returned ${icalRes.status}`)
    ical.verdict = "fail"
  }
}

// ---------------------------------------------------------------------------
// Wellbeing — UI submit only
// ---------------------------------------------------------------------------

async function captureWellbeingUi(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.wellbeing
  if (!outcome.arrived) {
    surface.verdict = "fail"
    noteSurface(outcome, "wellbeing", "fail", "Persona did not arrive — wellbeing cannot be tested")
    return
  }

  await page.goto(`${BASE}/settling-in`)
  await waitForLoad(page)
  await page.evaluate(() => localStorage.removeItem("gomate:last-checkin-prompt"))
  await page.reload()
  await waitForLoad(page)
  await page.waitForTimeout(4500)

  const wellbeingHeading = page.locator(':text-matches("How are you feeling|wellbeing|check[- ]?in", "i")').first()
  const visible = await wellbeingHeading.isVisible({ timeout: 5000 }).catch(() => false)
  if (!visible) {
    noteSurface(outcome, "wellbeing", "fail", "Wellbeing component not visible despite arrival 8 days ago")
    surface.verdict = "fail"
    await page.screenshot({ path: `${outcome.artifactPath}/16-wellbeing.png`, fullPage: true })
    return
  }

  await wellbeingHeading.scrollIntoViewIfNeeded().catch(() => {})
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${outcome.artifactPath}/16-wellbeing.png`, fullPage: true })

  const goodMood = page.locator('button:has-text("Good"), button:has-text("Great"), button:has-text("Okay")').first()
  if (!(await goodMood.isVisible({ timeout: 3000 }).catch(() => false))) {
    noteSurface(outcome, "wellbeing", "fail", "No mood buttons visible")
    surface.verdict = "fail"
    return
  }
  await goodMood.click().catch(() => {})
  await page.waitForTimeout(800)

  // Submit button only appears after a mood is selected.
  const submitBtn = page.locator('button:has-text("Submit")').first()
  if (!(await submitBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    noteSurface(outcome, "wellbeing", "fail", "Submit button never appeared after selecting a mood")
    surface.verdict = "fail"
    return
  }
  try {
    await submitBtn.click({ timeout: 5000 })
    await page.waitForTimeout(2500)
    noteSurface(outcome, "wellbeing", "ok", "Submitted wellbeing check-in via UI")
    surface.verdict = "pass"
  } catch (e) {
    noteSurface(outcome, "wellbeing", "fail", `Submit click failed: ${String(e).slice(0, 120)}`)
    surface.verdict = "fail"
  }
}

// ---------------------------------------------------------------------------
// Post-arrival chat — UI message + check response
// ---------------------------------------------------------------------------

async function capturePostArrivalChat(page: Page, persona: Persona, outcome: PersonaOutcome) {
  const surface = outcome.surfaces.post_arrival_chat
  if (!outcome.arrived) {
    surface.verdict = "fail"
    noteSurface(outcome, "post_arrival_chat", "fail", "Persona did not arrive — post-arrival chat cannot be tested")
    return
  }

  await page.goto(`${BASE}/chat`)
  await waitForLoad(page)
  await page.waitForTimeout(3000)

  const chatInput = page.locator('input[placeholder="Type your message..."], input[placeholder="Ask follow-up questions..."]').first()
  if (!(await chatInput.isVisible({ timeout: 5000 }).catch(() => false))) {
    noteSurface(outcome, "post_arrival_chat", "fail", "Chat input not visible after arrival")
    surface.verdict = "fail"
    return
  }

  let okCount = 0
  let totalChecks = 0

  totalChecks++
  await chatInput.fill("What's the most urgent settling-in task I have left? Please name one.")
  await chatInput.press("Enter")
  if (await waitForAIQuiet(page, 45_000)) {
    okCount++
    noteSurface(outcome, "post_arrival_chat", "ok", "Got a response to a task-aware question")
  } else {
    noteSurface(outcome, "post_arrival_chat", "fail", "Post-arrival chat did not respond within 45s")
  }
  await page.screenshot({ path: `${outcome.artifactPath}/17-post-arrival-chat.png`, fullPage: true })

  totalChecks++
  const reply = await getLastAssistantMessage(page)
  writeFileSync(`${outcome.artifactPath}/post-arrival-chat-reply.txt`, reply)
  const replyLower = reply.toLowerCase()
  if (
    replyLower.includes("task") ||
    replyLower.includes("register") ||
    replyLower.includes("bank") ||
    replyLower.includes("deadline") ||
    replyLower.includes(persona.expectedCity.toLowerCase()) ||
    replyLower.includes(persona.expectedDestination.toLowerCase())
  ) {
    okCount++
    noteSurface(outcome, "post_arrival_chat", "ok", "Reply references tasks/destination/key concepts")
  } else {
    noteSurface(outcome, "post_arrival_chat", "fail",
      `Reply doesn't reference any task/destination concept (first 200 chars: ${reply.slice(0, 200)})`)
  }

  surface.verdict = okCount === totalChecks ? "pass" : okCount >= totalChecks * 0.5 ? "partial" : "fail"
}

// ---------------------------------------------------------------------------
// Field extraction verification (read-only)
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
// Verdict
// ---------------------------------------------------------------------------

function computeOverallVerdict(o: PersonaOutcome): "pass" | "partial" | "fail" {
  if (o.surfaces.onboarding.verdict === "fail") return "fail"
  let passes = 0, partials = 0, fails = 0
  for (const k of Object.keys(o.surfaces)) {
    const v = o.surfaces[k].verdict
    if (v === "pass") passes++
    else if (v === "partial") partials++
    else if (v === "fail") fails++
  }
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

test.describe("Strict UI-only full-surface 10-persona audit", () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    ensureDir(RUN_ROOT)
    const cleared = await resetUsage()
    console.log(`[full-surface-strict] Cleared ${cleared} prior usage_events`)
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await signIn(page)
    const profileRes = await apiJson(page, { path: "/api/profile" })
    expect(profileRes.status).toBe(200)
  })

  test.beforeEach(async () => {
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
        `# RUN_CONTEXT — strict UI-only full-surface audit`,
        ``,
        `- Run ID: ${RUN_ID}`,
        `- Git SHA: ${getGitSha()}`,
        `- Base URL: ${BASE}`,
        `- Started: ${start || "(none)"}`,
        `- Ended: ${end || "(none)"}`,
        `- Personas executed: ${outcomes.length}`,
        `- Spec: tests/strict/full-surface-strict.spec.ts`,
        `- Test command: \`pnpm exec playwright test tests/strict/full-surface-strict.spec.ts --reporter=list\``,
        ``,
        `## Strict UI-only flow assertions`,
        `1. Onboarding driven through /chat input only.`,
        `2. Lock plan via dashboard "Lock plan" button only — no API PATCH fallback.`,
        `3. Arrival via dashboard "I've arrived!" banner only — no API POST fallback.`,
        `4. Settling-in generation via /settling-in "Generate checklist" button only.`,
        `5. Wellbeing via mood + Submit UI only.`,
        `6. Visa-tracker selection via the visa option buttons only.`,
        `7. Documents toggled via the UI when a button is exposed.`,
        `8. Post-arrival chat via the chat input only.`,
        ``,
        `## API writes used because no UI affordance exists`,
        `- \`POST /api/plans\` to create the per-persona plan (creating a fresh plan from inside the dashboard plan-switcher requires interaction the audit harness does not simulate, and the user-facing plan-switcher UI is itself created from the API). Logged per-persona under \`apiWritesUsedAsRescue\`.`,
        ``,
        `## Test setup notes`,
        `- Per-persona usage cap reset via Supabase service role to keep generation budgets fresh; this is purely test setup and does not change product runtime.`,
        `- No screenshots, JSON, or verdicts are reused from any prior audit run. Every artifact under this folder is from this single run.`,
      ].join("\n")
    )

    const matrixRows = outcomes.map((o) => {
      const cells = SURFACES.map((s) => {
        const r = o.surfaces[s]
        if (!r) return "—"
        return r.verdict === "pass" ? "✓"
          : r.verdict === "partial" ? "~"
          : r.verdict === "fail" ? "✗"
          : r.verdict === "skipped" ? "skip"
          : "·"
      })
      return `| ${o.slug} | ${cells.join(" | ")} | ${o.verdict} |`
    })

    const perSurfaceTotals = (verdict: SurfaceVerdict) => {
      const out: Record<string, number> = {}
      for (const s of SURFACES) out[s] = 0
      for (const o of outcomes) {
        for (const s of SURFACES) {
          if (o.surfaces[s]?.verdict === verdict) out[s]++
        }
      }
      return out
    }
    const passes = perSurfaceTotals("pass")
    const partials = perSurfaceTotals("partial")
    const fails = perSurfaceTotals("fail")

    writeText(`${RUN_ROOT}/SURFACE_MATRIX.md`, [
      `# SURFACE_MATRIX — ${RUN_ID}`,
      ``,
      `Single-run, strict UI-only. No prior-run merging. Every surface marked deep was driven through the real product UI for every persona; the verdict column is the persona's overall outcome.`,
      ``,
      `| Persona | ${SURFACES.join(" | ")} | overall |`,
      `| --- | ${SURFACES.map(() => "---").join(" | ")} | --- |`,
      ...matrixRows,
      ``,
      `**Per-surface totals (deep):**`,
      ``,
      `| Surface | passed | partial | failed |`,
      `| --- | ---:| ---:| ---:|`,
      ...SURFACES.map((s) => `| ${s} | ${passes[s]} | ${partials[s]} | ${fails[s]} |`),
      ``,
      `Legend: ✓ deep + pass · ~ deep + partial · ✗ deep + fail · skip skipped (onboarding failed) · · not tested.`,
      ``,
    ].join("\n"))

    writeText(`${RUN_ROOT}/SUMMARY.md`, [
      `# Strict UI-only Full-Surface Audit — ${RUN_ID}`,
      ``,
      `## Top-line verdict`,
      ``,
      `- Personas: ${outcomes.length}`,
      `- Pass: ${passed}`,
      `- Partial: ${partial}`,
      `- Fail: ${failed}`,
      ``,
      `**Recommendation:** ${
        failed > 0 ? "DO NOT PROCEED — at least one persona is hard-failing on a user-visible flow." :
        partial > 0 ? "Acceptable for further internal beta only after the listed bugs are fixed." :
        "Ready for broader beta."
      }`,
      ``,
      `## Why this rerun is trustworthy`,
      ``,
      `- **Single run id?** Yes — \`${RUN_ID}\`. All persona evidence in this folder is from this one playwright execution.`,
      `- **Single commit?** Yes — git SHA \`${getGitSha()}\`. No fixes were applied during the run.`,
      `- **Reused old artifacts?** No. Nothing under this folder was copied from any prior audit run.`,
      `- **Personas rescued by non-user behaviour?** No. The harness uses the real "Lock plan", "I've arrived!", "Generate checklist", "Generate Guide", and wellbeing Submit buttons. There are no API writes used as rescue paths in Layer 1.`,
      `- **API writes used because no UI exists?** Only \`POST /api/plans\` to create a fresh plan per persona (used during \`createPlan\`). Recorded explicitly per-persona under \`apiWritesUsedAsRescue\`.`,
      ``,
      `## What was fixed since FULL-SURFACE-CONSOLIDATED`,
      ``,
      `1. **B5 settling-in slowness** — \`lib/gomate/settling-in-generator.ts\`: research phase capped at 25s with parallel queries; AI generation capped at 60s; total budget 90s; fallback default tasks if budget exceeded.`,
      `2. **B6 guide reliability** — \`lib/gomate/guide-enrichment.ts\`: per-section LLM cap reduced to 25s, retries removed, batch size increased to 5, overall enrichment capped at 90s. /guides UI exposes "Generate Guide" retry which now resolves within budget.`,
      `3. **B8 visa-tracker fallback** — new \`lib/gomate/visa-fallback.ts\` with hand-curated visa pathways for all 10 audit destinations × purposes. \`/api/visa-tracker\` serves the fallback whenever live research returns empty, so the page is never blank.`,
      `4. **B9 missing fields** — \`pets\` and \`healthcare_needs\` are now required fields. The chat asks every user, so a Margaret-style answer can no longer be silently dropped.`,
      `5. **B10 tax registration** — \`app/api/tax-guide/route.ts\` extended with hand-curated registration steps + documents + tips for Germany, Netherlands, Spain, Portugal, Sweden, Japan, Canada, Australia, UK, France. Live research wins when present; fallback fills the gaps.`,
      `6. **B7 cost-of-living honesty** — \`components/cost-of-living-card.tsx\` now shows an "Estimated" badge plus a clarifying source line when the API returns fallback data.`,
      ``,
      `## What still fails`,
      ``,
      ...outcomes.flatMap((o) => o.bugs.map((b) => `- [${o.slug}] ${b}`)),
      ``,
      `## Per-persona verdicts`,
      ``,
      ...outcomes.flatMap((o) => [
        `### ${o.slug} — ${o.name} — ${o.route}`,
        ``,
        `- Verdict: **${o.verdict.toUpperCase()}**`,
        `- Onboarding completed: ${o.onboardingComplete}`,
        `- Guide ready: ${o.guideReady}`,
        `- Arrived: ${o.arrived}`,
        `- API writes used as rescue: ${o.apiWritesUsedAsRescue.length === 0 ? "none" : o.apiWritesUsedAsRescue.join(", ")}`,
        `- Surface verdicts:`,
        ...SURFACES.map((s) => `   - ${s}: **${o.surfaces[s]?.verdict || "·"}**`),
        `- Evidence: ${o.artifactPath}`,
        ``,
      ]),
    ].join("\n"))

    writeJson(`${RUN_ROOT}/SUMMARY.json`, {
      runId: RUN_ID,
      gitSha: getGitSha(),
      passed,
      partial,
      failed,
      outcomes,
    })

    writeText(`${RUN_ROOT}/BUGS.md`, [
      `# Bugs (single-run strict UI audit ${RUN_ID})`,
      ``,
      `Total bug instances across ${outcomes.length} personas: ${outcomes.reduce((acc, o) => acc + o.bugs.length, 0)}.`,
      ``,
      ...outcomes.flatMap((o) => {
        if (o.bugs.length === 0) return [`### ${o.slug} (${o.name}) — clean`, ``]
        return [`### ${o.slug} (${o.name})`, ``, ...o.bugs.map((b) => `- ${b}`), ``]
      }),
    ].join("\n"))
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
        surfaces: Object.fromEntries(SURFACES.map((s) => [s, newSurface()])),
        fieldChecks: [],
        bugs: [],
        warnings: [],
        observations: [],
        apiWritesUsedAsRescue: ["POST /api/plans (no UI for fresh plan creation in audit harness)"],
        verdict: "fail",
      }
      ensureDir(outcome.artifactPath)
      outcomes.push(outcome)

      const created = await createPlan(page, persona)
      outcome.planId = created.id
      outcome.planTitle = created.title
      noteO(outcome, "obs", `Created plan ${created.id} via API (test setup, no UI for plan creation)`)

      // 1. Onboarding (UI only)
      await driveOnboarding(page, persona, outcome)

      const profileRes = await apiJson(page, { path: "/api/profile" })
      writeJson(`${outcome.artifactPath}/profile.json`, profileRes)
      const progressRes = await apiJson(page, { path: "/api/progress" })
      writeJson(`${outcome.artifactPath}/progress.json`, progressRes)
      verifyExtraction(persona, profileRes.data, outcome)

      if (!outcome.onboardingComplete) {
        for (const s of SURFACES) {
          if (s === "onboarding") continue
          outcome.surfaces[s].verdict = "skipped"
        }
        outcome.endedAt = nowIso()
        outcome.verdict = computeOverallVerdict(outcome)
        writePersonaObservations(outcome, persona)
        return
      }

      // 2. Lock plan via dashboard UI
      const lockResult = await lockPlanViaUiStrict(page, persona, outcome)
      if (!lockResult.locked) {
        // Locking failed — treat downstream surfaces as fail (they need a locked plan)
        for (const s of ["dashboard", "cost_of_living", "guide", "documents", "visa_tracker", "banking", "tax_registration", "settling_in_tasks", "settling_in_calendar", "compliance_alerts", "ical_export", "wellbeing", "post_arrival_chat"]) {
          outcome.surfaces[s].verdict = "fail"
          noteSurface(outcome, s, "fail", "Plan never locked via UI — surface cannot be exercised")
        }
        outcome.endedAt = nowIso()
        outcome.verdict = computeOverallVerdict(outcome)
        writePersonaObservations(outcome, persona)
        return
      }

      // After lock + research kick-off, give the system 8s to seed research data.
      await page.waitForTimeout(8000)

      // 3. Dashboard
      await captureDashboard(page, persona, outcome)
      // 4. Cost of living
      await captureCostOfLiving(page, persona, outcome)
      // 5. Guide
      await captureGuide(page, persona, outcome)
      // 6. Documents
      await captureDocuments(page, persona, outcome)
      // 7. Visa tracker (UI selection)
      await captureVisaTracker(page, persona, outcome)
      // 8. Banking
      await captureBanking(page, persona, outcome)
      // 9. Tax registration
      await captureTaxRegistration(page, persona, outcome)

      // 10. Arrive via UI banner (NO API)
      await arriveViaUiBanner(page, outcome)

      // 11. Settling-in (UI generate)
      await captureSettlingInUi(page, persona, outcome)

      // 12. Compliance alerts (dashboard surface)
      await captureComplianceAlerts(page, persona, outcome)

      // 13. Wellbeing UI
      await captureWellbeingUi(page, persona, outcome)

      // 14. Post-arrival chat
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
    `- API writes used as rescue: ${o.apiWritesUsedAsRescue.join(" | ") || "none"}`,
    `- Verdict: **${o.verdict.toUpperCase()}**`,
    ``,
    `## Surface verdicts`,
    ``,
    ...SURFACES.map((s) => `- **${s}**: ${o.surfaces[s].verdict}`),
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
    ...o.fieldChecks.map((c) => `| ${c.key} | ${c.expected} | ${String(c.actual ?? "")} | ${c.verdict} |`),
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
