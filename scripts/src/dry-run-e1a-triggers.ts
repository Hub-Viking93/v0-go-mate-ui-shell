// =============================================================
// Dry-run harness — Phase E1a: research-triggers.ts
// =============================================================
// Pure offline. Asserts the profile-field → SpecialistDomain[]
// mapping behaves correctly:
//
//   • destination change → universal blast radius
//   • target_city change → housing + registration only
//   • Sweden → Sweden (no value change) → no domains
//   • new field added → its mapped domains appear
//   • field cleared → its mapped domains appear (research re-runs
//                     with the new state)
//   • unknown field → empty list
//   • filterToImplementedDomains correctly partitions
//
// USAGE:
//   pnpm --filter @workspace/scripts dry-run-e1a
// =============================================================

import {
  PROFILE_FIELD_TO_DOMAINS,
  IMPLEMENTED_RESEARCHED_DOMAINS,
  diffProfileForDomains,
  filterToImplementedDomains,
  type SpecialistDomain,
} from "@workspace/agents";

function banner(label: string): void {
  const line = "─".repeat(60);
  console.log(`\n${line}\n  ${label}\n${line}\n`);
}

function check(label: string, ok: boolean, detail = ""): boolean {
  console.log(`${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function arrEq(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].sort();
  const bs = [...b].sort();
  for (let i = 0; i < as.length; i++) if (as[i] !== bs[i]) return false;
  return true;
}

let passes = 0;
let total = 0;
function expect(label: string, ok: boolean, detail = ""): void {
  total += 1;
  if (check(label, ok, detail)) passes += 1;
}

// ---- 1. Mapping sanity ------------------------------------------------

banner("1/4  Mapping sanity");

expect(
  "destination is the universal blast radius (≥6 domains)",
  PROFILE_FIELD_TO_DOMAINS.destination.length >= 6,
  `${PROFILE_FIELD_TO_DOMAINS.destination.length} domains`,
);
expect(
  "destination includes core domains",
  ["visa", "documents", "registration", "banking", "housing", "healthcare"].every(
    (d) => PROFILE_FIELD_TO_DOMAINS.destination.includes(d as SpecialistDomain),
  ),
);
expect(
  "target_city is narrower than destination",
  PROFILE_FIELD_TO_DOMAINS.target_city.length < PROFILE_FIELD_TO_DOMAINS.destination.length,
);
expect(
  "target_city covers housing + registration",
  arrEq(PROFILE_FIELD_TO_DOMAINS.target_city, ["housing", "registration"]),
);
expect(
  "purpose maps to visa + banking + tax",
  arrEq(PROFILE_FIELD_TO_DOMAINS.purpose, ["visa", "banking", "tax"]),
);
expect(
  "pets maps to pet only",
  arrEq(PROFILE_FIELD_TO_DOMAINS.pets, ["pet"]),
);
expect(
  "monthly_budget covers banking + housing + cost",
  arrEq(PROFILE_FIELD_TO_DOMAINS.monthly_budget, ["banking", "housing", "cost"]),
);

// ---- 2. Diff helper ---------------------------------------------------

banner("2/4  diffProfileForDomains");

const baseProfile = {
  destination: "Sweden",
  target_city: "Stockholm",
  citizenship: "Philippines",
  purpose: "settle",
  prior_visa: "yes",
  pets: "none",
};

// Identical → no domains.
expect(
  "identical profiles → []",
  arrEq(diffProfileForDomains(baseProfile, baseProfile), []),
);

// destination change → wide blast.
const destChange = { ...baseProfile, destination: "Germany" };
const destDiff = diffProfileForDomains(baseProfile, destChange);
expect(
  "destination Sweden→Germany triggers full blast (≥6 domains)",
  destDiff.length >= 6,
  `got ${destDiff.length}: ${destDiff.join(", ")}`,
);
expect(
  "destination diff includes visa + housing + healthcare",
  ["visa", "housing", "healthcare"].every((d) => destDiff.includes(d as SpecialistDomain)),
);

// target_city change → housing + registration only.
const cityChange = { ...baseProfile, target_city: "Gothenburg" };
expect(
  "target_city Stockholm→Gothenburg triggers exactly [housing, registration]",
  arrEq(diffProfileForDomains(baseProfile, cityChange), ["housing", "registration"]),
  `got ${diffProfileForDomains(baseProfile, cityChange).join(", ")}`,
);

// New field added.
const addPets = { ...baseProfile, pets: "dog" } as Record<string, unknown>;
const noPets = { ...baseProfile, pets: undefined } as Record<string, unknown>;
expect(
  "adding pets value (undefined → 'dog') triggers [pet]",
  arrEq(diffProfileForDomains(noPets, addPets), ["pet"]),
);

// Field cleared.
expect(
  "clearing prior_visa triggers [visa]",
  arrEq(
    diffProfileForDomains(baseProfile, { ...baseProfile, prior_visa: undefined }),
    ["visa"],
  ),
);

// Unknown field never affects anything.
expect(
  "unknown field change → []",
  arrEq(
    diffProfileForDomains(
      { ...baseProfile, undocumented_field: "a" } as Record<string, unknown>,
      { ...baseProfile, undocumented_field: "b" } as Record<string, unknown>,
    ),
    [],
  ),
);

// Multiple changes → union, deduplicated.
const multiChange = {
  ...baseProfile,
  destination: "Germany",
  target_city: "Berlin",
  pets: "dog",
};
const multiDiff = diffProfileForDomains(baseProfile, multiChange);
expect(
  "multiple changes union without duplicates",
  multiDiff.length === new Set(multiDiff).size,
);
expect(
  "multiple changes diff is alphabetical",
  multiDiff.join(",") === [...multiDiff].sort().join(","),
);

// null vs undefined treated as equivalent (both "absent").
expect(
  "null vs undefined treated as same — no domains",
  arrEq(
    diffProfileForDomains(
      { ...baseProfile, monthly_budget: null } as Record<string, unknown>,
      { ...baseProfile, monthly_budget: undefined } as Record<string, unknown>,
    ),
    [],
  ),
);

// ---- 3. filterToImplementedDomains ------------------------------------

banner("3/4  filterToImplementedDomains");

const requested = [
  "registration",
  "banking",
  "documents",
  "housing",
  "healthcare",
  "visa", // not implemented
  "pet", // not implemented
] as SpecialistDomain[];
const partition = filterToImplementedDomains(requested, IMPLEMENTED_RESEARCHED_DOMAINS);
expect(
  "5 implemented domains pass",
  partition.runnable.length === 5 &&
    partition.runnable.every((d) => IMPLEMENTED_RESEARCHED_DOMAINS.has(d)),
);
expect(
  "visa + pet skipped",
  arrEq(partition.skipped, ["visa", "pet"]),
);

// ---- 4. End-to-end realistic scenario ---------------------------------

banner("4/4  Scenario: user changes city + adds spouse");

const before = {
  destination: "Sweden",
  target_city: "Stockholm",
  citizenship: "Philippines",
  purpose: "settle",
  spouse_joining: "no",
  monthly_budget: 5000,
};
const after = {
  ...before,
  target_city: "Gothenburg",
  spouse_joining: "yes",
};
const realDiff = diffProfileForDomains(before, after);
console.log(`affected domains: ${realDiff.join(", ")}`);
expect(
  "city change + spouse_joining gives ⊇ {housing, registration, visa, documents}",
  ["housing", "registration", "visa", "documents"].every((d) =>
    realDiff.includes(d as SpecialistDomain),
  ),
);
const partitioned = filterToImplementedDomains(realDiff, IMPLEMENTED_RESEARCHED_DOMAINS);
console.log(
  `runnable: ${partitioned.runnable.join(", ")} | skipped: ${partitioned.skipped.join(", ")}`,
);
expect(
  "visa skipped (no v2 yet)",
  partitioned.skipped.includes("visa"),
);
expect(
  "housing + registration + documents runnable",
  ["housing", "registration", "documents"].every((d) =>
    partitioned.runnable.includes(d as SpecialistDomain),
  ),
);

// ---- summary ----------------------------------------------------------

banner(passes === total ? `✅ ${passes}/${total} passed` : `❌ ${passes}/${total} passed`);
if (passes !== total) process.exit(1);
