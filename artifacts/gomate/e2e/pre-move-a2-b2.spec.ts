// =============================================================
// Phase A2 verification — /pre-move user-facing actions are sourced
// from documents_v2 + housing_v2 (not the legacy adapter).
// =============================================================
// Pre-conditions (run once before this spec):
//   1. Dev servers running:
//        pnpm dev   (vite at :5174 + api-server at :3002)
//   2. Test user seeded + B2 cache pre-warmed:
//        set -a && source .env.local && set +a
//        cd scripts && pnpm exec tsx src/seed-a1-test-user.ts
//        cd scripts && pnpm seed-b2-cache --force
//
// What this proves:
//   - The B2 cache (research_meta.researchedSpecialists.{documents,
//     housing}) is consumed by the pre-departure generate route.
//   - Composer takes B2 output over the legacy adapter for those
//     domains (precedence: researched cache > legacy adapter).
//   - User-facing action titles match the B2 output shape (3-step
//     lifecycle for documents — obtain/apostille/translate; queue +
//     temp-accommodation + lease-signing for housing).
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
  "../../../artifacts/screenshots/phase-a2",
)

test("phase-a2 — /pre-move action titles come from documents_v2 + housing_v2 cache", async ({ page }) => {
  test.setTimeout(180_000)
  fs.mkdirSync(SHOTS_DIR, { recursive: true })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForURL(/\/auth\/login/, { timeout: 20_000 })
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL)
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 })

  await page.goto("/pre-move", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(1_500)
  await page.screenshot({
    path: path.join(SHOTS_DIR, "01-before.png"),
    fullPage: true,
  })

  const generateBtn = page.getByRole("button", { name: /Generate checklist/i }).first()
  const regenerateBtn = page.getByRole("button", { name: /Regenerate from latest profile/i }).first()
  if (await generateBtn.isVisible().catch(() => false)) {
    await generateBtn.click()
  } else {
    await regenerateBtn.click()
  }

  // Cache hit means generate completes in seconds (no LLM/Firecrawl).
  // 60s gives us margin even if cache wasn't pre-warmed.
  const generateResp = await page.waitForResponse(
    (r) =>
      r.url().includes("/api/pre-departure/generate") &&
      r.request().method() === "POST" &&
      r.status() === 200,
    { timeout: 120_000 },
  )
  await page.waitForTimeout(2_000)

  await page.screenshot({
    path: path.join(SHOTS_DIR, "02-after-regenerate.png"),
    fullPage: true,
  })

  // ---- B2-only markers ----
  // The legacy adapter for the seeded local_requirements_research only
  // produced these item titles for documents/housing:
  //   • "Apostilled birth certificate" (single step)
  //   • "Police clearance certificate" (single step)
  //   • "Secure first-hand contract or sub-let in Stockholm" (single step)
  //
  // The B2 specialists produce a 3-step lifecycle per document
  // (obtain → apostille → translate) and 5+ housing steps including
  // queue registration, temporary accommodation, and lease signing —
  // shapes the legacy adapter cannot produce. We assert at least one
  // of those B2-only patterns shows up.
  const titles = await page
    .locator('[data-testid^="action-card"], h3, h4, h5')
    .allInnerTexts()
    .catch(() => [])
  const bodyText = (await page.locator("body").innerText()).toLowerCase()

  // documents:* — 3-step lifecycle. The legacy adapter never produces
  // separate "obtain" + "apostille" + "translate" actions; the B2
  // specialist does.
  const hasDocsObtainStep =
    /obtain (philippine|psa|nbi|cenomar|birth certificate|police clearance)/.test(bodyText)
  const hasDocsApostilleStep =
    /(apostille|legalise|legalize|authenticate)\s+(the\s+)?(birth|police|cenomar|certificate|clearance)/.test(bodyText)
  const hasDocsTranslateStep =
    /(translate|certified translation)\s+(the\s+|to\s+)?(birth|police|cenomar|certificate|clearance|swedish)/.test(bodyText)

  // housing:* — queue / temp / sign-lease pattern that legacy doesn't
  // emit as separate actions.
  const hasHousingQueue =
    /(register .* (rental )?queue|bostadsförmedlingen)/.test(bodyText)
  const hasHousingTemp = /(temporary accommodation|short-?term|airbnb|sublet)/.test(bodyText)
  const hasHousingLease = /sign\s+(the\s+)?lease/.test(bodyText)

  console.log(
    `[a2-spec] docs markers — obtain=${hasDocsObtainStep} apostille=${hasDocsApostilleStep} translate=${hasDocsTranslateStep}`,
  )
  console.log(
    `[a2-spec] housing markers — queue=${hasHousingQueue} temp=${hasHousingTemp} lease=${hasHousingLease}`,
  )
  console.log(`[a2-spec] sample titles:`, titles.slice(0, 16))

  // Both domains should have at least one B2-shape marker hit.
  const docsHits = [hasDocsObtainStep, hasDocsApostilleStep, hasDocsTranslateStep].filter(Boolean).length
  const housingHits = [hasHousingQueue, hasHousingTemp, hasHousingLease].filter(Boolean).length

  expect(
    docsHits,
    "expected at least one B2-shape documents-specialist action title in /pre-move",
  ).toBeGreaterThanOrEqual(1)
  expect(
    housingHits,
    "expected at least one B2-shape housing-specialist action title in /pre-move",
  ).toBeGreaterThanOrEqual(1)

  // Source attribution — at least one of the registered B2 housing /
  // documents URLs should appear in the page's anchor links.
  const links = await page
    .locator('a[href]')
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href))
  const hasB2HousingLink = links.some((u) =>
    u.includes("bostad.stockholm.se") ||
    u.includes("hyresgastforeningen.se") ||
    u.includes("boverket.se"),
  )
  const hasB2DocsLink = links.some((u) =>
    u.includes("migrationsverket.se") ||
    u.includes("swedenabroad.se") ||
    u.includes("regeringen.se"),
  )
  console.log(`[a2-spec] B2 source links — housing=${hasB2HousingLink} docs=${hasB2DocsLink}`)
  expect(
    hasB2HousingLink || hasB2DocsLink,
    "expected at least one B2 registered source URL on /pre-move",
  ).toBe(true)

  // Capture a tight shot of one B2 action so the user can eyeball it.
  const firstAction = page.locator('[data-testid^="task-"]').first()
  if (await firstAction.isVisible().catch(() => false)) {
    await firstAction.scrollIntoViewIfNeeded()
    await firstAction.screenshot({
      path: path.join(SHOTS_DIR, "03-action-detail.png"),
    })
  }

  // Log generate response for debugging.
  const respJson = await generateResp.json().catch(() => null)
  if (respJson) {
    console.log(
      `[a2-spec] generate response — total=${respJson.totalActions} criticalPath=${respJson.criticalPathActionKeys?.length ?? 0}`,
    )
  }
})
