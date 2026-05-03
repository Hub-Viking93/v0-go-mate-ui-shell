import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const preDepartureActionsTable = pgTable(
  "pre_departure_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull(),

    title: text("title").notNull(),
    description: text("description"),

    weeksBeforeMoveStart: integer("weeks_before_move_start"),
    weeksBeforeMoveDeadline: integer("weeks_before_move_deadline"),
    estimatedDurationDays: integer("estimated_duration_days"),

    dependsOn: uuid("depends_on").array(),
    documentsNeeded: text("documents_needed").array(),

    officialSourceUrl: text("official_source_url"),
    preFilledFormUrl: text("pre_filled_form_url"),

    agentWhoAddedIt: text("agent_who_added_it"),
    legalConsequenceIfMissed: text("legal_consequence_if_missed"),

    status: text("status").notNull().default("not_started"),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sortOrder: integer("sort_order"),
  },
  (t) => ({
    profileIdIdx: index("pre_departure_actions_profile_id_idx").on(t.profileId),
    profileWeeksIdx: index("pre_departure_actions_profile_weeks_idx").on(
      t.profileId,
      t.weeksBeforeMoveStart,
    ),
  }),
);

export type PreDepartureAction = typeof preDepartureActionsTable.$inferSelect;
export type InsertPreDepartureAction = typeof preDepartureActionsTable.$inferInsert;
