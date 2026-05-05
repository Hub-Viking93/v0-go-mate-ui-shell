import { test } from "@playwright/test"
import {
  loginAndStart,
  wipePlan,
  fillProfile,
  fillDestination,
  fillSettle,
  fillVisaFinance,
  captureReview,
  verifyDashboard,
} from "./wizard-helpers"

test("wizard / settle persona / Dolores → Portugal", async ({ page }) => {
  test.setTimeout(180_000)
  const slug = "settle"
  await wipePlan()
  await loginAndStart(page)

  await fillProfile(page, slug, {
    name: "Dolores",
    birthYear: "1955",
    citizenship: "United States",
    currentLocation: "United States",
  })

  await fillDestination(page, slug, {
    destination: "Portugal",
    city: "Lisbon",
    purpose: "Settle",
    durationLabel: "3+ years / permanent",
  })

  await fillSettle(page, slug, {
    settlementReasonLabel: "Retirement",
    familyTiesLabel: "No",
    occupation: "Retired",
    educationLabel: "Bachelor's degree",
    hasSpecialRequirementsLabel: "No, nothing special",
  })

  await fillVisaFinance(page, slug, {
    savings: "250000",
    settlementSupportLabel: "Pension / retirement income",
    priorVisaLabel: "No",
    visaRejectionsLabel: "No",
    criminalRecordLabel: "No",
    healthcareNeedsLabel: "Chronic condition",
    prescriptionMedicationsLabel: "Yes",
    petsLabel: "None",
  })

  await captureReview(page, slug)

  await verifyDashboard(page, slug, [
    "Dolores",
    "Portugal",
    "Lisbon",
    "Settlement",
    "Retirement",
  ])
})
