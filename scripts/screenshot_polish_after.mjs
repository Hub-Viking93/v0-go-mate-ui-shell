import { chromium } from '@playwright/test'
import path from 'path'
const OUT = '/Users/axel/Downloads/v0-go-mate-ui-shell-main/screenshots/polish-after'
const BASE = 'http://localhost:5175'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle', timeout: 60000 })
await page.locator('input[type="email"]').first().fill(process.env.TEST_EMAIL)
await page.locator('input[type="password"]').first().fill(process.env.TEST_PASSWORD)
await page.locator('button[type="submit"]').first().click()
await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 25000 })
for (const p of ['/dashboard','/visa','/guides','/checklist','/settling-in','/pre-departure']) {
  await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{})
  await page.waitForTimeout(2500)
  await page.screenshot({ path: path.join(OUT, p.replace(/\//g,'_').replace(/^_/,'') + '.png'), fullPage: true })
  console.log('captured', p)
}
await browser.close()
