import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
const OUT = '/Users/axel/Downloads/v0-go-mate-ui-shell-main/screenshots'
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
// Set Axel back to ready_for_pre_departure so dashboard renders the rich data
await admin.from('relocation_plans').update({stage:'ready_for_pre_departure',user_triggered_pre_departure_at:null,arrival_date:null,post_relocation_generated:false}).eq('user_id','819053d3-0f53-49c6-a8a0-d92122cab5ae').eq('is_current',true)
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto('http://localhost:5175/auth/login', { waitUntil: 'networkidle' })
await page.locator('input[type="email"]').first().fill(process.env.TEST_EMAIL)
await page.locator('input[type="password"]').first().fill(process.env.TEST_PASSWORD)
await page.locator('button[type="submit"]').first().click()
await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 25000 })

await page.goto('http://localhost:5175/dashboard', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, 'trust-dashboard.png'), fullPage: false })
// Open the trust badge popover
const tb = page.locator('[data-testid="trust-badge-subtitle"]').first()
if (await tb.count()) {
  await tb.scrollIntoViewIfNeeded()
  await tb.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(OUT, 'trust-dashboard-popover.png'), fullPage: false })
  await page.keyboard.press('Escape')
}

await page.goto('http://localhost:5175/visa', { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, 'trust-visa.png'), fullPage: false })
const vTb = page.locator('[data-testid="trust-badge-pill"]').first()
if (await vTb.count()) {
  await vTb.scrollIntoViewIfNeeded()
  await vTb.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(OUT, 'trust-visa-popover.png'), fullPage: false })
}

await browser.close()
console.log('done')
