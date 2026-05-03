import { Page } from "@playwright/test";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
export const SHOTS_DIR = path.join(REPO_ROOT, "artifacts/screenshots/phase-4");
export const REPORTS_DIR = path.join(REPO_ROOT, "artifacts/test-reports");

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  }
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

export async function captureUserId(page: Page): Promise<string | null> {
  const id = await page.evaluate(() => {
    try {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k || !k.startsWith("sb-") || !k.endsWith("-auth-token")) continue;
        const raw = window.localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const u = parsed?.user ?? parsed?.currentSession?.user;
        if (u?.id) return u.id as string;
      }
    } catch {}
    return null;
  });
  return id;
}

export async function cleanupUser(userId: string | null): Promise<void> {
  if (!userId) return;
  const a = admin();
  // Best-effort: delete domain rows scoped by user_id, then the user.
  // Tables that may not exist or may not have user_id will silently fail.
  const tables = [
    "agent_audit",
    "chat_messages",
    "guides",
    "agent_run_log",
    "artifacts",
    "documents",
    "relocation_plans",
  ];
  for (const t of tables) {
    try {
      await a.from(t).delete().eq("user_id", userId);
    } catch {
      /* ignore */
    }
  }
  try {
    await a.auth.admin.deleteUser(userId);
  } catch (err) {
    console.warn(`[cleanup] deleteUser(${userId}) failed:`, (err as Error).message);
  }
}

export async function takeShot(
  page: Page,
  slug: string,
  num: string,
  desc: string,
): Promise<string> {
  const dir = path.join(SHOTS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${num}-${desc}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

export async function HEAD(url: string): Promise<number> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.status >= 400) {
      // Some sites refuse HEAD; fall back to a tiny GET
      const res2 = await fetch(url, { method: "GET", redirect: "follow" });
      return res2.status;
    }
    return res.status;
  } catch {
    return 0;
  }
}

export function isWhitelisted(url: string, whitelist: string[]): boolean {
  try {
    const u = new URL(url);
    return whitelist.some((host) => u.hostname.endsWith(host));
  } catch {
    return false;
  }
}

// --- Gate report recorder ----------------------------------------------------

export interface PersonaResult {
  slug: string;
  label: string;
  userId: string | null;
  status: "pass" | "fail" | "partial" | "running";
  failures: string[];
  warnings: string[];
  questionsSeen: string[];
  duplicateQuestions: string[];
  extractedFields: string[];
  visibleCards: string[];
  hiddenCardsSeen: string[];
  citationsTotal: number;
  citationsOk: number;
  citationsBad: { url: string; status: number }[];
  citationsOffWhitelist: string[];
  agentsSeen: string[];
  auditPopover: { opened: boolean; sample: string | null };
  guideWordCount: number;
  guideSectionCount: number;
  timings: {
    firstTurnMs?: number;
    onboardingTotalMs?: number;
    researchMs?: number;
    dashboardLoadMs?: number;
  };
  screenshots: string[];
  consoleErrors: string[];
}

export class GateRecorder {
  results: PersonaResult[] = [];

  start(slug: string, label: string): PersonaResult {
    const r: PersonaResult = {
      slug,
      label,
      userId: null,
      status: "running",
      failures: [],
      warnings: [],
      questionsSeen: [],
      duplicateQuestions: [],
      extractedFields: [],
      visibleCards: [],
      hiddenCardsSeen: [],
      citationsTotal: 0,
      citationsOk: 0,
      citationsBad: [],
      citationsOffWhitelist: [],
      agentsSeen: [],
      auditPopover: { opened: false, sample: null },
      guideWordCount: 0,
      guideSectionCount: 0,
      timings: {},
      screenshots: [],
      consoleErrors: [],
    };
    this.results.push(r);
    return r;
  }

  finish(r: PersonaResult): void {
    r.status = r.failures.length === 0 ? "pass" : "fail";
  }

  write(file: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const lines: string[] = [];
    lines.push("# Phase 4 E2E Spine — Gate Report");
    lines.push("");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push("Mode: anonymous-only (Slice 3 simplified per user directive — permanent signup + criterion (o) anon→permanent upgrade are out of scope, will be tested post-launch).");
    lines.push("");
    lines.push("## Per-persona results");
    lines.push("");
    lines.push("| Persona | Status | (a) No repeats | (c) Extraction | (e) Specialists | (h) Cards | (i) Audit popover | (j+k) Guide+citations | (l) State transitions | (n) Anon flow |");
    lines.push("|---|---|---|---|---|---|---|---|---|---|");
    for (const r of this.results) {
      const sym = (ok: boolean) => (ok ? "✅" : "❌");
      const a = sym(r.duplicateQuestions.length === 0);
      const c = sym(r.extractedFields.length > 0 && !r.failures.some((f) => f.startsWith("(c)")));
      const e = sym(!r.failures.some((f) => f.startsWith("(e)")));
      const h = sym(!r.failures.some((f) => f.startsWith("(h)")));
      const i = sym(r.auditPopover.opened);
      const jk = sym(r.guideWordCount >= 100 || r.citationsOk > 0);
      const l = sym(!r.failures.some((f) => f.startsWith("(l)")));
      const n = sym(!r.failures.some((f) => f.startsWith("(n)")));
      lines.push(
        `| ${r.label} | ${r.status} | ${a} | ${c} | ${e} | ${h} | ${i} | ${jk} | ${l} | ${n} |`,
      );
    }

    for (const r of this.results) {
      lines.push("");
      lines.push(`## ${r.label}`);
      lines.push("");
      lines.push(`- **Status:** ${r.status}`);
      lines.push(`- **User id:** ${r.userId ?? "(not captured)"}`);
      lines.push("");
      lines.push("### Timings");
      lines.push("");
      lines.push(`- First-turn extraction: ${r.timings.firstTurnMs ?? "n/a"} ms (budget 8000)`);
      lines.push(`- Onboarding total: ${r.timings.onboardingTotalMs ?? "n/a"} ms`);
      lines.push(`- Research duration: ${r.timings.researchMs ?? "n/a"} ms (budget 90000)`);
      lines.push(`- Dashboard load: ${r.timings.dashboardLoadMs ?? "n/a"} ms (budget 3000)`);
      lines.push("");
      lines.push("### Questions seen");
      lines.push("");
      for (const q of r.questionsSeen) lines.push(`- ${q}`);
      if (r.duplicateQuestions.length > 0) {
        lines.push("");
        lines.push("**Duplicates:**");
        for (const d of r.duplicateQuestions) lines.push(`- ❌ ${d}`);
      }
      lines.push("");
      lines.push("### Extracted fields");
      lines.push("");
      lines.push(r.extractedFields.length > 0 ? r.extractedFields.join(", ") : "(none captured)");
      lines.push("");
      lines.push("### Dashboard cards visible");
      lines.push("");
      for (const c of r.visibleCards) lines.push(`- ${c}`);
      if (r.hiddenCardsSeen.length > 0) {
        lines.push("");
        lines.push("**Cards that should be hidden but appeared:**");
        for (const c of r.hiddenCardsSeen) lines.push(`- ❌ ${c}`);
      }
      lines.push("");
      lines.push("### Citations");
      lines.push("");
      lines.push(`- Total collected: ${r.citationsTotal}`);
      lines.push(`- HTTP 2xx: ${r.citationsOk}`);
      lines.push(`- HTTP 4xx/5xx/network: ${r.citationsBad.length}`);
      lines.push(`- Off whitelist: ${r.citationsOffWhitelist.length}`);
      if (r.citationsBad.length > 0) {
        lines.push("");
        lines.push("**Bad citation URLs:**");
        for (const b of r.citationsBad) lines.push(`- ${b.status}  ${b.url}`);
      }
      if (r.citationsOffWhitelist.length > 0) {
        lines.push("");
        lines.push("**Off-whitelist citation URLs:**");
        for (const u of r.citationsOffWhitelist) lines.push(`- ${u}`);
      }
      lines.push("");
      lines.push("### Audit popover");
      lines.push("");
      lines.push(`- Opened: ${r.auditPopover.opened}`);
      if (r.auditPopover.sample) {
        lines.push(`- Sample content: ${r.auditPopover.sample.slice(0, 200)}…`);
      }
      lines.push("");
      lines.push("### Guide");
      lines.push("");
      lines.push(`- Word count: ${r.guideWordCount}`);
      lines.push(`- Sections detected: ${r.guideSectionCount}`);
      lines.push("");
      lines.push("### Specialists seen");
      lines.push("");
      lines.push(r.agentsSeen.length > 0 ? r.agentsSeen.join(", ") : "(none observed via UI)");
      lines.push("");
      lines.push("### Failures");
      lines.push("");
      if (r.failures.length === 0) {
        lines.push("- None");
      } else {
        for (const f of r.failures) lines.push(`- ❌ ${f}`);
      }
      if (r.warnings.length > 0) {
        lines.push("");
        lines.push("### Warnings");
        lines.push("");
        for (const w of r.warnings) lines.push(`- ⚠ ${w}`);
      }
      if (r.consoleErrors.length > 0) {
        lines.push("");
        lines.push("### Browser console errors");
        lines.push("");
        for (const c of r.consoleErrors.slice(0, 20)) lines.push(`- ${c}`);
      }
      lines.push("");
      lines.push("### Screenshots");
      lines.push("");
      for (const s of r.screenshots) {
        const rel = path.relative(path.dirname(file), s);
        lines.push(`- ![${path.basename(s)}](${rel})`);
      }
    }

    lines.push("");
    lines.push("## Out-of-scope notes");
    lines.push("");
    lines.push("- Permanent signup mode (criterion 3b) — skipped per Slice 3 simplification.");
    lines.push("- Criterion (o) anon→permanent upgrade — skipped per Slice 3 simplification.");
    lines.push("- Criterion (m) re-run idempotency — only attempted for Axel if base flow passes.");

    fs.writeFileSync(file, lines.join("\n"), "utf-8");
  }
}
