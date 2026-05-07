// Phase 3A — readiness section structural test.
//
// Signs in with the existing TEST_EMAIL/TEST_PASSWORD user, navigates to the
// dashboard, and asserts that the readiness section renders correctly:
//   • Four domain cards (visa / document / money / move)
//   • Each card has a level pill (low / medium / high)
//   • Cards are sorted lowest-level-first
//   • The disclaimer is present
//   • No fake "X% ready" / "Approved" copy slipped in anywhere
//
// We don't pin specific levels — those depend on the test account's state.
// We only assert the structural invariants the UI must always satisfy.

import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;

if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error("TEST_EMAIL and TEST_PASSWORD must be set in env");
}

const DOMAINS = ["visa", "document", "money", "move"] as const;
const LEVELS = ["low", "medium", "high"] as const;
const LEVEL_RANK: Record<string, number> = { low: 0, medium: 1, high: 2 };

test("Phase 3A — readiness section renders with explainable structure", async ({ page }) => {
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200));
  });

  // ---- Sign in --------------------------------------------------------------

  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  const emailInput = page
    .locator('input[type="email"], input[name="email"], [data-testid="email-input"]')
    .first();
  const passwordInput = page
    .locator('input[type="password"], input[name="password"], [data-testid="password-input"]')
    .first();
  await expect(emailInput).toBeVisible({ timeout: 15_000 });
  await emailInput.fill(TEST_EMAIL!);
  await passwordInput.fill(TEST_PASSWORD!);
  await page
    .locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]')
    .first()
    .click();

  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });
  if (page.url().includes("/onboarding")) {
    // Test user might not have completed onboarding — readiness still
    // renders on /dashboard if they navigate there directly.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  }
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  // ---- API contract check (proves the bug fixes too) -----------------------

  const apiRes = await page.evaluate(async () => {
    const r = await fetch("/api/readiness");
    if (!r.ok) return { status: r.status, body: null };
    return { status: r.status, body: await r.json() };
  });
  expect(apiRes.status, "GET /api/readiness should respond 200 for the active plan").toBe(200);
  const body = apiRes.body as {
    planId: string;
    domains: Record<string, { level: string; reasons: string[]; blockers: string[]; nextStep: string | null }>;
    topPriority: { domain: string; nextStep: string } | null;
  } | null;
  expect(body, "API body should be present").not.toBeNull();
  expect(body!.domains).toBeDefined();
  for (const dom of DOMAINS) {
    expect(body!.domains[dom], `domains.${dom} should be present`).toBeDefined();
    expect(LEVELS).toContain(body!.domains[dom].level);
    expect(Array.isArray(body!.domains[dom].reasons)).toBe(true);
    expect(Array.isArray(body!.domains[dom].blockers)).toBe(true);
  }

  // ---- Section + 4 cards rendered ------------------------------------------

  const section = page.getByTestId("readiness-section");
  await expect(section, "readiness section is visible").toBeVisible({ timeout: 30_000 });
  await expect(section.getByTestId("readiness-heading")).toHaveText(/How ready are you\?/i);

  for (const dom of DOMAINS) {
    const card = page.getByTestId(`readiness-domain-${dom}`);
    await expect(card, `domain card for ${dom} is visible`).toBeVisible();
    const pill = page.getByTestId(`readiness-level-${dom}`);
    await expect(pill).toBeVisible();
    const pillText = (await pill.innerText()).trim().toLowerCase();
    expect(LEVELS).toContain(pillText);
  }

  // ---- Sort order: lowest-level-first --------------------------------------

  const cards = page.getByTestId(/^readiness-domain-/);
  const count = await cards.count();
  expect(count, "should render exactly 4 domain cards").toBe(4);
  const renderedLevels: string[] = [];
  for (let i = 0; i < count; i++) {
    const c = cards.nth(i);
    const lvl = (await c.getAttribute("data-readiness-level")) ?? "";
    expect(LEVELS).toContain(lvl);
    renderedLevels.push(lvl);
  }
  for (let i = 1; i < renderedLevels.length; i++) {
    expect(
      LEVEL_RANK[renderedLevels[i - 1]] <= LEVEL_RANK[renderedLevels[i]],
      `cards must be sorted low→medium→high; got ${renderedLevels.join(",")}`,
    ).toBe(true);
  }

  // ---- Disclaimer is present, and is exactly the preparation-style line ----

  const disclaimer = page.getByTestId("readiness-disclaimer");
  await expect(disclaimer).toBeVisible();
  await expect(disclaimer).toHaveText(/guidance signal — not a prediction of approval/i);

  // ---- No fake "X% ready" or "approved" copy anywhere in the section -------

  const sectionHtml = (await section.innerHTML()).toLowerCase();
  // Forbidden patterns: percentage scoring, approval-style verdicts.
  // Note: we still expect the words "approval" inside the disclaimer copy,
  // so we look for stronger affirmative claims instead.
  expect(sectionHtml).not.toMatch(/\b\d{1,3}%\s*(ready|done|covered)/);
  expect(sectionHtml).not.toMatch(/\b(approved|verified|guaranteed|eligible)\b/);

  // ---- Top-priority banner: present iff API returned one -------------------

  if (body!.topPriority) {
    const banner = page.getByTestId("readiness-top-priority");
    await expect(banner).toBeVisible();
    const dom = await banner.getAttribute("data-priority-domain");
    expect(DOMAINS).toContain(dom);
    expect(dom).toBe(body!.topPriority.domain);
  } else {
    await expect(page.getByTestId("readiness-top-priority")).toHaveCount(0);
  }
});
