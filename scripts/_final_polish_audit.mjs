import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import path from 'path'
const OUT = '/Users/axel/Downloads/v0-go-mate-ui-shell-main/screenshots/final'
import fs from 'fs'
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

// Reset Axel to ready_for_pre_departure so dashboard is in mid-lifecycle
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
await admin.from('relocation_plans').update({stage:'ready_for_pre_departure',arrival_date:null,user_triggered_pre_departure_at:null,post_relocation_generated:false}).eq('user_id','819053d3-0f53-49c6-a8a0-d92122cab5ae').eq('is_current',true)

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto('http://localhost:5175/auth/login', { waitUntil: 'networkidle' })
await page.locator('input[type="email"]').first().fill(process.env.TEST_EMAIL)
await page.locator('input[type="password"]').first().fill(process.env.TEST_PASSWORD)
await page.locator('button[type="submit"]').first().click()
await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 25000 })

for (const p of ['/dashboard','/visa','/guides','/checklist','/pre-departure','/chat','/settings']) {
  await page.goto('http://localhost:5175' + p, { waitUntil: 'networkidle' }).catch(()=>{})
  await page.waitForTimeout(2500)
  await page.screenshot({ path: path.join(OUT, p.replace(/\//g,'_').replace(/^_/,'') + '.png'), fullPage: true })
  console.log('captured', p)
}
await browser.close()
