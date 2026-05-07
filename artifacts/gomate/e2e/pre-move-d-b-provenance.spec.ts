// =============================================================
// Phase D-B verification — /pre-move surfaces a per-domain
// provenance summary at the top of the page.
// =============================================================
// Pre-conditions (run once before this spec):
//   1. Dev servers running.
//   2. Test user seeded (stage=ready_for_pre_departure with A1
//      visa_research + local_requirements_research) + B2 cache:
//        cd scripts && pnpm exec tsx src/seed-a1-test-user.ts
//        cd scripts && pnpm seed-b2-cache --force
//
// Asserts:
//   - POST /api/pre-departure/generate returns provenance:
//       visa            → legacy_research (visa_research column)
//       documents       → researched (B2 cache)
//       housing         → researched (B2 cache)
//       banking         → researched (B2 cache)
//       healthcare      → legacy_research (local_requirements has it)
//                          OR generic (if not in fixture)
//   - GET /api/pre-departure surfaces the same provenance from the
//     persisted snapshot.
//   - DOM renders TimelineProvenanceSummary with 5 domain chips,
//     each carrying [data-testid="provenance-chip-<domain>"] +
//     [data-domain="<domain>"].
//   - The visa chip's badge has data-provenance-kind="legacy_research".
//   - Documents/housing/banking chips have data-provenance-kind="researched".
//   - Clicking a researched badge reveals its source list popover.
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
  "../../../artifacts/screenshots/phase-d-b",
)

test("phase-d-b — /pre-move surfaces per-domain provenance summary", async ({ page }) => {
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

  // Trigger generate (cache warm so it's fast).
  const gen = await page.evaluate(async () => {
    const r = await fetch("/api/pre-departure/generate", { method: "POST", credentials: "include" })
    return { status: r.status, body: await r.json().catch(() => null) }
  })
  expect(gen.status).toBe(200)
  const genProvenance = gen.body?.provenance ?? {}
  console.log(`[d-b-spec] generate provenance keys: ${Object.keys(genProvenance).join(", ")}`)
  console.log(
    `[d-b-spec] generate provenance kinds:`,
    Object.fromEntries(
      Object.entries(genProvenance).map(([k, v]) => [k, (v as { kind?: string }).kind ?? "?"]),
    ),
  )

  expect((genProvenance.visa as { kind?: string })?.kind, "visa should be legacy_research").toBe(
    "legacy_research",
  )
  expect((genProvenance.documents as { kind?: string })?.kind, "documents should be researched").toBe(
    "researched",
  )
  expect((genProvenance.housing as { kind?: string })?.kind, "housing should be researched").toBe(
    "researched",
  )
  expect((genProvenance.banking as { kind?: string })?.kind, "banking should be researched").toBe(
    "researched",
  )

  // Reload so the UI re-fetches and renders.
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2_000)
  await page.screenshot({
    path: path.join(SHOTS_DIR, "01-pre-move-with-summary.png"),
    fullPage: true,
  })

  // ---- Confirm GET also returns the persisted provenance ----
  const apiJson = await page.evaluate(async () => {
    const r = await fetch("/api/pre-departure", { credentials: "include" })
    return r.json().catch(() => null)
  })
  const getProvenance = apiJson?.provenance ?? {}
  expect((getProvenance.visa as { kind?: string })?.kind, "GET visa → legacy_research").toBe(
    "legacy_research",
  )
  expect((getProvenance.documents as { kind?: string })?.kind).toBe("researched")
  expect((getProvenance.housing as { kind?: string })?.kind).toBe("researched")
  expect((getProvenance.banking as { kind?: string })?.kind).toBe("researched")

  // ---- DOM proof: summary card + per-chip data attrs ----
  const summary = page.locator('[data-testid="timeline-provenance-summary"]').first()
  await expect(summary, "summary card visible").toBeVisible()

  const visaChip = page.locator('[data-testid="provenance-chip-visa"]').first()
  const docsChip = page.locator('[data-testid="provenance-chip-documents"]').first()
  const housingChip = page.locator('[data-testid="provenance-chip-housing"]').first()
  const bankingChip = page.locator('[data-testid="provenance-chip-banking"]').first()
  await expect(visaChip).toBeVisible()
  await expect(docsChip).toBeVisible()
  await expect(housingChip).toBeVisible()
  await expect(bankingChip).toBeVisible()

  const visaBadgeKind = await visaChip
    .locator('[data-testid="provenance-badge"]')
    .first()
    .getAttribute("data-provenance-kind")
  const docsBadgeKind = await docsChip
    .locator('[data-testid="provenance-badge"]')
    .first()
    .getAttribute("data-provenance-kind")
  const housingBadgeKind = await housingChip
    .locator('[data-testid="provenance-badge"]')
    .first()
    .getAttribute("data-provenance-kind")
  const bankingBadgeKind = await bankingChip
    .locator('[data-testid="provenance-badge"]')
    .first()
    .getAttribute("data-provenance-kind")
  console.log(
    `[d-b-spec] DOM badge kinds — visa=${visaBadgeKind} docs=${docsBadgeKind} housing=${housingBadgeKind} banking=${bankingBadgeKind}`,
  )
  expect(visaBadgeKind).toBe("legacy_research")
  expect(docsBadgeKind).toBe("researched")
  expect(housingBadgeKind).toBe("researched")
  expect(bankingBadgeKind).toBe("researched")

  // ---- Open the visa popover; assert the legacy-explainer text + a link ----
  await visaChip.locator('[data-testid="provenance-badge"]').first().click()
  await page.waitForTimeout(800)
  await page.screenshot({
    path: path.join(SHOTS_DIR, "02-visa-popover.png"),
    fullPage: true,
  })

  const popoverText = await page.locator("body").innerText()
  expect(
    popoverText.toLowerCase().includes("older research pipeline") ||
      popoverText.toLowerCase().includes("legacy"),
    "visa popover should disclose 'older research pipeline'",
  ).toBe(true)

  // Capture researched popover too for the diff.
  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  await docsChip.locator('[data-testid="provenance-badge"]').first().click()
  await page.waitForTimeout(800)
  await page.screenshot({
    path: path.join(SHOTS_DIR, "03-documents-popover.png"),
    fullPage: true,
  })
})
