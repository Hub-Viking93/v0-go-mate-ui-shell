import { test, expect, Page } from "@playwright/test";
import * as path from "node:path";
import { PERSONAS, type Persona } from "./personas";
import {
  captureUserId,
  cleanupUser,
  takeShot,
  HEAD,
  isWhitelisted,
  GateRecorder,
  REPORTS_DIR,
  type PersonaResult,
} from "./helpers";

const recorder = new GateRecorder();

test.afterAll(async () => {
  recorder.write(path.join(REPORTS_DIR, "phase-4-gate-report.md"));
});

async function readQuestion(page: Page): Promise<string | null> {
  // Reads the FULL bubble text from the sr-only live region, which is only
  // populated once the typewriter animation has completed (avoids flapping
  // partial reads). Falls back to the visible bubble text if needed.
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
  timeoutMs = 45_000,
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
    await page.waitForTimeout(400);
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

async function answerFollowUp(
  page: Page,
  persona: Persona,
  question: string,
): Promise<string> {
  // Find the first matching scripted answer; if none, give a safe generic answer.
  for (const f of persona.followUps) {
    if (f.match.test(question)) return f.answer;
  }
  // Phase 4 fix #1 — substantive default answer (NOT a deflection).
  // The application's deflection short-circuit treats short "skip"/"later"
  // responses as user_skipped and won't re-ask, so we deliberately give
  // a substantive fallback so the LLM can extract something useful.
  return persona.defaultAnswer;
}

async function submitTurn(page: Page, text: string): Promise<void> {
  const textarea = page.locator('[data-testid="onboarding-input"] textarea');
  await textarea.fill(text);
  await textarea.press("Enter");
}

for (const persona of PERSONAS) {
  test.describe(`${persona.label}`, () => {
    let userId: string | null = null;
    let result: PersonaResult;
    const consoleErrors: string[] = [];

    test.afterEach(async () => {
      if (userId) {
        await cleanupUser(userId);
      }
    });

    test(`anonymous spine — ${persona.slug}`, async ({ page }) => {
      result = recorder.start(persona.slug, persona.label);
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text().slice(0, 300));
        }
      });
      page.on("pageerror", (err) => {
        consoleErrors.push(`pageerror: ${err.message}`);
      });

      const t0 = Date.now();

      // ----- 1. Visit / → /auth/login -----
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/auth\/login/, { timeout: 15_000 });
      result.screenshots.push(await takeShot(page, persona.slug, "01", "login"));

      // ----- 2. Continue as guest -----
      const guestBtn = page.getByTestId("continue-as-guest");
      await expect(guestBtn).toBeVisible();
      await guestBtn.click();
      await page.waitForURL(/\/onboarding/, { timeout: 20_000 });
      // Capture the anon user_id immediately so cleanup works even on early failure.
      // Retry briefly because supabase writes the session async after click().
      for (let i = 0; i < 10 && !userId; i++) {
        userId = await captureUserId(page);
        if (!userId) await page.waitForTimeout(300);
      }
      result.userId = userId;
      if (!userId) {
        result.failures.push("(n) Could not capture anonymous user_id from session");
      }

      // ----- 3. Wait for onboarding ready -----
      await expect(page.getByTestId("onboarding-input")).toBeVisible({ timeout: 30_000 });
      result.screenshots.push(
        await takeShot(page, persona.slug, "03", "onboarding-start"),
      );

      // ----- 4. Send bundled message -----
      const turnStart = Date.now();
      await submitTurn(page, persona.bundledMessage);

      // Wait for first response question
      const q1 = await waitForNextQuestion(page, null, 60_000);
      result.timings.firstTurnMs = Date.now() - turnStart;
      result.screenshots.push(
        await takeShot(page, persona.slug, "04", "after-bundled-input"),
      );

      if (!q1) {
        result.failures.push("(g) First-turn response timed out (>60s)");
      } else {
        result.questionsSeen.push(q1);
        if (result.timings.firstTurnMs > 12000) {
          result.warnings.push(
            `(g) First-turn over budget: ${result.timings.firstTurnMs}ms > 12000ms`,
          );
        }
      }

      // ----- 5. Side panel populated — wait for at least one extracted chip -----
      await expect(
        page.getByTestId("profile-preview-list-desktop").first(),
      ).toBeAttached({ timeout: 10_000 });
      // Wait for the extractor to populate at least one field chip, OR for
      // a "Next up" hint (which means the model picked the next question
      // even if extraction returned nothing for this turn).
      try {
        await page.waitForFunction(
          () => {
            const chips = document.querySelectorAll(
              '[data-testid^="profile-chip-compact-"]',
            );
            const nextUp = document.querySelector(
              '[data-testid="profile-preview-next-up"]',
            );
            return chips.length > 0 || nextUp !== null;
          },
          { timeout: 15_000 },
        );
      } catch {
        result.warnings.push(
          "(c) profile-preview did not populate chips/next-up within 15s",
        );
      }
      result.screenshots.push(
        await takeShot(page, persona.slug, "05", "side-panel-populated"),
      );

      const filledAfterBundle = await getFilledFieldKeys(page);
      result.extractedFields = filledAfterBundle;

      // (c) Hallucination / extraction sanity check — at least the very-explicit
      // fields must be present. We don't fail on absence of every expected field
      // because the agent may collect them in follow-ups.
      const haveAtLeastSomeExpected = persona.expectedFields.some((f) =>
        filledAfterBundle.includes(f),
      );
      if (!haveAtLeastSomeExpected) {
        result.failures.push(
          `(c) Extractor produced no expected fields after bundled message. expected one of: ${persona.expectedFields.join(", ")}; got: ${filledAfterBundle.join(", ") || "(none)"}`,
        );
      }

      // ----- 6. Follow-up Q/A loop -----
      let prevQuestion = q1;
      let followUpQuestionsAsked = 0;
      const maxFollowUps = 10;
      let saveModalSeen = false;

      while (followUpQuestionsAsked < maxFollowUps) {
        // Stop if "Generate my plan" CTA appeared.
        const generateBtnVisible = await page
          .getByTestId("button-generate-plan")
          .isVisible()
          .catch(() => false);
        if (generateBtnVisible) break;

        // Detect save-progress modal (criterion n) — appears at >=5 fields.
        const modalVisible = await page
          .getByTestId("save-progress-modal")
          .isVisible()
          .catch(() => false);
        if (modalVisible && !saveModalSeen) {
          saveModalSeen = true;
          result.screenshots.push(
            await takeShot(page, persona.slug, "06b", "save-progress-modal"),
          );
          // Per Slice 3 simplification: just dismiss and continue.
          await page.getByTestId("save-progress-skip").click();
          await page.waitForTimeout(300);
        }

        const currentQ = await readQuestion(page);
        if (!currentQ || currentQ === prevQuestion) {
          // Wait briefly for transition.
          await page.waitForTimeout(800);
          continue;
        }

        // (a) Repeated-question check.
        if (
          result.questionsSeen.includes(currentQ) &&
          currentQ !== prevQuestion
        ) {
          result.duplicateQuestions.push(currentQ);
          result.failures.push(`(a) Repeated question: "${currentQ.slice(0, 100)}"`);
        } else {
          result.questionsSeen.push(currentQ);
        }

        const answer = await answerFollowUp(page, persona, currentQ);
        const turnT = Date.now();
        await submitTurn(page, answer);
        prevQuestion = currentQ;
        followUpQuestionsAsked++;

        if (followUpQuestionsAsked === 1) {
          result.screenshots.push(
            await takeShot(page, persona.slug, "06", "qd-followup-question"),
          );
        }

        const next = await waitForNextQuestion(page, currentQ, 45_000);
        const turnMs = Date.now() - turnT;
        if (turnMs > 8000) {
          result.warnings.push(`(g) Turn ${followUpQuestionsAsked} over budget: ${turnMs}ms`);
        }
        if (!next) break; // either onboarding finished or timed out
        prevQuestion = next;
      }

      result.timings.onboardingTotalMs = Date.now() - turnStart;

      // (n) Save modal must appear at some point during anon onboarding.
      if (!saveModalSeen) {
        result.warnings.push(
          "(n) Save-progress modal never appeared during anonymous onboarding (>=5 fields trigger)",
        );
      }

      // ----- 7. Generate my plan -----
      const generateBtn = page.getByTestId("button-generate-plan");
      const generateVisible = await generateBtn.isVisible().catch(() => false);
      if (!generateVisible) {
        result.failures.push(
          "(l) Did not reach onboarding-complete state within follow-up budget",
        );
        recorder.finish(result);
        return;
      }

      result.screenshots.push(
        await takeShot(page, persona.slug, "07", "onboarding-complete"),
      );

      const researchStart = Date.now();
      await generateBtn.click();
      await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

      // ----- 8. Research mid-flight screenshot -----
      // Try briefly to capture /research panel grid by direct nav (best effort).
      try {
        const popup = await page.context().newPage();
        await popup.goto("/research", { waitUntil: "domcontentloaded", timeout: 10_000 });
        await popup.waitForSelector('[data-testid="agent-panel-grid"], [data-testid="coordinator-panel"]', { timeout: 10_000 });
        const seenAgents = await popup.evaluate(() => {
          const els = Array.from(
            document.querySelectorAll('[data-testid^="agent-panel-"]'),
          );
          return els.map((e) =>
            e.getAttribute("data-testid")!.replace(/^agent-panel-/, ""),
          );
        });
        result.agentsSeen = seenAgents;
        result.screenshots.push(
          await (async () => {
            const file = path.join(
              "artifacts/screenshots/phase-4",
              persona.slug,
              "09-research-mid-flight.png",
            );
            await popup.screenshot({ path: file, fullPage: true });
            return file;
          })(),
        );
        await popup.close();
      } catch (e) {
        result.warnings.push(
          `(e) Could not capture /research mid-flight panels: ${(e as Error).message}`,
        );
      }

      // ----- 9. Wait for dashboard cards / research completion -----
      // Poll /api/profile (via the page's session) for research_status='completed'
      // OR for visa-research-card to appear in the DOM (whichever comes first).
      const dashLoadStart = Date.now();
      let researchCompleted = false;
      const RESEARCH_DEADLINE_MS = 180_000; // restored to spec default after Phase 4 fixes
      while (Date.now() - researchStart < RESEARCH_DEADLINE_MS) {
        const cardCount = await page
          .locator('[data-specialist-card]')
          .count()
          .catch(() => 0);
        if (cardCount > 0) {
          researchCompleted = true;
          break;
        }
        await page.waitForTimeout(2000);
        // Soft reload every ~30s in case the dashboard didn't poll.
        if ((Date.now() - researchStart) % 30_000 < 2100) {
          await page.reload({ waitUntil: "domcontentloaded" });
        }
      }
      result.timings.researchMs = Date.now() - researchStart;
      result.timings.dashboardLoadMs = Date.now() - dashLoadStart;

      if (!researchCompleted) {
        result.failures.push(
          `(g)(d) Research did not produce visible cards within ${RESEARCH_DEADLINE_MS}ms`,
        );
      } else if (result.timings.researchMs > 90_000) {
        result.warnings.push(
          `(g) Research over budget: ${result.timings.researchMs}ms > 90000ms`,
        );
      }

      result.screenshots.push(
        await takeShot(page, persona.slug, "10", "dashboard-loaded"),
      );

      // ----- 10. Card visibility (criterion h) -----
      const visibleCardTitles = await page.evaluate(() => {
        const els = Array.from(
          document.querySelectorAll("[data-specialist-card]"),
        );
        return els.map((e) => e.getAttribute("data-specialist-card") || "");
      });
      result.visibleCards = visibleCardTitles;

      const lc = (s: string) => s.toLowerCase();
      const visLower = visibleCardTitles.map(lc);
      for (const want of persona.mustVisibleCards) {
        if (!visLower.some((v) => v.includes(lc(want)))) {
          result.failures.push(
            `(h) Expected card containing "${want}" not visible. Saw: ${visibleCardTitles.join(" | ") || "(none)"}`,
          );
        }
      }
      for (const banned of persona.mustHiddenCards) {
        if (visLower.some((v) => v.includes(lc(banned)))) {
          result.failures.push(
            `(h) Card "${banned}" should be hidden but appeared`,
          );
          result.hiddenCardsSeen.push(banned);
        }
      }

      // ----- 11. Audit popover (criterion i) -----
      const auditIcon = page.locator('[data-testid^="audit-icon-"]').first();
      const hasAudit = await auditIcon.count();
      if (hasAudit > 0) {
        await auditIcon.click();
        // Popover appears in a portal — look for any popover content.
        const popContent = page.locator("[role='dialog'], [data-radix-popper-content-wrapper]").first();
        try {
          await expect(popContent).toBeVisible({ timeout: 3_000 });
          result.auditPopover.opened = true;
          const sample = await popContent.textContent().catch(() => null);
          result.auditPopover.sample = sample?.trim() ?? null;
          result.screenshots.push(
            await takeShot(page, persona.slug, "11", "audit-popover-open"),
          );
          // Click outside to close.
          await page.mouse.click(10, 10);
        } catch {
          result.failures.push("(i) Audit popover did not open within 3s after click");
        }
      } else {
        result.warnings.push("(i) No audit-icon-* elements found on dashboard");
      }

      // ----- 12. Citations (criteria f, j) -----
      const citationUrls = await page.evaluate(() => {
        const links = Array.from(
          document.querySelectorAll('a[href^="http"]'),
        );
        const urls = new Set<string>();
        for (const a of links) {
          const h = (a as HTMLAnchorElement).href;
          // Filter out clearly internal links by hostname
          try {
            const u = new URL(h);
            if (u.hostname.includes("replit") || u.hostname.includes("localhost"))
              continue;
            urls.add(h);
          } catch {}
        }
        return Array.from(urls);
      });
      result.citationsTotal = citationUrls.length;
      // HEAD-check up to 8 (keep test runtime bounded)
      const subset = citationUrls.slice(0, 8);
      for (const url of subset) {
        const status = await HEAD(url);
        if (status >= 200 && status < 400) result.citationsOk++;
        else result.citationsBad.push({ url, status });
        if (!isWhitelisted(url, persona.citationWhitelist)) {
          result.citationsOffWhitelist.push(url);
        }
      }

      // ----- 13. Guide content metrics (criterion k) -----
      const guideText = await page.evaluate(() => {
        const candidates = Array.from(
          document.querySelectorAll("[data-specialist-card], article, .gm-card"),
        );
        return candidates.map((c) => (c as HTMLElement).innerText).join("\n\n");
      });
      const words = guideText.split(/\s+/).filter((s) => s.length > 0);
      result.guideWordCount = words.length;
      result.guideSectionCount = (await page.locator("[data-specialist-card]").count());

      // Persona-specific keyword check
      const lcGuide = guideText.toLowerCase();
      const personaKeywords: Record<string, string[]> = {
        roselle: ["sambo", "filipino", "philippine", "manila"],
        axel: ["a1", "posted worker", "posting", "sweden"],
        priya: ["digital nomad", "spain", "dn ", "beckham", "income"],
        stevenson: ["482", "australia", "quarantine", "border collie", "melbourne"],
      };
      const want = personaKeywords[persona.slug] ?? [];
      const found = want.filter((w) => lcGuide.includes(w));
      if (found.length === 0 && result.guideWordCount > 100) {
        result.warnings.push(
          `(k) Guide content did not mention any persona-specific keywords: ${want.join(", ")}`,
        );
      }

      result.consoleErrors = consoleErrors.slice(0, 30);
      recorder.finish(result);
    });
  });
}
