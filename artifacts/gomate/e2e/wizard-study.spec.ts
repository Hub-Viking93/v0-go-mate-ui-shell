import { test } from "@playwright/test"
import {
  loginAndStart,
  wipePlan,
  fillProfile,
  fillDestination,
  fillStudy,
  fillVisaFinance,
  captureReview,
  verifyDashboard,
} from "./wizard-helpers"

test("wizard / study persona / Sofia → Japan", async ({ page }) => {
  test.setTimeout(180_000)
  const slug = "study"
  await wipePlan()
  await loginAndStart(page)

  await fillProfile(page, slug, {
    name: "Sofia",
    birthYear: "1998",
    citizenship: "Italy",
    currentLocation: "Italy",
  })

  await fillDestination(page, slug, {
    destination: "Japan",
    city: "Tokyo",
    purpose: "Study",
    durationLabel: "1–2 years",
  })

  await fillStudy(page, slug, {
    studyType: "University",
    studyField: "Computer Science",
    educationLabel: "Bachelor's degree",
    fundingLabel: "Own savings",
  })

  await fillVisaFinance(page, slug, {
    savings: "25000",
    workWhileStudyingLabel: "Yes, part-time",
    priorVisaLabel: "No",
    visaRejectionsLabel: "No",
    criminalRecordLabel: "No",
    healthcareNeedsLabel: "None",
    petsLabel: "None",
  })

  await captureReview(page, slug)

  await verifyDashboard(page, slug, [
    "Sofia",
    "Japan",
    "Tokyo",
    "Italy",
    "Study",
    "Computer Science",
  ])
})
