// =============================================================
// Dry-run harness — Phase E1b: isResearchStale + daysSinceRetrieved
// =============================================================
// Pure offline. Asserts:
//   - 14-day threshold (RESEARCH_STALE_AFTER_DAYS)
//   - "now" injectability
//   - boundary cases (just under / just over)
//   - bad ISO returns false (conservative)
//   - daysSinceRetrieved math matches isResearchStale's threshold
// =============================================================

import {
  RESEARCH_STALE_AFTER_DAYS,
  RESEARCH_STALE_AFTER_MS,
  isResearchStale,
  daysSinceRetrieved,
} from "@workspace/agents";

function banner(label: string): void {
  const line = "─".repeat(60);
  console.log(`\n${line}\n  ${label}\n${line}\n`);
}

let total = 0;
let passes = 0;
function expect(label: string, ok: boolean, detail = ""): void {
  total += 1;
  if (ok) passes += 1;
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
}

const NOW = new Date("2026-05-07T12:00:00.000Z");
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

banner("1/3  Constants");

expect(
  "RESEARCH_STALE_AFTER_DAYS === 14",
  RESEARCH_STALE_AFTER_DAYS === 14,
  String(RESEARCH_STALE_AFTER_DAYS),
);
expect(
  "RESEARCH_STALE_AFTER_MS === 14 * ONE_DAY_MS",
  RESEARCH_STALE_AFTER_MS === 14 * ONE_DAY_MS,
);

banner("2/3  isResearchStale");

const justNow = new Date(NOW.getTime() - 1000).toISOString();
expect("just now → not stale", isResearchStale(justNow, NOW) === false);

const oneDayAgo = new Date(NOW.getTime() - 1 * ONE_DAY_MS).toISOString();
expect("1 day ago → not stale", isResearchStale(oneDayAgo, NOW) === false);

const thirteenDaysAgo = new Date(NOW.getTime() - 13 * ONE_DAY_MS).toISOString();
expect("13 days ago → not stale", isResearchStale(thirteenDaysAgo, NOW) === false);

// Exactly 14 days = NOT stale (threshold is strict >, not ≥).
const exactlyFourteen = new Date(NOW.getTime() - 14 * ONE_DAY_MS).toISOString();
expect(
  "exactly 14 days ago → not stale (strict >)",
  isResearchStale(exactlyFourteen, NOW) === false,
);

// Just over 14 days → stale.
const justOverFourteen = new Date(NOW.getTime() - 14 * ONE_DAY_MS - 1).toISOString();
expect(
  "14 days + 1ms ago → stale",
  isResearchStale(justOverFourteen, NOW) === true,
);

const fifteenDaysAgo = new Date(NOW.getTime() - 15 * ONE_DAY_MS).toISOString();
expect("15 days ago → stale", isResearchStale(fifteenDaysAgo, NOW) === true);

const ninetyDaysAgo = new Date(NOW.getTime() - 90 * ONE_DAY_MS).toISOString();
expect("90 days ago → stale", isResearchStale(ninetyDaysAgo, NOW) === true);

// Bad ISO → conservative false.
expect("bad ISO → false", isResearchStale("not-a-date", NOW) === false);
expect("empty string → false", isResearchStale("", NOW) === false);

// Future date → not stale.
const future = new Date(NOW.getTime() + 5 * ONE_DAY_MS).toISOString();
expect("future date → not stale", isResearchStale(future, NOW) === false);

banner("3/3  daysSinceRetrieved");

expect("just now → 0 days", daysSinceRetrieved(justNow, NOW) === 0);
expect("1 day ago → 1 day", daysSinceRetrieved(oneDayAgo, NOW) === 1);
expect("13 days ago → 13 days", daysSinceRetrieved(thirteenDaysAgo, NOW) === 13);
expect("15 days ago → 15 days", daysSinceRetrieved(fifteenDaysAgo, NOW) === 15);
expect(
  "90 days ago → 90 days",
  daysSinceRetrieved(ninetyDaysAgo, NOW) === 90,
);
expect("bad ISO → null", daysSinceRetrieved("not-a-date", NOW) === null);
expect("future date → 0 (clamped)", daysSinceRetrieved(future, NOW) === 0);

banner(passes === total ? `✅ ${passes}/${total} passed` : `❌ ${passes}/${total} passed`);
if (passes !== total) process.exit(1);
