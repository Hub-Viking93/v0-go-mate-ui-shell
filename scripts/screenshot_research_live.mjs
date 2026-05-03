// Screenshot the /research page while research is running, then test
// page-leave + return to verify SSE reconnects to the same run.
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
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)))

console.log('-> /auth/login')
await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle', timeout: 60000 })
await page.locator('input[type="email"]').first().fill(EMAIL)
await page.locator('input[type="password"]').first().fill(PASSWORD)
await page.locator('button[type="submit"]').first().click()
await Promise.race([
  page.waitForURL(/\/(dashboard|onboarding|research)/, { timeout: 30000 }),
  page.waitForTimeout(5000),
])
console.log('logged in, url:', page.url())

console.log('-> /research (live agent panels)')
await page.goto(BASE + '/research', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, '20-research-live-1.png'), fullPage: true })

// wait 8s and capture again — should see panels updating
await page.waitForTimeout(8000)
await page.screenshot({ path: path.join(OUT, '21-research-live-2.png'), fullPage: true })

// Test page-leave + return
console.log('-> /dashboard (leave research page)')
await page.goto(BASE + '/dashboard', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2000)
console.log('-> /research (return to verify SSE reconnects)')
await page.goto(BASE + '/research', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4000)
await page.screenshot({ path: path.join(OUT, '22-research-after-return.png'), fullPage: true })

const headings = await page.locator('h1,h2,h3').allTextContents()
console.log('headings:', headings.slice(0, 15))
const bodyText = await page.locator('body').innerText()
const indicators = ['running', 'complete', 'specialist', 'visa_specialist', 'cost_specialist', 'documents_specialist', 'cultural_adapter', 'pending']
console.log('indicator hits:')
for (const i of indicators) {
  const c = (bodyText.match(new RegExp(i, 'gi')) || []).length
  if (c) console.log(`  ${i}: ${c}`)
}

await browser.close()
console.log('done')
