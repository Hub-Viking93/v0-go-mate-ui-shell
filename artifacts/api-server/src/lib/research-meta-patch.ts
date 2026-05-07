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
  // The RPC returns the merged research_meta jsonb. Supabase JS
  // unwraps single-row scalar returns — `data` is the jsonb object
  // directly (or null if the plan id didn't match a row).
  return { merged: (data ?? null) as Record<string, unknown> | null };
}
