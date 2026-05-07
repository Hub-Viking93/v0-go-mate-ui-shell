// =============================================================
// Phase F1 — research_meta atomic-patch helper
// =============================================================
// All writers that touch relocation_plans.research_meta should go
// through this helper instead of read-modify-write. The previous
// pattern:
//
//   const { data: row } = await sb.from(...).select("research_meta")...
//   await sb.from(...).update({ research_meta: { ...row.research_meta, [k]: v } })
//
// has a lost-update race when two writers race each other on
// different sub-keys. Concretely observed: notifications-scheduler
// reads research_meta on its tick, computes notifications, and
// writes the whole column back. If a concurrent writer mutates a
// different sub-key (e.g. researchedSpecialists.banking), it gets
// silently clobbered by the scheduler's stale snapshot.
//
// The helper calls the apply_research_meta_patch RPC (defined in
// supabase/migrations/20260507000000_apply_research_meta_patch.sql)
// which performs a single atomic statement:
//
//   update relocation_plans
//   set research_meta = coalesce(research_meta, '{}'::jsonb) || $patch
//   where id = $plan_id
//   returning research_meta
//
// JSONB's `||` operator is shallow-merge: keys in the patch
// overwrite top-level keys in the existing object. For deep edits
// (e.g. researchedSpecialists.banking), the caller passes the full
// sub-object as the patch's value — same shape every existing
// writer already constructs.
//
// Returns the merged research_meta so callers don't need a second
// SELECT to know the post-state.
// =============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

export type ResearchMetaPatch = Record<string, unknown>;

/**
 * Phase E3-A — capture the profile-data subset that's relevant to
 * specialist research. Stored as a sibling under
 * research_meta.profileSnapshots[domain] each time a domain's
 * bundle is persisted. Used by /api/research/suggestions to detect
 * which domains the user has changed since their last research run.
 *
 * Strategy: snapshot the full profile_data wholesale rather than
 * only the trigger-mapped subset. Profile_data is ~30 small scalar
 * fields, so the storage cost is trivial; keeping the snapshot
 * symmetric with what writers actually saw simplifies the diff
 * call-site (one input, one output, no per-domain filtering at
 * snapshot-write time).
 */
export function captureProfileSnapshot(
  profileData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  // Defensive copy + drop functions / undefined / non-serialisable
  // entries so what we save round-trips cleanly through JSONB.
  const out: Record<string, unknown> = {};
  if (!profileData) return out;
  for (const [k, v] of Object.entries(profileData)) {
    if (v === undefined) continue;
    if (typeof v === "function") continue;
    out[k] = v;
  }
  return out;
}

export interface ApplyResearchMetaPatchResult {
  /** The merged research_meta after the patch was applied. Null when
   *  the plan id didn't match any row (caller should treat as a
   *  no-op, same as the old read-then-update pattern would have). */
  merged: Record<string, unknown> | null;
}

export class ResearchMetaPatchError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ResearchMetaPatchError";
  }
}

/**
 * Atomically merge `patch` into relocation_plans.research_meta for the
 * given plan id. RLS-gated via security invoker — callers using a
 * user-context Supabase client get the same row-visibility they'd
 * get from a direct SELECT/UPDATE; callers using the service-role
 * client bypass RLS as expected.
 *
 * SCOPE NOTE: this is shallow (top-level) merge. Two writers that
 * patch DIFFERENT sub-keys under the SAME parent (e.g. both write
 * `researchedSpecialists`, one with banking, one with healthcare)
 * still race because each carries the other's stale snapshot in
 * its patch payload. For multi-domain writes under a parent, use
 * `applyResearchMetaPatchAt` per leaf.
 */
export async function applyResearchMetaPatch(
  supabase: SupabaseClient,
  planId: string,
  patch: ResearchMetaPatch,
): Promise<ApplyResearchMetaPatchResult> {
  const { data, error } = await supabase.rpc("apply_research_meta_patch", {
    p_plan_id: planId,
    p_patch: patch,
  });
  if (error) {
    throw new ResearchMetaPatchError(
      `apply_research_meta_patch RPC failed: ${error.message}`,
      error,
    );
  }
  return { merged: (data ?? null) as Record<string, unknown> | null };
}

/**
 * Path-aware atomic write into relocation_plans.research_meta.
 * Uses jsonb_set so two concurrent writes to different leaves
 * under the same parent both survive.
 *
 * Example:
 *   applyResearchMetaPatchAt(sb, planId,
 *     ["researchedSpecialists", "banking"], bankingBundle)
 *
 * Race-correct against:
 *   applyResearchMetaPatchAt(sb, planId,
 *     ["researchedSpecialists", "healthcare"], healthcareBundle)
 *
 * Path depth ≤ 2 supported by the SQL function today; extend the
 * migration if deeper writes ever materialise.
 */
export async function applyResearchMetaPatchAt(
  supabase: SupabaseClient,
  planId: string,
  path: ReadonlyArray<string>,
  value: unknown,
): Promise<ApplyResearchMetaPatchResult> {
  if (path.length === 0) {
    throw new ResearchMetaPatchError("path must contain at least one segment");
  }
  const { data, error } = await supabase.rpc("apply_research_meta_patch_at", {
    p_plan_id: planId,
    p_path: path,
    p_value: value as Record<string, unknown>,
  });
  if (error) {
    throw new ResearchMetaPatchError(
      `apply_research_meta_patch_at RPC failed: ${error.message}`,
      error,
    );
  }
  return { merged: (data ?? null) as Record<string, unknown> | null };
}
