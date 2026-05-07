// =============================================================
// Phase E3-B verification — suggestions banner on /pre-move
// =============================================================
// Companion to research-suggestions-banner-e3b.spec.ts which proves
// the banner on /post-move. The two surfaces differ in:
//   - stage gate (pre-move requires stage="ready_for_pre_departure"+;
//     post-move requires stage="arrived")
//   - banner mount point (pre-move's banner is now mounted in BOTH
//     the empty-state branch AND the with-timeline branch — see
//     pre-departure-timeline.tsx; this spec exercises the
//     with-timeline path since /pre-departure/generate runs first
//     to build the cache + persisted snapshots)
//
// Pre-conditions:
//   1. Dev servers running.
//   2. cd scripts && pnpm exec tsx src/seed-a1-test-user.ts
//      (sets stage=ready_for_pre_departure + clears research_meta)
//   3. cd scripts && pnpm seed-b2-cache --force
//      (warms documents + housing + banking + writes profileSnapshots
//       per domain so the suggestions endpoint has a baseline)
//
// What this proves:
//   - Banner is ABSENT on /pre-move when profile is unchanged.
//   - Banner APPEARS on /pre-move when profile.destination is mutated.
//   - "Refresh suggested" succeeds end-to-end and the banner clears
//     after a reload.
//
// Same flow as /post-move spec, same assertions, same proof shape.
// =============================================================

import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs"
import * as path from "node:path"

const TEST_EMAIL = process.env.TEST_EMAIL!
const TEST_PASSWORD = process.env.TEST_PASSWORD!
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!TEST_EMAIL || !TEST_PASSWORD || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("env not set")
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const SHOTS_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../../artifacts/screenshots/phase-e3b",
)

async function findUserId(): Promise<string> {
  for (let p = 1; p < 10; p++) {
    const { data } = await sb.auth.admin.listUsers({ page: p, perPage: 100 })
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === TEST_EMAIL.toLowerCase())
    if (u) return u.id
    if (data.users.length < 100) break
  }
  throw new Error("test user not found")
}

test("phase-e3b — suggestions banner on /pre-move (parallel proof to /post-move spec)", async ({ page }) => {
  test.setTimeout(240_000)
  fs.mkdirSync(SHOTS_DIR, { recursive: true })

  const userId = await findUserId()
  const { data: plan } = await sb
    .from("relocation_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .single<{ id: string }>()
  expect(plan?.id).toBeTruthy()
  const planId = plan!.id

  // ---- 1. Login --------------------------------------------------
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForURL(/\/auth\/login/, { timeout: 20_000 })
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL)
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 })

  const { data: planRow } = await sb
    .from("relocation_plans")
    .select("profile_data, stage")
    .eq("id", planId)
    .single<{ profile_data: Record<string, unknown>; stage: string | null }>()
  const original = planRow!.profile_data
  console.log(
    `[e3b-pre] original destination=${original.destination} stage=${planRow!.stage}`,
  )
  expect(
    planRow!.stage === "ready_for_pre_departure" || planRow!.stage === "pre_departure",
    "pre-move spec requires stage in pre-departure flow — re-run seed-a1-test-user before this spec",
  ).toBe(true)

  try {
    // ---- 2. Generate the pre-departure timeline so /pre-move has
    //         content to render. /generate also persists fresh
    //         profileSnapshots per cached domain — so right after
    //         this call, the suggestions endpoint should return [].
    const generated = await page.evaluate(async () => {
      const r = await fetch("/api/pre-departure/generate", {
        method: "POST",
        credentials: "include",
      })
      return { status: r.status }
    })
    console.log(`[e3b-pre] /api/pre-departure/generate status=${generated.status}`)
    expect(generated.status).toBe(200)

    // ---- 3. Visit /pre-move with profile UNCHANGED — banner absent.
    await page.goto("/pre-move", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(1500)

    const bannerLocator = page.locator('[data-testid="research-suggestions-banner"]').first()
    await expect(
      bannerLocator,
      "/pre-move banner must NOT appear when profile is unchanged since last research",
    ).not.toBeVisible({ timeout: 2000 })
    console.log(`[e3b-pre] /pre-move pre-mutation: banner absent ✓`)
    await page.screenshot({
      path: path.join(SHOTS_DIR, "premove-01-banner-absent-fresh-state.png"),
      fullPage: true,
    })

    // ---- 4. Mutate profile.destination via service-role -----------
    await sb
      .from("relocation_plans")
      .update({ profile_data: { ...original, destination: "Germany" } })
      .eq("id", planId)
    console.log(`[e3b-pre] mutated destination → Germany`)

    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000)

    await expect(
      bannerLocator,
      "/pre-move banner must appear after profile mutation",
    ).toBeVisible({ timeout: 5000 })
    console.log(`[e3b-pre] /pre-move post-mutation: banner present ✓`)
    await page.screenshot({
      path: path.join(SHOTS_DIR, "premove-02-banner-visible-after-change.png"),
      fullPage: true,
    })

    // ---- 5. Inspect chips — pre-move cache covers documents +
    //         housing + banking. All three depend on destination.
    const chips = await page
      .locator('[data-testid^="suggestion-chip-"]')
      .evaluateAll((els) =>
        els.map((e) => ({
          domain: e.getAttribute("data-domain"),
          changedFields: (e.getAttribute("data-changed-fields") ?? "").split(",").filter(Boolean),
        })),
      )
    console.log(`[e3b-pre] chips:`, chips)
    const chipDomains = new Set(chips.map((c) => c.domain ?? ""))
    expect(chipDomains.has("documents"), "documents chip present").toBe(true)
    expect(chipDomains.has("housing"), "housing chip present").toBe(true)
    expect(chipDomains.has("banking"), "banking chip present").toBe(true)
    for (const c of chips) {
      if (!c.domain) continue
      expect(
        c.changedFields.includes("destination"),
        `${c.domain} chip changedFields should include destination`,
      ).toBe(true)
    }

    // Pre-move's surface copy should mirror post-move's but reference
    // "timeline" instead of "checklist".
    const bannerText = (await bannerLocator.innerText()).toLowerCase()
    expect(bannerText.includes("profile changed")).toBe(true)
    expect(bannerText.includes("suggested refresh")).toBe(true)

    // ---- 6. Click refresh + wait for success -----------------
    const refreshBtn = page.locator('[data-testid="research-suggestions-refresh"]').first()
    await expect(refreshBtn).toBeVisible()
    await refreshBtn.click()

    const refreshingState = await bannerLocator.getAttribute("data-state").catch(() => null)
    console.log(`[e3b-pre] mid-refresh banner state=${refreshingState}`)
    expect(refreshingState).toBe("refreshing")

    await page.waitForResponse(
      (r) =>
        r.url().includes("/api/research/refresh") &&
        r.request().method() === "POST" &&
        r.status() === 200,
      { timeout: 180_000 },
    )
    await page.waitForTimeout(1500)

    const stateAfter = await bannerLocator.getAttribute("data-state").catch(() => null)
    console.log(`[e3b-pre] post-refresh banner state=${stateAfter}`)
    if (stateAfter === "success") {
      const successText = (await bannerLocator.innerText()).toLowerCase()
      expect(
        successText.includes("regenerate"),
        "/pre-move success copy must mention Regenerate (cache→timeline boundary)",
      ).toBe(true)
      expect(
        successText.includes("timeline"),
        "/pre-move success copy uses 'timeline' wording (vs post-move's 'checklist')",
      ).toBe(true)
      await page.screenshot({
        path: path.join(SHOTS_DIR, "premove-03-banner-success.png"),
        fullPage: true,
      })
    }

    // ---- 7. After reload, banner is absent again -------------
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(1500)
    await expect(
      bannerLocator,
      "/pre-move banner must be absent after successful refresh + reload",
    ).not.toBeVisible({ timeout: 2000 })
    console.log(`[e3b-pre] /pre-move post-refresh-reload: banner absent ✓`)
  } finally {
    // ---- 8. Restore original profile -------------------------
    await sb.from("relocation_plans").update({ profile_data: original }).eq("id", planId)
    console.log(`[e3b-pre] restored original profile`)
  }
})
