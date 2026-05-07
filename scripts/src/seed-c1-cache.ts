// =============================================================
// Pre-warm research_meta.researchedSpecialists.{registration,banking}
// for the test plan + flip stage to "arrived" so /post-move's
// settling-in surface has data to render.
// =============================================================
// Companion to seed-b2-cache.ts but scoped to post-move:
//   - registration (post-arrival, registration_specialist)
//   - banking (banking_v2; same specialist as B2 — fine to share the
//     bundle across surfaces, each composer filters phase)
//
// Mirrors the post-move route's runResearchedSpecialistsForPostMove
// contract so the cache shape lines up.
// =============================================================

import { createClient } from "@supabase/supabase-js";
import {
  registrationSpecialist,
  bankingSpecialistV2,
  createSupabaseLogWriter,
  type ResearchedOutput,
} from "@workspace/agents";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = process.env.TEST_EMAIL!;

const FORCE = process.argv.includes("--force");

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId(): Promise<string> {
  let page = 1;
  while (page < 10) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const u = data.users.find(
      (x) => (x.email ?? "").toLowerCase() === TEST_EMAIL.toLowerCase(),
    );
    if (u) return u.id;
    if (data.users.length < 100) break;
    page += 1;
  }
  throw new Error(`User ${TEST_EMAIL} not found`);
}

async function main(): Promise<void> {
  const userId = await findUserId();
  const { data: plan, error } = await sb
    .from("relocation_plans")
    .select("id, profile_data, research_meta, stage, arrival_date")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle<{
      id: string;
      profile_data: Record<string, unknown> | null;
      research_meta: { researchedSpecialists?: Record<string, unknown> } | null;
      stage: string | null;
      arrival_date: string | null;
    }>();
  if (error || !plan) throw error ?? new Error("no current plan");

  const cache = plan.research_meta?.researchedSpecialists ?? {};
  const haveReg = !!(cache as Record<string, unknown>).registration;
  const haveBank = !!(cache as Record<string, unknown>).banking;
  const stageOk = plan.stage === "arrived";

  if (haveReg && haveBank && stageOk && !FORCE) {
    console.log(
      `[seed-c1-cache] cache + arrived stage already present for plan ${plan.id}; pass --force to overwrite.`,
    );
    return;
  }

  console.log(
    `[seed-c1-cache] running registration + banking specialists for plan ${plan.id} (force=${FORCE})…`,
  );
  const profileRaw = (plan.profile_data ?? {}) as Record<string, unknown>;
  const profile: Record<string, string | number | null | undefined> = {};
  for (const [k, v] of Object.entries(profileRaw)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "string" || typeof v === "number") profile[k] = v;
    else if (typeof v === "boolean") profile[k] = v ? "yes" : "no";
  }

  const logWriter = createSupabaseLogWriter(sb);
  const sharedInput = {
    profile,
    profileId: plan.id,
    logWriter,
    budgetMs: 90_000,
  } as const;

  const t0 = Date.now();
  const [registration, banking] = await Promise.all([
    registrationSpecialist(sharedInput),
    bankingSpecialistV2(sharedInput),
  ]);
  const ms = Date.now() - t0;

  console.log(
    `[seed-c1-cache] done in ${ms}ms — registration=${describe(registration)} banking=${describe(banking)}`,
  );

  // Use today's date if arrival_date is in the future (common with
  // test fixtures pinning timeline=2028 for pre-departure tests). The
  // post-move flow triggers off stage=arrived; keeping arrival_date
  // in the future would still work but the urgency math gets weird.
  const today = new Date().toISOString().split("T")[0];
  const newArrivalDate =
    !plan.arrival_date || new Date(plan.arrival_date) > new Date()
      ? today
      : plan.arrival_date;

  const newMeta = {
    ...(plan.research_meta ?? {}),
    researchedSpecialists: {
      ...((plan.research_meta as { researchedSpecialists?: Record<string, unknown> })?.researchedSpecialists ?? {}),
      registration,
      banking,
    },
  };

  const { error: upErr } = await sb
    .from("relocation_plans")
    .update({
      research_meta: newMeta,
      stage: "arrived",
      arrival_date: newArrivalDate,
      post_relocation_generated: false, // force regen on next /generate
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id);
  if (upErr) throw upErr;

  // Wipe any stale settling_in_tasks rows so the next /generate call
  // produces a fresh DAG keyed by the new researched ids.
  const { error: delErr } = await sb
    .from("settling_in_tasks")
    .delete()
    .eq("plan_id", plan.id)
    .eq("user_id", userId);
  if (delErr) throw delErr;

  console.log(
    `[seed-c1-cache] cache written + stage=arrived + arrival_date=${newArrivalDate} + tasks wiped on plan ${plan.id}`,
  );
}

function describe(out: ResearchedOutput): string {
  if (out.kind === "steps") {
    return `${out.quality}/${out.steps.length} steps/${out.documents.length} docs`;
  }
  return out.quality;
}

main().catch((err) => {
  console.error("[seed-c1-cache] failed:", err);
  process.exit(1);
});
