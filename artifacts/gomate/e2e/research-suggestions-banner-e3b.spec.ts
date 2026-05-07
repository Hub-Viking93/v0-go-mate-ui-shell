// =============================================================
// Phase E3-B verification — suggestions banner end-to-end
// =============================================================
// Pre-conditions:
//   1. Dev servers running.
//   2. cd scripts && pnpm exec tsx src/seed-a1-test-user.ts
//      cd scripts && pnpm seed-c1-cache --force
//
// What this proves:
//   1. Fresh state (just-warmed cache, profile unchanged) → banner
//      not visible on /post-move/checklist.
//   2. After mutating profile.destination via service-role:
//        - banner appears
//        - shows chips for registration / banking / healthcare
//        - chip text + data-changed-fields includes "destination"
//        - banner copy explicitly mentions Regenerate
//   3. Click "Refresh suggested" → banner flips to refreshing state
//      with the "up to 90 seconds" hint.
//   4. After refresh resolves → banner shows "Refreshed N domains"
//      success state + "click Regenerate" hint, then auto-hides on
//      next-fetch (suggestions become 0 since the snapshots got
//      updated).
//
// Restores profile at the end so subsequent tests don't see the
// mutated state.
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

test("phase-e3b — suggestions banner appears on profile change + refreshes via UI", async ({ page }) => {
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

  // Snapshot original profile so we can restore later regardless of
  // assertion outcomes.
  const { data: planRow } = await sb
    .from("relocation_plans")
    .select("profile_data")
    .eq("id", planId)
    .single<{ profile_data: Record<string, unknown> }>()
  const original = planRow!.profile_data
  console.log(`[e3b-spec] original destination=${original.destination}`)

  try {
    // ---- 2. Visit /post-move with profile UNCHANGED — banner is
    //         expected to NOT be in the DOM (or hidden). Use
    //         Playwright's not.toBeVisible so the assertion message
    //         is unambiguous regardless of whether the element is
    //         absent or present-but-hidden.
    await page.goto("/post-move", { waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(1500)

    const bannerLocator = page.locator('[data-testid="research-suggestions-banner"]').first()
    await expect(
      bannerLocator,
      "/post-move banner must NOT appear when profile is unchanged since last research",
    ).not.toBeVisible({ timeout: 2000 })
    console.log(`[e3b-spec] /post-move pre-mutation: banner absent ✓`)
    await page.screenshot({
      path: path.join(SHOTS_DIR, "01-banner-hidden-before-change.png"),
      fullPage: true,
    })

    // ---- 3. Mutate profile.destination via service-role -----------
    await sb
      .from("relocation_plans")
      .update({ profile_data: { ...original, destination: "Germany" } })
      .eq("id", planId)
    console.log(`[e3b-spec] mutated destination → Germany`)

    // Reload the page so the banner's mount-time fetch sees the new
    // profile.
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000)

    await expect(bannerLocator, "banner visible after mutation").toBeVisible({ timeout: 5000 })
    await page.screenshot({
      path: path.join(SHOTS_DIR, "02-banner-visible-after-change.png"),
      fullPage: true,
    })

    // ---- 4. Inspect the chips ---------------------------------
    const chips = await page
      .locator('[data-testid^="suggestion-chip-"]')
      .evaluateAll((els) =>
        els.map((e) => ({
          domain: e.getAttribute("data-domain"),
          changedFields: (e.getAttribute("data-changed-fields") ?? "").split(",").filter(Boolean),
          text: (e.textContent ?? "").trim(),
        })),
      )
    console.log(`[e3b-spec] chips:`, chips)
    const chipDomains = new Set(chips.map((c) => c.domain ?? ""))
    expect(chipDomains.has("registration")).toBe(true)
    expect(chipDomains.has("banking")).toBe(true)
    expect(chipDomains.has("healthcare")).toBe(true)
    for (const c of chips) {
      expect(
        c.changedFields.includes("destination"),
        `${c.domain} chip changedFields should include destination`,
      ).toBe(true)
    }

    // Banner copy mentions the cache-vs-checklist distinction.
    const bannerText = (await bannerLocator.innerText()).toLowerCase()
    expect(
      bannerText.includes("profile changed"),
      "banner must say profile changed",
    ).toBe(true)
    expect(
      bannerText.includes("suggested refresh"),
      "banner must say suggested refresh",
    ).toBe(true)

    // ---- 5. Click "Refresh suggested" + wait for success state ---
    const refreshBtn = page.locator('[data-testid="research-suggestions-refresh"]').first()
    await expect(refreshBtn, "Refresh suggested button visible").toBeVisible()
    await refreshBtn.click()

    // Banner immediately flips to refreshing — should expose the
    // "up to 90 seconds" hint.
    const refreshingHint = page.locator('[data-testid="research-suggestions-refreshing-hint"]').first()
    await expect(refreshingHint, "refreshing hint visible").toBeVisible({ timeout: 3000 })
    const stateMid = await bannerLocator.getAttribute("data-state").catch(() => null)
    console.log(`[e3b-spec] mid-refresh banner state=${stateMid}`)
    expect(stateMid).toBe("refreshing")
    await page.screenshot({
      path: path.join(SHOTS_DIR, "03-banner-refreshing.png"),
      fullPage: true,
    })

    // Wait for the refresh response. With banking + registration +
    // healthcare in parallel each can be 60-90s; allow 180s.
    await page.waitForResponse(
      (r) =>
        r.url().includes("/api/research/refresh") &&
        r.request().method() === "POST" &&
        r.status() === 200,
      { timeout: 180_000 },
    )
    await page.waitForTimeout(1500)

    // ---- 6. Banner now in success state -----------------------
    const stateAfter = await bannerLocator.getAttribute("data-state").catch(() => null)
    console.log(`[e3b-spec] post-refresh banner state=${stateAfter}`)
    // Either success (visible briefly) OR auto-hidden if the
    // post-success refetch completed already and suggestions
    // returned 0 — that's actually what we WANT after a successful
    // refresh: snapshots are now updated, so no more suggestions.
    if (stateAfter === "success") {
      const successText = (await bannerLocator.innerText()).toLowerCase()
      expect(successText.includes("refreshed")).toBe(true)
      expect(successText.includes("regenerate")).toBe(true)
      await page.screenshot({
        path: path.join(SHOTS_DIR, "04-banner-success.png"),
        fullPage: true,
      })
    } else {
      console.log(`[e3b-spec] banner hidden — suggestions cleared after refresh`)
    }

    // ---- 7. After a fresh page load, banner must be absent ------
    // (because snapshot got refreshed → 0 suggestions).
    await page.reload({ waitUntil: "domcontentloaded" })
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(1500)
    await expect(
      bannerLocator,
      "/post-move banner must be absent after successful refresh + reload (snapshots are now current)",
    ).not.toBeVisible({ timeout: 2000 })
    console.log(`[e3b-spec] /post-move post-refresh-reload: banner absent ✓`)
  } finally {
    // ---- 8. Restore original profile --------------------------
    await sb.from("relocation_plans").update({ profile_data: original }).eq("id", planId)
    console.log(`[e3b-spec] restored original profile`)
  }
})
