import { test, expect, type Page } from "@playwright/test"

const BASE = "http://localhost:3000"
const EMAIL = "axelcornelius93@gmail.com"
const PASSWORD = "AvC93!4778"

// Helper: wait for network idle after navigation
async function waitForLoad(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
}

// Helper: sign in via the auth UI
async function signIn(page: Page) {
  await page.goto(`${BASE}/auth/login`)
  await waitForLoad(page)

  // Fill email and password
  const emailInput = page.locator('input[type="email"], input[name="email"]')
  const passwordInput = page.locator('input[type="password"], input[name="password"]')

  if (await emailInput.isVisible({ timeout: 5000 })) {
    await emailInput.fill(EMAIL)
    await passwordInput.fill(PASSWORD)
    // Click sign in button
    const signInBtn = page.locator('button:has-text("Sign"), button:has-text("Log")')
    await signInBtn.click()
    // Wait for redirect to dashboard or chat
    await page.waitForURL(/\/(dashboard|chat|app)/, { timeout: 15000 })
  }
}

test.describe("GoMate E2E Audit", () => {
  test.describe.configure({ timeout: 180000 }) // 3 min per test

  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await signIn(page)
  })

  test.afterAll(async () => {
    await page.close()
  })

  test("1. Dashboard loads and shows profile progress", async () => {
    await page.goto(`${BASE}/dashboard`)
    await waitForLoad(page)

    // Take screenshot for reference
    await page.screenshot({ path: "/tmp/gomate_screenshots/01_dashboard.png", fullPage: true })

    // Check that the page loaded (look for common dashboard elements)
    const body = await page.textContent("body")
    expect(body).toBeTruthy()

    // Look for profile-related content
    const hasProfileCard = await page.locator("text=Profile").first().isVisible({ timeout: 5000 }).catch(() => false)
    console.log(`Dashboard has Profile card: ${hasProfileCard}`)

    // Check for stat cards or progress indicators
    const pageText = await page.textContent("body") || ""
    console.log(`Dashboard text includes "Profile": ${pageText.includes("Profile")}`)
    console.log(`Dashboard text includes "%": ${pageText.includes("%")}`)
  })

  test("2. Chat page loads with opening message", async () => {
    await page.goto(`${BASE}/chat`)
    await waitForLoad(page)

    // Wait for chat to initialize
    await page.waitForTimeout(3000)
    await page.screenshot({ path: "/tmp/gomate_screenshots/02_chat_initial.png", fullPage: true })

    const chatText = await page.textContent("body") || ""

    // Check for opening message or existing conversation
    const hasGoMate = chatText.includes("GoMate") || chatText.includes("relocation")
    console.log(`Chat shows GoMate content: ${hasGoMate}`)
    console.log(`Chat text preview: ${chatText.slice(0, 300)}`)
  })

  test("3. Chat onboarding - full interview flow", async () => {
    // Create a new plan first to get a fresh start
    await page.goto(`${BASE}/chat`)
    await waitForLoad(page)
    await page.waitForTimeout(2000)

    // Find the chat input
    const chatInput = page.locator('textarea, input[placeholder*="message"], input[placeholder*="type"], [contenteditable="true"]').first()
    await chatInput.waitFor({ timeout: 10000 })

    // Helper to send a message and wait for response
    async function sendMessage(msg: string, stepName: string) {
      await chatInput.fill(msg)
      // Press Enter or click send button
      await chatInput.press("Enter")
      // Wait for AI response (look for new content appearing)
      await page.waitForTimeout(5000) // Wait for streaming response
      const chatArea = await page.textContent("body") || ""
      console.log(`[${stepName}] Sent: "${msg}"`)
      console.log(`[${stepName}] Chat includes response: ${chatArea.length > 100}`)
      return chatArea
    }

    // Step 1: Name
    let response = await sendMessage("Hi, my name is Marco", "Step 1: Name")
    await page.screenshot({ path: "/tmp/gomate_screenshots/03_chat_step1.png", fullPage: true })

    // Step 2: Destination - only answer what's asked
    // Wait to see what the AI asks
    await page.waitForTimeout(2000)
    const afterStep1 = await page.textContent("body") || ""
    console.log(`After step 1, AI text includes destination question: ${afterStep1.toLowerCase().includes("where") || afterStep1.toLowerCase().includes("country") || afterStep1.toLowerCase().includes("move")}`)

    response = await sendMessage("Lisbon, Portugal", "Step 2: Destination")
    await page.screenshot({ path: "/tmp/gomate_screenshots/03_chat_step2.png", fullPage: true })

    // Step 3: Confirm destination
    response = await sendMessage("Yes, that's correct", "Step 3: Confirm")

    // Step 4: Purpose
    response = await sendMessage("I work remotely as a freelance designer", "Step 4: Purpose")
    await page.screenshot({ path: "/tmp/gomate_screenshots/03_chat_step4.png", fullPage: true })

    // Step 5: Timeline
    response = await sendMessage("Around September this year", "Step 5: Timeline")

    // Step 6: Citizenship
    response = await sendMessage("Brazilian", "Step 6: Citizenship")

    // Step 7: Moving alone
    response = await sendMessage("Just me, going solo", "Step 7: Moving alone")

    // Step 8: Remote income source
    response = await sendMessage("Graphic design and branding, mostly for US clients", "Step 8: Income source")

    // Step 9: Monthly income
    response = await sendMessage("Around 4000 USD per month", "Step 9: Monthly income")
    await page.screenshot({ path: "/tmp/gomate_screenshots/03_chat_step9.png", fullPage: true })

    // Step 10: Wait and check - does AI ask about savings or go idle?
    await page.waitForTimeout(3000)
    const afterStep9 = await page.textContent("body") || ""
    const askedAboutSavings = afterStep9.toLowerCase().includes("saving") || afterStep9.toLowerCase().includes("saved")
    console.log(`After income, AI asked about savings: ${askedAboutSavings}`)

    // If AI didn't ask, note it as idle, but still provide answer
    if (!askedAboutSavings) {
      console.log("⚠️ AI went idle after income - deadlock bug still present")
      response = await sendMessage("What else do you need?", "Step 10: Prompt")
      await page.waitForTimeout(3000)
    }

    response = await sendMessage("I have about 15000 USD saved up", "Step 11: Savings")

    // Step 12: Monthly budget
    await page.waitForTimeout(2000)
    const afterSavings = await page.textContent("body") || ""
    const askedAboutBudget = afterSavings.toLowerCase().includes("budget") || afterSavings.toLowerCase().includes("spend")
    console.log(`After savings, AI asked about budget: ${askedAboutBudget}`)

    if (!askedAboutBudget) {
      console.log("⚠️ AI went idle after savings")
      response = await sendMessage("Anything else?", "Step 12: Prompt")
      await page.waitForTimeout(3000)
    }

    response = await sendMessage("About 1800 euros per month", "Step 13: Budget")

    // Step 14: Current location + duration
    await page.waitForTimeout(2000)
    response = await sendMessage("I currently live in Sao Paulo, Brazil. Planning to stay 1-2 years", "Step 14: Location+Duration")
    await page.screenshot({ path: "/tmp/gomate_screenshots/03_chat_step14.png", fullPage: true })

    // Wait for profile review
    await page.waitForTimeout(5000)
    const finalChat = await page.textContent("body") || ""
    const profileComplete = finalChat.toLowerCase().includes("confirm") ||
                            finalChat.toLowerCase().includes("correct") ||
                            finalChat.toLowerCase().includes("summary") ||
                            finalChat.toLowerCase().includes("100%")
    console.log(`Profile appears complete: ${profileComplete}`)
    console.log(`Chat mentions D8/digital nomad visa: ${finalChat.toLowerCase().includes("d8") || finalChat.toLowerCase().includes("digital nomad visa")}`)

    await page.screenshot({ path: "/tmp/gomate_screenshots/03_chat_final.png", fullPage: true })

    // Confirm profile
    if (profileComplete) {
      response = await sendMessage("Yes, everything looks correct! Please generate my plan.", "Step 15: Confirm")
      await page.waitForTimeout(5000)
      await page.screenshot({ path: "/tmp/gomate_screenshots/03_chat_confirmed.png", fullPage: true })
    }
  })

  test("4. Dashboard shows correct field count and completion", async () => {
    await page.goto(`${BASE}/dashboard`)
    await waitForLoad(page)
    await page.waitForTimeout(3000)

    await page.screenshot({ path: "/tmp/gomate_screenshots/04_dashboard_after_chat.png", fullPage: true })

    const dashText = await page.textContent("body") || ""

    // Check profile completion percentage
    const has100 = dashText.includes("100%")
    const has17 = dashText.includes("17")
    console.log(`Dashboard shows 100%: ${has100}`)
    console.log(`Dashboard shows 17 fields: ${has17}`)
    console.log(`Dashboard shows Portugal: ${dashText.includes("Portugal")}`)
    console.log(`Dashboard shows Lisbon: ${dashText.includes("Lisbon")}`)
    console.log(`Dashboard shows Marco: ${dashText.includes("Marco")}`)
    console.log(`Dashboard shows Digital Nomad: ${dashText.includes("Digital Nomad") || dashText.includes("digital_nomad")}`)

    // Check ProfileDetailsCard categories
    const hasJourney = dashText.includes("Journey")
    const hasFinancial = dashText.includes("Financial")
    const hasRemoteWork = dashText.includes("Remote Work") || dashText.includes("Purpose") || dashText.includes("Digital Nomad")
    console.log(`Has Journey category: ${hasJourney}`)
    console.log(`Has Financial category: ${hasFinancial}`)
    console.log(`Has purpose-related category: ${hasRemoteWork}`)
  })

  test("5. Cost of living card shows correct currency", async () => {
    // Still on dashboard, scroll to cost of living section
    await page.goto(`${BASE}/dashboard`)
    await waitForLoad(page)
    await page.waitForTimeout(5000)

    // Scroll down to find cost of living
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(2000)

    await page.screenshot({ path: "/tmp/gomate_screenshots/05_cost_of_living.png", fullPage: true })

    const dashText = await page.textContent("body") || ""

    // Check for EUR symbol (local currency for Lisbon)
    const hasEUR = dashText.includes("€")
    // Check for BRL conversion (Marco is Brazilian)
    const hasBRL = dashText.includes("R$") || dashText.includes("BRL")
    // Check for Numbeo data
    const hasNumbeo = dashText.includes("Numbeo")
    const hasLisbon = dashText.includes("Lisbon")

    console.log(`Cost of living shows €: ${hasEUR}`)
    console.log(`Cost of living shows R$ (BRL conversion): ${hasBRL}`)
    console.log(`Cost of living mentions Numbeo: ${hasNumbeo}`)
    console.log(`Cost of living mentions Lisbon: ${hasLisbon}`)

    // Check budget amounts are present
    const hasBudgetNumbers = /[\d,]+\/mo/.test(dashText) || /[\d,]+/.test(dashText)
    console.log(`Has budget numbers: ${hasBudgetNumbers}`)
  })

  test("6. Guide generation and isolation", async () => {
    await page.goto(`${BASE}/dashboard`)
    await waitForLoad(page)
    await page.waitForTimeout(3000)

    const dashText = await page.textContent("body") || ""

    // Check if guide section is visible
    const hasGuideSection = dashText.includes("Guide") || dashText.includes("guide")
    console.log(`Dashboard has guide section: ${hasGuideSection}`)
    console.log(`Guide shows Portugal: ${dashText.includes("Portugal")}`)

    // Navigate to guides page
    await page.goto(`${BASE}/guides`)
    await waitForLoad(page)
    await page.waitForTimeout(3000)

    await page.screenshot({ path: "/tmp/gomate_screenshots/06_guides_page.png", fullPage: true })

    const guidesText = await page.textContent("body") || ""

    // Check isolation: should ONLY show Portugal guide, not Germany/Japan
    const hasPortugal = guidesText.includes("Portugal")
    const hasGermany = guidesText.includes("Germany")
    const hasJapan = guidesText.includes("Japan")

    console.log(`Guides page shows Portugal: ${hasPortugal}`)
    console.log(`Guides page shows Germany (should be false): ${hasGermany}`)
    console.log(`Guides page shows Japan (should be false): ${hasJapan}`)

    if (hasGermany || hasJapan) {
      console.log("❌ GUIDE ISOLATION BUG: Guides from other plans are visible!")
    } else {
      console.log("✅ Guide isolation working: only current plan guides shown")
    }
  })

  test("7. Guide content quality", async () => {
    // Click into the Portugal guide
    await page.goto(`${BASE}/guides`)
    await waitForLoad(page)
    await page.waitForTimeout(3000)

    // Try to click on the guide card/link
    const guideLink = page.locator('a:has-text("Portugal"), [role="link"]:has-text("Portugal"), button:has-text("Portugal")').first()
    if (await guideLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await guideLink.click()
      await waitForLoad(page)
      await page.waitForTimeout(3000)
    } else {
      // Maybe guides are shown inline or there's a different structure
      console.log("No clickable Portugal guide link found - checking current page content")
    }

    await page.screenshot({ path: "/tmp/gomate_screenshots/07_guide_content.png", fullPage: true })

    const guideText = await page.textContent("body") || ""

    // Check guide sections
    const sections = {
      visa: guideText.toLowerCase().includes("visa") || guideText.toLowerCase().includes("d8"),
      budget: guideText.toLowerCase().includes("budget") || guideText.toLowerCase().includes("cost"),
      housing: guideText.toLowerCase().includes("housing") || guideText.toLowerCase().includes("rent"),
      healthcare: guideText.toLowerCase().includes("healthcare") || guideText.toLowerCase().includes("health"),
      banking: guideText.toLowerCase().includes("bank"),
      timeline: guideText.toLowerCase().includes("timeline") || guideText.toLowerCase().includes("month"),
      checklist: guideText.toLowerCase().includes("checklist") || guideText.toLowerCase().includes("document"),
    }

    for (const [section, present] of Object.entries(sections)) {
      console.log(`Guide has ${section} section: ${present}`)
    }

    // Check Portugal-specific content
    console.log(`Guide mentions Lisbon: ${guideText.includes("Lisbon")}`)
    console.log(`Guide mentions digital nomad: ${guideText.toLowerCase().includes("digital nomad") || guideText.toLowerCase().includes("remote")}`)
    console.log(`Guide mentions EUR: ${guideText.includes("EUR") || guideText.includes("€")}`)
  })

  test("8. Chat greeting for returning user", async () => {
    // Go back to chat - should show personalized greeting, not first-time message
    await page.goto(`${BASE}/chat`)
    await waitForLoad(page)
    await page.waitForTimeout(4000) // Extra wait for profile load + greeting

    await page.screenshot({ path: "/tmp/gomate_screenshots/08_chat_returning.png", fullPage: true })

    const chatText = await page.textContent("body") || ""

    // A returning user with complete profile should see smart greeting
    const hasFirstTimeGreeting = chatText.includes("what's your name") || chatText.includes("To get started")
    const hasSmartGreeting = chatText.includes("Welcome back") || chatText.includes("plan") || chatText.includes("ready")

    console.log(`Shows first-time greeting (should be false): ${hasFirstTimeGreeting}`)
    console.log(`Shows smart/returning greeting: ${hasSmartGreeting}`)

    if (hasFirstTimeGreeting && !hasSmartGreeting) {
      console.log("❌ GREETING BUG: Still showing first-time message for returning user")
    } else if (hasSmartGreeting) {
      console.log("✅ Greeting fix working: personalized message for returning user")
    }
  })
})
