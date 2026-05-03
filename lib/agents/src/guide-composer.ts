// =============================================================
// @workspace/agents — Guide Composer (Wave 6)
// =============================================================
// Replaces the v1 single-LLM `enrichGuide`. The composer:
//   1. Fans out to all relevant section writers in parallel.
//   2. Renumbers citations globally so [1] is unique guide-wide.
//   3. Runs a Sonnet 4.6 consistency pass that returns a small JSON
//      report (terminology drift, deadline contradictions, duplicate
//      info, tone breaks) plus a normalized vocabulary the caller
//      can show in a debug drawer.
//
// MODEL CHOICE — buildathon override (2026-05-03):
// The original spec routed the Composer through Opus 4.7. The user
// directed "no Opus anywhere" for cost. Composer now uses Sonnet 4.6,
// which handles the consistency-pass JSON shape without quality loss.
//
// Pre/post conditions:
//   * Every section writer is called even if the matching specialist
//     output is missing — the writer's `_base.ts` honestly degrades.
//   * Conditional sections (jobs / education / posted_worker) are
//     skipped at the orchestration level by checking the profile.
//   * The output is a `ComposedGuide` with renumbered citations and
//     a deduplicated `globalCitations` list. Caller persists each
//     citation row to `public.guide_section_citations`.
// =============================================================

import { callLLM } from "./router.js";
import { writeAuditRow } from "./audit.js";
import type { LogWriter } from "./types.js";
import {
  writeVisaSection,
  writeBudgetSection,
  writeHousingSection,
  writeBankingSection,
  writeHealthcareSection,
  writeCultureSection,
  writeJobsSection,
  writeEducationSection,
  writeDocumentsSection,
  writePostedWorkerSection,
  writePreDepartureOverviewSection,
  writeSettlingInOverviewSection,
  type SectionContent,
  type SpecialistInputForWriter,
  type SectionWriterOptions,
} from "./section-writers/index.js";

export const COMPOSER_AGENT = "guide_composer" as const;

// ---- Section keys (stable, used as the section_key column value) ----
export type GuideSectionKey =
  | "visa"
  | "budget"
  | "housing"
  | "banking"
  | "healthcare"
  | "culture"
  | "jobs"
  | "education"
  | "documents"
  | "posted_worker"
  | "pre_departure_overview"
  | "settling_in_overview";

export interface GuideCitation {
  number: number;
  sourceUrl: string;
  sourceName: string;
  retrievedAt: string;
  /** Which agent produced the citation (from the section it belongs to). */
  agentWhoAdded: string;
}

export interface GuideSection {
  key: GuideSectionKey;
  title: string;
  paragraphs: string[];
  citations: GuideCitation[];
}

export interface ComposedGuide {
  sections: GuideSection[];
  globalCitations: GuideCitation[];
  consistencyReport: {
    issues: Array<{ severity: "warn" | "info"; section: GuideSectionKey | "global"; note: string }>;
    vocabulary: Record<string, string>;
    notes: string;
  };
}

export interface ComposeGuideOptions {
  writer?: LogWriter;
  profileId?: string;
  /** When true, run section writers sequentially. Default false (parallel). */
  sequential?: boolean;
}

/**
 * Specialist outputs by section key. Caller maps from research-orchestrator
 * specialist outputs to this shape — composer doesn't peek into the agent
 * router; it's just data in.
 */
export type SpecialistInputs = Partial<Record<GuideSectionKey, SpecialistInputForWriter>>;

const SECTION_TITLES: Record<GuideSectionKey, string> = {
  visa: "Visa pathway",
  budget: "Budget & cost of living",
  housing: "Housing",
  banking: "Banking & digital ID",
  healthcare: "Healthcare",
  culture: "Culture & daily life",
  jobs: "Jobs & labor market",
  education: "Education",
  documents: "Document pipeline",
  posted_worker: "Posted-worker compliance",
  pre_departure_overview: "Pre-departure overview",
  settling_in_overview: "Settling-in overview",
};

const SECTION_AGENTS: Record<GuideSectionKey, string> = {
  visa: "section_writer_visa",
  budget: "section_writer_budget",
  housing: "section_writer_housing",
  banking: "section_writer_banking",
  healthcare: "section_writer_healthcare",
  culture: "section_writer_culture",
  jobs: "section_writer_jobs",
  education: "section_writer_education",
  documents: "section_writer_documents",
  posted_worker: "section_writer_posted_worker",
  pre_departure_overview: "section_writer_pre_departure_overview",
  settling_in_overview: "section_writer_settling_in_overview",
};

const SECTION_WRITERS: Record<
  GuideSectionKey,
  (
    profile: Record<string, unknown>,
    specialist: SpecialistInputForWriter | null,
    options?: SectionWriterOptions,
  ) => Promise<SectionContent>
> = {
  visa: writeVisaSection,
  budget: writeBudgetSection,
  housing: writeHousingSection,
  banking: writeBankingSection,
  healthcare: writeHealthcareSection,
  culture: writeCultureSection,
  jobs: writeJobsSection,
  education: writeEducationSection,
  documents: writeDocumentsSection,
  posted_worker: writePostedWorkerSection,
  pre_departure_overview: writePreDepartureOverviewSection,
  settling_in_overview: writeSettlingInOverviewSection,
};

/** Decide which sections to include for the given profile. */
export function pickSectionsForProfile(profile: Record<string, unknown>): GuideSectionKey[] {
  const purpose = typeof profile.purpose === "string" ? profile.purpose : "";
  const childrenCount =
    typeof profile.children_count === "number"
      ? profile.children_count
      : typeof profile.children_count === "string"
        ? Number(profile.children_count) || 0
        : 0;
  const posting = profile.posting_or_secondment === "yes";

  const out: GuideSectionKey[] = [
    "visa",
    "budget",
    "housing",
    "banking",
    "healthcare",
    "culture",
    "documents",
    "pre_departure_overview",
    "settling_in_overview",
  ];

  if (purpose === "work" || purpose === "digital_nomad") out.push("jobs");
  if (purpose === "study" || childrenCount > 0) out.push("education");
  if (posting) out.push("posted_worker");

  return out;
}

interface ConsistencyReportRaw {
  issues?: Array<{ severity?: string; section?: string; note?: string }>;
  vocabulary?: Record<string, string>;
  notes?: string;
}

function tryParseJson(raw: string): unknown {
  const t = raw.trim();
  try { return JSON.parse(t); } catch {
    const a = t.indexOf("{"); const b = t.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
    }
    return null;
  }
}

/**
 * Renumber citations globally so [1] is unique across the whole guide.
 * De-dupes by sourceUrl. Returns the renumbered sections + the deduped
 * global citation list. The paragraphs' inline `[n]` markers are
 * rewritten to use the new global numbers.
 */
function renumberGlobally(
  perSection: Array<{ key: GuideSectionKey; title: string; content: SectionContent }>,
): { sections: GuideSection[]; global: GuideCitation[] } {
  const urlToNumber = new Map<string, number>();
  const global: GuideCitation[] = [];
  const sections: GuideSection[] = [];

  for (const section of perSection) {
    // Build per-section old→new number map for this section's citations.
    const oldToNew = new Map<number, number>();
    const sectionCitations: GuideCitation[] = [];
    const agentWhoAdded = SECTION_AGENTS[section.key];
    for (const cite of section.content.citations) {
      let newNum = urlToNumber.get(cite.sourceUrl);
      if (newNum === undefined) {
        newNum = global.length + 1;
        urlToNumber.set(cite.sourceUrl, newNum);
        global.push({
          number: newNum,
          sourceUrl: cite.sourceUrl,
          sourceName: cite.sourceName,
          retrievedAt: cite.retrievedAt,
          agentWhoAdded,
        });
      }
      oldToNew.set(cite.number, newNum);
      // Track section-local view (number is guide-global by now).
      sectionCitations.push({
        number: newNum,
        sourceUrl: cite.sourceUrl,
        sourceName: cite.sourceName,
        retrievedAt: cite.retrievedAt,
        agentWhoAdded,
      });
    }
    // Rewrite [n] markers in each paragraph using oldToNew.
    const rewritten = section.content.paragraphs.map((p) =>
      p.replace(/\[(\d+)\]/g, (_m, n) => {
        const nn = oldToNew.get(Number(n));
        return nn !== undefined ? `[${nn}]` : `[${n}]`;
      }),
    );
    sections.push({
      key: section.key,
      title: section.title,
      paragraphs: rewritten,
      citations: sectionCitations,
    });
  }
  return { sections, global };
}

async function runConsistencyPass(
  sections: GuideSection[],
  globalCitations: GuideCitation[],
  options: ComposeGuideOptions,
): Promise<ComposedGuide["consistencyReport"]> {
  const flat = sections
    .map((s) => `### ${s.title} [${s.key}]\n${s.paragraphs.join("\n\n")}`)
    .join("\n\n---\n\n");
  const citesShort = globalCitations
    .map((c) => `[${c.number}] ${c.sourceName} — ${c.sourceUrl}`)
    .join("\n");
  const systemPrompt = [
    "You are GoMate's Guide Composer. Your only job is a CONSISTENCY PASS.",
    "Read the assembled guide and produce a JSON report — no rewrites, no new prose.",
    "",
    "Check for:",
    "- Terminology drift (e.g., 'personnummer' in one section vs 'Swedish personal ID number' in another). Pick a canonical term and list it.",
    "- Numerical / date contradictions across sections (visa processing time in section A vs in section B).",
    "- Information that's repeated nearly verbatim in two sections.",
    "- Tone breaks (a paragraph that reads more bureaucratic than the brand voice — warm, calm, confident).",
    "- Citation hygiene: every [n] in the prose has a matching entry in the citation list (use the list provided).",
    "",
    "Return ONLY this JSON shape:",
    `{`,
    `  "issues": [{ "severity": "warn"|"info", "section": "<section_key or 'global'>", "note": "<short>" }],`,
    `  "vocabulary": { "<canonical term>": "<replace these synonyms with it>" },`,
    `  "notes": "<one paragraph summary, max 600 chars>"`,
    `}`,
  ].join("\n");
  const userPrompt = [
    `GUIDE BODY:`,
    flat.slice(0, 30_000),
    ``,
    `GLOBAL CITATION LIST:`,
    citesShort,
  ].join("\n\n");

  let llmContent = "";
  let modelUsed: string | null = null;
  let wallClockMs = 0;
  let tokens: number | null = null;
  const t0 = Date.now();
  try {
    const llm = await callLLM(COMPOSER_AGENT, userPrompt, { system: systemPrompt });
    llmContent = llm.content;
    modelUsed = llm.model_used;
    wallClockMs = llm.wall_clock_ms;
    tokens = llm.tokens_used;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[guide-composer] consistency LLM failed:", err instanceof Error ? err.message : err);
    return {
      issues: [{ severity: "info", section: "global", note: "Consistency pass skipped (LLM error)." }],
      vocabulary: {},
      notes: "Consistency pass not available for this run.",
    };
  }

  const parsed = (tryParseJson(llmContent) as ConsistencyReportRaw | null) ?? {};
  const issues: ComposedGuide["consistencyReport"]["issues"] = [];
  if (Array.isArray(parsed.issues)) {
    for (const i of parsed.issues) {
      if (!i || typeof i !== "object") continue;
      const sev = i.severity === "warn" ? "warn" : "info";
      const section = (i.section as GuideSectionKey | "global") ?? "global";
      const note = typeof i.note === "string" ? i.note : "";
      if (note.length > 0) issues.push({ severity: sev, section, note });
    }
  }
  const vocabulary = (parsed.vocabulary && typeof parsed.vocabulary === "object")
    ? (parsed.vocabulary as Record<string, string>)
    : {};
  const notes = typeof parsed.notes === "string" ? parsed.notes : "";

  if (options.writer && options.profileId) {
    try {
      await writeAuditRow(options.writer, {
        profile_id: options.profileId,
        agent_name: COMPOSER_AGENT,
        model_used: modelUsed,
        phase: "enrichment",
        field_or_output_key: "consistency_report",
        value: { issueCount: issues.length, vocabularyTerms: Object.keys(vocabulary).length },
        confidence: "explicit",
        source_user_message: "(composer)",
        prompt: `${systemPrompt}\n\n${userPrompt}`.slice(0, 8_000),
        response: llmContent.slice(0, 8_000),
        wall_clock_ms: Date.now() - t0,
        tokens_used: tokens,
      });
    } catch { /* non-fatal */ }
  }
  void wallClockMs;
  return { issues, vocabulary, notes };
}

/**
 * Compose a full guide. Caller hands us:
 *   - the user's profile (for sectionPick + per-writer context),
 *   - a `SpecialistInputs` map with whatever specialist outputs are
 *     available (missing is OK; writers degrade gracefully).
 */
export async function composeGuide(
  profile: Record<string, unknown>,
  specialistInputs: SpecialistInputs,
  options: ComposeGuideOptions = {},
): Promise<ComposedGuide> {
  const sectionsToRun = pickSectionsForProfile(profile);
  const writerOptions: SectionWriterOptions = {
    writer: options.writer,
    profileId: options.profileId,
  };

  // Run section writers (parallel by default — caps at the LLM provider's
  // concurrency, but Sonnet 4.6 over OpenRouter handles 12 in flight fine).
  type Pair = { key: GuideSectionKey; title: string; content: SectionContent };
  const pairs: Pair[] = [];
  if (options.sequential) {
    for (const key of sectionsToRun) {
      const fn = SECTION_WRITERS[key];
      const content = await fn(profile, specialistInputs[key] ?? null, writerOptions);
      pairs.push({ key, title: SECTION_TITLES[key], content });
    }
  } else {
    const promises = sectionsToRun.map(async (key) => {
      const fn = SECTION_WRITERS[key];
      const content = await fn(profile, specialistInputs[key] ?? null, writerOptions);
      return { key, title: SECTION_TITLES[key], content } as Pair;
    });
    const settled = await Promise.allSettled(promises);
    for (const s of settled) {
      if (s.status === "fulfilled") pairs.push(s.value);
      else {
        // Defensive: a writer that throws becomes an empty section, not a 500.
        // eslint-disable-next-line no-console
        console.error("[guide-composer] section writer rejected:", s.reason);
      }
    }
  }

  const { sections, global } = renumberGlobally(pairs);
  const consistencyReport = await runConsistencyPass(sections, global, options);

  return { sections, globalCitations: global, consistencyReport };
}
