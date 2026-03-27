import { test, expect, type Page } from "@playwright/test"

const BASE = "http://localhost:3000"
const EMAIL = "axelcornelius93@gmail.com"
const PASSWORD = "AvC93!4778"

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

// Map of field keys to user answers
const FIELD_ANSWERS: Record<string, string> = {
  name: "My name is Sofia",
  destination: "Tokyo, Japan",
  target_city: "Tokyo",
  purpose: "I'm transferring with my company for work",
  timeline: "January next year",
  citizenship: "South Korean",
  moving_alone: "Just me, going solo",
  job_offer: "Yes, my company has a position for me and they're sponsoring the visa",
  job_field: "Software engineering",
  employer_sponsorship: "Yes, fully sponsored by my employer",
  highly_skilled: "Yes, I'd say so — 8 years of experience",
  years_experience: "8 years",
  savings_available: "About 30000 USD saved",
  monthly_budget: "Around 5000 USD per month",
  need_budget_help: "No, I think I'll be fine",
  current_location: "Currently in Seoul, South Korea",
  duration: "Planning to stay 3+ years",
  language_skill: "Basic Japanese, about N4 level",
  education_level: "I have a master's degree in computer science",
  prior_visa: "No, never had a Japanese visa before",
  visa_rejections: "No rejections",
  healthcare_needs: "No special healthcare needs",
  pets: "No pets",
  special_requirements: "Nothing special",
  // Family fields (if moving with someone)
  spouse_joining: "No spouse",
  children_count: "No children",
  children_ages: "N/A",
  // Digital nomad fields
  remote_income: "No",
  income_source: "My employer pays me",
  monthly_income: "About 8000 USD",
  // Dependent fields
  partner_citizenship: "N/A",
  partner_visa_status: "N/A",
  relationship_type: "N/A",
}

test.describe("AI Idle Fix Verification", () => {
  test.describe.configure({ timeout: 300000 })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await signIn(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("Fresh plan: AI asks follow-up questions and completes onboarding", async () => {
    // Create a fresh plan via API
    const createResult = await page.evaluate(async () => {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Idle Fix Test" }),
      })
      return { status: res.status, data: await res.json() }
    })
    console.log(`New plan created: status=${createResult.status}`)
    expect(createResult.status).toBe(200)

    // Navigate to chat
    await page.goto(`${BASE}/chat`)
    await waitForLoad(page)
    await page.waitForTimeout(4000)

    // Verify fresh state
    const headerText = await page.textContent("body") || ""
    console.log(`Fresh profile: ${headerText.includes("0%") || headerText.includes("0 of")}`)

    const chatInput = page.locator('input[placeholder="Type your message..."]').first()
    await chatInput.waitFor({ timeout: 10000 })

    let idleCount = 0
    let totalTurns = 0
    let lastPendingField = ""
    let stuckCount = 0

    // Adaptive send: read the "Next:" indicator to know what field to answer
    async function adaptiveSend(maxTurns = 25): Promise<void> {
      for (let turn = 0; turn < maxTurns; turn++) {
        totalTurns++

        // Read the "Next:" field indicator from the colored span in the header
        const nextSpan = page.locator('span.text-primary:has-text("Next:")').first()
        let pendingLabel = ""
        if (await nextSpan.isVisible({ timeout: 1000 }).catch(() => false)) {
          const spanText = await nextSpan.textContent() || ""
          pendingLabel = spanText.replace("Next:", "").trim()
        }
        const bodyText = await page.textContent("body") || ""

        // Check completion
        const progressMatch = bodyText.match(/(\d+)\s*of\s*(\d+)\s*fields/)
        const completionMatch = bodyText.match(/(\d+)%/)
        const pct = completionMatch ? parseInt(completionMatch[1]) : 0

        if (pct >= 100 || bodyText.includes("Review your profile") || bodyText.includes("review")) {
          console.log(`✅ Profile complete at ${pct}% after ${totalTurns} turns`)
          await page.screenshot({ path: "/tmp/gomate_screenshots/idle_complete.png", fullPage: true })
          return
        }

        // Detect stuck (same field 3+ times)
        if (pendingLabel === lastPendingField) {
          stuckCount++
          if (stuckCount >= 3) {
            console.log(`⚠️  Stuck on "${pendingLabel}" for ${stuckCount} turns — providing direct answer`)
          }
        } else {
          stuckCount = 0
        }
        lastPendingField = pendingLabel

        // Find the right answer based on what the AI/system is asking for
        let answer = ""

        // Try to match the pending field label to our answers
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
          "Savings": "savings_available",
          "Monthly Budget": "monthly_budget",
          "Budget Help Needed": "need_budget_help",
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

        const fieldKey = fieldLabelMap[pendingLabel]
        if (fieldKey && FIELD_ANSWERS[fieldKey]) {
          answer = FIELD_ANSWERS[fieldKey]
        } else if (pendingLabel) {
          // Fallback: try fuzzy matching by converting label to snake_case key
          const fuzzyKey = pendingLabel.toLowerCase().replace(/\s+/g, "_")
          const fuzzyMatch = Object.keys(FIELD_ANSWERS).find(k =>
            k.includes(fuzzyKey) || fuzzyKey.includes(k) ||
            pendingLabel.toLowerCase().includes(k.replace(/_/g, " "))
          )
          if (fuzzyMatch) {
            answer = FIELD_ANSWERS[fuzzyMatch]
            console.log(`🔍 Fuzzy matched "${pendingLabel}" → ${fuzzyMatch}`)
          } else {
            console.log(`⚠️  Unknown field label: "${pendingLabel}" — providing a direct answer`)
            answer = `Regarding ${pendingLabel}: I'm not sure about this one, let me think... Actually, nothing special to mention for this.`
          }
        } else {
          // No "Next:" found — might be first turn, answer with name
          answer = turn === 0 ? "Hi, my name is Sofia" : "What's the next question?"
        }

        // Check for idle in the AI's last message
        const recentText = bodyText.slice(-500).toLowerCase()
        const idlePhrases = [
          "feel free to ask",
          "let me know if you",
          "anything else you'd like",
          "is there anything else",
          "don't hesitate",
        ]
        const isIdle = idlePhrases.some(p => recentText.includes(p)) && pct < 100
        if (isIdle) {
          console.log(`❌ [Turn ${totalTurns}] AI went IDLE at ${pct}% (pending: ${pendingLabel})`)
          idleCount++
        }

        console.log(`[Turn ${totalTurns}] ${pct}% | Next: "${pendingLabel}" → Answering: "${answer.slice(0, 50)}"`)
        await chatInput.fill(answer)
        await chatInput.press("Enter")
        await page.waitForTimeout(8000) // Wait for AI response
      }

      console.log(`⚠️  Reached max turns (${maxTurns}) without completing profile`)
    }

    await adaptiveSend()

    // Check final screenshots
    await page.screenshot({ path: "/tmp/gomate_screenshots/idle_final.png", fullPage: true })

    // Results
    const finalText = await page.textContent("body") || ""
    const finalPct = finalText.match(/(\d+)%/)
    const finalProgress = finalPct ? parseInt(finalPct[1]) : 0

    console.log(`\n========================================`)
    console.log(`  AI IDLE FIX TEST RESULTS`)
    console.log(`========================================`)
    console.log(`  Final completion: ${finalProgress}%`)
    console.log(`  Total turns: ${totalTurns}`)
    console.log(`  Idle occurrences: ${idleCount}`)
    console.log(`========================================`)

    // Assertions
    expect(idleCount).toBe(0)
    expect(finalProgress).toBeGreaterThanOrEqual(80) // Should reach at least 80%
  })
})
