// Sitemap IA smoke verification — the seven top-level destinations.
import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL!;
const TEST_PASSWORD = process.env.TEST_PASSWORD!;

test("Sitemap IA — seven top-level destinations + redirects", async ({ page }) => {
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200));
  });

  // Sign in
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD);
  await page
    .locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]')
    .first()
    .click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  // Sidebar should expose all 7 top-level destinations.
  for (const name of [
    "Dashboard",
    "Immigration",
    "Pre-move",
    "Post-move",
    "Documents",
    "Plan & Guidance",
    "Settings",
  ]) {
    await expect(page.locator(`aside a:has-text("${name}")`).first()).toBeVisible();
  }

  // Workspace tiles on dashboard
  await expect(page.getByTestId("workspace-tiles")).toBeVisible();
  for (const t of [
    "tile-immigration",
    "tile-pre-move",
    "tile-post-move",
    "tile-documents",
    "tile-guidance",
  ]) {
    await expect(page.getByTestId(t)).toBeVisible();
  }

  // No legacy fullsize sections on dashboard
  for (const id of [
    "readiness-section",
    "risks-section",
    "pathways-section",
    "arrival-playbook-section",
    "setup-flows-section",
    "license-insurance-section",
    "orientation-section",
    "housing-support-section",
    "departure-flow-section",
    "pet-relocation-section",
    "tax-overview-section",
    "rule-changes-section",
  ]) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }

  // Click each tile + assert it lands at the correct page
  await page.getByTestId("tile-immigration").click();
  await page.waitForURL(/\/immigration/);
  await expect(page.getByTestId("immigration-page")).toBeVisible();
  await expect(page.getByTestId("page-title")).toHaveText(/Immigration/i);

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.getByTestId("tile-post-move").click();
  await page.waitForURL(/\/post-move/);
  await expect(page.getByTestId("post-move-page")).toBeVisible();
  await expect(page.getByTestId("page-title")).toHaveText(/Post-move/i);
  // Subnav default = checklist; flip to playbook
  await page.getByTestId("subnav-playbook").click();
  await expect(page.getByTestId("arrival-playbook-section")).toBeVisible({ timeout: 10_000 });

  await page.goto("/guidance", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("guidance-page")).toBeVisible();
  await expect(page.getByTestId("page-title")).toHaveText(/Plan & Guidance/i);
  // Default tab = housing
  await expect(page.getByTestId("housing-support-section")).toBeVisible();
  // Switch to rule_changes
  await page.getByTestId("subnav-rule_changes").click();
  await expect(page.getByTestId("rule-changes-section")).toBeVisible({ timeout: 10_000 });

  await page.goto("/documents", { waitUntil: "domcontentloaded" });
  // VaultPage doesn't have a single page-title testid; assert the URL alone
  // stuck (legacy redirect would have moved us back to /checklist).
  expect(page.url()).toMatch(/\/documents$/);

  // Legacy redirects
  await page.goto("/visa-tracker", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/immigration$/, { timeout: 5_000 });
  await page.goto("/pre-departure", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/pre-move$/, { timeout: 5_000 });
  await page.goto("/settling-in", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/post-move$/, { timeout: 5_000 });
});
