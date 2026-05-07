// =============================================================
// @workspace/agents — settling-in completion bridge (C1.1)
// =============================================================
// When a settling-in plan regenerates after migrating a domain to
// the researched pipeline (C1, C2), the new task_keys are
// LLM-generated step.id values like "registration:population-register".
// Pre-migration rows used short keys like "reg-population". The
// keys don't carry over — so any progress the user made on legacy
// tasks would be lost when the row gets wiped + reinserted.
//
// This module is the bridge. It does NOT do "old key → new key"
// id-rewriting. The researched ids aren't stable enough between
// LLM runs for that to be reliable. Instead it answers:
//
//     "for each new task, was the user already working on the
//      same underlying real-world task under a previous run? if
//      so, carry over their completion state."
//
// Strategy (β): semantic match within the same domain.
//   1. Normalize titles (lowercase + diacritic-fold + punct-strip).
//   2. Tokenise; drop stop words; require ≥ 3-char content tokens.
//   3. Jaccard similarity over distinctive tokens.
//   4. Match only if score ≥ MIN_SCORE AND ≥ MIN_SHARED tokens
//      AND top score beats runner-up by ≥ MIN_SEPARATION.
//   5. Same-category gating is mandatory — never bridge across
//      categories (e.g. a banking task into a registration slot).
//
// Bias: false negatives are acceptable, false positives are not.
// It's far better to leave a few legacy completions as orphans
// than to wrongly mark an unrelated new task as "complete".
//
// Orphan handling is the caller's job. This module only decides
// matches; the route persists matched state on the new row and
// re-inserts orphans verbatim so the UI can later prompt
// disambiguation.
// =============================================================

// ---- Tunables -------------------------------------------------------
//
// Calibrated against the deterministic→researched title pairs
// observed in dry-runs and live LLM output for SE/registration,
// banking, healthcare. See the unit tests for the boundary cases
// these values are meant to handle.
//
// Tuning notes (calibrated against live LLM-emitted titles for
// SE/registration + banking + healthcare specialists):
//   - 0.35 was too strict. Observed: legacy
//     "Register at Skatteverket (folkbokföring) → personnummer"
//     vs researched "Register with the Swedish Tax Agency
//     (folkbokföring)" scored 0.29 — different LLM run, different
//     phrasing, same underlying task. User intent matched.
//   - 0.25 is the floor that admits these realistic LLM-phrasing
//     drifts while still rejecting genuine non-matches. Same-
//     category pre-gating + MIN_SHARED_TOKENS=2 keep false-positive
//     pressure low. Reference ceiling: "Open a Swedish bank
//     account" vs "Apply for Swedish ID card" scores 0.17 across
//     categories — irrelevant since cross-category never compares,
//     but useful as a tuning floor.
//   - MIN_SEPARATION=0.15 catches LLM ambiguity within a category
//     (two researched tasks that overlap heavily with the same
//     legacy title). Conservative — orphan rather than guess.

export const BRIDGE_MIN_SCORE = 0.25;
export const BRIDGE_MIN_SHARED_TOKENS = 2;
export const BRIDGE_MIN_SEPARATION = 0.15;

// ---- Stop words -----------------------------------------------------
//
// Keep this list tight — token-overlap relies on KEEPING distinctive
// content words (Skatteverket, folkbokföring, BankID, vårdcentral,
// etc.). Only filter words that are universally low-signal in EN/SV/DE
// since those are the languages our task titles mix.

const STOP_WORDS: ReadonlySet<string> = new Set([
  // English (high-frequency function words only)
  "a", "an", "the", "of", "at", "in", "on", "to", "for", "with", "and", "or",
  "your", "you", "my", "is", "are", "be", "do", "does", "did", "go", "get",
  "from", "by", "into", "onto", "via", "as", "this", "that", "these", "those",
  "when", "what", "where", "why", "how", "any", "all", "some", "if", "so",
  "not", "no", "than", "then", "but", "out", "up", "down", "over", "under",
  // Swedish (common articles + prepositions)
  "att", "för", "av", "och", "eller", "det", "den", "de", "en", "ett",
  "som", "kan", "med", "om", "har", "ska", "vad", "var", "när", "till",
  "från", "efter", "innan", "under",
  // German (common articles + prepositions; some legacy DE titles)
  "der", "die", "das", "den", "dem", "ein", "eine", "einen", "einem",
  "fur", "mit", "von", "zu", "auf", "im", "ist", "und", "oder",
]);

// ---- Public types ---------------------------------------------------

export interface BridgeSnapshot {
  /** Legacy task_key, e.g. "reg-population" or any prior key. */
  taskKey: string;
  title: string;
  category: string;
  status: string;
  completedAt: string | null;
  userNotes: string | null;
}

export interface BridgeNewTask {
  taskKey: string;
  title: string;
  category: string;
}

export interface BridgeMatch {
  /** The legacy snapshot that's being carried forward. */
  legacyKey: string;
  /** The state to apply to the new task. */
  status: string;
  completedAt: string | null;
  userNotes: string | null;
  /** Diagnostic — the Jaccard score that won. */
  score: number;
  /** Diagnostic — the tokens both titles shared. */
  sharedTokens: string[];
}

export type BridgeDecision =
  | "matched"
  | "orphan_no_candidate"
  | "orphan_low_confidence"
  | "orphan_ambiguous"
  | "orphan_already_claimed";

export interface BridgeLogEntry {
  legacyKey: string;
  category: string;
  decision: BridgeDecision;
  bestMatch?: { newKey: string; score: number; sharedTokens: string[] };
  runnerUp?: { newKey: string; score: number };
  reason?: string;
}

export interface BridgeResult {
  /** Map from new task's taskKey → state to apply. */
  matches: Map<string, BridgeMatch>;
  /** Legacy snapshots that didn't earn a confident unique match. */
  orphans: BridgeSnapshot[];
  /** Per-snapshot decision log for ops + tests. */
  log: BridgeLogEntry[];
}

// ---- Normalisation --------------------------------------------------

/**
 * Normalise a title for comparison: lowercase, decompose Unicode
 * (so å → a + combining ring), strip combining marks (so the ring
 * disappears), replace non-alphanumeric with whitespace, collapse
 * runs. Result is a clean ascii-ish string of words separated by
 * single spaces.
 *
 * Examples:
 *   "Skatteverket (folkbokföring) → personnummer"
 *     → "skatteverket folkbokforing personnummer"
 *   "Vårdcentral · Förskole" → "vardcentral forskole"
 */
export function normaliseTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenise + filter to distinctive content tokens. Drops stop words
 * and short tokens (≤ 2 chars). Returns deduplicated set as array
 * (order preserved on first occurrence; useful for diagnostics).
 */
export function distinctiveTokens(title: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of normaliseTitle(title).split(" ")) {
    if (tok.length < 3) continue;
    if (STOP_WORDS.has(tok)) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

// ---- Similarity -----------------------------------------------------

export interface SimilarityResult {
  score: number;
  sharedTokens: string[];
}

/**
 * Jaccard similarity over distinctive tokens. Returns 0 when either
 * title has no distinctive tokens. The shared-token list is exposed
 * for ops diagnostics + tests so failures are inspectable.
 */
export function similarity(a: string, b: string): SimilarityResult {
  const ta = new Set(distinctiveTokens(a));
  const tb = new Set(distinctiveTokens(b));
  if (ta.size === 0 || tb.size === 0) return { score: 0, sharedTokens: [] };
  const shared: string[] = [];
  for (const t of ta) if (tb.has(t)) shared.push(t);
  const unionSize = ta.size + tb.size - shared.length;
  if (unionSize === 0) return { score: 0, sharedTokens: [] };
  return { score: shared.length / unionSize, sharedTokens: shared };
}

// ---- Bridge ---------------------------------------------------------

/**
 * Decide which new tasks should inherit completion state from the
 * snapshot of prior rows. Conservative — see module header.
 *
 * Inputs:
 *   newTasks: the freshly composed task list (researched + deterministic)
 *   snapshot: the rows that existed for this plan BEFORE the wipe.
 *
 * Output: matches map keyed by NEW task_key; orphans = the snapshot
 * entries that did NOT earn a confident match (caller re-inserts).
 *
 * The bridge skips snapshot entries with default state (status=available
 * AND no completedAt AND no userNotes) — there's nothing to carry over,
 * so we don't waste cycles or potentially mis-match.
 */
export function bridgeCompletionsBySimilarTitle(
  newTasks: ReadonlyArray<BridgeNewTask>,
  snapshot: ReadonlyArray<BridgeSnapshot>,
): BridgeResult {
  const matches = new Map<string, BridgeMatch>();
  const orphans: BridgeSnapshot[] = [];
  const log: BridgeLogEntry[] = [];

  // Filter snapshot to entries with state worth preserving.
  const carryWorthy = snapshot.filter((s) => {
    if (s.status && s.status !== "available") return true;
    if (s.completedAt) return true;
    if (s.userNotes && s.userNotes.trim().length > 0) return true;
    return false;
  });

  // Index new tasks by category for cheap lookup.
  const newByCategory = new Map<string, BridgeNewTask[]>();
  for (const t of newTasks) {
    const list = newByCategory.get(t.category) ?? [];
    list.push(t);
    newByCategory.set(t.category, list);
  }

  for (const legacy of carryWorthy) {
    const candidates = newByCategory.get(legacy.category) ?? [];

    // Score every candidate; sort descending.
    const scored = candidates
      .map((n) => {
        const sim = similarity(legacy.title, n.title);
        return { taskKey: n.taskKey, ...sim };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    const top = scored[0];
    const second = scored[1];

    if (!top) {
      orphans.push(legacy);
      log.push({
        legacyKey: legacy.taskKey,
        category: legacy.category,
        decision: "orphan_no_candidate",
        reason: candidates.length === 0
          ? `no new tasks in category "${legacy.category}"`
          : "no candidate scored above zero",
      });
      continue;
    }

    if (top.score < BRIDGE_MIN_SCORE || top.sharedTokens.length < BRIDGE_MIN_SHARED_TOKENS) {
      orphans.push(legacy);
      log.push({
        legacyKey: legacy.taskKey,
        category: legacy.category,
        decision: "orphan_low_confidence",
        bestMatch: { newKey: top.taskKey, score: top.score, sharedTokens: top.sharedTokens },
        reason: `score=${top.score.toFixed(2)} (min ${BRIDGE_MIN_SCORE}); sharedTokens=${top.sharedTokens.length} (min ${BRIDGE_MIN_SHARED_TOKENS})`,
      });
      continue;
    }

    if (second && top.score - second.score < BRIDGE_MIN_SEPARATION) {
      orphans.push(legacy);
      log.push({
        legacyKey: legacy.taskKey,
        category: legacy.category,
        decision: "orphan_ambiguous",
        bestMatch: { newKey: top.taskKey, score: top.score, sharedTokens: top.sharedTokens },
        runnerUp: { newKey: second.taskKey, score: second.score },
        reason: `top - runnerUp = ${(top.score - second.score).toFixed(2)} (min ${BRIDGE_MIN_SEPARATION})`,
      });
      continue;
    }

    // Don't let two legacies claim the same new task. The earlier
    // (in iteration order) wins; later collisions become orphans.
    // Iteration order is the snapshot's order — caller should pass
    // them with priority items first if it cares.
    if (matches.has(top.taskKey)) {
      orphans.push(legacy);
      log.push({
        legacyKey: legacy.taskKey,
        category: legacy.category,
        decision: "orphan_already_claimed",
        bestMatch: { newKey: top.taskKey, score: top.score, sharedTokens: top.sharedTokens },
        reason: `${top.taskKey} already bridged from ${matches.get(top.taskKey)?.legacyKey}`,
      });
      continue;
    }

    matches.set(top.taskKey, {
      legacyKey: legacy.taskKey,
      status: legacy.status,
      completedAt: legacy.completedAt,
      userNotes: legacy.userNotes,
      score: top.score,
      sharedTokens: top.sharedTokens,
    });
    log.push({
      legacyKey: legacy.taskKey,
      category: legacy.category,
      decision: "matched",
      bestMatch: { newKey: top.taskKey, score: top.score, sharedTokens: top.sharedTokens },
      ...(second ? { runnerUp: { newKey: second.taskKey, score: second.score } } : {}),
    });
  }

  return { matches, orphans, log };
}
