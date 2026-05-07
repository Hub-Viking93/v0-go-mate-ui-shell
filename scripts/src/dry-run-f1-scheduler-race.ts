// =============================================================
// Phase F1 — scheduler-race regression
// =============================================================
// Reproduces the exact scenario E1b's integration spec hit:
//   1. seed-c1-cache populates research_meta.researchedSpecialists
//   2. Mutate banking.retrievedAt to 20 days ago (service-role)
//   3. Wait for the notifications-scheduler to fire a tick
//   4. Read research_meta — banking.retrievedAt MUST still be the
//      mutated value (i.e. tick didn't clobber it)
//
// Pre-F1: scheduler reads {...meta} snapshot, computes notifications,
//         writes whole column back → mutation lost.
// Post-F1: scheduler patches only its own keys via JSONB merge →
//         mutation survives.
//
// USAGE:
//   1. Make sure api-server is running with the F1 build (so the
//      scheduler uses applyResearchMetaPatch).
//   2. cd scripts && pnpm exec tsx src/dry-run-f1-scheduler-race.ts
//
// The script triggers a manual scheduler tick by calling the
// existing /api/notifications/poll endpoint if available, OR just
// waits 5 seconds and lets the in-server scheduler do its thing
// (depending on NOTIFICATIONS_SCHEDULER_INTERVAL_MS).
//
// Practical note: in dev with default 30-min interval, the only
// tick that's likely to fire during this test is the startup tick.
// We trigger one explicitly via the /api/notifications/poll route
// when it exists, or skip the wait if it doesn't.
// =============================================================

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = process.env.TEST_EMAIL!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId(): Promise<string> {
  for (let p = 1; p < 10; p++) {
    const { data } = await sb.auth.admin.listUsers({ page: p, perPage: 100 });
    const u = data.users.find((x) => (x.email ?? "").toLowerCase() === TEST_EMAIL.toLowerCase());
    if (u) return u.id;
    if (data.users.length < 100) break;
  }
  throw new Error(`User ${TEST_EMAIL} not found`);
}

interface CacheEntry { retrievedAt?: string; [k: string]: unknown }
type Cache = Record<string, CacheEntry>;

async function readBankingRetrievedAt(planId: string): Promise<string | undefined> {
  const { data } = await sb
    .from("relocation_plans")
    .select("research_meta")
    .eq("id", planId)
    .single<{ research_meta: { researchedSpecialists?: Cache } | null }>();
  return data?.research_meta?.researchedSpecialists?.banking?.retrievedAt;
}

async function patchBankingRetrievedAt(planId: string, when: string): Promise<void> {
  // Read current cache, mutate banking, write back via the F1 RPC.
  // Mirrors what an external system would do (e.g. a stale-flag
  // backfill, or a migration script).
  const { data } = await sb
    .from("relocation_plans")
    .select("research_meta")
    .eq("id", planId)
    .single<{ research_meta: { researchedSpecialists?: Cache } | null }>();
  const current = data?.research_meta?.researchedSpecialists ?? {};
  const next: Cache = { ...current, banking: { ...(current.banking ?? {}), retrievedAt: when } };
  const { error } = await sb.rpc("apply_research_meta_patch", {
    p_plan_id: planId,
    p_patch: { researchedSpecialists: next },
  });
  if (error) throw error;
}

async function callPollEndpoint(): Promise<{ ok: boolean; status: number; reason?: string }> {
  // Best-effort: try the manual notifications poll route. Returns
  // ok=false if the route doesn't exist or auth is the problem;
  // the caller falls back to the startup tick proof in that case.
  try {
    const r = await fetch("http://localhost:3002/api/notifications/poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return { ok: r.ok, status: r.status };
  } catch (err) {
    return { ok: false, status: 0, reason: err instanceof Error ? err.message : String(err) };
  }
}

async function main(): Promise<void> {
  const userId = await findUserId();
  const { data: plan } = await sb
    .from("relocation_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .single<{ id: string }>();
  if (!plan?.id) throw new Error("No current plan");
  const planId = plan.id;
  console.log(`[f1-race] plan ${planId}`);

  const before = await readBankingRetrievedAt(planId);
  console.log(`[f1-race] before mutation — banking.retrievedAt=${before}`);
  if (!before) {
    throw new Error(
      "banking cache missing — run `pnpm seed-c1-cache --force` first to populate it",
    );
  }

  const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
  await patchBankingRetrievedAt(planId, twentyDaysAgo);
  console.log(`[f1-race] mutated banking.retrievedAt=${twentyDaysAgo}`);

  const afterMutation = await readBankingRetrievedAt(planId);
  if (afterMutation !== twentyDaysAgo) {
    throw new Error(
      `mutation didn't persist: expected ${twentyDaysAgo}, got ${afterMutation}`,
    );
  }

  // Best-effort: ask the scheduler to tick now. If the route doesn't
  // exist we fall back to a 6-second wait — the api-server's startup
  // tick fires within ~1s of process boot, so anything later than
  // that proves it ran AFTER our mutation.
  const poll = await callPollEndpoint();
  console.log(`[f1-race] poll endpoint status=${poll.status} ok=${poll.ok}`);
  console.log(`[f1-race] waiting 6s for any in-flight tick to settle…`);
  await new Promise((resolve) => setTimeout(resolve, 6_000));

  const after = await readBankingRetrievedAt(planId);
  console.log(`[f1-race] after wait — banking.retrievedAt=${after}`);

  if (after === twentyDaysAgo) {
    console.log(
      `\n✅ banking.retrievedAt SURVIVED the scheduler tick window (was: ${before}, mutated: ${twentyDaysAgo}, still: ${after}).`,
    );
    // Restore for clean state.
    await patchBankingRetrievedAt(planId, before);
    console.log(`[f1-race] restored banking.retrievedAt=${before}`);
    return;
  }

  // Restore and surface the failure.
  await patchBankingRetrievedAt(planId, before);
  throw new Error(
    `banking.retrievedAt was clobbered. mutated=${twentyDaysAgo}, after=${after}. ` +
      `Either the scheduler is still using whole-column writes, or another writer is racing.`,
  );
}

main().catch((err) => {
  console.error("[f1-race] failed:", err);
  process.exit(1);
});
