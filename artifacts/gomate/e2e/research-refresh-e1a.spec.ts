// =============================================================
// Phase E1a smoke test — POST /api/research/refresh
// =============================================================
// What this proves end-to-end against a running api-server:
//
//   1. Snapshot current research_meta.researchedSpecialists state
//      (via /api/settling-in's provenance map — which reads the
//      same cache).
//   2. Call POST /api/research/refresh with a single domain
//      ("banking"). Wait up to 120s for it to land.
//   3. Confirm:
//        - response.refreshed contains banking with non-zero
//          stepsCount + sourcesCount
//        - response.skipped doesn't claim banking was skipped
//        - the post-snapshot's banking.retrievedAt is STRICTLY
//          NEWER than the pre-snapshot's
//        - other domains' retrievedAt timestamps are UNCHANGED
//          (registration + healthcare cache entries didn't get
//          re-run)
//   4. Call again with a non-implemented domain ("visa") and
//      expect skipped: [{domain: "visa", reason: "no_v2_specialist"}]
//      and refreshed: [].
//
// Pre-conditions:
//   - Test user logged in via TEST_EMAIL/TEST_PASSWORD.
//   - Plan has stage="arrived" and a pre-warmed cache for
//     registration + banking + healthcare. seed-c1-cache --force
//     gets us there.
// =============================================================

import { test, expect } from "@playwright/test"

const TEST_EMAIL = process.env.TEST_EMAIL!
const TEST_PASSWORD = process.env.TEST_PASSWORD!
if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error("TEST_EMAIL and TEST_PASSWORD must be set")
}

interface ProvenanceEntry {
  kind: "researched" | "generic"
  retrievedAt?: string
}

async function readProvenance(
  page: import("@playwright/test").Page,
): Promise<Record<string, ProvenanceEntry>> {
  const json = await page.evaluate(async () => {
    const r = await fetch("/api/settling-in", { credentials: "include" })
    return r.json().catch(() => null)
  })
  return (json?.provenance ?? {}) as Record<string, ProvenanceEntry>
}

test("phase-e1a — POST /api/research/refresh refreshes one domain, leaves others untouched", async ({ page }) => {
  test.setTimeout(180_000)

  // ---- 1. Login + open /post-move so the session has cookies ----
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForURL(/\/auth\/login/, { timeout: 20_000 })
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL)
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 })
  await page.goto("/post-move", { waitUntil: "domcontentloaded" })
  await page.waitForLoadState("networkidle")

  // ---- 2. Snapshot pre-refresh provenance -----------------------
  const before = await readProvenance(page)
  console.log(
    `[e1a-spec] before — registration=${before.registration?.retrievedAt ?? "none"} banking=${before.banking?.retrievedAt ?? "none"} healthcare=${before.healthcare?.retrievedAt ?? "none"}`,
  )
  expect(before.banking?.retrievedAt, "banking must be cached before refresh").toBeTruthy()
  expect(before.registration?.retrievedAt, "registration must be cached before refresh").toBeTruthy()

  // ---- 3. Refresh banking only ---------------------------------
  // page.evaluate so the browser's auth cookies travel with fetch.
  const refreshResp = await page.evaluate(async () => {
    const r = await fetch("/api/research/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domains: ["banking"] }),
    })
    return { status: r.status, body: await r.json().catch(() => null) }
  })
  console.log(`[e1a-spec] refresh banking response: status=${refreshResp.status}`)
  console.log(`[e1a-spec]   body:`, JSON.stringify(refreshResp.body, null, 2))
  expect(refreshResp.status, "refresh banking should 200").toBe(200)

  const refreshed = (refreshResp.body?.refreshed ?? []) as Array<{
    domain: string
    quality: string
    retrievedAt: string
    sourcesCount: number
    stepsCount: number
  }>
  const skipped = (refreshResp.body?.skipped ?? []) as Array<{ domain: string; reason: string }>

  expect(
    refreshed.some((r) => r.domain === "banking" && r.stepsCount > 0),
    "refreshed should include banking with ≥1 step",
  ).toBe(true)
  expect(
    skipped.find((s) => s.domain === "banking"),
    "banking must not appear in skipped",
  ).toBeUndefined()

  // ---- 4. Snapshot post-refresh and compare --------------------
  // Small grace window for the persist to land before reading.
  await page.waitForTimeout(500)
  const after = await readProvenance(page)
  console.log(
    `[e1a-spec] after — registration=${after.registration?.retrievedAt ?? "none"} banking=${after.banking?.retrievedAt ?? "none"} healthcare=${after.healthcare?.retrievedAt ?? "none"}`,
  )

  // banking newer than before.
  const beforeBankingMs = new Date(before.banking!.retrievedAt!).getTime()
  const afterBankingMs = new Date(after.banking!.retrievedAt!).getTime()
  expect(
    afterBankingMs > beforeBankingMs,
    `banking retrievedAt should be newer (before=${beforeBankingMs} after=${afterBankingMs})`,
  ).toBe(true)

  // Other domains unchanged.
  if (before.registration?.retrievedAt) {
    expect(
      after.registration?.retrievedAt,
      "registration retrievedAt must be unchanged",
    ).toBe(before.registration.retrievedAt)
  }
  if (before.healthcare?.retrievedAt) {
    expect(
      after.healthcare?.retrievedAt,
      "healthcare retrievedAt must be unchanged",
    ).toBe(before.healthcare.retrievedAt)
  }

  // ---- 5. Refresh an unsupported domain (visa) -----------------
  const visaResp = await page.evaluate(async () => {
    const r = await fetch("/api/research/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domains: ["visa"] }),
    })
    return { status: r.status, body: await r.json().catch(() => null) }
  })
  console.log(`[e1a-spec] refresh visa response:`, JSON.stringify(visaResp.body, null, 2))
  expect(visaResp.status).toBe(200)
  expect(
    (visaResp.body?.refreshed ?? []).length,
    "visa is unsupported → refreshed should be empty",
  ).toBe(0)
  expect(
    (visaResp.body?.skipped ?? []).find(
      (s: { domain: string; reason: string }) => s.domain === "visa" && s.reason === "no_v2_specialist",
    ),
    "visa should be skipped with reason no_v2_specialist",
  ).toBeTruthy()
})
