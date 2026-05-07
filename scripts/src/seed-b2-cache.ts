// =============================================================
// Pre-warm research_meta.researchedSpecialists for the test plan.
// =============================================================
// Runs documentsSpecialistV2 + housingSpecialistV2 + bankingSpecialistV2
// once for the TEST_EMAIL plan and writes the ResearchedSteps payloads
// under relocation_plans.research_meta.researchedSpecialists. Lets the
// Playwright A2 spec hit /pre-departure/generate without paying the
// 60–90s LLM + Firecrawl bill on every run.
//
// Idempotent: re-running with --force re-runs the specialists and
// overwrites the cache; without --force it skips when all three
// domains are already cached.
// =============================================================

import { createClient } from "@supabase/supabase-js";
import {
  documentsSpecialistV2,
  housingSpecialistV2,
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
    .select("id, profile_data, research_meta")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle<{
      id: string;
      profile_data: Record<string, unknown> | null;
      research_meta: { researchedSpecialists?: Record<string, unknown> } | null;
    }>();
  if (error || !plan) throw error ?? new Error("no current plan");

  const cache = plan.research_meta?.researchedSpecialists ?? {};
  const haveDocs = !!(cache as Record<string, unknown>).documents;
  const haveHousing = !!(cache as Record<string, unknown>).housing;
  const haveBanking = !!(cache as Record<string, unknown>).banking;
  if (haveDocs && haveHousing && haveBanking && !FORCE) {
    console.log(
      `[seed-b2-cache] cache already present (documents+housing+banking) for plan ${plan.id}; pass --force to overwrite.`,
    );
    return;
  }

  console.log(
    `[seed-b2-cache] running B2 specialists for plan ${plan.id} (force=${FORCE})…`,
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
  const [docs, housing, banking] = await Promise.all([
    documentsSpecialistV2(sharedInput),
    housingSpecialistV2(sharedInput),
    bankingSpecialistV2(sharedInput),
  ]);
  const ms = Date.now() - t0;

  console.log(
    `[seed-b2-cache] done in ${ms}ms — docs=${describe(docs)} housing=${describe(housing)} banking=${describe(banking)}`,
  );

  const newMeta = {
    ...(plan.research_meta ?? {}),
    researchedSpecialists: {
      ...((plan.research_meta as { researchedSpecialists?: Record<string, unknown> })?.researchedSpecialists ?? {}),
      documents: docs,
      housing,
      banking,
    },
    // Drop any stale preDeparture payload so the next /generate call
    // reads from the fresh cache and rebuilds the timeline.
    preDeparture: undefined,
  };

  const { error: upErr } = await sb
    .from("relocation_plans")
    .update({ research_meta: newMeta, updated_at: new Date().toISOString() })
    .eq("id", plan.id);
  if (upErr) throw upErr;
  console.log(`[seed-b2-cache] wrote cache to plan ${plan.id}`);
}

function describe(out: ResearchedOutput): string {
  if (out.kind === "steps") {
    return `${out.quality}/${out.steps.length} steps/${out.documents.length} docs`;
  }
  return out.quality;
}

main().catch((err) => {
  console.error("[seed-b2-cache] failed:", err);
  process.exit(1);
});
