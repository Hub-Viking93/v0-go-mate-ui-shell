// =============================================================
// Phase C2 verification — /post-move checklist renders researched
// healthcare alongside the registration + banking proof from C1.
// =============================================================
// Pre-conditions (run once before this spec):
//   1. Dev servers running:
//        pnpm dev
//   2. Test user seeded + post-move cache pre-warmed (now includes
//      healthcare):
//        set -a && source .env.local && set +a
//        cd scripts && pnpm exec tsx src/seed-a1-test-user.ts
//        cd scripts && pnpm seed-c1-cache --force
//
// Asserts (all deterministic, derived from API response shape — LLM
// copy varies between runs):
//   - registration:* taskKeys present  (carried over from C1)
//   - banking:* taskKeys present       (carried over from C1)
//   - healthcare:* taskKeys present    (NEW — C2)
//   - no legacy reg-* / bank-* / health-* keys leak
//   - at least one researched healthcare task carries an
//     official_link to 1177.se or forsakringskassan.se
// =============================================================

import { test, expect } from "@playwright/test"
import * as fs from "node:fs"
import * as path from "node:path"

const TEST_EMAIL = process.env.TEST_EMAIL!
const TEST_PASSWORD = process.env.TEST_PASSWORD!
if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error("TEST_EMAIL and TEST_PASSWORD must be set")
}

const SHOTS_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../artifacts/screenshots/phase-c2",
)

test("phase-c2 — /post-move checklist renders researched healthcare", async ({ page }) => {
  test.setTimeout(180_000)
  fs.mkdirSync(SHOTS_DIR, { recursive: true })

  // ---- 1. Login --------------------------------------------------
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForURL(/\/auth\/login/, { timeout: 20_000 })
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL)
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 })

  // ---- 2. Open /post-move + trigger generate via API -----------
  await page.goto("/post-move", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")
  await page.screenshot({
    path: path.join(SHOTS_DIR, "01-before.png"),
    fullPage: true,
  })

  const generateJson = await page.evaluate(async () => {
    const r = await fetch("/api/settling-in/generate", { method: "POST", credentials: "include" })
    return { status: r.status, body: await r.json().catch(() => null) }
  })
  expect(generateJson.status).toBe(200)
  console.log(
    `[c2-spec] generate response — tasksGenerated=${generateJson.body?.tasksGenerated} legalRequirements=${generateJson.body?.legalRequirements} urgentDeadlines=${generateJson.body?.urgentDeadlines}`,
  )

  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2_000)
  await page.screenshot({
    path: path.join(SHOTS_DIR, "02-after-generate.png"),
    fullPage: true,
  })

  // ---- 3. API-level proof of researched provenance ------------
  const apiJson = await page.evaluate(async () => {
    const r = await fetch("/api/settling-in", { credentials: "include" })
    return r.json().catch(() => null)
  })
  const apiTasks = (apiJson?.tasks ?? []) as Array<{
    task_key?: string
    category?: string
    title?: string
    official_link?: string | null
  }>

  const regTasks = apiTasks.filter((t) => t.category === "registration")
  const bankTasks = apiTasks.filter((t) => t.category === "banking")
  const hcTasks = apiTasks.filter((t) => t.category === "healthcare")

  const regResearched = regTasks.filter((t) => (t.task_key ?? "").startsWith("registration:"))
  const bankResearched = bankTasks.filter((t) => (t.task_key ?? "").startsWith("banking:"))
  const hcResearched = hcTasks.filter((t) => (t.task_key ?? "").startsWith("healthcare:"))

  const regLegacyKeys = regTasks
    .filter((t) => !(t.task_key ?? "").startsWith("registration:"))
    .map((t) => t.task_key ?? "?")
  const bankLegacyKeys = bankTasks
    .filter((t) => !(t.task_key ?? "").startsWith("banking:"))
    .map((t) => t.task_key ?? "?")
  const hcLegacyKeys = hcTasks
    .filter((t) => !(t.task_key ?? "").startsWith("healthcare:"))
    .map((t) => t.task_key ?? "?")

  console.log(
    `[c2-spec] API tasks — total=${apiTasks.length} ` +
      `registration=${regTasks.length}/researched=${regResearched.length} ` +
      `banking=${bankTasks.length}/researched=${bankResearched.length} ` +
      `healthcare=${hcTasks.length}/researched=${hcResearched.length}`,
  )
  console.log(
    `[c2-spec] healthcare researched titles:`,
    hcResearched.map((t) => t.title?.slice(0, 80)),
  )
  if (hcLegacyKeys.length > 0) {
    console.log(`[c2-spec] WARN — legacy healthcare keys leaked:`, hcLegacyKeys)
  }
  if (regLegacyKeys.length > 0) {
    console.log(`[c2-spec] WARN — legacy registration keys leaked:`, regLegacyKeys)
  }
  if (bankLegacyKeys.length > 0) {
    console.log(`[c2-spec] WARN — legacy banking keys leaked:`, bankLegacyKeys)
  }

  // C1 carry-over assertions.
  expect(regResearched.length, "registration:* researched tasks").toBeGreaterThanOrEqual(1)
  expect(bankResearched.length, "banking:* researched tasks").toBeGreaterThanOrEqual(1)
  expect(regLegacyKeys.length, "no legacy registration keys").toBe(0)
  expect(bankLegacyKeys.length, "no legacy banking keys").toBe(0)

  // C2 NEW.
  expect(
    hcResearched.length,
    "expected at least one healthcare:* task_key from researched specialist",
  ).toBeGreaterThanOrEqual(1)
  expect(
    hcLegacyKeys.length,
    "no legacy health-* task_keys should leak when healthcare is researched",
  ).toBe(0)

  // Source attribution for healthcare specifically.
  const hcOfficialLinks = hcResearched
    .map((t) => t.official_link)
    .filter((u): u is string => typeof u === "string" && u.length > 0)
  const hasHealthcareSource = hcOfficialLinks.some(
    (u) => u.includes("1177.se") || u.includes("forsakringskassan.se"),
  )
  console.log(
    `[c2-spec] healthcare official_links — count=${hcOfficialLinks.length} registry-sourced=${hasHealthcareSource}`,
  )
  expect(
    hasHealthcareSource,
    "expected at least one researched healthcare task to carry a 1177.se / forsakringskassan.se link",
  ).toBe(true)

  // Capture detail-sheet shot for one healthcare task.
  const firstHcTitle = hcResearched[0]?.title
  if (firstHcTitle) {
    const card = page.locator(`:text("${firstHcTitle}")`).first()
    if (await card.isVisible().catch(() => false)) {
      await card.click()
      await page.waitForTimeout(1_000)
      await page.screenshot({
        path: path.join(SHOTS_DIR, "03-healthcare-detail.png"),
        fullPage: true,
      })
    }
  }
})
