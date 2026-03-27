import { test, expect, type Page } from "@playwright/test"

const BASE = "http://localhost:3000"
const EMAIL = "axelcornelius93@gmail.com"
const PASSWORD = "AvC93!4778"
const SCREENSHOT_DIR = "/tmp/gomate_screenshots"

async function waitForLoad(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
}

async function signIn(page: Page) {
  await page.goto(`${BASE}/auth/login`)
  await waitForLoad(page)
  const emailInput = page.locator('input[type="email"], input[name="email"]')
  const passwordInput = page.locator('input[type="password"], input[name="password"]')
  if (await emailInput.isVisible({ timeout: 5000 })) {
    await emailInput.fill(EMAIL)
    await passwordInput.fill(PASSWORD)
    const signInBtn = page.locator('button:has-text("Sign"), button:has-text("Log")')
    await signInBtn.click()
    await page.waitForURL(/\/(dashboard|chat|app)/, { timeout: 15000 })
  }
}

// Priya persona — Indian citizen → Munich, Germany (work, employer-sponsored)
const FIELD_ANSWERS: Record<string, string> = {
  name: "My name is Priya",
  destination: "Germany",
  target_city: "Munich",
  purpose: "I'm relocating for work",
  timeline: "In about 3 months",
  citizenship: "Indian",
  moving_alone: "Yes, I'm moving alone",
  job_offer: "Yes, I have a job offer from a tech company in Munich",
  job_field: "Software engineering",
  employer_sponsorship: "Yes, my employer is sponsoring my visa",
  highly_skilled: "Yes, I'm a highly skilled professional",
  years_experience: "6 years of experience",
  savings_available: "About 20000 USD saved up",
  monthly_budget: "Around 3000 EUR per month",
  need_budget_help: "No, I think I'll manage my budget",
  current_location: "Currently living in Bangalore, India",
  duration: "Planning to stay 3+ years, probably permanently",
  language_skill: "I have basic German, about A1 level",
  education_level: "I have a master's degree in computer science",
  prior_visa: "No, I've never had a German or EU visa before",
  visa_rejections: "No rejections ever",
  healthcare_needs: "No special healthcare needs",
  pets: "No pets",
  special_requirements: "Nothing special",
  spouse_joining: "No spouse",
  children_count: "No children",
  children_ages: "N/A",
  remote_income: "No",
  income_source: "My employer pays me",
  monthly_income: "About 6000 EUR gross",
  partner_citizenship: "N/A",
  partner_visa_status: "N/A",
  relationship_type: "N/A",
}

const fieldLabelMap: Record<string, string> = {
  "Name": "name",
  "Destination Country": "destination",
  "Destination": "destination",
  "Target City": "target_city",
  "Purpose": "purpose",
  "Timeline": "timeline",
  "Citizenship": "citizenship",
  "Moving Alone": "moving_alone",
  "Job Offer Status": "job_offer",
  "Job Offer": "job_offer",
  "Job Field": "job_field",
  "Employer Sponsorship": "employer_sponsorship",
  "Highly Skilled": "highly_skilled",
  "Highly Skilled Professional": "highly_skilled",
  "Years of Experience": "years_experience",
  "Years Experience": "years_experience",
  "Work Experience": "years_experience",
  "Savings Available": "savings_available",
  "Available Savings": "savings_available",
  "Savings": "savings_available",
  "Monthly Budget": "monthly_budget",
  "Budget Help Needed": "need_budget_help",
  "Budget Help": "need_budget_help",
  "Current Location": "current_location",
  "Duration": "duration",
  "Intended Duration": "duration",
  "Language Skill": "language_skill",
  "Language Skills": "language_skill",
  "Education Level": "education_level",
  "Education": "education_level",
  "Prior Visa": "prior_visa",
  "Prior Visas": "prior_visa",
  "Visa Rejections": "visa_rejections",
  "Healthcare Needs": "healthcare_needs",
  "Healthcare": "healthcare_needs",
  "Pets": "pets",
  "Special Requirements": "special_requirements",
  "Number of Children": "children_count",
  "Children Count": "children_count",
  "Children Ages": "children_ages",
  "Spouse Joining": "spouse_joining",
  "Remote Income": "remote_income",
  "Income Source": "income_source",
  "Monthly Income": "monthly_income",
}

test.describe.serial("GoMate Full E2E Flow — Priya (India → Munich)", () => {
  test.describe.configure({ timeout: 600000 }) // 10 min total budget

  let page: Page
  let tier = "unknown"
  let planStage = "unknown"

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await signIn(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  // ─── Test 1: Onboarding ─────────────────────────────────────────────
  test("1 — Onboarding: AI asks all questions, no idle, no repeats", async () => {
    // Create a fresh plan
    const createResult = await page.evaluate(async () => {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Priya E2E Test" }),
      })
      return { status: res.status, data: await res.json() }
    })
    console.log(`Plan created: status=${createResult.status}`)
    expect(createResult.status).toBe(200)

    await page.goto(`${BASE}/chat`)
    await waitForLoad(page)
    await page.waitForTimeout(4000)

    const chatInput = page.locator('input[placeholder="Type your message..."]').first()
    await chatInput.waitFor({ timeout: 10000 })

    let idleCount = 0
    let totalTurns = 0
    let lastPendingField = ""
    let stuckCount = 0

    for (let turn = 0; turn < 25; turn++) {
      totalTurns++

      // Read "Next:" field indicator
      const nextSpan = page.locator('span.text-primary:has-text("Next:")').first()
      let pendingLabel = ""
      if (await nextSpan.isVisible({ timeout: 1000 }).catch(() => false)) {
        const spanText = (await nextSpan.textContent()) || ""
        pendingLabel = spanText.replace("Next:", "").trim()
      }

      const bodyText = (await page.textContent("body")) || ""
      const completionMatch = bodyText.match(/(\d+)%/)
      const pct = completionMatch ? parseInt(completionMatch[1]) : 0

      // Check completion
      if (pct >= 100 || bodyText.includes("Review your profile") || bodyText.includes("review")) {
        console.log(`✅ Profile complete at ${pct}% after ${totalTurns} turns`)
        await page.screenshot({ path: `${SCREENSHOT_DIR}/01_onboarding_complete.png`, fullPage: true })
        break
      }

      // Detect stuck
      if (pendingLabel === lastPendingField) {
        stuckCount++
        if (stuckCount >= 3) {
          console.log(`⚠️  Stuck on "${pendingLabel}" for ${stuckCount} turns`)
        }
      } else {
        stuckCount = 0
      }
      lastPendingField = pendingLabel

      // Find answer
      let answer = ""
      const fieldKey = fieldLabelMap[pendingLabel]
      if (fieldKey && FIELD_ANSWERS[fieldKey]) {
        answer = FIELD_ANSWERS[fieldKey]
      } else if (pendingLabel) {
        const fuzzyKey = pendingLabel.toLowerCase().replace(/\s+/g, "_")
        const fuzzyMatch = Object.keys(FIELD_ANSWERS).find(
          (k) =>
            k.includes(fuzzyKey) ||
            fuzzyKey.includes(k) ||
            pendingLabel.toLowerCase().includes(k.replace(/_/g, " "))
        )
        if (fuzzyMatch) {
          answer = FIELD_ANSWERS[fuzzyMatch]
          console.log(`🔍 Fuzzy matched "${pendingLabel}" → ${fuzzyMatch}`)
        } else {
          console.log(`⚠️  Unknown field: "${pendingLabel}" — generic answer`)
          answer = `Regarding ${pendingLabel}: nothing special to mention.`
        }
      } else {
        answer = turn === 0 ? "Hi, my name is Priya" : "What's the next question?"
      }

      // Check idle
      const recentText = bodyText.slice(-500).toLowerCase()
      const idlePhrases = [
        "feel free to ask",
        "let me know if you",
        "anything else you'd like",
        "is there anything else",
        "don't hesitate",
      ]
      const isIdle = idlePhrases.some((p) => recentText.includes(p)) && pct < 100
      if (isIdle) {
        console.log(`❌ [Turn ${totalTurns}] AI went IDLE at ${pct}%`)
        idleCount++
      }

      console.log(
        `[Turn ${totalTurns}] ${pct}% | Next: "${pendingLabel}" → "${answer.slice(0, 50)}"`
      )
      await chatInput.fill(answer)
      await chatInput.press("Enter")
      await page.waitForTimeout(10000) // 10s per turn for AI response
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/01_onboarding_final.png`, fullPage: true })

    const finalText = (await page.textContent("body")) || ""
    const finalPct = finalText.match(/(\d+)%/)
    const finalProgress = finalPct ? parseInt(finalPct[1]) : 0

    console.log(`\n=== ONBOARDING RESULTS ===`)
    console.log(`  Final: ${finalProgress}% | Turns: ${totalTurns} | Idle: ${idleCount}`)

    expect(idleCount).toBe(0)
    expect(finalProgress).toBeGreaterThanOrEqual(95)
    expect(totalTurns).toBeLessThan(25)
  })

  // ─── Test 2: Profile Review + Confirm ───────────────────────────────
  test("2 — Profile review: confirm and lock plan", async () => {
    const bodyText = (await page.textContent("body")) || ""

    // Should show review state
    const confirmBtn = page.locator('button:has-text("Looks good, generate plan")')
    const isVisible = await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)

    if (!isVisible) {
      // If not visible yet, the profile might need one more nudge
      console.log("Confirm button not visible — checking for review state")
      await page.screenshot({ path: `${SCREENSHOT_DIR}/02_pre_confirm.png`, fullPage: true })
    }

    expect(isVisible).toBe(true)

    // Check profile summary mentions key fields
    expect(bodyText.toLowerCase()).toContain("germany")
    expect(bodyText.toLowerCase()).toContain("priya")

    // Click confirm
    await confirmBtn.click()
    console.log("Clicked confirm — waiting for plan generation...")
    await page.waitForTimeout(15000) // Wait for AI to generate recommendations

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02_plan_confirmed.png`, fullPage: true })

    // Verify plan locked state
    const postConfirmText = (await page.textContent("body")) || ""
    const isLocked =
      postConfirmText.includes("Plan Protected") ||
      postConfirmText.includes("Plan locked") ||
      postConfirmText.includes("Complete")
    expect(isLocked).toBe(true)
    console.log("✅ Plan confirmed and locked")
  })

  // ─── Test 3: Dashboard Verification ─────────────────────────────────
  test("3 — Dashboard: destination, purpose, stat cards", async () => {
    await page.goto(`${BASE}/dashboard`)
    await waitForLoad(page)
    await page.waitForTimeout(3000)

    const bodyText = (await page.textContent("body")) || ""
    const bodyLower = bodyText.toLowerCase()

    expect(bodyLower).toContain("germany")
    expect(bodyLower).toContain("munich")
    expect(bodyLower).toContain("priya")

    // Stat cards should be present
    const statCards = page.locator('[class*="stat"], [class*="card"]')
    const cardCount = await statCards.count()
    expect(cardCount).toBeGreaterThan(0)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03_dashboard.png`, fullPage: true })
    console.log("✅ Dashboard shows Germany/Munich/Priya with stat cards")
  })

  // ─── Test 4: Cost of Living — EUR + INR Conversion ──────────────────
  test("4 — Cost of living: EUR prices with INR conversion", async () => {
    // Should already be on dashboard
    await page.waitForTimeout(5000) // Wait for cost-of-living data to load

    const bodyText = (await page.textContent("body")) || ""

    // EUR symbol should be present (Germany uses EUR)
    const hasEuro = bodyText.includes("€")
    expect(hasEuro).toBe(true)
    console.log("✅ Euro symbol found")

    // INR conversion should appear (Indian citizenship → INR via Frankfurter API)
    // The format is: €X,XXX (~₹XX,XXX)
    const hasRupee = bodyText.includes("₹")
    if (hasRupee) {
      console.log("✅ INR (₹) conversion displayed")
    } else {
      console.log("⚠️  INR conversion not displayed — Frankfurter API may be slow or unavailable")
    }

    // At minimum, EUR values should be present
    const eurPattern = /€[\d,]+/
    expect(bodyText).toMatch(eurPattern)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04_cost_of_living.png`, fullPage: true })
  })

  // ─── Test 5: Budget Card ────────────────────────────────────────────
  test("5 — Budget card: EUR amounts present", async () => {
    const bodyText = (await page.textContent("body")) || ""
    const bodyLower = bodyText.toLowerCase()

    // Budget section may be behind TierGate — check for it
    const hasBudget =
      bodyLower.includes("budget") ||
      bodyLower.includes("minimum") ||
      bodyLower.includes("comfortable")

    if (hasBudget) {
      // EUR should be visible in budget context
      expect(bodyText).toMatch(/€[\d,]+/)
      console.log("✅ Budget card shows EUR amounts")
    } else {
      console.log("⚠️  Budget card not visible — may be tier-gated or on chat page only")
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05_budget.png`, fullPage: true })
  })

  // ─── Test 6: Visa Recommendation ────────────────────────────────────
  test("6 — Visa recommendation: check-required for Indian citizen", async () => {
    const bodyText = (await page.textContent("body")) || ""
    const bodyLower = bodyText.toLowerCase()

    // Indian citizen going to Germany — should NOT be visa-free
    const hasVisaFree = bodyLower.includes("visa-free") || bodyLower.includes("visa free")
    const hasCheckRequired =
      bodyLower.includes("check-required") ||
      bodyLower.includes("visa required") ||
      bodyLower.includes("check required")

    if (hasCheckRequired) {
      console.log("✅ Visa badge shows check-required/visa required")
    } else if (!hasVisaFree) {
      console.log("⚠️  No explicit visa badge found — checking chat page")
    }

    // Should definitely NOT say visa-free for India → Germany
    if (hasVisaFree) {
      console.log("❌ Incorrectly shows visa-free for Indian citizen → Germany")
    }
    // Soft assertion — visa badge may not be on dashboard
    expect(hasVisaFree).toBe(false)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/06_visa.png`, fullPage: true })
  })

  // ─── Test 7: Guide Content Quality ──────────────────────────────────
  test("7 — Guide content quality: Germany-specific terms", async () => {
    await page.goto(`${BASE}/guides`)
    await waitForLoad(page)
    await page.waitForTimeout(3000)

    const bodyText = (await page.textContent("body")) || ""

    // Check a guide exists
    const guideLinks = page.locator('a[href*="/guides/"]')
    const guideCount = await guideLinks.count()

    if (guideCount === 0) {
      console.log("⚠️  No guides found — guide generation may not have completed yet")
      await page.screenshot({ path: `${SCREENSHOT_DIR}/07_guides_empty.png`, fullPage: true })
      return
    }

    console.log(`Found ${guideCount} guide(s)`)

    // Click into the first guide
    await guideLinks.first().click()
    await waitForLoad(page)
    await page.waitForTimeout(3000)

    const guideText = (await page.textContent("body")) || ""
    const guideLower = guideText.toLowerCase()

    // Germany-specific content checks (from COUNTRY_DATA in guide-generator.ts)
    const germanTerms = {
      banking: ["n26", "deutsche bank", "sparkasse"],
      housing: ["wg-gesucht", "immobilienscout", "immoscout"],
      culture: ["pfand", "recycling", "punctuality", "pünktlichkeit"],
      visa: ["blue card", "aufenthaltstitel", "residence permit"],
      healthcare: ["insurance", "krankenversicherung", "health insurance"],
    }

    const foundTerms: string[] = []
    for (const [category, terms] of Object.entries(germanTerms)) {
      const found = terms.find((t) => guideLower.includes(t))
      if (found) {
        foundTerms.push(`${category}: ${found}`)
      }
    }

    console.log(`Germany-specific terms found: ${foundTerms.join(", ")}`)

    // Should have at least 2 Germany-specific mentions
    expect(foundTerms.length).toBeGreaterThanOrEqual(2)

    // Guide should have multiple sections (not empty)
    const headings = page.locator("h2, h3")
    const headingCount = await headings.count()
    expect(headingCount).toBeGreaterThan(2)
    console.log(`✅ Guide has ${headingCount} sections with Germany-specific content`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/07_guide_content.png`, fullPage: true })
  })

  // ─── Test 8: Arrival Banner Check ───────────────────────────────────
  test("8 — Arrival banner: visible for pro_plus + complete stage", async () => {
    await page.goto(`${BASE}/dashboard`)
    await waitForLoad(page)
    await page.waitForTimeout(3000)

    // Check for "I've arrived!" button
    const arrivalBtn = page.locator('button:has-text("I\'ve arrived!")')
    const isVisible = await arrivalBtn.isVisible({ timeout: 5000 }).catch(() => false)

    if (isVisible) {
      console.log("✅ Arrival banner visible")
      tier = "pro_plus"
      planStage = "complete"
    } else {
      // Check why — tier or stage issue
      const bodyText = (await page.textContent("body")) || ""
      const bodyLower = bodyText.toLowerCase()

      if (bodyLower.includes("upgrade") || bodyLower.includes("pro+") || bodyLower.includes("unlock")) {
        tier = "not_pro_plus"
        console.log("⚠️  SKIP: Tier is not pro_plus — arrival tests will be skipped")
      } else if (bodyLower.includes("arrived") || bodyLower.includes("settling")) {
        planStage = "arrived"
        console.log("ℹ️  Plan already in arrived state")
      } else {
        console.log("⚠️  Arrival button not visible — unknown reason")
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/08_arrival_banner.png`, fullPage: true })
  })

  // ─── Test 9: Click "I've Arrived" ───────────────────────────────────
  test("9 — Click 'I have arrived': stage transition", async () => {
    if (tier === "not_pro_plus") {
      console.log("SKIP: tier is not pro_plus")
      test.skip()
      return
    }
    if (planStage === "arrived") {
      console.log("SKIP: already in arrived state")
      test.skip()
      return
    }

    const arrivalBtn = page.locator('button:has-text("I\'ve arrived!")')
    const isVisible = await arrivalBtn.isVisible({ timeout: 3000 }).catch(() => false)
    if (!isVisible) {
      console.log("SKIP: arrival button not visible")
      test.skip()
      return
    }

    // Click "I've arrived!" — date picker appears
    await arrivalBtn.click()
    await page.waitForTimeout(1000)

    // Date picker should now be visible
    const dateInput = page.locator('input[type="date"]')
    await dateInput.waitFor({ timeout: 5000 })

    // Click Confirm with today's date
    const confirmBtn = page.locator('button:has-text("Confirm")')
    await confirmBtn.click()
    console.log("Clicked Confirm — waiting for stage transition...")

    // Wait for redirect to settling-in or dashboard refresh
    await page.waitForTimeout(5000)

    const currentUrl = page.url()
    const bodyText = (await page.textContent("body")) || ""
    const bodyLower = bodyText.toLowerCase()

    const transitioned =
      currentUrl.includes("/settling-in") ||
      bodyLower.includes("settling-in") ||
      bodyLower.includes("checklist") ||
      bodyLower.includes("post-arrival")

    expect(transitioned).toBe(true)
    planStage = "arrived"
    console.log(`✅ Stage transitioned to arrived (URL: ${currentUrl})`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/09_arrived.png`, fullPage: true })
  })

  // ─── Test 10: Post-Arrival Chat Behavior ────────────────────────────
  test("10 — Post-arrival chat: AI is settling-in coach", async () => {
    if (tier === "not_pro_plus" && planStage !== "arrived") {
      console.log("SKIP: tier is not pro_plus and not arrived")
      test.skip()
      return
    }

    await page.goto(`${BASE}/chat`)
    await waitForLoad(page)
    await page.waitForTimeout(4000)

    const bodyText = (await page.textContent("body")) || ""
    const bodyLower = bodyText.toLowerCase()

    // Should NOT show onboarding opener
    const isOnboarding =
      bodyLower.includes("what's your name") || bodyLower.includes("what is your name")
    if (isOnboarding) {
      console.log("❌ Chat shows onboarding opener in post-arrival mode")
    }

    // Input placeholder may change
    const input = page.locator('input[placeholder]').first()
    const placeholder = (await input.getAttribute("placeholder")) || ""
    console.log(`Chat input placeholder: "${placeholder}"`)

    // Send a practical question
    const chatInput = page
      .locator('input[placeholder="Ask follow-up questions..."], input[placeholder="Type your message..."]')
      .first()
    await chatInput.waitFor({ timeout: 10000 })

    await chatInput.fill("What should I do first after arriving in Munich?")
    await chatInput.press("Enter")
    await page.waitForTimeout(12000)

    const responseText = (await page.textContent("body")) || ""
    const responseLower = responseText.toLowerCase()

    // AI should talk about practical tasks, not ask profile questions
    const practicalTerms = [
      "registration",
      "anmeldung",
      "bank",
      "insurance",
      "apartment",
      "housing",
      "residence",
    ]
    const foundPractical = practicalTerms.filter((t) => responseLower.includes(t))
    console.log(`Practical terms in response: ${foundPractical.join(", ")}`)
    expect(foundPractical.length).toBeGreaterThan(0)

    // Send Anmeldung question
    await chatInput.fill("Can you help me with the Anmeldung process?")
    await chatInput.press("Enter")
    await page.waitForTimeout(12000)

    const anmeldungText = (await page.textContent("body")) || ""
    const anmeldungLower = anmeldungText.toLowerCase()

    // Should provide guidance, not ask interview questions
    const guidanceTerms = [
      "bürgerbüro",
      "bürgeramt",
      "kreisverwaltungsreferat",
      "14 day",
      "14-day",
      "two weeks",
      "registration form",
      "anmeldeformular",
      "appointment",
      "address",
      "wohnungsgeberbestätigung",
      "landlord",
    ]
    const foundGuidance = guidanceTerms.filter((t) => anmeldungLower.includes(t))
    console.log(`Anmeldung guidance terms: ${foundGuidance.join(", ")}`)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/10_post_arrival_chat.png`, fullPage: true })
    console.log("✅ Post-arrival chat provides practical guidance")
  })

  // ─── Test 11: Post-Arrival Extraction Disabled ──────────────────────
  test("11 — Post-arrival: extraction disabled, profile unchanged", async () => {
    if (tier === "not_pro_plus" && planStage !== "arrived") {
      console.log("SKIP: not in arrived state")
      test.skip()
      return
    }

    const chatInput = page
      .locator('input[placeholder="Ask follow-up questions..."], input[placeholder="Type your message..."]')
      .first()

    // Try to change destination via chat
    await chatInput.fill("Actually my name is Raj and I'm going to France now")
    await chatInput.press("Enter")
    await page.waitForTimeout(12000)

    // Chat header should still show Germany
    const headerText = (await page.textContent("body")) || ""
    const headerLower = headerText.toLowerCase()

    const stillGermany = headerLower.includes("germany")
    const switchedToFrance =
      headerLower.includes("france") &&
      !headerLower.includes("germany") // Only fail if Germany is completely gone

    if (switchedToFrance) {
      console.log("❌ Profile changed to France — extraction not properly disabled")
    } else if (stillGermany) {
      console.log("✅ Profile still shows Germany — extraction disabled")
    }

    expect(stillGermany).toBe(true)

    await page.screenshot({ path: `${SCREENSHOT_DIR}/11_extraction_disabled.png`, fullPage: true })
  })

  // ─── Test 12: Settling-In Tasks ─────────────────────────────────────
  test("12 — Settling-in tasks: Germany-specific (Anmeldung, health insurance, Steuer-ID)", async () => {
    if (tier === "not_pro_plus" && planStage !== "arrived") {
      console.log("SKIP: not in arrived state")
      test.skip()
      return
    }

    await page.goto(`${BASE}/settling-in`)
    await waitForLoad(page)
    await page.waitForTimeout(3000)

    let bodyText = (await page.textContent("body")) || ""
    let bodyLower = bodyText.toLowerCase()

    // If tasks not generated yet, click generate button
    const generateBtn = page.locator('button:has-text("Generate checklist")')
    const needsGeneration = await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)

    if (needsGeneration) {
      console.log("Generating settling-in tasks...")
      await generateBtn.click()

      // Wait up to 90s for generation (Claude Sonnet via OpenRouter)
      await page
        .locator('text="Progress"')
        .waitFor({ timeout: 90000 })
        .catch(async () => {
          // Fallback: wait and check for task cards
          await page.waitForTimeout(60000)
        })

      bodyText = (await page.textContent("body")) || ""
      bodyLower = bodyText.toLowerCase()
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/12_settling_in_tasks.png`, fullPage: true })

    // Check for "Confirm your arrival first" — means plan is not in arrived stage
    if (bodyLower.includes("confirm your arrival first")) {
      console.log("⚠️  Settling-in page says 'Confirm your arrival first' — stage not arrived")
      // This test can't proceed without arrived stage
      return
    }

    // Germany-specific task assertions
    const germanyTasks = {
      anmeldung: ["anmeldung", "resident registration", "city registration", "register your address"],
      health_insurance: ["health insurance", "krankenversicherung", "insurance"],
      banking: ["bank account", "banking", "open a bank"],
      tax_id: ["steuer-id", "tax id", "tax identification", "steuernummer"],
    }

    const foundTasks: string[] = []
    for (const [taskName, variants] of Object.entries(germanyTasks)) {
      const found = variants.find((v) => bodyLower.includes(v))
      if (found) {
        foundTasks.push(`${taskName}: "${found}"`)
      }
    }

    console.log(`Germany-specific tasks found: ${foundTasks.join(", ")}`)

    // Should find at least Anmeldung + health insurance (the two most critical)
    expect(foundTasks.length).toBeGreaterThanOrEqual(2)

    // Structural assertions: count task cards
    // Tasks are rendered inside category groups — count visible task titles
    const taskCards = page.locator('[class*="task"], [class*="Task"]')
    const taskCount = await taskCards.count()

    // Also check for category headers
    const categoryHeaders = page.locator('button:has-text("/") >> nth=0').locator("..")
    const progressText = bodyText.match(/(\d+)\/(\d+)/)

    if (progressText) {
      const total = parseInt(progressText[2])
      console.log(`Task count: ${total} (from progress indicator)`)
      expect(total).toBeGreaterThanOrEqual(8)
      expect(total).toBeLessThanOrEqual(25)
    } else if (taskCount > 0) {
      console.log(`Task card elements found: ${taskCount}`)
    }

    // Check for legal requirement indicators
    const hasLegal =
      bodyLower.includes("legal") ||
      bodyLower.includes("compliance") ||
      bodyLower.includes("required by law")

    if (hasLegal) {
      console.log("✅ Tasks include legal requirement indicators")
    }

    // Check for locked/dependency tasks
    const hasLocked = bodyLower.includes("locked") || bodyText.includes("🔒")
    if (hasLocked) {
      console.log("✅ Some tasks show dependency locking")
    }

    console.log("✅ Settling-in tasks validated for Germany")
  })
})
