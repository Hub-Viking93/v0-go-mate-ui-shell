#!/usr/bin/env node
// Phase 4 backend-only persona driver. Bypasses Playwright + browser.
// Drives /api/chat directly via SSE, verifies onboarding-complete signal
// from the orchestrator, then optionally triggers research.
//
// Usage:
//   node artifacts/api-server/scripts/phase-4-backend-driver.mjs <persona-slug>
//   node artifacts/api-server/scripts/phase-4-backend-driver.mjs all

import { createClient } from "@supabase/supabase-js";

const API_BASE = process.env.API_BASE ?? "http://localhost:8080/api";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(2);
}

// ---------------- Personas ----------------
// Mirrors artifacts/gomate/e2e/personas.ts but trimmed to just bundled +
// followUps + defaultAnswer (the bits the orchestrator actually sees).

// Personas now answer questions ONE FIELD AT A TIME, like a real user.
// The opener is a minimal greeting — no field-bundling. This avoids the
// extractor getting confused by multiple fields in one message and matches
// the natural conversation flow the orchestrator was designed for.
//
// `nameAnswer` is matched first (against the very first onboarding question
// "What's your name?"). All other answers are concise single-field replies.

const PERSONAS = {
  roselle: {
    label: "Roselle (Filipino → Sweden sambo)",
    opener: "Hi, I want help planning a relocation.",
    nameAnswer: "Roselle",
    followUps: [
      [/name/i, "Roselle"],
      [/passport|citizen|nationality|where.*you.*from|country.*origin|country.*birth|home country|original.*country|find.*right.*visa|determine.*visa/i, "Filipino"],
      [/destination|moving to|where.*moving|relocating to|target country|new country|which country|where.*planning.*move/i, "Sweden"],
      [/which city|target city|what city|specific city|city.*moving|city.*plan|where in sweden|where in.*sweden/i, "Stockholm"],
      [/current.*location|currently.*living|currently.*based|where.*living now|right now|where.*reside|where.*based/i, "Manila, Philippines"],
      [/purpose|reason.*move|why.*moving|why.*relocat|main.*reason/i, "To live with my Swedish partner Anders"],
      [/visa.*type|which visa|sambo/i, "Sambo (cohabitation) visa"],
      [/income|salary|earn|make.*money|monthly.*pay/i, "3500 USD per month freelance"],
      [/savings|saved|bank/i, "15000 USD"],
      [/arrive|when.*move|when.*plan|move.*date|arrival/i, "About 30 days"],
      [/language|swedish|speak/i, "Beginner Swedish, fluent English"],
      [/job|work|employment|profession|field|industry/i, "Freelance designer"],
      [/pet|dog|cat/i, "No pets"],
      [/family|spouse|partner|kid|children|alone|relocating with/i, "Solo, my partner Anders is already in Sweden"],
      [/housing|where.*live|accommodation/i, "Will live with Anders in Stockholm"],
    ],
    defaultAnswer: "Could you rephrase that? I'm not sure what you're asking.",
  },
  axel: {
    label: "Axel (German posting → Sweden, family)",
    opener: "Hi, I need help relocating.",
    nameAnswer: "Axel",
    followUps: [
      [/name/i, "Axel"],
      [/passport|citizen|nationality|where.*you.*from|country.*origin|country.*birth|home country|original.*country|find.*right.*visa|determine.*visa/i, "German"],
      [/destination|moving to|where.*moving|relocating to|target country|new country|which country|where.*planning.*move/i, "Sweden"],
      [/which city|target city|what city|specific city|city.*moving|city.*plan|where in sweden|where in.*sweden/i, "Stockholm"],
      [/current.*location|currently.*living|currently.*based|where.*living now|right now|where.*reside|where.*based/i, "Munich, Germany"],
      [/purpose|reason.*move|why.*moving|why.*relocat|main.*reason/i, "Work — 14-month posting with my employer Siemens"],
      [/visa.*type|which visa|posting|work permit/i, "Intra-company work posting permit"],
      [/employer|company|who.*sponsor|who.*sending/i, "Siemens"],
      [/job.*field|industry|profession|sector|line.*work/i, "Engineering"],
      [/income|salary|earn|make/i, "8500 EUR per month"],
      [/duration|how long|stay/i, "14 months"],
      [/arrive|when.*move|when.*plan|arrival/i, "About 60 days"],
      [/family|spouse|partner|kid|children|alone|relocating with/i, "Wife Emma and two kids (ages 5 and 8)"],
      [/pet|dog|cat/i, "No pets"],
      [/language|swedish|speak/i, "Fluent English, basic Swedish"],
      [/housing|where.*live|accommodation/i, "Company-arranged furnished apartment"],
    ],
    defaultAnswer: "Could you rephrase that? I'm not sure what you're asking.",
  },
  priya: {
    label: "Priya (US → Spain, digital nomad, solo)",
    opener: "Hi, I'd like help with a relocation.",
    nameAnswer: "Priya",
    followUps: [
      [/name/i, "Priya"],
      [/passport|citizen|nationality|where.*you.*from|country.*origin|country.*birth|home country|original.*country|find.*right.*visa|determine.*visa/i, "American"],
      [/destination|moving to|where.*moving|relocating to|target country|new country|which country|where.*planning.*move/i, "Spain"],
      [/which city|target city|what city|specific city|city.*moving|city.*plan|where in spain|where in.*spain/i, "Barcelona"],
      [/current.*location|currently.*living|currently.*based|where.*living now|right now|where.*reside|where.*based/i, "San Francisco, USA"],
      [/purpose|reason.*move|why.*moving|why.*relocat|main.*reason/i, "Lifestyle — working remotely from Spain"],
      [/visa.*type|which visa|nomad/i, "Spanish digital nomad visa"],
      [/employer|company|who.*work/i, "Stripe (US, fully remote)"],
      [/job.*field|industry|profession|sector|line.*work/i, "Software engineering"],
      [/income.*consist|steady|stable.*income|long.*employ/i, "Steady — same employer for 4 years"],
      [/income|salary|earn|make/i, "14000 USD per month"],
      [/savings|saved|bank/i, "80000 USD"],
      [/arrive|when.*move|when.*plan|arrival/i, "About 90 days"],
      [/language|spanish|speak/i, "Beginner Spanish, native English"],
      [/family|spouse|partner|kid|children|alone|relocating with/i, "Solo, no family"],
      [/pet|dog|cat/i, "No pets"],
      [/housing|where.*live|accommodation/i, "Will rent in the Eixample district"],
    ],
    defaultAnswer: "Could you rephrase that? I'm not sure what you're asking.",
  },
  stevenson: {
    label: "Stevenson family (UK → Australia + dog)",
    opener: "Hello, our family needs help with a relocation.",
    nameAnswer: "James Stevenson",
    followUps: [
      [/name/i, "James Stevenson"],
      [/passport|citizen|nationality|where.*you.*from|country.*origin|country.*birth|home country|original.*country|find.*right.*visa|determine.*visa/i, "British"],
      [/destination|moving to|where.*moving|relocating to|target country|new country|which country|where.*planning.*move/i, "Australia"],
      [/which city|target city|what city|specific city|city.*moving|city.*plan|where in australia|where in.*australia/i, "Melbourne"],
      [/current.*location|currently.*living|currently.*based|where.*living now|right now|where.*reside|where.*based/i, "Manchester, UK"],
      [/purpose|reason.*move|why.*moving|why.*relocat|main.*reason/i, "Work — new job at Atlassian"],
      [/visa.*type|which visa|482/i, "Subclass 482 employer-sponsored work visa"],
      [/employer|company|who.*sponsor|atlassian/i, "Atlassian"],
      [/job.*field|industry|profession|sector|line.*work/i, "Software"],
      [/income|salary|earn|make/i, "180000 AUD per year"],
      [/savings|saved|bank/i, "120000 GBP"],
      [/arrive|when.*move|when.*plan|arrival/i, "About 90 days"],
      [/spouse|wife|partner.*work|emma.*work|emma.*career/i, "Emma is a registered nurse"],
      [/family|partner|kid|children|alone|relocating with/i, "Wife Emma, two kids (ages 7 and 10), and our Border Collie"],
      [/pet.*type|what.*pet|breed|dog.*type/i, "5-year-old Border Collie"],
      [/pet.*vacc|vaccination|dog.*health|rabies/i, "All current including rabies"],
      [/pet|dog|cat/i, "Yes — one Border Collie"],
      [/school.*type|public.*school|private.*school|kids.*school/i, "Public school"],
      [/language|english|speak/i, "Native English"],
      [/housing|where.*live|accommodation/i, "Will rent a family home in a Melbourne suburb"],
    ],
    defaultAnswer: "Could you rephrase that? I'm not sure what you're asking.",
  },
};

// ---------------- Helpers ----------------

function answerFor(persona, question) {
  for (const [re, ans] of persona.followUps) {
    if (re.test(question)) return ans;
  }
  return persona.defaultAnswer;
}

async function createAnonUser() {
  // Create a fresh anonymous user via supabase admin API.
  // signInAnonymously() doesn't work server-side without browser refs,
  // so we use the admin createUser path with a random email-less is_anonymous.
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.session) {
    throw new Error(`signInAnonymously failed: ${error?.message ?? "no session"}`);
  }
  return {
    userId: data.user.id,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

async function ensurePlan(accessToken) {
  // GET /api/profile auto-creates a plan if none exists.
  const r = await fetch(`${API_BASE}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`/api/profile ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.plan;
}

async function chatTurn(accessToken, messages) {
  // Stream SSE response. Returns { assistantText, onboardingCompleted, profile, pendingField, filledFields, planLocked }.
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
  let mascotEvents = [];

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
        } else if (ev.type === "mascot") {
          mascotEvents.push(ev);
        }
      } catch {
        // ignore malformed event
      }
    }
  }

  return { assistantText: assistantText.trim(), metadata, mascotEvents };
}

function fmtDuration(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------- Main flow ----------------

async function runPersona(slug) {
  const persona = PERSONAS[slug];
  if (!persona) throw new Error(`unknown persona: ${slug}`);

  const result = {
    slug,
    label: persona.label,
    userId: null,
    pass: false,
    onboardingCompleted: false,
    planLocked: false,
    timings: { total: 0, firstTurn: 0, perTurn: [] },
    turns: 0,
    questionsAsked: [],
    duplicateQuestions: [],
    finalProfile: null,
    finalFilledFields: [],
    failures: [],
  };

  const t0 = Date.now();
  console.log(`\n========== ${persona.label} (${slug}) ==========`);

  // 1. Create anon user.
  let session = null;
  try {
    session = await createAnonUser();
    result.userId = session.userId;
    console.log(`[user] ${session.userId}`);
  } catch (e) {
    result.failures.push(`createAnonUser: ${e.message}`);
    return { result, session: null };
  }

  // 2. Ensure plan exists.
  try {
    const plan = await ensurePlan(session.accessToken);
    console.log(`[plan] ${plan.id} stage=${plan.stage} locked=${plan.locked}`);
  } catch (e) {
    result.failures.push(`ensurePlan: ${e.message}`);
    return { result, session };
  }

  // 3. Conversation loop.
  const history = [{ role: "user", content: persona.opener }];
  const MAX_TURNS = 30;

  while (result.turns < MAX_TURNS) {
    const turnStart = Date.now();
    let turn;
    try {
      turn = await chatTurn(session.accessToken, history);
    } catch (e) {
      result.failures.push(`chatTurn turn=${result.turns}: ${e.message}`);
      break;
    }
    const turnMs = Date.now() - turnStart;
    result.timings.perTurn.push(turnMs);
    if (result.turns === 0) result.timings.firstTurn = turnMs;
    result.turns++;

    const q = turn.assistantText || "(empty)";
    const qShort = q.slice(0, 80).replace(/\s+/g, " ");
    console.log(`[t${result.turns}] ${fmtDuration(turnMs)}  filled=${turn.metadata?.filledFields?.length ?? "?"}  pending=${turn.metadata?.pendingField ?? "?"}  complete=${turn.metadata?.onboardingCompleted ?? false}`);
    console.log(`     Q: ${qShort}${q.length > 80 ? "…" : ""}`);

    if (result.questionsAsked.includes(q) && q !== "(empty)") {
      result.duplicateQuestions.push(q);
      result.failures.push(`duplicate question at turn ${result.turns}: "${qShort}"`);
    }
    result.questionsAsked.push(q);

    history.push({ role: "assistant", content: turn.assistantText });

    if (turn.metadata?.onboardingCompleted || turn.metadata?.planLocked) {
      result.onboardingCompleted = !!turn.metadata.onboardingCompleted;
      result.planLocked = !!turn.metadata.planLocked;
      result.finalProfile = turn.metadata.profile ?? null;
      result.finalFilledFields = turn.metadata.filledFields ?? [];
      console.log(`[done] onboarding complete at turn ${result.turns}`);
      break;
    }

    // Generate next user answer.
    const ans = answerFor(persona, turn.assistantText);
    console.log(`     A: ${ans.slice(0, 80)}${ans.length > 80 ? "…" : ""}`);
    history.push({ role: "user", content: ans });
  }

  result.timings.total = Date.now() - t0;
  result.pass =
    result.onboardingCompleted &&
    result.failures.length === 0;

  console.log(
    `[result] ${result.pass ? "✅ PASS" : "❌ FAIL"}  turns=${result.turns}  total=${fmtDuration(result.timings.total)}  filledFields=${result.finalFilledFields.length}  failures=${result.failures.length}`,
  );

  return { result, session };
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
  const append = flags.has("--append");
  const arg = args[0];
  const slugs =
    !arg || arg === "all"
      ? ["roselle", "axel", "priya", "stevenson"]
      : [arg];

  const fs = await import("node:fs/promises");
  const reportPath = "/home/runner/workspace/artifacts/test-reports/phase-4-backend-results.json";
  const sessionsPath = "/home/runner/workspace/artifacts/test-reports/phase-4-sessions.json";

  // Load existing report if appending.
  let results = [];
  let sessions = {};
  if (append) {
    try {
      results = JSON.parse(await fs.readFile(reportPath, "utf8"));
    } catch {}
    try {
      sessions = JSON.parse(await fs.readFile(sessionsPath, "utf8"));
    } catch {}
  }

  for (const slug of slugs) {
    results = results.filter((r) => r.slug !== slug);
    const { result: r, session } = await runPersona(slug);
    results.push(r);
    if (session) {
      sessions[slug] = { ...session };
    }
  }

  console.log("\n========== SUMMARY ==========");
  for (const r of results) {
    console.log(
      `${r.pass ? "✅" : "❌"}  ${r.slug.padEnd(11)}  turns=${String(r.turns).padStart(2)}  total=${fmtDuration(r.timings.total).padStart(6)}  filled=${String(r.finalFilledFields.length).padStart(2)}  failures=${r.failures.length}`,
    );
  }

  await fs.writeFile(reportPath, JSON.stringify(results, null, 2));
  await fs.writeFile(sessionsPath, JSON.stringify(sessions, null, 2));
  console.log(`\nReport written to ${reportPath}`);
  console.log(`Sessions written to ${sessionsPath}`);

  const allPass = results.every((r) => r.pass);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(2);
});
