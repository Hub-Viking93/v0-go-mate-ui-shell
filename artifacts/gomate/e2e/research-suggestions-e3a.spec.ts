// =============================================================
// Phase E3-A verification — GET /api/research/suggestions
// =============================================================
// Pre-conditions:
//   1. Dev servers running.
//   2. Test user seeded with stage=arrived + warm cache:
//        cd scripts && pnpm exec tsx src/seed-a1-test-user.ts
//        cd scripts && pnpm seed-c1-cache --force
//      The seed now writes profileSnapshots alongside the bundles
//      so /suggestions has a diff-baseline to work from.
//
// What this proves:
//   1. Fresh state (just warmed): suggestions=[].
//   2. Mutating profile.destination → "Germany" produces suggestions
//      for every cached domain (registration + banking + healthcare
//      all transitively depend on destination).
//   3. Each suggestion's changedFields ⊆ {fields that affect that
//      domain per PROFILE_FIELD_TO_DOMAINS}.
//   4. Mutating profile.target_city only adds suggestions for domains
//      that depend on city (registration + housing — but housing has
//      no post-move v2 cache here, so just registration).
//   5. Mutating a profile field that doesn't map to any cached
//      domain ("preferred_currency") doesn't produce suggestions
//      (because that domain — banking — wasn't actually changed by
//      the field if it's already in changedFields, OR the field
//      doesn't map to a cached domain).
//
// Restores the profile snapshot at the end so subsequent tests
// don't see the mutated state.
// =============================================================

import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

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

interface SuggestionsResponse {
  suggestions: Array<{
    domain: string
    changedFields: string[]
    reason: string
    lastResearchedAt: string
  }>
  lastResearchedAt: string | null
}

async function findUserId(): Promise<string> {
  for (let p = 1; p < 10; p++) {
    const { data } = await sb.auth.admin.listUsers({ page: p, perPage: 100 })
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === TEST_EMAIL.toLowerCase())
    if (u) return u.id
    if (data.users.length < 100) break
  }
  throw new Error("test user not found")
}

async function readProfile(planId: string): Promise<Record<string, unknown>> {
  const { data } = await sb
    .from("relocation_plans")
    .select("profile_data")
    .eq("id", planId)
    .single<{ profile_data: Record<string, unknown> }>()
  return data!.profile_data
}

async function writeProfile(planId: string, profile: Record<string, unknown>): Promise<void> {
  const { error } = await sb
    .from("relocation_plans")
    .update({ profile_data: profile })
    .eq("id", planId)
  if (error) throw error
}

test("phase-e3a — /api/research/suggestions reflects profile-vs-snapshot diff per domain", async ({ page }) => {
  test.setTimeout(120_000)
  const userId = await findUserId()
  const { data: plan } = await sb
    .from("relocation_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .single<{ id: string }>()
  expect(plan?.id).toBeTruthy()
  const planId = plan!.id

  // ---- 1. Login ----------------------------------------------
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForURL(/\/auth\/login/, { timeout: 20_000 })
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL)
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 })

  // Snapshot original profile so we can restore later regardless.
  const original = await readProfile(planId)
  console.log(
    `[e3a-spec] original profile — destination=${original.destination} target_city=${original.target_city} pets=${original.pets}`,
  )

  try {
    // ---- 2. Fresh cache + unchanged profile → empty suggestions
    const fresh = (await page.evaluate(async () => {
      const r = await fetch("/api/research/suggestions", { credentials: "include" })
      return r.json().catch(() => null)
    })) as SuggestionsResponse | null
    console.log(`[e3a-spec] fresh: ${JSON.stringify(fresh)}`)
    expect(fresh?.suggestions.length, "fresh cache + unchanged profile → 0 suggestions").toBe(0)
    expect(typeof fresh?.lastResearchedAt, "lastResearchedAt populated").toBe("string")
    const cacheLastAt = fresh!.lastResearchedAt

    // ---- 3. Mutate destination → wide blast -------------------
    await writeProfile(planId, { ...original, destination: "Germany" })
    const afterDest = (await page.evaluate(async () => {
      const r = await fetch("/api/research/suggestions", { credentials: "include" })
      return r.json().catch(() => null)
    })) as SuggestionsResponse | null
    console.log(`[e3a-spec] after destination → Germany:`)
    for (const s of afterDest?.suggestions ?? []) {
      console.log(`  • ${s.domain.padEnd(15)} changed=[${s.changedFields.join(", ")}] reason="${s.reason}"`)
    }

    expect(afterDest?.suggestions.length, "destination change → ≥3 suggestions").toBeGreaterThanOrEqual(3)
    const domains = new Set(afterDest!.suggestions.map((s) => s.domain))
    expect(domains.has("registration"), "registration suggested").toBe(true)
    expect(domains.has("banking"), "banking suggested").toBe(true)
    expect(domains.has("healthcare"), "healthcare suggested").toBe(true)

    // Every suggestion's changedFields must contain "destination" since that's what we changed.
    for (const s of afterDest!.suggestions) {
      expect(
        s.changedFields.includes("destination"),
        `${s.domain}.changedFields must include "destination"`,
      ).toBe(true)
    }
    // And lastResearchedAt is preserved.
    for (const s of afterDest!.suggestions) {
      expect(typeof s.lastResearchedAt).toBe("string")
    }
    expect(afterDest!.lastResearchedAt, "top-level lastResearchedAt preserved").toBe(cacheLastAt)

    // ---- 4. Add target_city change on top → registration's
    //         changedFields should include both. Other domains
    //         should NOT include target_city (mapping is housing +
    //         registration only).
    await writeProfile(planId, {
      ...original,
      destination: "Germany",
      target_city: "Berlin",
    })
    const afterCity = (await page.evaluate(async () => {
      const r = await fetch("/api/research/suggestions", { credentials: "include" })
      return r.json().catch(() => null)
    })) as SuggestionsResponse | null
    console.log(`[e3a-spec] after destination + target_city changes:`)
    for (const s of afterCity?.suggestions ?? []) {
      console.log(`  • ${s.domain.padEnd(15)} changed=[${s.changedFields.join(", ")}]`)
    }

    const reg = afterCity!.suggestions.find((s) => s.domain === "registration")
    const bank = afterCity!.suggestions.find((s) => s.domain === "banking")
    const hc = afterCity!.suggestions.find((s) => s.domain === "healthcare")
    expect(
      reg?.changedFields.includes("target_city"),
      "registration: target_city affects it",
    ).toBe(true)
    expect(
      bank?.changedFields.includes("target_city"),
      "banking: target_city does NOT affect it",
    ).toBe(false)
    expect(
      hc?.changedFields.includes("target_city"),
      "healthcare: target_city does NOT affect it",
    ).toBe(false)

    // ---- 5. Mutate a field that maps to a domain WITHOUT a v2
    //         specialist (pets → pet). No suggestion should appear
    //         because there's no cached pet bundle to suggest
    //         refreshing.
    await writeProfile(planId, {
      ...original,
      pets: "dog",
    })
    const afterPets = (await page.evaluate(async () => {
      const r = await fetch("/api/research/suggestions", { credentials: "include" })
      return r.json().catch(() => null)
    })) as SuggestionsResponse | null
    console.log(`[e3a-spec] after pets → dog: suggestions=${afterPets?.suggestions.length ?? 0}`)
    // Pets only maps to "pet" domain; no cache exists for it; but
    // none of the cached domains (registration/banking/healthcare)
    // depends on `pets`. So 0 suggestions.
    expect(
      afterPets?.suggestions.length,
      "pets change → 0 suggestions (no cached domain depends on it)",
    ).toBe(0)
  } finally {
    // ---- 6. Restore original profile ---------------------------
    await writeProfile(planId, original)
    console.log(`[e3a-spec] restored original profile`)
  }
})
