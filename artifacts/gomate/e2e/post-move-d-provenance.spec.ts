// =============================================================
// Phase D-A verification — /post-move/checklist surfaces a
// per-category provenance badge.
// =============================================================
// Pre-conditions (run once before this spec):
//   1. Dev servers running.
//   2. Test user seeded + post-move cache pre-warmed:
//        cd scripts && pnpm exec tsx src/seed-a1-test-user.ts
//        cd scripts && pnpm seed-c1-cache --force
//
// Asserts:
//   - /api/settling-in returns a provenance map keyed by SettlingDomain
//   - Researched domains (registration / banking / healthcare) are
//     kind="researched" with quality + sources + retrievedAt populated
//   - Other domains are kind="generic"
//   - Each rendered category card carries a [data-testid="provenance-badge"]
//     with the matching kind/quality data attributes
//   - At least one researched popover opens and surfaces source URLs
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
  "../../../artifacts/screenshots/phase-d-a",
)

test("phase-d-a — /post-move/checklist shows per-category provenance badges", async ({ page }) => {
  test.setTimeout(180_000)
  fs.mkdirSync(SHOTS_DIR, { recursive: true })

  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForURL(/\/auth\/login/, { timeout: 20_000 })
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL)
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 })

  await page.goto("/post-move", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")

  // The page auto-defaults to "first 30 days" mode for users newly
  // arrived; that view is a flat list with no per-category headers.
  // Force "all" mode so category-grouped rendering kicks in (the
  // surface this phase ships).
  await page.evaluate(() => {
    localStorage.setItem("gomate:settling-view", "all")
  })

  // Trigger generate so tasks exist + provenance is fresh.
  const gen = await page.evaluate(async () => {
    const r = await fetch("/api/settling-in/generate", { method: "POST", credentials: "include" })
    return { status: r.status }
  })
  expect(gen.status).toBe(200)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2_000)

  // Defensively click the "All tasks" toggle in case localStorage
  // didn't override the auto-mode.
  const allTabBtn = page.getByRole("button", { name: /^All tasks$/i }).first()
  if (await allTabBtn.isVisible().catch(() => false)) {
    await allTabBtn.click()
    await page.waitForTimeout(500)
  }

  // ---- API-level proof of provenance shape ------------------
  const apiJson = await page.evaluate(async () => {
    const r = await fetch("/api/settling-in", { credentials: "include" })
    return r.json().catch(() => null)
  })
  const provenance = (apiJson?.provenance ?? {}) as Record<string, { kind: "researched" | "generic"; quality?: string; sources?: unknown[]; retrievedAt?: string }>
  console.log(`[d-a-spec] provenance keys: ${Object.keys(provenance).join(", ")}`)

  const researched = Object.entries(provenance).filter(([, v]) => v.kind === "researched")
  const generic = Object.entries(provenance).filter(([, v]) => v.kind === "generic")
  console.log(
    `[d-a-spec] researched=${researched.length} (${researched.map(([k, v]) => `${k}/${v.quality}`).join(", ")})`,
  )
  console.log(`[d-a-spec] generic=${generic.length} (${generic.map(([k]) => k).join(", ")})`)

  expect(provenance.registration?.kind).toBe("researched")
  expect(provenance.banking?.kind).toBe("researched")
  expect(provenance.healthcare?.kind).toBe("researched")
  expect(provenance.housing?.kind).toBe("generic")
  expect(provenance.employment?.kind).toBe("generic")
  expect(provenance.transport?.kind).toBe("generic")
  expect(provenance.family?.kind).toBe("generic")
  expect(provenance.tax?.kind).toBe("generic")

  for (const [domain, p] of researched) {
    expect(p.quality, `${domain} should have quality`).toBeTruthy()
    expect(p.retrievedAt, `${domain} should have retrievedAt`).toBeTruthy()
    expect((p.sources ?? []).length, `${domain} should have sources`).toBeGreaterThan(0)
  }

  // ---- DOM proof: badges render with the right data attrs ----
  // Need to scroll through all categories — collect every badge rendered
  // on the page.
  await page.screenshot({
    path: path.join(SHOTS_DIR, "01-checklist-with-badges.png"),
    fullPage: true,
  })

  const badges = await page
    .locator('[data-testid="provenance-badge"]')
    .evaluateAll((els) =>
      els.map((e) => ({
        kind: e.getAttribute("data-provenance-kind"),
        quality: e.getAttribute("data-provenance-quality"),
        text: e.textContent?.trim() ?? "",
      })),
    )
  console.log(`[d-a-spec] rendered badges:`, badges)

  const researchedBadges = badges.filter((b) => b.kind === "researched")
  const genericBadges = badges.filter((b) => b.kind === "generic")
  expect(
    researchedBadges.length,
    "expected at least 3 researched badges (registration + banking + healthcare)",
  ).toBeGreaterThanOrEqual(3)
  expect(
    genericBadges.length,
    "expected at least 1 generic badge (other categories)",
  ).toBeGreaterThanOrEqual(1)

  // ---- Open one researched popover and confirm sources show -
  const researchedTrigger = page
    .locator('[data-testid="provenance-badge"][data-provenance-kind="researched"]')
    .first()
  await researchedTrigger.click()
  await page.waitForTimeout(800)
  await page.screenshot({
    path: path.join(SHOTS_DIR, "02-popover-open.png"),
    fullPage: true,
  })

  // Popover renders to body; pull anchors that look like our source URLs.
  const popoverLinks = await page
    .locator('a[target="_blank"][rel*="noopener"]')
    .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href))
  console.log(`[d-a-spec] popover surfaced links: ${popoverLinks.slice(0, 8).join(", ")}`)
  const hasRegistrySource = popoverLinks.some(
    (u) =>
      u.includes("skatteverket.se") ||
      u.includes("forsakringskassan.se") ||
      u.includes("1177.se") ||
      u.includes("fi.se") ||
      u.includes("bankid.com") ||
      u.includes("migrationsverket.se"),
  )
  expect(
    hasRegistrySource,
    "expected the open popover to surface at least one researched source URL",
  ).toBe(true)
})
