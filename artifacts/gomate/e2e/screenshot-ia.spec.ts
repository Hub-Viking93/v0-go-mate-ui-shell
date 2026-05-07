import { test } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_EMAIL = process.env.TEST_EMAIL!;
const TEST_PASSWORD = process.env.TEST_PASSWORD!;

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-ia");
fs.mkdirSync(SHOTS_DIR, { recursive: true });

test("Sitemap IA — visual screenshots", async ({ page }) => {
  await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD);
  await page.locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });

  const shots: { name: string; route: string }[] = [
    { name: "01-dashboard", route: "/dashboard" },
    { name: "02-immigration", route: "/immigration" },
    { name: "03-pre-move", route: "/pre-move" },
    { name: "04-post-move", route: "/post-move" },
    { name: "05-documents", route: "/documents" },
    { name: "06-guidance", route: "/guidance" },
  ];
  for (const s of shots) {
    await page.goto(s.route, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(SHOTS_DIR, `${s.name}.png`), fullPage: false });
  }
});
