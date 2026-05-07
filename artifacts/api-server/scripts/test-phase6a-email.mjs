// Phase 6A — end-to-end live email test.
//
// Sets up an overdue task on the test user's plan, fires a scheduler tick
// (which dispatches via the email dispatcher in `live` mode given the
// RESEND_API_KEY + EMAIL_FROM env), and inspects the audit ledger.
// Restores the plan to its prior state on exit.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const API_BASE = process.env.API_BASE ?? "http://localhost:3002";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TEST_EMAIL || !TEST_PASSWORD) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / TEST_EMAIL / TEST_PASSWORD");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function log(label, obj) {
  console.log(`\n[${label}]`, typeof obj === "string" ? obj : JSON.stringify(obj, null, 2));
}

async function resolveUser() {
  for (let p = 1; p <= 50; p++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: p, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === TEST_EMAIL.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) break;
  }
  throw new Error(`Test user ${TEST_EMAIL} not found`);
}

async function getJwt() {
  // Sign in via the public anon endpoint to get a real user JWT for the
  // auth-gated /scheduler-tick endpoint.
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Sign-in failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.access_token;
}

const DAY = 24 * 60 * 60 * 1000;
const overdueIso = new Date(Date.now() - 5 * DAY).toISOString();

async function main() {
  const user = await resolveUser();
  log("User resolved", { id: user.id, email: user.email });

  const { data: plan } = await admin
    .from("relocation_plans")
    .select("id, stage, arrival_date, profile_data, research_meta")
    .eq("user_id", user.id)
    .eq("is_current", true)
    .maybeSingle();
  if (!plan) throw new Error("Test user has no active plan");
  log("Plan", { id: plan.id, stage: plan.stage });

  // Snapshot prior state so we can restore.
  const prior = {
    stage: plan.stage,
    arrival_date: plan.arrival_date,
    profile_data: plan.profile_data ?? {},
    research_meta: plan.research_meta ?? {},
  };

  // ---- 1. Snapshot existing settling-in tasks + delivery ledger length ---
  const { data: priorSettlingTasks } = await admin
    .from("settling_in_tasks")
    .select("id")
    .eq("plan_id", plan.id);
  const priorTaskIds = new Set((priorSettlingTasks ?? []).map((r) => r.id));

  const priorDeliveryLen = Array.isArray(prior.research_meta.notification_deliveries)
    ? prior.research_meta.notification_deliveries.length
    : 0;

  log("Prior state", {
    settling_tasks: priorTaskIds.size,
    notification_deliveries_len: priorDeliveryLen,
  });

  try {
    // ---- 2. Insert a fixture overdue settling-in task -------------------
    const taskKey = `phase6a-fixture-${Date.now()}`;
    const insertRes = await admin.from("settling_in_tasks").insert({
      user_id: user.id,
      plan_id: plan.id,
      task_key: taskKey,
      title: "Phase 6A live-email fixture (overdue)",
      description: "Test fixture — overdue 5 days. Should trigger an email.",
      category: "registration",
      depends_on: [],
      deadline_days: -5,
      deadline_at: overdueIso,
      is_legal_requirement: false,
      deadline_type: "practical",
      steps: [],
      documents_needed: [],
      official_link: null,
      estimated_time: "30 minutes",
      cost: "Free",
      status: "available",
      sort_order: 0,
      walkthrough: null,
    });
    if (insertRes.error) throw insertRes.error;
    log("Inserted overdue task fixture", { taskKey });

    // ---- 3. Fire scheduler tick via the API -----------------------------
    const jwt = await getJwt();
    const tickRes = await fetch(`${API_BASE}/api/notifications/scheduler-tick`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!tickRes.ok) {
      throw new Error(`scheduler-tick failed: ${tickRes.status} ${await tickRes.text()}`);
    }
    const tickBody = await tickRes.json();
    log("Scheduler tick stats", tickBody.stats);

    // ---- 4. Read back research_meta.notification_deliveries -------------
    const { data: refreshed } = await admin
      .from("relocation_plans")
      .select("research_meta")
      .eq("id", plan.id)
      .single();
    const meta = refreshed?.research_meta ?? {};
    const deliveries = meta.notification_deliveries ?? [];
    const newAttempts = deliveries.slice(priorDeliveryLen);

    log("New dispatch attempts in audit ledger", newAttempts);

    const liveSent = newAttempts.filter(
      (d) => d.channel === "email" && d.mode === "live" && d.outcome === "sent",
    );
    const errored = newAttempts.filter((d) => d.outcome === "error");

    if (liveSent.length > 0) {
      log("✅ PASS — at least one live email sent", liveSent[0]);
    } else if (errored.length > 0) {
      log("❌ FAIL — dispatch attempt(s) errored", errored);
      process.exitCode = 1;
    } else {
      log("⚠️  No new dispatch attempts in ledger", { newAttempts });
      process.exitCode = 1;
    }

    // Show a snapshot of notifications too
    const notifs = (meta.notifications ?? []).filter((n) =>
      n.dedupeKey?.startsWith(`deadline_overdue:${taskKey}`),
    );
    log("Matching notifications stored", notifs.map((n) => ({
      id: n.id,
      title: n.title,
      severity: n.severity,
      channel: n.channel,
      delivery: n.delivery,
    })));
  } finally {
    // ---- 5. Cleanup -----------------------------------------------------
    // Remove the fixture task
    const { data: leftoverTasks } = await admin
      .from("settling_in_tasks")
      .select("id, task_key")
      .eq("plan_id", plan.id);
    const fixtureTaskIds = (leftoverTasks ?? [])
      .filter((r) => !priorTaskIds.has(r.id))
      .map((r) => r.id);
    if (fixtureTaskIds.length > 0) {
      await admin.from("settling_in_tasks").delete().in("id", fixtureTaskIds);
      log("Cleanup", `Removed ${fixtureTaskIds.length} fixture task(s)`);
    }

    // Restore prior research_meta exactly so we don't leave the live-sent
    // notification + delivery in the user's ledger across runs.
    await admin
      .from("relocation_plans")
      .update({
        stage: prior.stage,
        arrival_date: prior.arrival_date,
        profile_data: prior.profile_data,
        research_meta: prior.research_meta,
      })
      .eq("id", plan.id);
    log("Cleanup", "Restored plan to prior state");
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
