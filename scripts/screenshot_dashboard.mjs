import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const OUT = '/Users/axel/Downloads/v0-go-mate-ui-shell-main/screenshots'
const BASE = 'http://localhost:5175'
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 250)))
page.on('console', m => { if (m.type() === 'error') console.log('[console-error]', m.text().slice(0, 250)) })

console.log('-> /auth/login')
await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(1000)
console.log('current url:', page.url())

// Find inputs
const emailInput = page.locator('input[type="email"], input[name="email"], #email').first()
const passInput = page.locator('input[type="password"], input[name="password"], #password').first()
await emailInput.waitFor({ timeout: 10000 })
await emailInput.fill(EMAIL)
await passInput.fill(PASSWORD)

const submitBtn = page.locator('button[type="submit"], button:has-text("Sign in")').first()
await submitBtn.click()

// Wait for navigation away from login OR for an error
await Promise.race([
  page.waitForURL(/\/(dashboard|onboarding|chat|app)/, { timeout: 25000 }),
  page.waitForTimeout(15000),
])
console.log('after login url:', page.url())
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, '01-after-login.png'), fullPage: true })

console.log('-> /dashboard')
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(5000)
console.log('current url:', page.url())
await page.screenshot({ path: path.join(OUT, '02-dashboard-overview.png'), fullPage: true })

const tabs = ['Overview', 'Profile', 'Visa & Legal', 'Money', 'Settling']
for (const tab of tabs) {
  const t = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first()
  if (await t.count()) {
    await t.click().catch(() => {})
    await page.waitForTimeout(2000)
    const slug = tab.toLowerCase().replace(/[^a-z]/g, '')
    await page.screenshot({ path: path.join(OUT, `03-tab-${slug}.png`), fullPage: true })
    console.log('captured tab:', tab)
  }
}

// Visit dedicated visa workspace
console.log('-> /visa')
await page.goto(BASE + '/visa', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, '04-visa-workspace.png'), fullPage: true })

console.log('-> /visa-tracker')
await page.goto(BASE + '/visa-tracker', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, '05-visa-tracker.png'), fullPage: true })

console.log('-> /research')
await page.goto(BASE + '/research', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, '06-research.png'), fullPage: true })

await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2000)
// Persona summary text scan
const bodyText = await page.locator('body').innerText()
const fields = ['Roselle', 'Filipino', 'Stockholm', 'Manila', 'Swedish', 'spouse', 'family', 'permanent', 'Residence Permit', 'Migrationsverket', 'Uppehållstillstånd']
console.log('field hits across DOM:')
for (const f of fields) {
  const count = (bodyText.match(new RegExp(f, 'gi')) || []).length
  if (count) console.log(`  ${f}: ${count}`)
}

await browser.close()
console.log('done')
