// Phase 5.4 acceptance — full lifecycle E2E driven through the real UI.
//
// Frontend-only: every state transition is triggered by a click on a
// real button in the running Vite app. The backend (api-server :3001)
// must be running. Supabase service-role is only used for two things:
//   1. Reset Axel's plan to a clean "complete" state at the start.
//   2. Fast-forward stage from "complete" → "ready_for_pre_departure"
//      when we'd otherwise wait 5 min for the multi-specialist research
//      run to settle. This is documented inline; the BUTTON CLICK itself
//      is genuine, only the long wait is shortcut.
//
// Screenshots are taken at every stage transition and saved to
// screenshots/e2e-5.4-*.png.

import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

const OUT = '/Users/axel/Downloads/v0-go-mate-ui-shell-main/screenshots'
const BASE = 'http://localhost:5175'
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD
const SUPABASE_URL = process.env.SUPABASE_URL
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const admin = createClient(SUPABASE_URL, SVC)

// Find Axel's plan (the latest one for axelcornelius93@gmail.com).
const { data: plans } = await admin
  .from('relocation_plans')
  .select('id,user_id,profile_data,stage,locked')
  .eq('user_id', '819053d3-0f53-49c6-a8a0-d92122cab5ae')
  .order('created_at', { ascending: false })
  .limit(1)
const plan = plans[0]
console.log('plan:', plan.id, '| current stage:', plan.stage)

// Reset to clean Step 1 state: stage=complete, no triggers fired,
// no research completed. Profile + visa_research stay so the visible
// data is rich; we just rewind the trigger timestamps.
console.log('-- reset plan to stage=complete, no triggers fired')
await admin.from('relocation_plans').update({
  stage: 'complete',
  user_triggered_research_at: null,
  user_triggered_pre_departure_at: null,
  research_status: null,
  arrival_date: null,
  // Clear research_meta.preDeparture to prove the button regenerates
  research_meta: {},
}).eq('id', plan.id)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 240)))
page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 240)) })

console.log('-- log in')
await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle', timeout: 60000 })
await page.locator('input[type="email"]').first().fill(EMAIL)
await page.locator('input[type="password"]').first().fill(PASSWORD)
await page.locator('button[type="submit"]').first().click()
await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 25000 })

// ============================================================
// STEP 1 — "Generate my plan"
// ============================================================
console.log('\n=== STEP 1: dashboard with "Generate my plan" CTA ===')
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, 'e2e-5.4-step1-before-click.png'), fullPage: true })

const generateBtn = page.locator('[data-testid="trigger-generate-research"]')
const cnt1 = await generateBtn.count()
console.log('  Generate button visible:', cnt1 > 0)
if (cnt1 === 0) {
  console.log('  ✗ Generate button not found — listing all visible buttons')
  const labels = await page.locator('button').allTextContents()
  console.log('  buttons:', labels.slice(0, 15))
}

if (cnt1 > 0) {
  await generateBtn.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, 'e2e-5.4-step1-button-visible.png'), fullPage: false })
  console.log('  → clicking "Generate my plan"')
  await Promise.all([
    page.waitForURL(/\/research/, { timeout: 30000 }).catch(() => {}),
    generateBtn.click(),
  ])
  await page.waitForTimeout(3000)
  console.log('  arrived at:', page.url())
  await page.screenshot({ path: path.join(OUT, 'e2e-5.4-step1-research-page.png'), fullPage: true })
}

// ============================================================
// FAST-FORWARD: skip the 5-min real research run by simulating
// research completion (the actual button click + page transition above
// is what we're verifying — research already ran in earlier tests
// and persisted visa_research / a guide).
// ============================================================
console.log('\n-- fast-forward: setting stage=ready_for_pre_departure')
await admin.from('relocation_plans').update({
  stage: 'ready_for_pre_departure',
  research_status: 'completed',
  research_completed_at: new Date().toISOString(),
  user_triggered_pre_departure_at: null,
}).eq('id', plan.id)

// ============================================================
// STEP 2 — "Generate my pre-departure checklist"
// ============================================================
console.log('\n=== STEP 2: dashboard with "Generate my pre-departure" CTA ===')
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, 'e2e-5.4-step2-before-click.png'), fullPage: true })

const pdBtn = page.locator('[data-testid="trigger-generate-predeparture"]')
const cnt2 = await pdBtn.count()
console.log('  Pre-departure button visible:', cnt2 > 0)
if (cnt2 > 0) {
  await pdBtn.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, 'e2e-5.4-step2-button-visible.png'), fullPage: false })
  console.log('  → clicking "Generate my pre-departure checklist"')
  await Promise.all([
    page.waitForURL(/\/pre-departure/, { timeout: 30000 }).catch(() => {}),
    pdBtn.click(),
  ])
  await page.waitForTimeout(4000)
  console.log('  arrived at:', page.url())
  await page.screenshot({ path: path.join(OUT, 'e2e-5.4-step2-pre-departure-page.png'), fullPage: true })
}

// ============================================================
// STEP 3 — "I have arrived"
// ============================================================
console.log('\n=== STEP 3: dashboard with "I have arrived" CTA ===')
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, 'e2e-5.4-step3-before-click.png'), fullPage: true })

const arrivedBtn = page.locator('[data-testid="trigger-mark-arrived"]')
const cnt3 = await arrivedBtn.count()
console.log('  Arrived button visible:', cnt3 > 0)
if (cnt3 > 0) {
  await arrivedBtn.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, 'e2e-5.4-step3-button-visible.png'), fullPage: false })
  console.log('  → clicking "I have arrived"')
  await arrivedBtn.click()
  await page.waitForTimeout(5000)
  console.log('  arrived at:', page.url())
  await page.screenshot({ path: path.join(OUT, 'e2e-5.4-step3-after-click.png'), fullPage: true })
}

// Final state check
const { data: finalPlan } = await admin
  .from('relocation_plans')
  .select('stage,user_triggered_research_at,user_triggered_pre_departure_at,arrival_date')
  .eq('id', plan.id)
  .single()
console.log('\n=== FINAL DB STATE ===')
console.log('stage:', finalPlan.stage)
console.log('user_triggered_research_at:', finalPlan.user_triggered_research_at)
console.log('user_triggered_pre_departure_at:', finalPlan.user_triggered_pre_departure_at)
console.log('arrival_date:', finalPlan.arrival_date)

await browser.close()
console.log('\ndone')
