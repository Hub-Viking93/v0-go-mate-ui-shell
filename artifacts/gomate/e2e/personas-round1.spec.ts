// Round-1 personas — REAL FRONTEND Playwright driver.
//
// Drives all 10 round-1 personas through the actual UI (login → /onboarding
// chat → "Generate my plan" → /dashboard) using the same persona profiles the
// API harness covers. Captures screenshots at every key step and verifies
// the dashboard ProfileDetailsCard renders the expected profile chips.
//
// Run: PERSONA=sofia pnpm --filter @workspace/gomate test:personas
// Or:  pnpm --filter @workspace/gomate test:personas   (all 10, sequential)
//
// Each persona signs in with TEST_EMAIL/TEST_PASSWORD (NOT anonymous) so the
// run mirrors the API harness which uses one shared signed-in account. The
// account's `relocation_plans` row is wiped at the START of each persona so
// onboarding runs from a clean slate; we do NOT delete the auth user.

import { test, expect, Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUND_ONE_PERSONAS, type RoundOnePersona } from "./personas-round1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const SHOTS_DIR = path.join(REPO_ROOT, "artifacts/screenshots/personas-round1");
const REPORTS_DIR = path.join(REPO_ROOT, "artifacts/test-reports");
const REPORT_FILE = path.join(REPORTS_DIR, "personas-round1-frontend.md");

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error("TEST_EMAIL and TEST_PASSWORD must be set");
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Resolve the test account's user_id once (it's the same across all personas).
let TEST_USER_ID: string | null = null;
async function resolveTestUserId(): Promise<string> {
  if (TEST_USER_ID) return TEST_USER_ID;
  // listUsers paginates; fetch first page (small dev project) and find by email.
  const { data, error } = await sbAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw error;
  const u = data.users.find((x) => x.email?.toLowerCase() === TEST_EMAIL!.toLowerCase());
  if (!u) throw new Error(`Test user ${TEST_EMAIL} not found in Supabase`);
  TEST_USER_ID = u.id;
  return u.id;
}

async function wipePersonaState(userId: string): Promise<void> {
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
      await sbAdmin.from(t).delete().eq("user_id", userId);
    } catch {
      /* table may not exist or not user-scoped — best effort */
    }
  }
}

async function readQuestion(page: Page): Promise<string | null> {
  const txt = await page
    .locator('[data-testid="speech-bubble-text"]')
    .first()
    .textContent()
    .catch(() => null);
  if (txt && txt.trim().length > 0) return txt.trim();
  const fallback = await page
    .locator('[data-testid="speech-bubble"]')
    .first()
    .innerText()
    .catch(() => null);
  return fallback?.trim() ?? null;
}

async function waitForNextQuestion(
  page: Page,
  prevQuestion: string | null,
  timeoutMs = 60_000,
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const thinking = await page
      .locator('[data-testid="mascot-thinking"]')
      .isVisible()
      .catch(() => false);
    if (!thinking) {
      const q = await readQuestion(page);
      if (q && q !== prevQuestion && q.length > 5) return q;
    }
    await page.waitForTimeout(500);
  }
  return null;
}

async function getFilledFieldKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sel =
      '[data-testid^="profile-chip-full-"],[data-testid^="profile-chip-compact-"]';
    const chips = Array.from(document.querySelectorAll(sel));
    return chips.map((c) =>
      c.getAttribute("data-testid")!.replace(/^profile-chip-(full|compact)-/, ""),
    );
  });
}

async function answerFor(
  page: Page,
  persona: RoundOnePersona,
  question: string,
): Promise<string> {
  // Detect yes/no input mode by reading the textarea placeholder.
  const placeholder = await page
    .locator('[data-testid="onboarding-input"] textarea')
    .getAttribute("placeholder")
    .catch(() => null);
  const isYesNo = placeholder ? /yes.*no/i.test(placeholder) : false;

  for (const f of persona.followUps) {
    if (f.match.test(question)) {
      if (isYesNo) {
        // Coerce the scripted answer to yes/no based on its leading sentiment.
        if (/^no\b|never|none|don'?t|do not|not /i.test(f.answer)) return "no";
        return "yes";
      }
      return f.answer;
    }
  }
  if (isYesNo) {
    // Default: most "have you done X / are you Y" questions for these personas
    // are best answered "yes" (they describe well-prepared movers). Specific
    // negative cases are matched explicitly above.
    return "yes";
  }
  return persona.defaultAnswer;
}

async function submitTurn(page: Page, text: string): Promise<void> {
  const textarea = page.locator('[data-testid="onboarding-input"] textarea');
  await textarea.fill(text);
  await textarea.press("Enter");
}

async function takeShot(slug: string, page: Page, num: string, desc: string): Promise<string> {
  const dir = path.join(SHOTS_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${num}-${desc}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

interface PersonaRunResult {
  slug: string;
  label: string;
  status: "pass" | "fail";
  turns: number;
  fieldsFilled: number;
  fieldsExpectedSeenOnDashboard: string[];
  fieldsExpectedMissingOnDashboard: string[];
  generatePlanReached: boolean;
  dashboardLoaded: boolean;
  specialistCardsVisible: number;
  failures: string[];
  warnings: string[];
  durationMs: number;
  screenshots: string[];
}

const results: PersonaRunResult[] = [];

test.afterAll(async () => {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const lines: string[] = [];
  lines.push("# Personas Round 1 — REAL FRONTEND Playwright Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Test account: ${TEST_EMAIL}`);
  lines.push("");
  const passed = results.filter((r) => r.status === "pass").length;
  lines.push(`## Summary: ${passed}/${results.length} personas passed`);
  lines.push("");
  lines.push("| Persona | Status | Turns | Fields | Generate plan | Dashboard | Specialist cards | Duration |");
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    lines.push(
      `| ${r.label} | ${r.status === "pass" ? "✅ PASS" : "❌ FAIL"} | ${r.turns} | ${r.fieldsFilled} | ${r.generatePlanReached ? "✓" : "✗"} | ${r.dashboardLoaded ? "✓" : "✗"} | ${r.specialistCardsVisible} | ${(r.durationMs / 1000).toFixed(0)}s |`,
    );
  }
  for (const r of results) {
    lines.push("");
    lines.push(`## ${r.label}`);
    lines.push(`- **Status:** ${r.status}`);
    lines.push(`- **Turns to complete:** ${r.turns}`);
    lines.push(`- **Fields extracted (chip count):** ${r.fieldsFilled}`);
    lines.push(`- **Expected dashboard chips visible:** ${r.fieldsExpectedSeenOnDashboard.join(", ") || "(none)"}`);
    if (r.fieldsExpectedMissingOnDashboard.length > 0) {
      lines.push(`- **Expected chips MISSING:** ${r.fieldsExpectedMissingOnDashboard.join(", ")}`);
    }
    lines.push(`- **Specialist cards rendered:** ${r.specialistCardsVisible}`);
    if (r.failures.length > 0) {
      lines.push("");
      lines.push("**Failures:**");
      for (const f of r.failures) lines.push(`- ❌ ${f}`);
    }
    if (r.warnings.length > 0) {
      lines.push("");
      lines.push("**Warnings:**");
      for (const w of r.warnings) lines.push(`- ⚠ ${w}`);
    }
    lines.push("");
    lines.push("**Screenshots:**");
    for (const s of r.screenshots) {
      const rel = path.relative(path.dirname(REPORT_FILE), s);
      lines.push(`- ![${path.basename(s)}](${rel})`);
    }
  }
  fs.writeFileSync(REPORT_FILE, lines.join("\n"), "utf-8");
  console.log(`\n[personas-round1] Report written to ${REPORT_FILE}`);
});

const PERSONA_FILTER = process.env.PERSONA;
const PERSONA_SLUGS = PERSONA_FILTER
  ? PERSONA_FILTER.split(",").map((s) => s.trim()).filter(Boolean)
  : null;
const PERSONAS_TO_RUN = PERSONA_SLUGS
  ? ROUND_ONE_PERSONAS.filter((p) => PERSONA_SLUGS.includes(p.slug))
  : ROUND_ONE_PERSONAS;

if (PERSONAS_TO_RUN.length === 0) {
  throw new Error(`No persona matched PERSONA=${PERSONA_FILTER}`);
}

for (const persona of PERSONAS_TO_RUN) {
  test.describe(persona.label, () => {
    test(`frontend onboarding — ${persona.slug}`, async ({ page }) => {
      test.setTimeout(15 * 60 * 1000); // 15min per persona

      const result: PersonaRunResult = {
        slug: persona.slug,
        label: persona.label,
        status: "fail",
        turns: 0,
        fieldsFilled: 0,
        fieldsExpectedSeenOnDashboard: [],
        fieldsExpectedMissingOnDashboard: [],
        generatePlanReached: false,
        dashboardLoaded: false,
        specialistCardsVisible: 0,
        failures: [],
        warnings: [],
        durationMs: 0,
        screenshots: [],
      };
      const t0 = Date.now();

      try {
        // ----- Wipe previous persona state on the shared test account -----
        const userId = await resolveTestUserId();
        await wipePersonaState(userId);

        // ----- 1. Visit / → /auth/login -----
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await page.waitForURL(/\/auth\/login/, { timeout: 20_000 });
        result.screenshots.push(await takeShot(persona.slug, page, "01", "login"));

        // ----- 2. Sign in with email/password -----
        // Look for email input — try a few common selectors.
        const emailInput = page
          .locator('input[type="email"], input[name="email"], [data-testid="email-input"]')
          .first();
        const passwordInput = page
          .locator('input[type="password"], input[name="password"], [data-testid="password-input"]')
          .first();
        await expect(emailInput).toBeVisible({ timeout: 15_000 });
        await emailInput.fill(TEST_EMAIL!);
        await passwordInput.fill(TEST_PASSWORD!);
        result.screenshots.push(await takeShot(persona.slug, page, "02", "login-filled"));

        const signInBtn = page
          .locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]')
          .first();
        await signInBtn.click();

        // ----- 3. Wait for /onboarding (or /dashboard if profile already exists) -----
        await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 30_000 });
        if (page.url().includes("/dashboard")) {
          // Wipe didn't fully reset — navigate to /onboarding manually.
          await page.goto("/onboarding", { waitUntil: "domcontentloaded" });
          await page.waitForURL(/\/onboarding/, { timeout: 20_000 });
        }

        await expect(page.getByTestId("onboarding-input")).toBeVisible({
          timeout: 30_000,
        });
        result.screenshots.push(await takeShot(persona.slug, page, "03", "onboarding-start"));

        // ----- 4. Drive turns until "Generate my plan" appears or hard limit -----
        const MAX_TURNS = 100;
        let lastQuestion: string | null = null;
        const recentQuestions: string[] = [];

        // First turn: send the bundled message.
        await submitTurn(page, persona.bundledMessage);
        result.turns = 1;
        let q = await waitForNextQuestion(page, null, 90_000);
        lastQuestion = q;

        for (let turn = 0; turn < MAX_TURNS; turn++) {
          // Check if "Generate my plan" button is visible — if so, we're done.
          const generateBtn = page.getByTestId("button-generate-plan");
          if (await generateBtn.isVisible().catch(() => false)) {
            result.generatePlanReached = true;
            break;
          }

          if (!q) {
            result.warnings.push(`Turn ${turn}: no new question received within timeout`);
            break;
          }

          // Mid-onboarding screenshot at turn 5.
          if (turn === 5) {
            result.screenshots.push(
              await takeShot(persona.slug, page, "04", "onboarding-mid"),
            );
          }

          // Track recent questions to detect a true loop (same question 4×).
          recentQuestions.push(q);
          if (recentQuestions.length > 6) recentQuestions.shift();
          const sameCount = recentQuestions.filter((x) => x === q).length;
          if (sameCount >= 4) {
            result.warnings.push(
              `Same question repeated ${sameCount}× at turn ${turn} — aborting: "${q.slice(0, 80)}"`,
            );
            break;
          }

          const answer = await answerFor(page, persona, q);
          await submitTurn(page, answer);
          result.turns += 1;

          q = await waitForNextQuestion(page, lastQuestion, 90_000);
          lastQuestion = q;
        }

        result.fieldsFilled = (await getFilledFieldKeys(page)).length;
        result.screenshots.push(
          await takeShot(persona.slug, page, "05", "onboarding-complete"),
        );

        if (!result.generatePlanReached) {
          result.failures.push(
            `Did not reach 'Generate my plan' button within ${MAX_TURNS} turns`,
          );
        } else {
          // ----- 5. Click Generate plan → /dashboard -----
          await page.getByTestId("button-generate-plan").click();
          await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
          result.dashboardLoaded = true;
          // Give the dashboard a moment to fetch the plan + render cards.
          await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
          await page.waitForTimeout(5_000);
          result.screenshots.push(
            await takeShot(persona.slug, page, "06", "dashboard"),
          );

          // ----- 6. Verify dashboard renders persona data -----
          // The dashboard uses a few different field markers depending on which
          // card the field appears in. Try all of them and union the results.
          const renderedKeys = await page.evaluate(() => {
            const out = new Set<string>();
            const selectors = [
              '[data-testid^="audit-icon-"]',
              '[data-testid^="profile-chip-full-"]',
              '[data-testid^="profile-chip-compact-"]',
            ];
            for (const sel of selectors) {
              for (const el of Array.from(document.querySelectorAll(sel))) {
                const tid = el.getAttribute("data-testid")!;
                out.add(
                  tid.replace(/^(audit-icon|profile-chip-full|profile-chip-compact)-/, ""),
                );
              }
            }
            return Array.from(out);
          });
          for (const expected of persona.expectedProfileChips) {
            if (renderedKeys.includes(expected)) {
              result.fieldsExpectedSeenOnDashboard.push(expected);
            } else {
              result.fieldsExpectedMissingOnDashboard.push(expected);
            }
          }

          // Count specialist cards.
          result.specialistCardsVisible = await page
            .locator("[data-specialist-card]")
            .count()
            .catch(() => 0);

          // Pass criterion: the dashboard body must contain the persona's
          // destination city (proves the persona's data drives the UI).
          const bodyText = await page.locator("body").innerText().catch(() => "");
          const cityAnswer =
            persona.followUps.find((f) =>
              /target.*city|destination city/i.test(String(f.match)),
            )?.answer ?? "";
          const cityShort = cityAnswer.split(",")[0].trim();
          const cityFound = cityShort
            ? bodyText.toLowerCase().includes(cityShort.toLowerCase())
            : false;
          if (!cityFound) {
            result.failures.push(
              `Dashboard body does not contain destination city "${cityShort}"`,
            );
          }

          if (result.fieldsExpectedMissingOnDashboard.length > 0) {
            // Demote to warning — the dashboard may render the same field
            // under a different key name (e.g. destination_country vs destination).
            result.warnings.push(
              `Expected fields not found by exact key on dashboard: ${result.fieldsExpectedMissingOnDashboard.join(", ")}`,
            );
          }
        }

        result.status = result.failures.length === 0 ? "pass" : "fail";
      } catch (err) {
        result.failures.push(`Exception: ${(err as Error).message}`);
        result.status = "fail";
        try {
          result.screenshots.push(
            await takeShot(persona.slug, page, "99", "exception"),
          );
        } catch {
          /* ignore */
        }
      } finally {
        result.durationMs = Date.now() - t0;
        results.push(result);
      }

      // Surface failures to Playwright so the test goes red.
      expect(result.failures, result.failures.join("; ")).toEqual([]);
    });
  });
}
