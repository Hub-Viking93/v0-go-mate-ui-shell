// =============================================================
// F1 fix — verify nested-key race is closed
// =============================================================
// Three concurrency scenarios:
//   (1) banking + healthcare in parallel under researchedSpecialists
//   (2) documents + housing in parallel under researchedSpecialists
//   (3) preDeparture (top-level) + researchedSpecialists.banking
//       (nested) in parallel
//
// Each writer uses apply_research_meta_patch_at via the path API,
// which writes only its leaf via jsonb_set. Pre-fix, runs (1) and
// (2) flipped a coin every time; (3) was already safe.
// Post-fix, all three must always show both probes preserved.
//
// Also re-runs the OLD top-level-merge approach to confirm the
// hole still exists when the wrong API is used — as a control
// experiment that pins down what changed.
// =============================================================

import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const TEST_EMAIL = process.env.TEST_EMAIL!;

async function findUserId(): Promise<string> {
  for (let p = 1; p < 10; p++) {
    const { data } = await sb.auth.admin.listUsers({ page: p, perPage: 100 });
    const u = data.users.find(
      (x) => (x.email ?? "").toLowerCase() === TEST_EMAIL.toLowerCase(),
    );
    if (u) return u.id;
    if (data.users.length < 100) break;
  }
  throw new Error("user not found");
}

interface MetaShape {
  preDeparture?: { _probe?: string; [k: string]: unknown };
  researchedSpecialists?: Record<string, { _probe?: string; [k: string]: unknown }>;
  [k: string]: unknown;
}

async function readMeta(planId: string): Promise<MetaShape> {
  const { data } = await sb
    .from("relocation_plans")
    .select("research_meta")
    .eq("id", planId)
    .single<{ research_meta: MetaShape | null }>();
  return data?.research_meta ?? {};
}

async function patchAtPath(planId: string, path: string[], value: unknown): Promise<void> {
  const { error } = await sb.rpc("apply_research_meta_patch_at", {
    p_plan_id: planId,
    p_path: path,
    p_value: value,
  });
  if (error) throw error;
}

async function patchTopLevel(
  planId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await sb.rpc("apply_research_meta_patch", {
    p_plan_id: planId,
    p_patch: patch,
  });
  if (error) throw error;
}

let passes = 0;
let total = 0;
function expect(label: string, ok: boolean, detail = ""): void {
  total += 1;
  if (ok) passes += 1;
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
}

function banner(label: string): void {
  const line = "─".repeat(60);
  console.log(`\n${line}\n  ${label}\n${line}\n`);
}

async function main(): Promise<void> {
  const userId = await findUserId();
  const { data: plan } = await sb
    .from("relocation_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("is_current", true)
    .single<{ id: string }>();
  const planId = plan!.id;
  console.log(`[f1-nested] plan ${planId}`);

  // ---- Scenario 1: banking + healthcare under researchedSpecialists --
  banner("1/4  banking || healthcare under researchedSpecialists");
  const bankingProbe = `bank-${Date.now()}`;
  const healthcareProbe = `hc-${Date.now()}`;
  await Promise.all([
    patchAtPath(planId, ["researchedSpecialists", "banking"], {
      _probe: bankingProbe,
      kind: "steps",
    }),
    patchAtPath(planId, ["researchedSpecialists", "healthcare"], {
      _probe: healthcareProbe,
      kind: "steps",
    }),
  ]);
  const m1 = await readMeta(planId);
  console.log(
    `  banking._probe=${m1.researchedSpecialists?.banking?._probe} healthcare._probe=${m1.researchedSpecialists?.healthcare?._probe}`,
  );
  expect("banking probe survived", m1.researchedSpecialists?.banking?._probe === bankingProbe);
  expect("healthcare probe survived", m1.researchedSpecialists?.healthcare?._probe === healthcareProbe);

  // ---- Scenario 2: documents + housing under researchedSpecialists --
  banner("2/4  documents || housing under researchedSpecialists");
  const docsProbe = `docs-${Date.now()}`;
  const housingProbe = `housing-${Date.now()}`;
  await Promise.all([
    patchAtPath(planId, ["researchedSpecialists", "documents"], {
      _probe: docsProbe,
      kind: "steps",
    }),
    patchAtPath(planId, ["researchedSpecialists", "housing"], {
      _probe: housingProbe,
      kind: "steps",
    }),
  ]);
  const m2 = await readMeta(planId);
  console.log(
    `  documents._probe=${m2.researchedSpecialists?.documents?._probe} housing._probe=${m2.researchedSpecialists?.housing?._probe}`,
  );
  expect("documents probe survived", m2.researchedSpecialists?.documents?._probe === docsProbe);
  expect("housing probe survived", m2.researchedSpecialists?.housing?._probe === housingProbe);
  // And confirm scenario-1 leftovers weren't clobbered.
  expect(
    "banking probe from scenario 1 still alive",
    m2.researchedSpecialists?.banking?._probe === bankingProbe,
  );
  expect(
    "healthcare probe from scenario 1 still alive",
    m2.researchedSpecialists?.healthcare?._probe === healthcareProbe,
  );

  // ---- Scenario 3: preDeparture + researchedSpecialists.banking --
  banner("3/4  preDeparture (top-level) || researchedSpecialists.banking (nested)");
  const preDepartureProbe = `pd-${Date.now()}`;
  const bankingProbe2 = `bank2-${Date.now()}`;
  await Promise.all([
    // Top-level write (single-owner sub-key, original RPC is fine).
    patchTopLevel(planId, { preDeparture: { _probe: preDepartureProbe } }),
    // Nested write into researchedSpecialists.banking.
    patchAtPath(planId, ["researchedSpecialists", "banking"], {
      _probe: bankingProbe2,
      kind: "steps",
    }),
  ]);
  const m3 = await readMeta(planId);
  console.log(
    `  preDeparture._probe=${m3.preDeparture?._probe} banking._probe=${m3.researchedSpecialists?.banking?._probe}`,
  );
  expect(
    "preDeparture top-level probe survived nested write",
    m3.preDeparture?._probe === preDepartureProbe,
  );
  expect(
    "banking nested probe survived top-level write",
    m3.researchedSpecialists?.banking?._probe === bankingProbe2,
  );
  expect(
    "scenario-2 documents leftover still alive",
    m3.researchedSpecialists?.documents?._probe === docsProbe,
  );
  expect(
    "scenario-2 housing leftover still alive",
    m3.researchedSpecialists?.housing?._probe === housingProbe,
  );

  // ---- Scenario 4 (control): old top-level RPC still loses --
  // Demonstrates that the bug ISN'T magically fixed — the new RPC
  // fixes it; the old one would still race. Reproduces the
  // application-layer pattern (read snapshot + spread + push whole
  // researchedSpecialists object) used pre-F1.
  banner("4/4  CONTROL — top-level merge still races (proves the fix is doing real work)");
  let lostA = 0;
  let lostB = 0;
  for (let i = 0; i < 3; i++) {
    const probeA = `oldA-${Date.now()}-${i}`;
    const probeB = `oldB-${Date.now()}-${i}`;
    const start = await readMeta(planId);
    const baseSpecs = start.researchedSpecialists ?? {};
    await Promise.all([
      // Each writer sees the snapshot, spreads + adds their own
      // domain, pushes whole researchedSpecialists. Classic race.
      patchTopLevel(planId, {
        researchedSpecialists: {
          ...baseSpecs,
          banking: { ...(baseSpecs.banking ?? {}), _probe: probeA },
        },
      }),
      patchTopLevel(planId, {
        researchedSpecialists: {
          ...baseSpecs,
          healthcare: { ...(baseSpecs.healthcare ?? {}), _probe: probeB },
        },
      }),
    ]);
    const after = await readMeta(planId);
    if (after.researchedSpecialists?.banking?._probe !== probeA) lostA += 1;
    if (after.researchedSpecialists?.healthcare?._probe !== probeB) lostB += 1;
  }
  console.log(`  control runs lost banking ${lostA}/3, healthcare ${lostB}/3`);
  expect(
    "old top-level pattern STILL races (≥1 lost across 3 runs)",
    lostA > 0 || lostB > 0,
    `proves the fix matters (lostA=${lostA}, lostB=${lostB})`,
  );

  banner(passes === total ? `✅ ${passes}/${total} passed` : `❌ ${passes}/${total} passed`);
  if (passes !== total) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
