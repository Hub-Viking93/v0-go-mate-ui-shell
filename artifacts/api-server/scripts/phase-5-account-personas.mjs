#!/usr/bin/env node
// Phase 5: run all 4 personas as plans under a SINGLE real account.
// Each persona becomes its own plan — visible in the user's plan switcher.
//
// Auth: signInWithPassword (email/password from env). No service-role key
// needed at runtime; we just use a normal anon session.
//
// Usage:
//   ACCOUNT_EMAIL=foo@bar ACCOUNT_PASSWORD=xxx \
//     node artifacts/api-server/scripts/phase-5-account-personas.mjs [persona|all]

import { createClient } from "@supabase/supabase-js";

const API_BASE = process.env.API_BASE ?? "http://localhost:8080/api";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const ACCOUNT_EMAIL = process.env.ACCOUNT_EMAIL;
const ACCOUNT_PASSWORD = process.env.ACCOUNT_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars.");
  process.exit(2);
}
if (!ACCOUNT_EMAIL || !ACCOUNT_PASSWORD) {
  console.error("Missing ACCOUNT_EMAIL / ACCOUNT_PASSWORD env vars.");
  process.exit(2);
}

// ---- Reuse persona config from phase-4 driver. ----
const { PERSONAS, answerFor } = await import("./phase-4-personas.mjs");

function fmtDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

async function signIn() {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({
    email: ACCOUNT_EMAIL,
    password: ACCOUNT_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`signIn failed: ${error?.message ?? "no session"}`);
  }
  return {
    userId: data.user.id,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

async function createPlan(accessToken) {
  const r = await fetch(`${API_BASE}/plans`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`POST /plans ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.plan;
}

async function setPlanTitle(accessToken, planId, title) {
  // No PATCH for title in routes/plans.ts — direct DB update would need
  // service role. Cheap alternative: rely on the auto-derived title from
  // profile_data.destination once that field is filled.
  // (No-op here; left as a hook in case we add a /plans/:id/title route.)
}

async function chatTurn(accessToken, messages) {
  const r = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messages }),
  });
  if (!r.ok) throw new Error(`/api/chat ${r.status}: ${await r.text()}`);

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let assistantText = "";
  let metadata = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nlIdx;
    while ((nlIdx = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, nlIdx);
      buf = buf.slice(nlIdx + 2);
      const dataLines = block
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6));
      if (!dataLines.length) continue;
      const payload = dataLines.join("\n");
      if (payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.type === "text-delta" && typeof ev.delta === "string") {
          assistantText += ev.delta;
        } else if (ev.type === "message-end" && ev.metadata) {
          metadata = ev.metadata;
        }
      } catch {}
    }
  }

  return { assistantText: assistantText.trim(), metadata };
}

async function runPersonaAsPlan(slug, accessToken) {
  const persona = PERSONAS[slug];
  const result = {
    slug,
    label: persona.label,
    planId: null,
    pass: false,
    onboardingCompleted: false,
    turns: 0,
    finalProfile: null,
    finalFilledFields: [],
    failures: [],
    durationMs: 0,
  };

  const t0 = Date.now();
  console.log(`\n========== ${persona.label} (${slug}) ==========`);

  // 1. Create a new plan (becomes current automatically).
  let plan;
  try {
    plan = await createPlan(accessToken);
    result.planId = plan.id;
    console.log(`[plan] created ${plan.id}`);
  } catch (e) {
    result.failures.push(`createPlan: ${e.message}`);
    return result;
  }

  // 2. Conversation loop — chat.ts always targets is_current plan, which
  //    is now this freshly-created one.
  const history = [{ role: "user", content: persona.opener }];
  const MAX_TURNS = 30;

  while (result.turns < MAX_TURNS) {
    let turn;
    const turnStart = Date.now();
    try {
      turn = await chatTurn(accessToken, history);
    } catch (e) {
      result.failures.push(`chatTurn t=${result.turns}: ${e.message}`);
      break;
    }
    const turnMs = Date.now() - turnStart;
    result.turns++;

    const q = turn.assistantText || "(empty)";
    console.log(
      `[t${result.turns}] ${fmtDuration(turnMs)}  filled=${turn.metadata?.filledFields?.length ?? "?"}  pending=${turn.metadata?.pendingField ?? "?"}  complete=${turn.metadata?.onboardingCompleted ?? false}`,
    );
    console.log(`     Q: ${q.slice(0, 80).replace(/\s+/g, " ")}${q.length > 80 ? "…" : ""}`);

    history.push({ role: "assistant", content: turn.assistantText });

    if (turn.metadata?.onboardingCompleted || turn.metadata?.planLocked) {
      result.onboardingCompleted = !!turn.metadata.onboardingCompleted;
      result.finalProfile = turn.metadata.profile ?? null;
      result.finalFilledFields = turn.metadata.filledFields ?? [];
      console.log(`[done] complete at turn ${result.turns}`);
      break;
    }

    const ans = answerFor(persona, turn.assistantText);
    console.log(`     A: ${ans.slice(0, 80)}${ans.length > 80 ? "…" : ""}`);
    history.push({ role: "user", content: ans });
  }

  result.durationMs = Date.now() - t0;
  result.pass =
    result.onboardingCompleted && result.failures.length === 0;
  console.log(
    `[result] ${result.pass ? "✅" : "❌"} turns=${result.turns} total=${fmtDuration(result.durationMs)} filled=${result.finalFilledFields.length}`,
  );
  return result;
}

async function main() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const slugs =
    !arg || arg === "all"
      ? ["roselle", "axel", "priya", "stevenson"]
      : [arg];

  console.log(`[auth] signing in as ${ACCOUNT_EMAIL}`);
  const session = await signIn();
  console.log(`[auth] userId=${session.userId}`);

  const results = [];
  for (const slug of slugs) {
    results.push(await runPersonaAsPlan(slug, session.accessToken));
  }

  console.log("\n========== SUMMARY ==========");
  for (const r of results) {
    console.log(
      `${r.pass ? "✅" : "❌"} ${r.slug.padEnd(11)} plan=${r.planId ?? "—"} turns=${String(r.turns).padStart(2)} filled=${r.finalFilledFields.length} fail=${r.failures.length}`,
    );
  }

  const fs = await import("node:fs/promises");
  const reportPath =
    "/home/runner/workspace/artifacts/test-reports/phase-5-account-results.json";
  await fs.writeFile(
    reportPath,
    JSON.stringify({ userId: session.userId, results }, null, 2),
  );
  console.log(`\nReport: ${reportPath}`);

  process.exit(results.every((r) => r.pass) ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(2);
});
