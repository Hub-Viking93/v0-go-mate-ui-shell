// Wizard E2E helpers — frontend-only verification of the new
// onboarding flow. Drives the 5-step wizard via real DOM
// interactions (no mock data, no LLM extraction). Each persona
// flow:
//   1. login → wipe plan_data → /onboarding/profile
//   2. drive each step, screenshot at the top of each page
//   3. stop on /onboarding/review (do NOT click "Generate plan")
//   4. navigate to /dashboard, click through every tab
//   5. assert persona-specific values render across tabs

import { Page, expect } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, "../../..")
export const SHOTS_DIR = path.join(REPO_ROOT, "artifacts/screenshots/wizard-personas")

const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!TEST_EMAIL || !TEST_PASSWORD) {
  throw new Error("TEST_EMAIL and TEST_PASSWORD must be set")
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
}

const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let TEST_USER_ID: string | null = null

async function resolveTestUserId(): Promise<string> {
  if (TEST_USER_ID) return TEST_USER_ID
  const { data, error } = await sbAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) throw error
  const u = data.users.find((x) => x.email?.toLowerCase() === TEST_EMAIL!.toLowerCase())
  if (!u) throw new Error(`Test user ${TEST_EMAIL} not found`)
  TEST_USER_ID = u.id
  return u.id
}

export async function wipePlan(): Promise<void> {
  const userId = await resolveTestUserId()
  await sbAdmin.from("relocation_plans").delete().eq("user_id", userId)
  await sbAdmin.from("chat_messages").delete().eq("user_id", userId).then(
    () => null,
    () => null,
  )
}

export async function shot(page: Page, slug: string, num: string, desc: string): Promise<void> {
  const dir = path.join(SHOTS_DIR, slug)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${num}-${desc}.png`)
  await page.screenshot({ path: file, fullPage: true })
}

// ---------- login + nav -------------------------------------------------

export async function loginAndStart(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" })
  await page.waitForURL(/\/auth\/login/, { timeout: 20_000 })
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL!)
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD!)
  await page.locator('button[type="submit"]').first().click()
  // After wipe, sign-in lands either on /onboarding (welcome) or
  // /dashboard. Force /onboarding/profile to start the wizard cleanly.
  await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 30_000 })
  await page.goto("/onboarding/profile", { waitUntil: "domcontentloaded" })
  await page.waitForURL(/\/onboarding\/profile/)
}

// ---------- wizard primitives ------------------------------------------

/** Click a pill chip by visible label inside the OptionPills group. */
async function clickPill(page: Page, label: string): Promise<void> {
  const pill = page.getByRole("radio", { name: label, exact: true }).first()
  await pill.click()
}

/** Pick a country in a CountrySelect combobox, identified by element id. */
async function pickCountryById(page: Page, id: string, country: string): Promise<void> {
  // Defensive: ensure no popover from a previous combobox is still open.
  await page.keyboard.press("Escape").catch(() => null)
  await page.waitForTimeout(150)

  const trigger = page.locator(`#${id}`)
  await trigger.click()
  // Wait for the popover's command input to be ready.
  const search = page.getByPlaceholder("Search countries…").first()
  await search.waitFor({ state: "visible", timeout: 5000 })
  await search.fill(country)
  // Click the first cmdk-item that contains the country text. This avoids
  // accessible-name matching against the country flag's alt text.
  await page
    .locator("[cmdk-item]")
    .filter({ hasText: country })
    .first()
    .click({ timeout: 5000 })
  // Verify the trigger now displays the picked country (sanity check).
  await trigger.locator(`text=${country}`).waitFor({ state: "visible", timeout: 5000 })
}

/** Pick an option in a shadcn Select by aria-label and option text. */
async function pickSelect(page: Page, ariaLabel: string, optionLabel: string): Promise<void> {
  const trigger = page.getByRole("combobox", { name: ariaLabel }).first()
  await trigger.click()
  await page.getByRole("option", { name: optionLabel, exact: true }).first().click()
}

/** Pick a year from the Year-of-birth Select (id=birth_year). */
async function pickYear(page: Page, year: string): Promise<void> {
  await page.locator("#birth_year").click()
  await page.getByRole("option", { name: year, exact: true }).first().click()
}

/** Pick the duration dropdown on /onboarding/destination. */
async function pickDuration(page: Page, optionLabel: string): Promise<void> {
  // Duration trigger is identified by its initial placeholder "Select duration"
  // but after selection it shows the chosen label. We target it by id.
  const trigger = page.locator("#duration").first()
  await trigger.click()
  await page.getByRole("option", { name: optionLabel, exact: true }).first().click()
}

/** Pick the education-level dropdown. */
async function pickEducation(page: Page, optionLabel: string): Promise<void> {
  const trigger = page.locator("#education_level").first()
  await trigger.click()
  await page.getByRole("option", { name: optionLabel, exact: true }).first().click()
}

/** Click the "I haven't decided yet — I'm flexible" toggle on the date picker. */
async function setTimelineFlexible(page: Page): Promise<void> {
  await page.getByLabel(/I haven't decided yet/).check()
}

/** Pick a purpose card on /onboarding/destination. */
async function pickPurpose(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: new RegExp(`^${label}\\b`, "i") }).first().click()
}

async function clickContinue(page: Page): Promise<void> {
  await page.getByRole("button", { name: /save & continue/i }).first().click()
}

// ---------- step drivers -----------------------------------------------

export interface ProfileAnswers {
  name: string
  birthYear: string
  citizenship: string  // display label e.g. "Italy"
  currentLocation: string
  // languages auto-default; we don't add manually
}

export async function fillProfile(page: Page, slug: string, p: ProfileAnswers): Promise<void> {
  await page.waitForURL(/\/onboarding\/profile/)
  await page.locator('input#name').fill(p.name)
  await pickYear(page, p.birthYear)
  await pickCountryById(page, "citizenship", p.citizenship)
  await pickCountryById(page, "current_location", p.currentLocation)
  // wait a beat so the language-default effect populates the list
  await page.waitForTimeout(500)
  await shot(page, slug, "01", "profile-filled")
  await clickContinue(page)
}

export interface DestinationAnswers {
  destination: string
  city: string | null
  purpose: "Work" | "Study" | "Digital nomad" | "Settle"
  durationLabel: string
}

export async function fillDestination(
  page: Page,
  slug: string,
  d: DestinationAnswers,
): Promise<void> {
  await page.waitForURL(/\/onboarding\/destination/)
  await pickCountryById(page, "destination", d.destination)
  if (d.city) {
    await page.locator('input#target_city').fill(d.city)
  }
  await pickPurpose(page, d.purpose)
  await setTimelineFlexible(page)
  await pickDuration(page, d.durationLabel)
  await shot(page, slug, "02", "destination-filled")
  await clickContinue(page)
}

// --- /onboarding/study --------------------------------------------------

export interface StudyAnswers {
  studyType: string  // pill label
  studyField: string
  educationLabel: string
  fundingLabel: string
}

export async function fillStudy(page: Page, slug: string, s: StudyAnswers): Promise<void> {
  await page.waitForURL(/\/onboarding\/study/)
  await clickPill(page, s.studyType)
  await page.locator('input#study_field').fill(s.studyField)
  await pickEducation(page, s.educationLabel)
  await clickPill(page, s.fundingLabel)
  await shot(page, slug, "03", "study-filled")
  await clickContinue(page)
}

// --- /onboarding/work ---------------------------------------------------

export interface WorkAnswers {
  jobOfferLabel: string
  jobFieldLabel: string
  educationLabel: string
  yearsExperienceLabel: string
  highlySkilledLabel: string
  employerSponsorshipLabel?: string  // gated
  postingOrSecondmentLabel: string
}

export async function fillWork(page: Page, slug: string, w: WorkAnswers): Promise<void> {
  await page.waitForURL(/\/onboarding\/work/)
  await clickPill(page, w.jobOfferLabel)
  await clickPill(page, w.jobFieldLabel)
  await pickEducation(page, w.educationLabel)
  await clickPill(page, w.yearsExperienceLabel)
  await clickPill(page, w.highlySkilledLabel)
  if (w.employerSponsorshipLabel) {
    // employer_sponsorship + posting_or_secondment both render Yes/No/Not
    // sure pills. Disambiguate via radiogroup aria-label.
    const sponsor = page.getByRole("radiogroup", { name: "Employer sponsorship" })
    await sponsor.getByRole("radio", { name: w.employerSponsorshipLabel, exact: true }).click()
  }
  const posting = page.getByRole("radiogroup", { name: "Posting or secondment" })
  await posting.getByRole("radio", { name: w.postingOrSecondmentLabel, exact: true }).click()
  await shot(page, slug, "03", "work-filled")
  await clickContinue(page)
}

// --- /onboarding/settle -------------------------------------------------

export interface SettleAnswers {
  settlementReasonLabel: string
  familyTiesLabel: string
  occupation: string
  educationLabel: string
  hasSpecialRequirementsLabel: "No, nothing special" | "Yes"
}

export async function fillSettle(page: Page, slug: string, s: SettleAnswers): Promise<void> {
  await page.waitForURL(/\/onboarding\/settle/)
  await clickPill(page, s.settlementReasonLabel)
  // family_ties uses Yes/No — disambiguate via radiogroup aria-label
  await page
    .getByRole("radiogroup", { name: "Family ties" })
    .getByRole("radio", { name: s.familyTiesLabel, exact: true })
    .click()
  await page.locator('input#current_occupation').fill(s.occupation)
  await pickEducation(page, s.educationLabel)
  await page
    .getByRole("radiogroup", { name: "Has special requirements" })
    .getByRole("radio", { name: s.hasSpecialRequirementsLabel, exact: true })
    .click()
  await shot(page, slug, "03", "settle-filled")
  await clickContinue(page)
}

// --- /onboarding/digital-nomad -----------------------------------------

export interface DnAnswers {
  remoteIncomeLabel: "Yes" | "No"
  incomeSourceLabel: string
  monthlyIncome: string
  incomeConsistencyLabel: string
  incomeHistoryLabel: string
  keepCurrentLabel: string
  foreignIncomeLabel: string
}

export async function fillDigitalNomad(page: Page, slug: string, d: DnAnswers): Promise<void> {
  await page.waitForURL(/\/onboarding\/digital-nomad/)
  await page
    .getByRole("radiogroup", { name: "Remote income" })
    .getByRole("radio", { name: d.remoteIncomeLabel, exact: true })
    .click()
  await clickPill(page, d.incomeSourceLabel)
  await page.locator('input[inputmode="numeric"]').first().fill(d.monthlyIncome)
  await clickPill(page, d.incomeConsistencyLabel)
  await clickPill(page, d.incomeHistoryLabel)
  await page
    .getByRole("radiogroup", { name: "Keep current remote work" })
    .getByRole("radio", { name: d.keepCurrentLabel, exact: true })
    .click()
  await page
    .getByRole("radiogroup", { name: "Foreign income only" })
    .getByRole("radio", { name: d.foreignIncomeLabel, exact: true })
    .click()
  await shot(page, slug, "03", "dn-filled")
  await clickContinue(page)
}

// --- /onboarding/visa-finance ------------------------------------------

export interface VisaFinanceAnswers {
  savings: string
  // purpose-specific (all optional — only the relevant one renders)
  workWhileStudyingLabel?: string
  preFirstPaycheckLabel?: string
  settlementSupportLabel?: string
  incomeCoversLivingLabel?: string
  // universal
  priorVisaLabel: "Yes" | "No"
  visaRejectionsLabel: "Yes" | "No"
  criminalRecordLabel: "Yes" | "No"
  healthcareNeedsLabel: "None" | "Chronic condition" | "Disability"
  prescriptionMedicationsLabel?: "Yes" | "No"
  petsLabel: "None" | "Dog" | "Cat" | "Other"
}

export async function fillVisaFinance(
  page: Page,
  slug: string,
  vf: VisaFinanceAnswers,
): Promise<void> {
  await page.waitForURL(/\/onboarding\/visa-finance/)

  // Money: savings (use the numeric input regardless of which currency is auto-selected)
  await page.locator('input[inputmode="numeric"]').first().fill(vf.savings)

  if (vf.workWhileStudyingLabel) {
    await page
      .getByRole("radiogroup", { name: "Work while studying" })
      .getByRole("radio", { name: vf.workWhileStudyingLabel, exact: true })
      .click()
  }
  if (vf.preFirstPaycheckLabel) {
    await page
      .getByRole("radiogroup", { name: "Pre-first-paycheck support" })
      .getByRole("radio", { name: vf.preFirstPaycheckLabel, exact: true })
      .click()
  }
  if (vf.settlementSupportLabel) {
    await page
      .getByRole("radiogroup", { name: "Settlement support source" })
      .getByRole("radio", { name: vf.settlementSupportLabel, exact: true })
      .click()
  }
  if (vf.incomeCoversLivingLabel) {
    await page
      .getByRole("radiogroup", { name: "Income covers living costs" })
      .getByRole("radio", { name: vf.incomeCoversLivingLabel, exact: true })
      .click()
  }

  // Visa history
  await page
    .getByRole("radiogroup", { name: "Prior visa" })
    .getByRole("radio", { name: vf.priorVisaLabel, exact: true })
    .click()
  await page
    .getByRole("radiogroup", { name: "Visa rejections" })
    .getByRole("radio", { name: vf.visaRejectionsLabel, exact: true })
    .click()
  await page
    .getByRole("radiogroup", { name: "Criminal record" })
    .getByRole("radio", { name: vf.criminalRecordLabel, exact: true })
    .click()

  // Special circumstances
  await page
    .getByRole("radiogroup", { name: "Healthcare needs" })
    .getByRole("radio", { name: vf.healthcareNeedsLabel, exact: true })
    .click()
  if (vf.prescriptionMedicationsLabel && vf.healthcareNeedsLabel !== "None") {
    await page
      .getByRole("radiogroup", { name: "Prescription medications" })
      .getByRole("radio", { name: vf.prescriptionMedicationsLabel, exact: true })
      .click()
  }
  await page
    .getByRole("radiogroup", { name: "Pets" })
    .getByRole("radio", { name: vf.petsLabel, exact: true })
    .click()

  await shot(page, slug, "04", "visa-finance-filled")
  await clickContinue(page)
}

// --- /onboarding/review (we stop here) ---------------------------------

export async function captureReview(page: Page, slug: string): Promise<void> {
  await page.waitForURL(/\/onboarding\/review/)
  // Wait for the rows to hydrate
  await expect(page.getByRole("heading", { name: /review your details/i })).toBeVisible()
  await shot(page, slug, "05", "review")
}

// --- dashboard verification --------------------------------------------

export async function verifyDashboard(
  page: Page,
  slug: string,
  expectedTexts: string[],
): Promise<void> {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" })
  await expect(page.getByRole("tab", { name: /^Overview/ })).toBeVisible({
    timeout: 15_000,
  })

  // Click each tab + screenshot. Tab order: Overview, Profile, Visa & Legal, Money, Settling
  const tabs = ["Overview", "Profile", "Visa & Legal", "Money", "Settling"]
  for (const [i, tab] of tabs.entries()) {
    await page.getByRole("tab", { name: new RegExp(`^${tab}\\b`) }).first().click()
    await page.waitForTimeout(800)
    await shot(page, slug, `06-${i + 1}`, `dashboard-${tab.toLowerCase().replace(/\s|&/g, "-")}`)
  }

  // After tab loop, return to Profile tab and run text assertions —
  // most persona-specific values render in the Profile details card.
  await page.getByRole("tab", { name: /^Profile/ }).first().click()
  await page.waitForTimeout(500)
  for (const text of expectedTexts) {
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    })
  }
  await shot(page, slug, "07", "dashboard-profile-asserts")
}
