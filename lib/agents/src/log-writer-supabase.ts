// =============================================================
// @workspace/agents — Supabase adapter for LogWriter
// =============================================================
// Turns a Supabase client into the LogWriter interface that the
// orchestrator + audit modules expect. Lives here (not in api-server)
// so any future caller — workers, scripts, tests — can reuse it.
//
// The Supabase client must be authenticated as the user whose
// profile_id is being written, otherwise the RLS policies on
// agent_run_log / agent_audit (joined via relocation_plans.user_id)
// will reject the inserts.
//
// SupabaseClient is imported as a type-only symbol so this module
// adds no runtime dependency to lib/agents/. The caller supplies the
// concrete client instance.
// =============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentAuditRow,
  AgentRunLogRow,
  LogWriter,
} from "./types.js";

export function createSupabaseLogWriter(supabase: SupabaseClient): LogWriter {
  return {
    async insertRunLog(row: AgentRunLogRow): Promise<void> {
      const { error } = await supabase.from("agent_run_log").insert({
        profile_id: row.profile_id,
        agent_name: row.agent_name,
        phase: row.phase,
        status: row.status,
        prompt_summary: row.prompt_summary ?? null,
        response_summary: row.response_summary ?? null,
        tools_called: row.tools_called ?? null,
        validation_passed: row.validation_passed ?? null,
        retry_count: row.retry_count ?? 0,
        tokens_used: row.tokens_used ?? null,
        wall_clock_ms: row.wall_clock_ms ?? null,
        error_message: row.error_message ?? null,
      });
      if (error) {
        throw new Error(
          `[supabase log writer] agent_run_log insert failed: ${error.message}`,
        );
      }
    },

    async insertAudit(row: AgentAuditRow): Promise<void> {
      const { error } = await supabase.from("agent_audit").insert({
        profile_id: row.profile_id,
        agent_name: row.agent_name,
        model_used: row.model_used ?? null,
        phase: row.phase,
        field_or_output_key: row.field_or_output_key ?? null,
        value: row.value ?? null,
        confidence: row.confidence ?? null,
        source_user_message: row.source_user_message ?? null,
        source_url: row.source_url ?? null,
        prompt_hash: row.prompt_hash ?? null,
        response_hash: row.response_hash ?? null,
        validation_rules_applied: row.validation_rules_applied ?? null,
        wall_clock_ms: row.wall_clock_ms ?? null,
        tokens_used: row.tokens_used ?? null,
        retry_count: row.retry_count ?? 0,
      });
      if (error) {
        throw new Error(
          `[supabase log writer] agent_audit insert failed: ${error.message}`,
        );
      }
    },
  };
}
