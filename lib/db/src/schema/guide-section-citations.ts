import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export const guideSectionCitationsTable = pgTable(
  "guide_section_citations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    guideId: uuid("guide_id").notNull(),

    sectionKey: text("section_key").notNull(),
    paragraphIdx: integer("paragraph_idx").notNull(),
    citationNumber: integer("citation_number").notNull(),

    sourceUrl: text("source_url").notNull(),
    sourceName: text("source_name"),

    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }).notNull().defaultNow(),

    agentWhoAddedIt: text("agent_who_added_it"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    guideIdIdx: index("guide_section_citations_guide_id_idx").on(t.guideId),
    guideSectionParaIdx: index("guide_section_citations_guide_section_para_idx").on(
      t.guideId,
      t.sectionKey,
      t.paragraphIdx,
    ),
  }),
);

export type GuideSectionCitation = typeof guideSectionCitationsTable.$inferSelect;
export type InsertGuideSectionCitation = typeof guideSectionCitationsTable.$inferInsert;
