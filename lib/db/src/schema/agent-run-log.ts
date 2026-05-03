import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const agentRunLogTable = pgTable(
  "agent_run_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull(),

    agentName: text("agent_name").notNull(),
    phase: text("phase").notNull(),

    status: text("status").notNull(),

    promptSummary: text("prompt_summary"),
    responseSummary: text("response_summary"),
    toolsCalled: text("tools_called").array(),
    validationPassed: boolean("validation_passed"),
    retryCount: integer("retry_count").notNull().default(0),
    tokensUsed: integer("tokens_used"),
    wallClockMs: integer("wall_clock_ms"),
    errorMessage: text("error_message"),

    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdIdx: index("agent_run_log_profile_id_idx").on(t.profileId),
    profileTimestampIdx: index("agent_run_log_profile_timestamp_idx").on(
      t.profileId,
      t.timestamp,
    ),
  }),
);

export type AgentRunLog = typeof agentRunLogTable.$inferSelect;
export type InsertAgentRunLog = typeof agentRunLogTable.$inferInsert;
