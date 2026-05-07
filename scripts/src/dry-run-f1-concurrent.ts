// =============================================================
// Dry-run harness — Phase F1: concurrent research_meta patches
// =============================================================
// Proves that two concurrent atomic patches to DIFFERENT sub-keys
// both persist. This is the regression-anchor for the E1b-observed
// race where notifications-scheduler clobbered concurrent
// researchedSpecialists mutations.
//
// Each patch hits a unique sub-key with a probe value. After both
// promises resolve we read research_meta and confirm BOTH probes
// landed.
//
// USAGE:
//   pnpm --filter @workspace/scripts dry-run-f1
//
// Pre-conditions: same as the rest of the test scripts —
//   .env.local has SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY +
//   TEST_EMAIL pointing at a plan whose user_id is fetchable from
//   auth.admin.listUsers.
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

async function applyPatch(planId: string, patch: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await sb.rpc("apply_research_meta_patch", {
    p_plan_id: planId,
    p_patch: patch,
  });
  if (error) throw new Error(`apply_research_meta_patch failed: ${error.message}`);
  return data;
}

async function readMeta(planId: string): Promise<Record<string, unknown>> {
  const { data, error } = await sb
    .from("relocation_plans")
    .select("research_meta")
    .eq("id", planId)
    .single<{ research_meta: Record<string, unknown> | null }>();
  if (error) throw error;
  return data?.research_meta ?? {};
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
  console.log(`[f1-spec] plan ${planId}`);

  // ---- Scenario 1 — sequential write proves the function works ----
  console.log("\n1/3  Sequential patch (smoke):");
  const probe1 = `seq-${Date.now()}`;
  const merged1 = (await applyPatch(planId, { _f1_probe_a: probe1 })) as Record<string, unknown>;
  console.log(`  merged returned _f1_probe_a=${merged1._f1_probe_a}`);
  if (merged1._f1_probe_a !== probe1) throw new Error("sequential patch didn't return merged value");
  const after1 = await readMeta(planId);
  if (after1._f1_probe_a !== probe1) throw new Error("sequential patch didn't persist");
  console.log("  ✅ sequential patch persists");

  // ---- Scenario 2 — concurrent patches to different sub-keys ----
  console.log("\n2/3  Concurrent patches to DIFFERENT sub-keys:");
  const probeA = `concA-${Date.now()}`;
  const probeB = `concB-${Date.now()}`;
  const start = Date.now();
  await Promise.all([
    applyPatch(planId, { _f1_probe_a: probeA }),
    applyPatch(planId, { _f1_probe_b: probeB }),
  ]);
  const elapsed = Date.now() - start;
  const after2 = await readMeta(planId);
  console.log(
    `  elapsed=${elapsed}ms _f1_probe_a=${after2._f1_probe_a} _f1_probe_b=${after2._f1_probe_b}`,
  );
  if (after2._f1_probe_a !== probeA) {
    throw new Error(`probeA was clobbered: expected ${probeA}, got ${after2._f1_probe_a}`);
  }
  if (after2._f1_probe_b !== probeB) {
    throw new Error(`probeB was clobbered: expected ${probeB}, got ${after2._f1_probe_b}`);
  }
  console.log("  ✅ both sub-keys preserved under concurrent writes");

  // ---- Scenario 3 — heavier race (10 parallel patches to disjoint keys) ----
  console.log("\n3/3  10 parallel patches to disjoint keys:");
  const probes = Array.from({ length: 10 }, (_, i) => ({
    key: `_f1_probe_${i}`,
    value: `v${i}-${Date.now()}`,
  }));
  await Promise.all(probes.map((p) => applyPatch(planId, { [p.key]: p.value })));
  const after3 = await readMeta(planId);
  let missing = 0;
  for (const p of probes) {
    if (after3[p.key] !== p.value) {
      console.log(`  ❌ missing ${p.key} → expected ${p.value}, got ${after3[p.key]}`);
      missing += 1;
    }
  }
  if (missing > 0) throw new Error(`${missing}/10 concurrent patches lost`);
  console.log("  ✅ all 10 disjoint patches preserved");

  // ---- Cleanup probe keys --------------------------------------
  // Read current meta and write back without our probe keys. (The
  // helper itself can't DELETE keys; that needs `-` operator at the
  // SQL level. For the dry-run we'll leave the probes in place —
  // they don't conflict with any real key — but mark them with an
  // explicit cleanup helper if it ever matters.)
  console.log("\n[f1-spec] probe keys left in place (won't conflict with real keys).");
  console.log("\n✅ All 3 concurrent-write scenarios passed.");
}

main().catch((err) => {
  console.error("[f1-spec] failed:", err);
  process.exit(1);
});
