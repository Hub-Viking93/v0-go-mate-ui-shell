import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const OUT = '/Users/axel/Downloads/v0-go-mate-ui-shell-main/screenshots'
const BASE = 'http://localhost:5175'
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)))
page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)) })

await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle', timeout: 60000 })
await page.locator('input[type="email"]').first().fill(EMAIL)
await page.locator('input[type="password"]').first().fill(PASSWORD)
await page.locator('button[type="submit"]').first().click()
await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 25000 })
console.log('logged in')

console.log('-> /pre-departure')
await page.goto(BASE + '/pre-departure', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3500)
await page.screenshot({ path: path.join(OUT, '40-pre-departure-list.png'), fullPage: true })
console.log('screenshot 40 done')

// Try expanding first action
const firstChevron = page.locator('button[aria-label="Expand"]').first()
if (await firstChevron.count()) {
  await firstChevron.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: path.join(OUT, '41-pre-departure-expanded.png'), fullPage: true })
  console.log('screenshot 41 done')
}

const headings = await page.locator('h1,h2,h3').allTextContents()
console.log('headings:', headings.slice(0, 20))
const bodyText = await page.locator('body').innerText()
const checks = ['weeks', 'visa', 'apostille', 'A1', 'critical', 'pet', 'banking', 'documents', 'Sources']
for (const c of checks) {
  const n = (bodyText.match(new RegExp(c, 'gi')) || []).length
  if (n) console.log(`  ${c}: ${n}`)
}

await browser.close()
console.log('done')
