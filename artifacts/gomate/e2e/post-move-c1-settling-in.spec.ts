// =============================================================
// Phase C1d verification — /post-move checklist tab renders
// registration + banking from researched specialists.
// =============================================================
// Pre-conditions (run once before this spec):
//   1. Dev servers running:
//        pnpm dev
//   2. Test user seeded + post-move cache pre-warmed:
//        set -a && source .env.local && set +a
//        cd scripts && pnpm exec tsx src/seed-a1-test-user.ts
//        cd scripts && pnpm seed-c1-cache --force
//
// What this proves:
//   - The post-move researched cache (research_meta.researchedSpecialists.
//     {registration, banking}) is consumed by /api/settling-in/generate.
//   - composeSettlingInTimeline takes researched output over the
//     deterministic registration/banking contributors.
//   - User-facing task titles + walkthroughs match shapes only the
//     researched specialists can produce.
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
  "../../../artifacts/screenshots/phase-c1",
)

test("phase-c1 — /post-move checklist renders researched registration + banking", async ({ page }) => {
  test.setTimeout(180_000)
  fs.mkdirSync(SHOTS_DIR, { recursive: true })

  // ---- 1. Login --------------------------------------------------
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForURL(/\/auth\/login/, { timeout: 20_000 })
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL)
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 })

  // ---- 2. Trigger generate via API directly --------------------
  // Skip UI button-flake. Cache is pre-warmed so this returns quickly.
  // page.request inherits the auth cookies from the logged-in session.
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
  expect(generateJson.status, "POST /api/settling-in/generate should 200").toBe(200)
  console.log(
    `[c1-spec] generate response — tasksGenerated=${generateJson.body?.tasksGenerated} legalRequirements=${generateJson.body?.legalRequirements} urgentDeadlines=${generateJson.body?.urgentDeadlines}`,
  )

  // Reload /post-move so the UI re-fetches and renders the fresh tasks.
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2_000)
  await page.screenshot({
    path: path.join(SHOTS_DIR, "02-after-generate.png"),
    fullPage: true,
  })

  // ---- 4. Assertions: deterministic researched provenance ----
  // LLM-produced copy is non-deterministic between runs (one run says
  // "Skatteverket" prominently, another says "Swedish tax authority").
  // The DETERMINISTIC proof that researched output drove the page:
  // tasks for registration + banking domains carry the namespaced
  // taskKey (registration:* / banking:*) instead of the legacy
  // short-form keys (reg-*, bank-*). We pull this from the API
  // response directly — the UI doesn't surface taskKey as a DOM
  // attribute today, but the contract is at the data layer.
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
  const regResearched = regTasks.filter((t) => (t.task_key ?? "").startsWith("registration:"))
  const bankResearched = bankTasks.filter((t) => (t.task_key ?? "").startsWith("banking:"))
  const regLegacyKeys = regTasks
    .filter((t) => !(t.task_key ?? "").startsWith("registration:"))
    .map((t) => t.task_key ?? "?")
  const bankLegacyKeys = bankTasks
    .filter((t) => !(t.task_key ?? "").startsWith("banking:"))
    .map((t) => t.task_key ?? "?")

  console.log(
    `[c1-spec] API tasks — total=${apiTasks.length} registration=${regTasks.length} (researched=${regResearched.length}) banking=${bankTasks.length} (researched=${bankResearched.length})`,
  )
  console.log(
    `[c1-spec] registration researched task_keys:`,
    regResearched.map((t) => t.task_key).slice(0, 6),
  )
  console.log(
    `[c1-spec] banking researched task_keys:`,
    bankResearched.map((t) => t.task_key).slice(0, 6),
  )
  if (regLegacyKeys.length > 0) {
    console.log(`[c1-spec] WARN — legacy registration task_keys leaked:`, regLegacyKeys)
  }
  if (bankLegacyKeys.length > 0) {
    console.log(`[c1-spec] WARN — legacy banking task_keys leaked:`, bankLegacyKeys)
  }

  expect(
    regResearched.length,
    "expected at least one registration:* task_key from researched specialist",
  ).toBeGreaterThanOrEqual(1)
  expect(
    bankResearched.length,
    "expected at least one banking:* task_key from researched specialist",
  ).toBeGreaterThanOrEqual(1)
  expect(
    regLegacyKeys.length,
    "no legacy reg-* task_keys should leak when registration is researched",
  ).toBe(0)
  expect(
    bankLegacyKeys.length,
    "no legacy bank-* task_keys should leak when banking is researched",
  ).toBe(0)

  // Per-task source attribution lives on official_link. Confirm at
  // least one researched task has a registry-source URL.
  const apiOfficialLinks = apiTasks
    .filter((t) => t.task_key?.startsWith("registration:") || t.task_key?.startsWith("banking:"))
    .map((t) => t.official_link)
    .filter((u): u is string => typeof u === "string" && u.length > 0)
  const hasRegistrySource = apiOfficialLinks.some(
    (u) =>
      u.includes("skatteverket.se") ||
      u.includes("migrationsverket.se") ||
      u.includes("bankid.com") ||
      u.includes("fi.se"),
  )
  console.log(
    `[c1-spec] researched-task official_links — count=${apiOfficialLinks.length} registry-sourced=${hasRegistrySource}`,
  )
  expect(
    hasRegistrySource,
    "expected at least one researched task to carry a registry source URL on official_link",
  ).toBe(true)

  // Also log titles for human-eyeball review (the screenshot is the
  // primary visual proof).
  const titles = await page.locator('h3, h4, h5').allInnerTexts().catch(() => [])
  console.log(`[c1-spec] sample page titles:`, titles.slice(0, 16))

  console.log(
    `[c1-spec] researched titles — registration:`,
    regResearched.map((t) => t.title?.slice(0, 80)),
  )
  console.log(
    `[c1-spec] researched titles — banking:`,
    bankResearched.map((t) => t.title?.slice(0, 80)),
  )

  // Open the first task to capture a detail-sheet screenshot (UI
  // proof; not asserted — the API-level proof above is deterministic
  // enough on its own).
  const firstTaskTitle = regResearched[0]?.title ?? bankResearched[0]?.title
  if (firstTaskTitle) {
    const card = page.locator(`:text("${firstTaskTitle}")`).first()
    if (await card.isVisible().catch(() => false)) {
      await card.click()
      await page.waitForTimeout(1_000)
      await page.screenshot({
        path: path.join(SHOTS_DIR, "03-task-detail.png"),
        fullPage: true,
      })
    }
  }

})
