import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/dev-tour");
fs.mkdirSync(SHOTS_DIR, { recursive: true });

test("Dev tour preview — capture each step", async ({ page }) => {
  await page.goto("/dev/tour", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("dashboard-guided-tour")).toBeVisible();

  for (let i = 1; i <= 6; i += 1) {
    await page.waitForTimeout(450);
    await page.screenshot({
      path: path.join(SHOTS_DIR, `step-${i}.png`),
      fullPage: false,
    });
    if (i < 6) {
      await page.getByTestId("tour-next").click();
    }
  }

  await page.getByTestId("tour-next").click();
  await expect(page.getByTestId("dashboard-guided-tour")).toHaveCount(0);
  await page.screenshot({
    path: path.join(SHOTS_DIR, `closed.png`),
    fullPage: false,
  });
});
