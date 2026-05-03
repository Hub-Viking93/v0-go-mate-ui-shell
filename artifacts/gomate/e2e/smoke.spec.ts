import { test, expect } from "@playwright/test";
import { captureUserId, cleanupUser, takeShot } from "./helpers";

test("infrastructure smoke — anonymous flow boots and first-turn extraction works", async ({ page }) => {
  let userId: string | null = null;
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200));
  });

  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth\/login/);
    await takeShot(page, "smoke", "01", "login");

    await page.getByTestId("continue-as-guest").click();
    await page.waitForURL(/\/onboarding/);
    for (let i = 0; i < 10 && !userId; i++) {
      userId = await captureUserId(page);
      if (!userId) await page.waitForTimeout(300);
    }
    console.log("USER_ID=", userId);
    await expect(page.getByTestId("onboarding-input")).toBeVisible({ timeout: 30_000 });
    await takeShot(page, "smoke", "02", "onboarding-ready");

    const t = Date.now();
    await page
      .locator('[data-testid="onboarding-input"] textarea')
      .fill("Hi I'm Roselle, 28, Filipino, moving to Stockholm Sweden for a sambo visa.");
    await page.locator('[data-testid="onboarding-input"] textarea').press("Enter");

    // Wait for the bubble's sr-only full text to populate (typewriter complete)
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="speech-bubble-text"]');
        return el && (el.textContent ?? "").trim().length > 5;
      },
      { timeout: 60_000 },
    );
    const ms = Date.now() - t;
    const q = await page
      .locator('[data-testid="speech-bubble-text"]')
      .first()
      .textContent();
    console.log(`FIRST_TURN_MS=${ms}`);
    console.log(`QUESTION=`, (q ?? "").trim().slice(0, 180));

    // Wait for extracted chips
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-testid^="profile-chip-compact-"]').length > 0,
      { timeout: 15_000 },
    );
    const chips = await page.evaluate(() => {
      const el = Array.from(
        document.querySelectorAll('[data-testid^="profile-chip-compact-"]'),
      );
      return el.map((c) =>
        c.getAttribute("data-testid")!.replace(/^profile-chip-compact-/, ""),
      );
    });
    console.log(`CHIPS=`, chips.join(","));

    await takeShot(page, "smoke", "03", "after-first-turn");
    expect(chips.length).toBeGreaterThan(0);
  } finally {
    if (userId) await cleanupUser(userId);
  }
});
