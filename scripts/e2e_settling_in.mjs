// Phase 7 acceptance — verify settling-in tasks render in UI after arrival.
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

const OUT = '/Users/axel/Downloads/v0-go-mate-ui-shell-main/screenshots'
const BASE = 'http://localhost:5175'
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const userId = '819053d3-0f53-49c6-a8a0-d92122cab5ae'
// Reset to ready_for_pre_departure so the "I have arrived" button on dashboard appears.
// Actually the trigger card needs stage=pre_departure. Set to that.
await admin.from('relocation_plans').update({
  stage: 'pre_departure',
  arrival_date: null,
  post_relocation_generated: false,
}).eq('user_id', userId).eq('is_current', true)
await admin.from('settling_in_tasks').delete().eq('user_id', userId)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)))

await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle', timeout: 60000 })
await page.locator('input[type="email"]').first().fill(EMAIL)
await page.locator('input[type="password"]').first().fill(PASSWORD)
await page.locator('button[type="submit"]').first().click()
await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 25000 })

console.log('-> /dashboard (expect "I have arrived" button)')
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, 'phase7-1-arrived-button.png'), fullPage: true })

const arrivedBtn = page.locator('[data-testid="trigger-mark-arrived"]')
console.log('arrived button visible:', await arrivedBtn.count() > 0)
if (await arrivedBtn.count()) {
  await arrivedBtn.scrollIntoViewIfNeeded()
  await arrivedBtn.click()
  await page.waitForTimeout(5000)
  console.log('after click url:', page.url())
}

console.log('-> /checklist?tab=post-move')
await page.goto(BASE + '/checklist?tab=post-move', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, 'phase7-2-settling-in-tasks.png'), fullPage: true })

console.log('-> /settling-in (direct)')
await page.goto(BASE + '/settling-in', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, 'phase7-3-settling-in-direct.png'), fullPage: true })

const bodyText = await page.locator('body').innerText()
const checks = ['folkbokföring', 'personnummer', 'BankID', 'Skatteverket', 'A1', 'school placement', 'utilities', '7 day', '14 day', 'Legal']
console.log('content checks in DOM:')
for (const c of checks) {
  const n = (bodyText.match(new RegExp(c, 'gi')) || []).length
  if (n) console.log(`  ${c}: ${n}`)
}

// Final DB state
const { data: tasks } = await admin.from('settling_in_tasks').select('id,title,category,is_legal_requirement,depends_on,deadline_days').eq('user_id', userId).order('sort_order')
console.log('\nDB tasks:', tasks?.length)
for (const t of (tasks || []).slice(0, 5)) {
  console.log('  ', t.deadline_days + 'd', '|', t.category, '|', (t.is_legal_requirement ? '⚖ ' : '  '), t.title.slice(0, 55), '— deps:', t.depends_on?.length)
}

await browser.close()
console.log('done')
