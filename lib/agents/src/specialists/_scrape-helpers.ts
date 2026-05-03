import { writeAuditRow } from "../audit.js";
import { scrapeOfficialSource } from "../scraping/firecrawl.js";
import type { AgentName, ConfidenceLevel } from "../types.js";
import { makeSourceContext, type SourceContext } from "./_prompt-helpers.js";
import type { SpecialistContext, SpecialistOutput } from "./types.js";

export interface ResolvedScrapes {
  sources: SourceContext[];
  successfulScrapes: SourceContext[];
  quality: SpecialistOutput["quality"];
  confidence: ConfidenceLevel;
  fallbackReason?: string;
}

export async function scrapeCandidates(
  candidates: { label: string; url: string }[],
  signal: AbortSignal,
  destinationLabel?: string,
): Promise<ResolvedScrapes> {
  const scrapeResults = await Promise.all(
    candidates.map((c) => scrapeOfficialSource(c.url, { signal })),
  );
  const sources = candidates.map((c, i) => makeSourceContext(c.label, c.url, scrapeResults[i]));
  return resolveQuality(sources, destinationLabel);
}

export function resolveQuality(
  sources: SourceContext[],
  destinationLabel?: string,
): ResolvedScrapes {
  const successfulScrapes = sources.filter((s) => s.scraped);
  const total = sources.length;
  let quality: SpecialistOutput["quality"];
  let confidence: ConfidenceLevel;
  let fallbackReason: string | undefined;
  if (total === 0) {
    quality = "fallback";
    confidence = "fallback";
    fallbackReason = `No whitelist source URL on file for ${destinationLabel ?? "this profile"}.`;
  } else if (successfulScrapes.length === 0) {
    quality = "fallback";
    confidence = "fallback";
    fallbackReason = `All ${total} scrape attempt(s) failed (Firecrawl). Synthesising from embedded knowledge; URLs cited are whitelist references only.`;
  } else if (successfulScrapes.length < total) {
    quality = "partial";
    confidence = "partial";
    fallbackReason = `${total - successfulScrapes.length}/${total} scrape attempts failed; partial synthesis.`;
  } else {
    quality = "full";
    confidence = "explicit";
  }
  return { sources, successfulScrapes, quality, confidence, fallbackReason };
}

export async function writeSynthesisAudit(args: {
  ctx: SpecialistContext;
  specialist: string;
  agentName: AgentName;
  sources: SourceContext[];
  successfulScrapes: SourceContext[];
  confidence: ConfidenceLevel;
  userPrompt: string;
  llm: { content: string; tokens_used: number; model_used: string };
  synthesisMs: number;
  extra?: Record<string, unknown>;
}): Promise<void> {
  try {
    await writeAuditRow(args.ctx.logWriter, {
      profile_id: args.ctx.profileId,
      agent_name: args.agentName,
      model_used: args.llm.model_used,
      phase: "research",
      field_or_output_key: `${args.specialist}.synthesis`,
      value: {
        sources_scraped: args.successfulScrapes.length,
        sources_total: args.sources.length,
        ...(args.extra ?? {}),
      },
      confidence: args.confidence,
      source_url: args.successfulScrapes[0]?.url ?? args.sources[0]?.url ?? null,
      prompt: args.userPrompt,
      response: args.llm.content,
      wall_clock_ms: args.synthesisMs,
      tokens_used: args.llm.tokens_used,
    });
  } catch (err) {
    console.warn(
      `[${args.specialist}] synthesis-audit write failed:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export function citationsFromSources(sources: SourceContext[]) {
  return sources.map((s) => ({
    url: s.url,
    label: s.label,
    scraped: s.scraped,
    note: s.scraped ? "Scraped this run" : "Whitelist reference",
  }));
}
