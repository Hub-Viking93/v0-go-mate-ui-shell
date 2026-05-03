// =============================================================
// @workspace/agents — Wave 2.1 ProfileStore interface + adapter
// =============================================================
// Profile Writer needs to merge a single field into
// relocation_plans.profile_data. lib/agents/ stays pure: it never
// reaches into a concrete database driver. Callers pass a
// ProfileStore that satisfies the contract; the Supabase adapter
// ships alongside.
//
// CONCURRENCY (Wave 2.1 race fix):
//   The naive "read profile_data → spread → write" pattern has a
//   lost-update window when two extraction chains race against the
//   same row (e.g. a multi-field user message kicks off two
//   profile-writer calls, or two browser tabs are open). The
//   Supabase adapter therefore calls the
//   `apply_profile_field_patch(uuid, jsonb)` Postgres function
//   added in migration 20260502120500, which performs an atomic
//   `profile_data = profile_data || patch` inside a single
//   statement. RLS (security invoker) still enforces ownership.
//
//   In-memory test adapters can do the merge in JS — there's no
//   concurrency to lose to.
//
// The Supabase adapter assumes the client is authenticated as the
// user who owns the relocation_plans row (RLS policies on the
// table join via user_id = auth.uid()). Service-role clients also
// work.
// =============================================================

import type { AllFieldKey } from "./intake-fields.js";

export interface ProfileStore {
  /**
   * Returns the current profile_data JSONB for a relocation_plans row,
   * or null when the row doesn't exist. Mostly useful for read-only
   * inspection / tests; profile-writer.ts uses applyFieldPatch instead.
   */
  getProfileData(profileId: string): Promise<Record<string, unknown> | null>;

  /**
   * Atomically merges `patch` into profile_data and returns the merged
   * result. Implementations MUST guarantee the read+merge+write is a
   * single observable step (e.g. a Postgres `||` update) — clients rely
   * on this for safety against concurrent profile_writer invocations.
   */
  applyFieldPatch(
    profileId: string,
    patch: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}

// --- Supabase adapter ---
// type-only import keeps @supabase/supabase-js a devDep.
import type { SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseProfileStore(
  supabase: SupabaseClient,
): ProfileStore {
  return {
    async getProfileData(profileId: string) {
      const { data, error } = await supabase
        .from("relocation_plans")
        .select("profile_data")
        .eq("id", profileId)
        .maybeSingle();
      if (error) {
        throw new Error(
          `[profile-store] failed to read profile_data for ${profileId}: ${error.message}`,
        );
      }
      if (!data) return null;
      const pd = (data as { profile_data: unknown }).profile_data;
      if (pd && typeof pd === "object") return pd as Record<string, unknown>;
      return {};
    },

    async applyFieldPatch(profileId, patch) {
      // Atomic merge via the Wave 2.1 Postgres function. The function
      // returns the merged profile_data; PostgREST surfaces this as the
      // RPC return value.
      const { data, error } = await supabase.rpc("apply_profile_field_patch", {
        p_profile_id: profileId,
        p_patch: patch,
      });
      if (error) {
        throw new Error(
          `[profile-store] apply_profile_field_patch failed for ${profileId}: ${error.message}`,
        );
      }
      // RLS-blocked / non-existent row → function updates 0 rows and
      // returns NULL. Caller (profile-writer) treats this as fatal.
      if (data === null || data === undefined) {
        throw new Error(
          `[profile-store] apply_profile_field_patch returned no row for ${profileId} (missing row or RLS-blocked)`,
        );
      }
      if (typeof data !== "object") {
        throw new Error(
          `[profile-store] apply_profile_field_patch returned non-object for ${profileId}: ${typeof data}`,
        );
      }
      return data as Record<string, unknown>;
    },
  };
}

/**
 * Convenience: build a single-field patch object. Use this from
 * profile-writer rather than constructing the patch literal inline so
 * future fan-out (multiple fields per call) only needs one call site.
 */
export function singleFieldPatch(
  fieldKey: AllFieldKey,
  value: unknown,
): Record<string, unknown> {
  return { [fieldKey]: value };
}
