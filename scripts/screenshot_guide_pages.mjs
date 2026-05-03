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
const { data: g } = await admin.from('guides').select('id').order('created_at', { ascending: false }).limit(1).single()
const guideId = g.id
console.log('latest guide id:', guideId)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 200)))

await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle', timeout: 60000 })
await page.locator('input[type="email"]').first().fill(EMAIL)
await page.locator('input[type="password"]').first().fill(PASSWORD)
await page.locator('button[type="submit"]').first().click()
await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 25000 })
console.log('logged in')

console.log('-> /guides')
await page.goto(BASE + '/guides', { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(3000)
await page.screenshot({ path: path.join(OUT, '30-guides-list.png'), fullPage: true })

console.log(`-> /guides/${guideId}`)
await page.goto(BASE + `/guides/${guideId}`, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4000)
await page.screenshot({ path: path.join(OUT, '31-guide-overview.png'), fullPage: true })

const tabs = ['Visa', 'Budget', 'Housing', 'Practical', 'Culture', 'Jobs', 'Education', 'Timeline', 'Checklist']
for (const t of tabs) {
  const tab = page.locator(`button:has-text("${t}"), [role="tab"]:has-text("${t}")`).first()
  if (await tab.count()) {
    await tab.click().catch(() => {})
    await page.waitForTimeout(1500)
    const slug = t.toLowerCase()
    await page.screenshot({ path: path.join(OUT, `32-guide-tab-${slug}.png`), fullPage: true })
    console.log('captured', t)
  }
}

const bodyText = await page.locator('body').innerText()
const checks = ['Roselle', 'Axel', 'Stockholm', 'lagom', 'A1 certificate', 'posted', 'Migrationsverket', 'Sources', 'personnummer']
console.log('content checks:')
for (const c of checks) {
  const n = (bodyText.match(new RegExp(c, 'gi')) || []).length
  if (n) console.log(`  ${c}: ${n}`)
}

await browser.close()
console.log('done')
