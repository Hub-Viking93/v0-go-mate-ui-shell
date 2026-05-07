// Phase 1C verification — Action links + booking guidance.
//
// Frontend-first per verify.md: real user flow, before/after screenshots
// of every meaningful state, click on a primary link and assert it opens
// a new tab. API check is supplementary.
//
// Three seeded settling-in tasks make the surface deterministic:
//
//   • Verify1C-BOOKING       — primary booking link + secondary
//                              official_info + form. Generic Spanish
//                              gov / Hague portal URLs (NOT Sweden) so
//                              we also prove the UI isn't hardcoded
//                              around Skatteverket-style content.
//   • Verify1C-OFFICIAL-ONLY — only official_info + portal links, none
//                              flagged primary. We assert no fake
//                              "Booking" CTA appears anywhere.
//   • Verify1C-NO-LINKS      — walkthrough with `whatThisIs` but
//                              `links` omitted. We assert the
//                              "Take action" section is NOT rendered.

import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!TEST_EMAIL || !TEST_PASSWORD || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing TEST_EMAIL/TEST_PASSWORD/SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY");
}

let admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (admin) return admin;
  admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  return admin;
}

const DAY = 24 * 60 * 60 * 1000;

const SHOTS_DIR = path.resolve(__dirname, "../../../artifacts/screenshots/verify-1c");
fs.mkdirSync(SHOTS_DIR, { recursive: true });
// Default screenshot — viewport only. fullPage:true was scrolling away
// from the Radix-portal-rendered sheet, leaving only the underlying
// checklist visible. Visual review is the point here, so we keep it
// at viewport so any open overlay is actually captured.
async function shot(page: import("@playwright/test").Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

// Wait for the Radix Sheet to finish its 500ms slide-in animation so
// screenshots actually show the open sheet (not the underlying checklist).
async function waitForSheetSettled(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-slot="sheet-content"]');
      return Boolean(el && el.getAttribute("data-state") === "open");
    },
    null,
    { timeout: 5_000 },
  );
  // Slide-in is 500ms; let it fully settle before snapping.
  await page.waitForTimeout(600);
}

const BOOKING_WALKTHROUGH = {
  whatThisIs: "Verify1C-BOOKING — apply for an NIE in Spain. Generic non-Swedish content to prove the model is country-agnostic.",
  whyItMatters: "Without an NIE you can't open a Spanish bank account or sign a long-term lease.",
  beforeYouStart: ["Passport", "Address proof"],
  steps: [{ text: "Book the appointment online" }],
  commonMistakes: ["Picking the wrong category at the appointment portal"],
  whatHappensNext: "You receive an NIE certificate at the visit.",
  links: [
    {
      url: "https://sede.policia.gob.es/portalCiudadano/extranjeria/asignacion_nie.html",
      label: "Book NIE appointment (Cita Previa)",
      linkType: "booking",
      primary: true,
      description: "Spain's official appointment portal for foreign-citizen ID assignment.",
      appointmentHint: "Choose category 'Asignación de NIE'. Pick the office in your province.",
      languageHint: "Spanish",
    },
    {
      url: "https://www.exteriores.gob.es/Consulados/londres/en/InformacionParaExtranjeros/Paginas/Index.aspx",
      label: "Official NIE info page",
      linkType: "official_info",
      description: "Eligibility and requirements from Spain's foreign ministry.",
      languageHint: "Spanish + English",
    },
    {
      url: "https://example.com/ex15-form.pdf",
      label: "EX-15 application form",
      linkType: "form",
      description: "Pre-fill at home before the appointment.",
      languageHint: "Spanish",
    },
  ],
};

const OFFICIAL_ONLY_WALKTHROUGH = {
  whatThisIs: "Verify1C-OFFICIAL-ONLY — info-only task with two reference links and no booking.",
  whyItMatters: "Just background on EU social-security treaties. No appointment to book.",
  links: [
    {
      url: "https://ec.europa.eu/social/main.jsp?catId=471",
      label: "EU posted-workers info",
      linkType: "official_info",
      description: "European Commission's overview.",
      languageHint: "English",
    },
    {
      url: "https://ec.europa.eu/social/eu_account",
      label: "EU social-security portal",
      linkType: "portal",
      description: "Log in to check your status.",
      languageHint: "English",
    },
  ],
};

const NO_LINKS_WALKTHROUGH = {
  whatThisIs: "Verify1C-NO-LINKS — task with body content but no action links.",
  whyItMatters: "Some tasks are reflective; not every step needs an external URL.",
  beforeYouStart: ["Pen + paper"],
  whatHappensNext: "You'll have notes for the next conversation.",
};

test("Phase 1C — action links + booking guidance", async ({ page, context }) => {
  page.on("console", (m) => {
    if (m.type() === "error") console.log("CONSOLE ERR:", m.text().slice(0, 200));
  });

  // ---- Resolve user + plan -------------------------------------------------
  const a = adminClient();
  let user: { id: string; email?: string | null } | null = null;
  for (let p = 1; p <= 50; p++) {
    const { data, error } = await a.auth.admin.listUsers({ page: p, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === TEST_EMAIL!.toLowerCase());
    if (found) { user = found; break; }
    if (data.users.length < 200) break;
  }
  if (!user) throw new Error(`Test user ${TEST_EMAIL} not found`);
  const userId = user.id;

  const { data: planRow } = await a
    .from("relocation_plans")
    .select("id, stage, arrival_date, post_relocation_generated")
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  if (!planRow) throw new Error("Test user has no active plan — onboard first");
  const planId = planRow.id as string;
  const priorStage = planRow.stage as string | null;
  const priorArrival = planRow.arrival_date as string | null;
  const priorGenerated = planRow.post_relocation_generated as boolean | null;

  // ---- Seed plan + 3 tasks -------------------------------------------------
  const now = new Date();
  await a
    .from("relocation_plans")
    .update({
      stage: "arrived",
      arrival_date: new Date(now.getTime() - 2 * DAY).toISOString().slice(0, 10),
      post_relocation_generated: true,
    })
    .eq("id", planId);
  await a.from("settling_in_tasks").delete().eq("plan_id", planId);

  const baseTask = {
    user_id: userId,
    plan_id: planId,
    category: "registration",
    depends_on: [],
    deadline_days: 14,
    deadline_at: new Date(now.getTime() + 14 * DAY).toISOString(),
    is_legal_requirement: false,
    deadline_type: "practical" as const,
    steps: [],
    documents_needed: [],
    official_link: null,
    estimated_time: "30 minutes",
    cost: "Free",
    status: "available",
  };
  await a.from("settling_in_tasks").insert([
    {
      ...baseTask,
      task_key: "verify-1c-booking",
      title: "Verify1C-BOOKING",
      description: "Phase 1C verify: booking + official + form links",
      sort_order: 300,
      walkthrough: BOOKING_WALKTHROUGH,
    },
    {
      ...baseTask,
      task_key: "verify-1c-official-only",
      title: "Verify1C-OFFICIAL-ONLY",
      description: "Phase 1C verify: only info / portal links",
      sort_order: 301,
      walkthrough: OFFICIAL_ONLY_WALKTHROUGH,
    },
    {
      ...baseTask,
      task_key: "verify-1c-no-links",
      title: "Verify1C-NO-LINKS",
      description: "Phase 1C verify: walkthrough but no links",
      sort_order: 302,
      walkthrough: NO_LINKS_WALKTHROUGH,
    },
  ]);

  try {
    // ---- Sign in & navigate -------------------------------------------------
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"], input[name="email"]').first().fill(TEST_EMAIL!);
    await page.locator('input[type="password"], input[name="password"]').first().fill(TEST_PASSWORD!);
    await page
      .locator('button:has-text("Sign in"), button:has-text("Log in"), button[type="submit"]')
      .first()
      .click();
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30_000 });
    await page.goto("/checklist?tab=post-move", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    const allTasksBtn = page.getByRole("button", { name: /^all tasks$/i }).first();
    if (await allTasksBtn.isVisible().catch(() => false)) {
      await allTasksBtn.click();
      await page.waitForTimeout(300);
    }
    await shot(page, "01-checklist-overview");

    // ===== API contract — links payload shape ===============================
    const apiBody = await page.evaluate(async () => {
      const r = await fetch("/api/settling-in");
      return await r.json();
    });
    const tasks = apiBody.tasks as Array<Record<string, unknown>>;
    const booking = tasks.find((t) => t.title === "Verify1C-BOOKING")!;
    const bookingLinks = (booking.walkthrough as { links?: unknown[] })?.links as Array<Record<string, unknown>>;
    expect(bookingLinks, "API: walkthrough.links present on booking task").toHaveLength(3);
    const primaryLink = bookingLinks.find((l) => l.primary === true)!;
    expect(primaryLink, "exactly one primary link").toBeTruthy();
    expect(primaryLink.url).toBe(BOOKING_WALKTHROUGH.links[0].url);
    expect(primaryLink.label).toBe(BOOKING_WALKTHROUGH.links[0].label);
    expect(primaryLink.linkType).toBe("booking");
    expect(primaryLink.description).toBe(BOOKING_WALKTHROUGH.links[0].description);
    expect(primaryLink.appointmentHint).toBe(BOOKING_WALKTHROUGH.links[0].appointmentHint);
    expect(primaryLink.languageHint).toBe(BOOKING_WALKTHROUGH.links[0].languageHint);

    // ===== Booking task — full Take Action surface ==========================
    const bookingHeading = page.getByRole("heading", { name: "Verify1C-BOOKING" }).first();
    await expect(bookingHeading).toBeVisible({ timeout: 15_000 });
    await bookingHeading.click();
    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await waitForSheetSettled(page);
    await shot(page, "02-booking-sheet-open");

    // "Take action" header is present.
    await expect(dialog.getByRole("heading", { name: "Take action" })).toBeVisible();
    // Primary CTA card — labelled BOOKING + the seeded label.
    const primaryAnchor = dialog.locator(`a[href="${BOOKING_WALKTHROUGH.links[0].url}"]`).first();
    await expect(primaryAnchor).toBeVisible();
    await expect(primaryAnchor).toContainText(BOOKING_WALKTHROUGH.links[0].label);
    await expect(primaryAnchor).toContainText(/booking/i);
    // Appointment hint syns under primärkortet.
    await expect(dialog.getByText(BOOKING_WALKTHROUGH.links[0].appointmentHint!)).toBeVisible();
    // Description on the primary card is rendered too.
    await expect(dialog.getByText(BOOKING_WALKTHROUGH.links[0].description!)).toBeVisible();
    // Language hint badge present.
    await expect(dialog.getByText("Spanish").first()).toBeVisible();

    // Secondary rows — OFFICIAL SOURCE + FORM badges with distinct labels.
    const officialAnchor = dialog.locator(`a[href="${BOOKING_WALKTHROUGH.links[1].url}"]`).first();
    const formAnchor = dialog.locator(`a[href="${BOOKING_WALKTHROUGH.links[2].url}"]`).first();
    await expect(officialAnchor).toBeVisible();
    await expect(officialAnchor).toContainText(BOOKING_WALKTHROUGH.links[1].label);
    await expect(officialAnchor).toContainText(/official source/i);
    await expect(formAnchor).toBeVisible();
    await expect(formAnchor).toContainText(BOOKING_WALKTHROUGH.links[2].label);
    await expect(formAnchor).toContainText(/^.*form.*$/i);

    // Visual distinction proof — the three anchors must have DIFFERENT
    // background-color computed styles (each linkType has its own tone
    // class). We compare the icon-bg span inside each anchor.
    async function iconBgColor(anchor: import("@playwright/test").Locator): Promise<string> {
      // Find the first <span> child that holds the icon (round-rect bg).
      const iconSpan = anchor.locator("span").first();
      return await iconSpan.evaluate((el) => getComputedStyle(el).backgroundColor);
    }
    const primaryBg = await iconBgColor(primaryAnchor);
    const officialBg = await iconBgColor(officialAnchor);
    const formBg = await iconBgColor(formAnchor);
    expect(primaryBg, "primary bg").not.toBe(officialBg);
    expect(officialBg, "official bg").not.toBe(formBg);
    expect(primaryBg, "primary bg vs form").not.toBe(formBg);

    // ----- Click the primary link → new tab opens with the right URL -------
    const newPagePromise = context.waitForEvent("page", { timeout: 10_000 });
    await primaryAnchor.click({ modifiers: [] });
    const newPage = await newPagePromise;
    await newPage.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
    expect(newPage.url(), "new-tab URL matches the seeded primary link").toContain(
      "policia.gob.es/portalCiudadano/extranjeria/asignacion_nie.html",
    );
    await shot(newPage, "03-primary-link-opened");
    await newPage.close();

    // Sheet still open, original tab unchanged.
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    // ===== Official-only task — no fake booking CTA =========================
    const officialOnlyHeading = page.getByRole("heading", { name: "Verify1C-OFFICIAL-ONLY" }).first();
    await expect(officialOnlyHeading).toBeVisible();
    await officialOnlyHeading.click();
    const dialog2 = page.getByRole("dialog").first();
    await expect(dialog2).toBeVisible({ timeout: 10_000 });
    await waitForSheetSettled(page);
    await shot(page, "04-official-only-sheet");

    // "Take action" still appears (links exist), but…
    await expect(dialog2.getByRole("heading", { name: "Take action" })).toBeVisible();
    // No "Booking" badge anywhere.
    await expect(dialog2.getByText(/^booking$/i)).toHaveCount(0);
    // Both info + portal anchors render with their tagged badges.
    const ecAnchor = dialog2.locator(
      `a[href="${OFFICIAL_ONLY_WALKTHROUGH.links[0].url}"]`,
    ).first();
    const portalAnchor = dialog2.locator(
      `a[href="${OFFICIAL_ONLY_WALKTHROUGH.links[1].url}"]`,
    ).first();
    await expect(ecAnchor).toContainText(/official source/i);
    await expect(portalAnchor).toContainText(/portal/i);
    // Without `primary: true`, the surface should NOT promote anything as
    // the headline CTA. Rendering-wise this means none of the anchors is
    // rendered as the gradient PrimaryActionCard (block + larger). We
    // approximate by checking that the rendered card heights are similar
    // (secondaries are ~36px, primary is ~80-100px). All three cards
    // should fall in the secondary band.
    const ecBox = await ecAnchor.boundingBox();
    const portalBox = await portalAnchor.boundingBox();
    expect(ecBox).toBeTruthy();
    expect(portalBox).toBeTruthy();
    // Both have similar height (no primary inflation).
    expect(Math.abs((ecBox!.height) - (portalBox!.height))).toBeLessThanOrEqual(8);

    await page.keyboard.press("Escape");
    await expect(dialog2).toHaveCount(0);

    // ===== No-links task — Take Action absent ===============================
    const noLinksHeading = page.getByRole("heading", { name: "Verify1C-NO-LINKS" }).first();
    await expect(noLinksHeading).toBeVisible();
    await noLinksHeading.click();
    const dialog3 = page.getByRole("dialog").first();
    await expect(dialog3).toBeVisible({ timeout: 10_000 });
    await waitForSheetSettled(page);
    await shot(page, "05-no-links-sheet");

    // The walkthrough still renders…
    await expect(dialog3.getByText(NO_LINKS_WALKTHROUGH.whatThisIs)).toBeVisible();
    // …but Take Action must NOT be rendered.
    await expect(dialog3.getByRole("heading", { name: "Take action" })).toHaveCount(0);
    // No anchor with example.com (no orphan links).
    await expect(dialog3.locator("a[href*='example.com']")).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(dialog3).toHaveCount(0);
    await shot(page, "06-checklist-after-all-sheets");
  } finally {
    await a.from("settling_in_tasks").delete().eq("plan_id", planId);
    await a
      .from("relocation_plans")
      .update({
        stage: priorStage,
        arrival_date: priorArrival,
        post_relocation_generated: priorGenerated ?? false,
      })
      .eq("id", planId);
  }
});
