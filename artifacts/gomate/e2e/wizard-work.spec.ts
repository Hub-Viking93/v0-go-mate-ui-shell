import { test } from "@playwright/test"
import {
  loginAndStart,
  wipePlan,
  fillProfile,
  fillDestination,
  fillWork,
  fillVisaFinance,
  captureReview,
  verifyDashboard,
} from "./wizard-helpers"

test("wizard / work persona / Marcus → Germany", async ({ page }) => {
  test.setTimeout(180_000)
  const slug = "work"
  await wipePlan()
  await loginAndStart(page)

  await fillProfile(page, slug, {
    name: "Marcus",
    birthYear: "1992",
    citizenship: "Sweden",
    currentLocation: "Sweden",
  })

  await fillDestination(page, slug, {
    destination: "Germany",
    city: "Berlin",
    purpose: "Work",
    durationLabel: "1–2 years",
  })

  await fillWork(page, slug, {
    jobOfferLabel: "I already have a job offer",
    jobFieldLabel: "Tech / IT",
    educationLabel: "Master's degree",
    yearsExperienceLabel: "5–9 years",
    highlySkilledLabel: "Yes",
    employerSponsorshipLabel: "Yes",
    postingOrSecondmentLabel: "No",
  })

  await fillVisaFinance(page, slug, {
    savings: "50000",
    preFirstPaycheckLabel: "Own savings",
    priorVisaLabel: "No",
    visaRejectionsLabel: "No",
    criminalRecordLabel: "No",
    healthcareNeedsLabel: "None",
    petsLabel: "None",
  })

  await captureReview(page, slug)

  await verifyDashboard(page, slug, [
    "Marcus",
    "Germany",
    "Berlin",
    "Sweden",
    "Work",
  ])
})
