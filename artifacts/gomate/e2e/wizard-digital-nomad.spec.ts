import { test } from "@playwright/test"
import {
  loginAndStart,
  wipePlan,
  fillProfile,
  fillDestination,
  fillDigitalNomad,
  fillVisaFinance,
  captureReview,
  verifyDashboard,
} from "./wizard-helpers"

test("wizard / digital-nomad persona / Alex → Spain", async ({ page }) => {
  test.setTimeout(180_000)
  const slug = "digital-nomad"
  await wipePlan()
  await loginAndStart(page)

  await fillProfile(page, slug, {
    name: "Alex",
    birthYear: "1995",
    citizenship: "Canada",
    currentLocation: "Canada",
  })

  await fillDestination(page, slug, {
    destination: "Spain",
    city: "Barcelona",
    purpose: "Digital nomad",
    durationLabel: "6–12 months",
  })

  await fillDigitalNomad(page, slug, {
    remoteIncomeLabel: "Yes",
    incomeSourceLabel: "Freelance",
    monthlyIncome: "4500",
    incomeConsistencyLabel: "Stable",
    incomeHistoryLabel: "12+ months",
    keepCurrentLabel: "Yes",
    foreignIncomeLabel: "Yes",
  })

  await fillVisaFinance(page, slug, {
    savings: "30000",
    incomeCoversLivingLabel: "Yes",
    priorVisaLabel: "No",
    visaRejectionsLabel: "No",
    criminalRecordLabel: "No",
    healthcareNeedsLabel: "None",
    petsLabel: "None",
  })

  await captureReview(page, slug)

  await verifyDashboard(page, slug, [
    "Alex",
    "Spain",
    "Barcelona",
    "Canada",
    // Digital nomad renders as "Digital Nomad" in PURPOSE_LABELS
    "Digital",
  ])
})
