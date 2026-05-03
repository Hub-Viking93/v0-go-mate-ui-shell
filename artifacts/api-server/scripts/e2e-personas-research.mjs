/**
 * Triggers visa + local-requirements research for every plan listed in
 * .local/e2e-personas-round1-report.json (one per persona).
 *
 * Research is persistent in the DB (per user direction), so this only needs
 * to run once per persona. Each call is sequential to avoid overloading the
 * pipeline. 504 timeouts are recorded but do not abort the run.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const API = process.env.API_BASE ?? "http://localhost:8080";
const ACCOUNT_EMAIL = process.env.PERSONA_ACCOUNT_EMAIL;
const ACCOUNT_PASSWORD = process.env.PERSONA_ACCOUNT_PASSWORD;
if (!ACCOUNT_EMAIL || !ACCOUNT_PASSWORD) {
  throw new Error("PERSONA_ACCOUNT_EMAIL + PERSONA_ACCOUNT_PASSWORD required");
}

const SUPA_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPA_ANON =
  process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_ANON) {
  throw new Error("SUPABASE_URL + SUPABASE_ANON_KEY required");
}

const supa = createClient(SUPA_URL, SUPA_ANON);
const auth = await supa.auth.signInWithPassword({
  email: ACCOUNT_EMAIL,
  password: ACCOUNT_PASSWORD,
});
if (auth.error) throw auth.error;
const TOKEN = auth.data.session.access_token;
console.log(`Signed in as ${auth.data.user.id}`);

const report = JSON.parse(
  readFileSync(".local/e2e-personas-round1-report.json", "utf8"),
);

const results = [];
for (let i = 0; i < report.length; i++) {
  const r = report[i];
  if (!r.planId) {
    results.push({ persona: r.persona, skip: "no-planId" });
    continue;
  }
  const planId = r.planId;
  console.log(`\n=== [${i + 1}/${report.length}] ${r.persona}`);
  console.log(`    planId=${planId.slice(0, 8)}`);

  // Visa research
  const t0 = Date.now();
  let visaOk = false,
    visaErr = null,
    visaMs = 0;
  try {
    const resp = await fetch(`${API}/api/research/visa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ planId }),
    });
    visaMs = Date.now() - t0;
    if (resp.ok) {
      visaOk = true;
      console.log(`    visa OK (${visaMs}ms)`);
    } else {
      visaErr = `${resp.status}: ${(await resp.text()).slice(0, 200)}`;
      console.log(`    visa FAILED (${visaMs}ms) ${visaErr}`);
    }
  } catch (err) {
    visaErr = err.message;
    visaMs = Date.now() - t0;
    console.log(`    visa CRASH (${visaMs}ms) ${visaErr}`);
  }

  // Local-requirements research
  const t1 = Date.now();
  let lrOk = false,
    lrErr = null,
    lrMs = 0;
  try {
    const resp = await fetch(`${API}/api/research/local-requirements`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ planId }),
    });
    lrMs = Date.now() - t1;
    if (resp.ok) {
      lrOk = true;
      console.log(`    local-req OK (${lrMs}ms)`);
    } else {
      lrErr = `${resp.status}: ${(await resp.text()).slice(0, 200)}`;
      console.log(`    local-req FAILED (${lrMs}ms) ${lrErr}`);
    }
  } catch (err) {
    lrErr = err.message;
    lrMs = Date.now() - t1;
    console.log(`    local-req CRASH (${lrMs}ms) ${lrErr}`);
  }

  results.push({
    persona: r.persona,
    planId,
    visaOk,
    visaErr,
    visaMs,
    lrOk,
    lrErr,
    lrMs,
  });
}

console.log("\n========== RESEARCH SUMMARY ==========");
let pass = 0;
for (const r of results) {
  const icon = r.visaOk && r.lrOk ? "✓" : "✗";
  console.log(
    `${icon} ${r.persona}  visa=${r.visaOk ? "ok" : "FAIL"}  lr=${r.lrOk ? "ok" : "FAIL"}`,
  );
  if (r.visaErr) console.log(`    visa: ${r.visaErr}`);
  if (r.lrErr) console.log(`    lr:   ${r.lrErr}`);
  if (r.visaOk && r.lrOk) pass++;
}
console.log(`\nFINAL: ${pass}/${results.length} personas with both cards`);

writeFileSync(
  ".local/e2e-personas-research-report.json",
  JSON.stringify(results, null, 2),
);
console.log("Detailed report → .local/e2e-personas-research-report.json");
