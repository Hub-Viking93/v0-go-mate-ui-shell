// UI verification screenshots for Roselle + Axel plans.
// Reads .local/e2e-roselle-axel-plan-ids.json (written by the backend
// driver), logs in as the test account, switches between the two
// plans via PATCH /api/plans, and takes screenshots of:
//   - dashboard (overview, profile chips, audit icons)
//   - visa research page
//   - guides page
//
// Usage:
//   PERSONA_ACCOUNT_EMAIL=... PERSONA_ACCOUNT_PASSWORD=... \
//   pnpm exec playwright test screenshot-roselle-axel.spec.ts \
//     --reporter=list --workers=1
import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const EMAIL = process.env.PERSONA_ACCOUNT_EMAIL!;
const PASS = process.env.PERSONA_ACCOUNT_PASSWORD!;
if (!EMAIL || !PASS) throw new Error("PERSONA_ACCOUNT_EMAIL + PERSONA_ACCOUNT_PASSWORD required");

const PLAN_IDS_PATH = path.resolve(
  process.cwd(),
  "../..",
  ".local/e2e-roselle-axel-plan-ids.json",
);
const SHOT_DIR = path.resolve(process.cwd(), "../..", ".local/screenshots");

type PlanIds = { roselle: string; axel: string };

test.describe("Roselle + Axel UI screenshots", () => {
  test.setTimeout(300_000);

  test("capture both personas", async ({ page, context }) => {
    await fs.mkdir(SHOT_DIR, { recursive: true });
    const planIds = JSON.parse(await fs.readFile(PLAN_IDS_PATH, "utf8")) as PlanIds;
    console.log("plan ids:", planIds);

    // ---- 1. Login ----
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASS);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 60_000 });
    console.log("logged in, at:", page.url());

    // Pull the access_token from the supabase localStorage entry so we
    // can hit /api/plans directly to switch the current plan.
    const token: string = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.includes("auth-token")) {
          try {
            const v = JSON.parse(localStorage.getItem(k)!);
            return v.access_token || v.currentSession?.access_token || "";
          } catch { /* ignore */ }
        }
      }
      return "";
    });
    if (!token) throw new Error("no access_token in localStorage");

    const personas = (["roselle", "axel"] as const).filter((p) => planIds[p]);
    for (const persona of personas) {
      const planId = planIds[persona];
      console.log(`\n=== ${persona} plan=${planId} ===`);

      // ---- 2. Switch to this plan via PATCH /api/plans ----
      const switchResp = await page.request.patch("/api/plans", {
        headers: { Authorization: `Bearer ${token}` },
        data: { planId, action: "switch" },
      });
      console.log(`switch ${persona}: ${switchResp.status()}`);
      expect(switchResp.ok()).toBeTruthy();

      // ---- 3. Dashboard ----
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(4_000);
      await page.screenshot({
        path: path.join(SHOT_DIR, `${persona}-01-dashboard.png`),
        fullPage: true,
      });

      // Count rendered profile fields
      const renderedFields = await page.evaluate(() => {
        const out = new Set<string>();
        for (const el of Array.from(
          document.querySelectorAll(
            '[data-testid^="audit-icon-"],[data-testid^="profile-chip-full-"],[data-testid^="profile-chip-compact-"]',
          ),
        )) {
          const tid = el.getAttribute("data-testid")!;
          out.add(
            tid.replace(/^(audit-icon|profile-chip-full|profile-chip-compact)-/, ""),
          );
        }
        return Array.from(out);
      });
      console.log(`${persona} dashboard rendered ${renderedFields.length} fields:`, renderedFields.slice(0, 20).join(","));

      // Specialist cards visible
      const specialistCards = await page.locator("[data-specialist-card]").count();
      console.log(`${persona} specialist cards visible: ${specialistCards}`);

      // ---- 4. Visa research page ----
      await page.goto("/visa", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(3_000);
      await page.screenshot({
        path: path.join(SHOT_DIR, `${persona}-02-visa.png`),
        fullPage: true,
      });

      // ---- 5. Guides page ----
      await page.goto("/guides", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(3_000);
      await page.screenshot({
        path: path.join(SHOT_DIR, `${persona}-03-guides.png`),
        fullPage: true,
      });

      // ---- 6. Settling-in (local requirements) ----
      await page.goto("/settling-in", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(3_000);
      await page.screenshot({
        path: path.join(SHOT_DIR, `${persona}-04-settling-in.png`),
        fullPage: true,
      });

      // Persist the rendered field list per persona
      await fs.writeFile(
        path.join(SHOT_DIR, `${persona}-rendered-fields.json`),
        JSON.stringify({ planId, renderedFields, specialistCards }, null, 2),
      );
    }
  });
});
