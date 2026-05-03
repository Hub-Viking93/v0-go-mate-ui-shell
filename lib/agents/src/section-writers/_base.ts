// =============================================================
// @workspace/agents — Guide section-writer base
// =============================================================
// Shared types + a single `runSectionWriter` helper that every
// section file in this directory delegates to. The user-visible
// wrapper exists per section so each domain has its own focused
// prompt, but the LLM-call plumbing (citation extraction,
// JSON-mode parsing, audit log) lives here.
//
// CONTRACT (matches the buildathon prompt):
//   write(profile, specialistOutput) => SectionContent
//   SectionContent = { paragraphs: string[]; citations: Citation[] }
//
// Each writer's prompt pulls structured key_facts + scraped URLs
// from the specialist output, then asks Sonnet 4.6 to write 3-6
// brand-voice paragraphs with inline `[1]` `[2]` citation markers
// pointing to the citations array. The paragraphs go straight into
// the `*_section.detailedProcess` (or analogous) field on the
// guides table; the citation list is persisted to
// `guide_section_citations` and renumbered globally by the
// composer pass before render.
// =============================================================

import { callLLM } from "../router.js";
import type { AgentName, LogWriter } from "../types.js";
import { writeAuditRow } from "../audit.js";

export interface SectionCitation {
  /** Per-section number (composer renumbers globally before persistence). */
  number: number;
  sourceUrl: string;
  sourceName: string;
  retrievedAt: string;
}

export interface SectionContent {
  paragraphs: string[];
  citations: SectionCitation[];
}

export interface SectionWriterOptions {
  writer?: LogWriter;
  profileId?: string;
  /** Override default section-writer model. Mostly for tests. */
  modelOverride?: string;
}

/** Slim shape of what we need from a SpecialistOutput at write time. */
export interface SpecialistInputForWriter {
  /** Specialist's narrative paragraphs (already QA-ed). */
  paragraphs?: string[];
  /** Structured "facts" the specialist surfaces — best signal for citations. */
  key_facts?: Record<string, unknown>;
  /** Source URLs the specialist actually pulled from. */
  sources?: Array<{ url: string; name?: string; retrievedAt?: string }>;
  /** Free-form override channel — coordinator may pass anything. */
  [key: string]: unknown;
}

const BRAND_VOICE = [
  "BRAND VOICE — non-negotiable:",
  "- Warm, calm, confident. Sound like a senior relocation consultant who has done this 200 times.",
  "- ALWAYS address the reader in SECOND PERSON: 'you / your / you'll / yours'. NEVER use the third person ('Axel needs to...', 'the user must...') even though their name appears in the profile JSON. The reader IS the user — write to them, not about them.",
  "- Plain English. Short sentences. Active voice. No hedging fluff ('it might be worth considering...').",
  "- Concrete numbers, names, deadlines, official portal names — never vague.",
  "- Cite EVERY substantive claim with an inline [n] marker matching an entry in the citations array.",
  "- 3-6 paragraphs. Each paragraph stands on its own.",
  "- USE LIGHT MARKDOWN INSIDE PARAGRAPHS: **bold** for the 1-2 most important nouns/numbers per paragraph (a deadline, a form name, an authority, a hard threshold), `inline code` for form/portal names (e.g. `Inkomstdeklaration 1`, `SPSIC`, `BankID`). Use markdown links [link text](https://url) for any URL you mention. Do NOT use headings (#), block quotes (>), code blocks (```), or full bullet lists — those break our rendering. Light inline markdown only.",
].join("\n");

const JSON_SCHEMA = `Return ONLY a JSON object — no prose, no markdown fences:
{
  "paragraphs": [
    "First paragraph with inline citation markers like [1] and [2].",
    "Second paragraph..."
  ],
  "citations": [
    { "number": 1, "sourceUrl": "https://...", "sourceName": "Migrationsverket — Residence permits", "retrievedAt": "2026-05-03" }
  ]
}`;

function tryParseJSON(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const a = trimmed.indexOf("{");
    const b = trimmed.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(trimmed.slice(a, b + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function coerceCitations(raw: unknown): SectionCitation[] {
  if (!Array.isArray(raw)) return [];
  const out: SectionCitation[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const number = typeof r.number === "number" ? r.number : null;
    const sourceUrl = typeof r.sourceUrl === "string" ? r.sourceUrl : null;
    const sourceName = typeof r.sourceName === "string" ? r.sourceName : null;
    const retrievedAt =
      typeof r.retrievedAt === "string"
        ? r.retrievedAt
        : new Date().toISOString().split("T")[0];
    if (!number || !sourceUrl || !sourceName) continue;
    out.push({ number, sourceUrl, sourceName, retrievedAt });
  }
  return out;
}

function coerceParagraphs(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (t.length === 0) continue;
    out.push(t);
  }
  return out;
}

/**
 * Run a section writer end-to-end.
 *
 * @param agentName              Sub-agent name in `AgentName` union.
 * @param sectionTitle           Human label for the section ("Visa pathway").
 * @param sectionGuidance        Two-or-three sentence focus statement.
 * @param profile                Plan profile data (read-only context).
 * @param specialistOutput       Slim view of the specialist's structured output.
 * @param options                Audit + model override hooks.
 */
export async function runSectionWriter(
  agentName: AgentName,
  sectionTitle: string,
  sectionGuidance: string,
  profile: Record<string, unknown>,
  specialistOutput: SpecialistInputForWriter | null,
  options: SectionWriterOptions = {},
): Promise<SectionContent> {
  const trimmedProfile = pruneProfile(profile);

  const specialistJson = specialistOutput
    ? JSON.stringify(
        {
          paragraphs: specialistOutput.paragraphs,
          key_facts: specialistOutput.key_facts,
          sources: specialistOutput.sources,
        },
        null,
        2,
      ).slice(0, 12_000)
    : "null";

  const systemPrompt = [
    `You are GoMate's "${sectionTitle}" section writer. You produce ONE section of a relocation guide.`,
    sectionGuidance,
    BRAND_VOICE,
    "",
    "If the specialist input is null or empty, write a brief honest section that says we don't yet have research for this area and link to the destination's official immigration portal as the single citation. Do NOT fabricate data.",
    "",
    JSON_SCHEMA,
  ].join("\n\n");

  const userPrompt = [
    `User profile (relevant slice):\n${JSON.stringify(trimmedProfile, null, 2)}`,
    ``,
    `Specialist research for this section:\n${specialistJson}`,
    ``,
    `Write the section now. Match the brand voice. Inline-cite every substantive claim.`,
  ].join("\n");

  let llmContent = "";
  let modelUsed: string | null = null;
  let wallClockMs = 0;
  let tokensUsed: number | null = null;
  const start = Date.now();

  try {
    const llm = await callLLM(agentName, userPrompt, {
      system: systemPrompt,
      ...(options.modelOverride ? { modelOverride: options.modelOverride } : {}),
    });
    llmContent = llm.content;
    modelUsed = llm.model_used;
    wallClockMs = llm.wall_clock_ms;
    tokensUsed = llm.tokens_used;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[${agentName}] LLM call failed:`, err instanceof Error ? err.message : err);
    return { paragraphs: [], citations: [] };
  }

  const parsed = tryParseJSON(llmContent) as
    | { paragraphs?: unknown; citations?: unknown }
    | null;
  const paragraphs = coerceParagraphs(parsed?.paragraphs);
  const citations = coerceCitations(parsed?.citations);

  if (options.writer && options.profileId) {
    try {
      await writeAuditRow(options.writer, {
        profile_id: options.profileId,
        agent_name: agentName,
        model_used: modelUsed,
        phase: "enrichment",
        field_or_output_key: agentName,
        value: { paragraphCount: paragraphs.length, citationCount: citations.length },
        confidence: paragraphs.length > 0 ? "explicit" : "assumed",
        source_user_message: "(section-writer)",
        prompt: `${systemPrompt}\n\n${userPrompt}`.slice(0, 8_000),
        response: llmContent.slice(0, 8_000),
        wall_clock_ms: Date.now() - start,
        tokens_used: tokensUsed,
      });
    } catch {
      void wallClockMs;
    }
  }

  return { paragraphs, citations };
}

/** Strip noisy meta keys + giant nested objects so the prompt stays focused. */
function pruneProfile(profile: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(profile)) {
    if (k.startsWith("_")) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim().length === 0) continue;
    out[k] = v;
  }
  return out;
}
