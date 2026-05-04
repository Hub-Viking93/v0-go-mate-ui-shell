// =============================================================
// Shared date-context helper for LLM prompts.
// =============================================================
// Anthropic models default-assume the year is roughly their
// training-cutoff year. Without explicit context, the LLM phrases
// onboarding questions as "Will you be moving later this year? Or
// anytime in 2026?" — confusing when "this year" is in fact 2026
// already. The Extractor also stores raw relative phrases like
// "November this year" as-is because nothing in the pipeline knows
// what year "this" refers to.
//
// Every LLM-driven agent that asks for or reads dates should inject
// the string returned by `getDateContextLine()` into its system
// prompt so the model resolves relative time correctly.
//
// IMPORTANT: do NOT cache the result. `new Date()` is evaluated at
// each call so the prompt automatically reflects the server's wall
// clock. Hard-coding a date here would freeze the system at that
// instant and re-introduce the same bug.
// =============================================================

export interface DateContext {
  /** YYYY-MM-DD in UTC. */
  isoDate: string;
  /** Full ISO timestamp (UTC). */
  isoTimestamp: string;
  /** Calendar year as integer. */
  year: number;
  /** Calendar month as integer (1-12). */
  month: number;
  /** Day of month (1-31). */
  day: number;
  /** Long-form weekday + month + year, e.g. "Monday, May 4, 2026". */
  longHuman: string;
}

export function getDateContext(now: Date = new Date()): DateContext {
  const isoTimestamp = now.toISOString();
  const isoDate = isoTimestamp.split("T")[0]!;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  const longHuman = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return { isoDate, isoTimestamp, year, month, day, longHuman };
}

/**
 * Drop-in line to prepend to any system prompt. Tells the model
 * explicitly what today is and how to resolve relative phrases like
 * "this year" / "next year" / "later this year". Keep it short — the
 * model will reuse this anchor across the whole turn.
 */
export function getDateContextLine(now: Date = new Date()): string {
  const ctx = getDateContext(now);
  return [
    `Today's date is ${ctx.longHuman} (ISO ${ctx.isoDate}).`,
    `When the user says "this year" they mean ${ctx.year}.`,
    `When the user says "next year" they mean ${ctx.year + 1}.`,
    `When normalizing relative date phrases, anchor them to today's date above — never assume the year is anything other than ${ctx.year}.`,
  ].join(" ");
}
