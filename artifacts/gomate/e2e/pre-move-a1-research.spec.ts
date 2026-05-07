// =============================================================
// Phase A1 verification — /pre-move renders research-driven actions
// =============================================================
// Logs in as TEST_EMAIL (already seeded with completed research +
// arrival_date by scripts/src/seed-a1-test-user.ts), opens
// /pre-move, screenshots the BEFORE state (no preDeparture timeline
// yet → empty/welcome), clicks "Generate checklist" / "Regenerate
// from latest profile", waits, screenshots AFTER, asserts that the
// research-derived narrative made it into the timeline.
//
// Pre-conditions (run these once before this spec):
//   1. Dev servers running:
//        pnpm dev   (vite at :5174 + api-server at :3002)
//   2. Test user seeded:
//        set -a && source .env.local && set +a
//        cd scripts && pnpm exec tsx src/seed-a1-test-user.ts
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
  "../../../artifacts/screenshots/phase-a1",
)

test("phase-a1 — /pre-move renders research-derived actions with source attribution", async ({ page }) => {
  test.setTimeout(120_000)
  fs.mkdirSync(SHOTS_DIR, { recursive: true })

  // ---- 1. Login ------------------------------------------------------
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForURL(/\/auth\/login/, { timeout: 20_000 })
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL)
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 })

  // ---- 2. Pre-move BEFORE Regenerate --------------------------------
  await page.goto("/pre-move", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(1_500)
  await page.screenshot({
    path: path.join(SHOTS_DIR, "01-before.png"),
    fullPage: true,
  })

  // The seeded plan has research_meta=null so the page should render
  // the "Generate your week-by-week move plan" empty-state with a
  // "Generate checklist" button. After clicking, the timeline shows.
  const generateBtn = page.getByRole("button", { name: /Generate checklist/i }).first()
  const regenerateBtn = page.getByRole("button", { name: /Regenerate from latest profile/i }).first()
  if (await generateBtn.isVisible().catch(() => false)) {
    await generateBtn.click()
  } else {
    await regenerateBtn.click()
  }

  // ---- 3. Wait for the new (research-driven) actions to land --------
  await page.waitForResponse(
    (r) =>
      r.url().includes("/api/pre-departure/generate") &&
      r.request().method() === "POST" &&
      r.status() === 200,
    { timeout: 45_000 },
  )
  await page.waitForTimeout(2_000)

  await page.screenshot({
    path: path.join(SHOTS_DIR, "02-after-regenerate.png"),
    fullPage: true,
  })

  // ---- 4. Assertions: research narrative made it into actions -------
  // Pull the action titles + descriptions from the rendered list.
  const titles = await page
    .locator('[data-testid^="action-card"], h3, h4, h5')
    .allInnerTexts()
    .catch(() => [])
  const bodyText = (await page.locator("body").innerText()).toLowerCase()

  // Phase A1 success markers — the research_research fixture mentions
  // Migrationsverket, Stockholm-rental specifics, apostille flow.
  // If the composer correctly consumed researched output, at least
  // one of these phrases shows up in the rendered timeline.
  const hasMigrationsverket = bodyText.includes("migrationsverket")
  const hasStockholm = bodyText.includes("stockholm") || bodyText.includes("bostadsförmedlingen")
  const hasApostille = bodyText.includes("apostille") || bodyText.includes("apostilled")

  console.log(
    `[a1-spec] research narrative markers — migrationsverket=${hasMigrationsverket} stockholm=${hasStockholm} apostille=${hasApostille}`,
  )
  console.log(`[a1-spec] sample titles:`, titles.slice(0, 12))

  expect(
    hasMigrationsverket || hasStockholm || hasApostille,
    "expected at least one research-narrative marker in /pre-move",
  ).toBe(true)

  // Source attribution — at least one of the registered research URLs
  // should appear somewhere in the page (the timeline links to
  // officialSourceUrl per action).
  const links = await page
    .locator('a[href]')
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href))
  const hasSourceLink = links.some((u) =>
    u.includes("migrationsverket.se") ||
    u.includes("bostad.stockholm.se") ||
    u.includes("wise.com") ||
    u.includes("swedenabroad.se"),
  )
  console.log(`[a1-spec] source-link present: ${hasSourceLink}`)
  expect(hasSourceLink, "expected at least one research source URL on /pre-move").toBe(true)

  // ---- 5. Final detail screenshot — focus on a single action item ----
  // Scroll to the first task and take a tight shot of it.
  const firstAction = page.locator('[data-testid^="task-"]').first()
  if (await firstAction.isVisible().catch(() => false)) {
    await firstAction.scrollIntoViewIfNeeded()
    await firstAction.screenshot({
      path: path.join(SHOTS_DIR, "03-action-detail.png"),
    })
  }
})
