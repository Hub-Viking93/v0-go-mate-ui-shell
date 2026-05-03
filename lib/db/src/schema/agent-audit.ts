import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const agentAuditTable = pgTable(
  "agent_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull(),

    agentName: text("agent_name").notNull(),
    modelUsed: text("model_used"),
    phase: text("phase").notNull(),
    fieldOrOutputKey: text("field_or_output_key"),
    value: jsonb("value"),
    confidence: text("confidence"),

    sourceUserMessage: text("source_user_message"),
    sourceUrl: text("source_url"),

    promptHash: text("prompt_hash"),
    responseHash: text("response_hash"),

    validationRulesApplied: jsonb("validation_rules_applied"),

    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
    wallClockMs: integer("wall_clock_ms"),
    tokensUsed: integer("tokens_used"),
    retryCount: integer("retry_count").notNull().default(0),
  },
  (t) => ({
    profileIdIdx: index("agent_audit_profile_id_idx").on(t.profileId),
    agentNameIdx: index("agent_audit_agent_name_idx").on(t.agentName),
    profileAgentRetrievedIdx: index("agent_audit_profile_agent_retrieved_idx").on(
      t.profileId,
      t.agentName,
      t.retrievedAt,
    ),
  }),
);

export type AgentAudit = typeof agentAuditTable.$inferSelect;
export type InsertAgentAudit = typeof agentAuditTable.$inferInsert;
