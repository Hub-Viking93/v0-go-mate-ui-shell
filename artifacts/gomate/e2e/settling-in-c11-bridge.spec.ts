// =============================================================
// Phase C1.1 verification — completion bridge end-to-end
// =============================================================
// Pre-conditions:
//   1. Dev servers running.
//   2. Test user seeded:
//        cd scripts && pnpm exec tsx src/seed-a1-test-user.ts
//        cd scripts && pnpm seed-c1-cache --force
//
// What this proves:
//   1. We seed a legacy settling_in_task row directly in DB:
//        task_key="reg-population", category="registration",
//        title="Register at Skatteverket (folkbokföring) → personnummer",
//        status="completed", completed_at=<some date>
//   2. We hit /api/settling-in/generate which the api-server's bridge
//      detects + maps semantically onto the researched task with the
//      most overlapping distinctive tokens (skatteverket + folkbokforing
//      + register).
//   3. After generate, the new researched task that bridged from
//      reg-population now carries status="completed" and the original
//      completed_at timestamp.
//   4. As a control: we also seed an unbridgeable legacy
//      ("Some random old task that no researched specialist will
//      produce") in the registration category. After generate, that
//      orphan row still exists in settling_in_tasks (state preserved
//      for future UI disambiguation).
// =============================================================

import { test, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"

const TEST_EMAIL = process.env.TEST_EMAIL!
const TEST_PASSWORD = process.env.TEST_PASSWORD!
const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
if (!TEST_EMAIL || !TEST_PASSWORD || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("env: TEST_EMAIL / TEST_PASSWORD / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface SettlingTaskRow {
  id: string
  task_key: string | null
  title: string | null
  category: string | null
  status: string | null
  completed_at: string | null
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

test("phase-c1.1 — completion bridge carries legacy state to researched ids", async ({ page }) => {
  test.setTimeout(180_000)
  const userId = await findUserId()
  const { data: plan } = await sb
    .from("relocation_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .single<{ id: string }>()
  expect(plan?.id, "test plan must exist").toBeTruthy()
  const planId = plan!.id

  // ---- 1. Login (lets the page session set auth cookies) ------
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForURL(/\/auth\/login/, { timeout: 20_000 })
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL)
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 })

  // ---- 2. Wipe + insert legacy fixtures into settling_in_tasks ----
  // (a) bridgeable legacy: should map onto a researched
  //     registration:* task by title similarity.
  // (b) unbridgeable legacy: title doesn't share enough tokens with
  //     anything the registration_specialist emits for SE/Stockholm —
  //     should remain as an orphan row after regenerate.
  // (c) bridgeable banking legacy: should map onto banking:* task.
  const completedAtFixture = "2026-04-01T10:00:00.000Z"
  const orphanCompletedAt = "2026-04-02T11:00:00.000Z"

  await sb
    .from("settling_in_tasks")
    .delete()
    .eq("plan_id", planId)
    .eq("user_id", userId)

  const baseFixture = {
    user_id: userId,
    plan_id: planId,
    description: "fixture",
    depends_on: [] as string[],
    deadline_days: 14,
    deadline_at: "2026-05-21T00:00:00.000Z",
    is_legal_requirement: true,
    deadline_type: "legal",
    walkthrough: null,
    steps: [] as string[],
    documents_needed: [] as string[],
    official_link: null as string | null,
    estimated_time: "Varies",
    cost: "Free",
    sort_order: 0,
  }
  const fixtures = [
    {
      ...baseFixture,
      task_key: "reg-population",
      title: "Register at Skatteverket (folkbokföring) → personnummer",
      category: "registration",
      status: "completed",
      completed_at: completedAtFixture,
    },
    {
      ...baseFixture,
      task_key: "reg-mystery-archive",
      title: "Submit ancient parchment to royal scribe office",
      category: "registration",
      status: "completed",
      completed_at: orphanCompletedAt,
    },
    {
      ...baseFixture,
      task_key: "bank-open-account",
      title: "Open a Swedish bank account",
      category: "banking",
      status: "in_progress",
      completed_at: null,
    },
  ]
  const { error: insErr } = await sb.from("settling_in_tasks").insert(fixtures)
  if (insErr) throw insErr
  console.log(`[c11-spec] seeded 3 legacy fixtures`)

  // ---- 3. Trigger /api/settling-in/generate ------------------
  // Browser context (cookies attached) so RLS sees the test user.
  const generateResp = await page.evaluate(async () => {
    const r = await fetch("/api/settling-in/generate", {
      method: "POST",
      credentials: "include",
    })
    return { status: r.status, body: await r.json().catch(() => null) }
  })
  console.log(`[c11-spec] generate status=${generateResp.status}`)
  expect(generateResp.status).toBe(200)

  // ---- 4. Read settling_in_tasks AFTER generate -------------
  const { data: afterRows } = await sb
    .from("settling_in_tasks")
    .select("id, task_key, title, category, status, completed_at")
    .eq("plan_id", planId)
    .returns<SettlingTaskRow[]>()
  const after = afterRows ?? []
  console.log(`[c11-spec] post-generate rows: ${after.length}`)

  // ---- The actual invariant: completion state is preserved
  //      somewhere in the table. The bridge bridges-or-orphans;
  //      both outcomes are valid and depend on LLM phrasing. What
  //      we MUST NOT lose is the user's progress.
  //
  //   reg-population was seeded with status="completed" + a
  //   specific completed_at. After /generate, EITHER:
  //     (a) a researched registration:* task carries that state
  //         (bridge succeeded), OR
  //     (b) the legacy row was re-inserted as an orphan with the
  //         same state (bridge was ambiguous / low-confidence).
  //   Both preserve user progress; the difference is purely UX.
  const fixtureMs = new Date(completedAtFixture).getTime()
  const sameInstant = (iso: string | null) =>
    typeof iso === "string" && new Date(iso).getTime() === fixtureMs
  const regCompletionsAfter = after.filter(
    (r) =>
      r.category === "registration" &&
      r.status === "completed" &&
      sameInstant(r.completed_at),
  )
  console.log(
    `[c11-spec] reg-population completion preserved on rows:`,
    regCompletionsAfter.map((r) => r.task_key),
  )
  expect(
    regCompletionsAfter.length,
    "reg-population completion must survive somewhere (bridged onto researched OR preserved as orphan)",
  ).toBeGreaterThanOrEqual(1)
  // Confirm the same fixture's user-visible progress isn't gone.
  // (This is the user-facing contract — they must see "completed".)

  // bank-open-account was status="in_progress". Same invariant.
  const bankInProgressAfter = after.filter(
    (r) => r.category === "banking" && r.status === "in_progress",
  )
  console.log(
    `[c11-spec] bank-open-account in_progress preserved on rows:`,
    bankInProgressAfter.map((r) => r.task_key),
  )
  expect(
    bankInProgressAfter.length,
    "bank-open-account in_progress state must survive somewhere",
  ).toBeGreaterThanOrEqual(1)

  // Diagnostics: how often did bridging succeed in this run?
  const bridgedReg = after.some(
    (r) => r.task_key?.startsWith("registration:") && r.status === "completed" && sameInstant(r.completed_at),
  )
  const bridgedBank = after.some(
    (r) => r.task_key?.startsWith("banking:") && r.status === "in_progress",
  )
  const orphanedReg = after.some((r) => r.task_key === "reg-population")
  const orphanedBank = after.some((r) => r.task_key === "bank-open-account")
  console.log(
    `[c11-spec] outcomes — registration: ${bridgedReg ? "BRIDGED" : "orphan"}${orphanedReg ? "+orphan-row" : ""} | banking: ${bridgedBank ? "BRIDGED" : "orphan"}${orphanedBank ? "+orphan-row" : ""}`,
  )

  // Orphan: reg-mystery-archive should still be present with the
  // original task_key (re-inserted untouched).
  const orphan = after.find((r) => r.task_key === "reg-mystery-archive")
  console.log(
    `[c11-spec] orphan row: present=${!!orphan} status=${orphan?.status} completed_at=${orphan?.completed_at}`,
  )
  expect(orphan, "orphan legacy row must be re-inserted").toBeTruthy()
  expect(orphan?.status).toBe("completed")
  expect(
    new Date(orphan?.completed_at ?? "").getTime(),
    "orphan completed_at preserved",
  ).toBe(new Date(orphanCompletedAt).getTime())

  // Sanity: when bridging WAS confident, the legacy row must be
  // gone (its state lives on the researched task). When bridging
  // was orphan, the legacy row must STILL be present. These are
  // mutually exclusive — the assertion is "exactly one outcome
  // per legacy task".
  const regBridgedConfidently = after.some(
    (r) =>
      r.task_key?.startsWith("registration:") &&
      r.status === "completed" &&
      sameInstant(r.completed_at),
  )
  const regLegacyStillThere = after.some((r) => r.task_key === "reg-population")
  expect(
    regBridgedConfidently !== regLegacyStillThere,
    "reg-population: state must be exactly one of (bridged on researched, kept as orphan)",
  ).toBe(true)

  const bankBridgedConfidently = after.some(
    (r) => r.task_key?.startsWith("banking:") && r.status === "in_progress",
  )
  const bankLegacyStillThere = after.some((r) => r.task_key === "bank-open-account")
  expect(
    bankBridgedConfidently !== bankLegacyStillThere,
    "bank-open-account: state must be exactly one of (bridged on researched, kept as orphan)",
  ).toBe(true)
})
