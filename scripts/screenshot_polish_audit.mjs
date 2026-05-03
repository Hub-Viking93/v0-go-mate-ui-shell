// Audit current state of /visa /guides /settling-in /checklist before polish
import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const OUT = '/Users/axel/Downloads/v0-go-mate-ui-shell-main/screenshots/polish-before'
const BASE = 'http://localhost:5175'
const EMAIL = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle', timeout: 60000 })
await page.locator('input[type="email"]').first().fill(EMAIL)
await page.locator('input[type="password"]').first().fill(PASSWORD)
await page.locator('button[type="submit"]').first().click()
await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 25000 })

const pages = ['/dashboard', '/visa', '/guides', '/settling-in', '/checklist']
for (const p of pages) {
  await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2500)
  const slug = p.replace(/\//g, '_').replace(/^_/, '')
  await page.screenshot({ path: path.join(OUT, slug + '.png'), fullPage: true })
  console.log('captured', p)
}
await browser.close()
