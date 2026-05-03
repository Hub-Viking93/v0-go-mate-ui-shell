// Phase 8 acceptance — verify the chat page visually switches to
// "Settling-In Coach" / Post-arrival mode when stage="arrived" AND
// a real post-arrival question gets a settling-in-coach-style answer.
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

const OUT = '/Users/axel/Downloads/v0-go-mate-ui-shell-main/screenshots'
const BASE = 'http://localhost:5175'

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const userId = '819053d3-0f53-49c6-a8a0-d92122cab5ae'

async function setStage(stage, arrivalDate) {
  await admin.from('relocation_plans').update({
    stage, arrival_date: arrivalDate || null,
  }).eq('user_id', userId).eq('is_current', true)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('[err]', e.message.slice(0, 200)))

await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle', timeout: 60000 })
await page.locator('input[type="email"]').first().fill(process.env.TEST_EMAIL)
await page.locator('input[type="password"]').first().fill(process.env.TEST_PASSWORD)
await page.locator('button[type="submit"]').first().click()
await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 25000 })

// === Mode 1: pre-arrival (stage=ready_for_pre_departure) ===
console.log('\n=== STAGE: ready_for_pre_departure (pre-arrival chat) ===')
await setStage('ready_for_pre_departure')
await page.goto(BASE + '/chat', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, 'phase8-1-pre-arrival.png'), fullPage: true })
const headerPre = await page.locator('h1').first().innerText()
console.log('header:', headerPre)
const chipsPre = await page.locator('button').filter({ hasText: /Best neighborhoods|Document checklist|Common mistakes|BankID|Next priority|overwhelmed/ }).allTextContents()
console.log('chips visible:', chipsPre)

// === Mode 2: post-arrival (stage=arrived) ===
console.log('\n=== STAGE: arrived (post-arrival chat) ===')
await setStage('arrived', '2026-08-01')
await page.goto(BASE + '/chat', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, 'phase8-2-post-arrival.png'), fullPage: true })
const headerPost = await page.locator('h1').first().innerText()
console.log('header:', headerPost)
const chipsPost = await page.locator('button').filter({ hasText: /Next priority|Where to register|BankID setup|English-speaking doctor|overwhelmed/ }).allTextContents()
console.log('chips visible:', chipsPost)

// === Send a real post-arrival message via chip (chip click = submit) ===
console.log('\n=== Click "BankID setup" chip ===')
const bankIdChip = page.locator('button').filter({ hasText: /^BankID setup$/ }).first()
if (await bankIdChip.count()) {
  await bankIdChip.click()
  console.log('chip clicked, waiting for streamed response...')
  // Streaming completion: wait for "thinking" to disappear OR text response to grow.
  await page.waitForTimeout(20000)
  await page.screenshot({ path: path.join(OUT, 'phase8-3-bankid-answer.png'), fullPage: true })
  const text = (await page.locator('body').innerText()).toLowerCase()
  for (const k of ['bankid', 'personnummer', 'bank account', 'skatteverket', 'svenska']) {
    const n = (text.match(new RegExp(k, 'gi')) || []).length
    if (n) console.log('  mentions', k + ':', n)
  }
}

await browser.close()
console.log('\ndone')
