import { type UIMessage } from "ai"
import { createClient } from "@/lib/supabase/server"
import {
  type Profile,
  type AllFieldKey,
  EMPTY_PROFILE,
  ALL_FIELDS,
  FIELD_CONFIG,
  getRequiredFields,
} from "@/lib/gomate/profile-schema"
import {
  updateProfile,
  getNextPendingField,
  isProfileComplete,
  getFilledFields,
  getProgressInfo,
} from "@/lib/gomate/state-machine"
import { buildSystemPrompt, buildPostArrivalSystemPrompt, buildPostArrivalWelcome, buildFieldReminder } from "@/lib/gomate/system-prompt"
import { getRelevantSources } from "@/lib/gomate/source-linker"
import { getOfficialSourcesArray } from "@/lib/gomate/official-sources"
import { getVisaStatus } from "@/lib/gomate/visa-checker"
import { saveProfileToSupabase } from "@/lib/gomate/supabase-utils"
import { derivePlanAuthority } from "@/lib/gomate/core-state"
import {
  generateProfileSummary,
  generateVisaRecommendation,
  formatVisaRecommendation
} from "@/lib/gomate/profile-summary"
import {
  getCostOfLivingData,
  calculateMonthlyBudget,
  calculateSavingsTarget,
  generateResearchReport,
} from "@/lib/gomate/web-research"
import { fetchWithRetry } from "@/lib/gomate/fetch-with-retry"
import { checkUsageLimit, recordUsage } from "@/lib/gomate/usage-guard"

export const maxDuration = 30

// API base URL — uses OpenRouter when OPENAI_BASE_URL is set, falls back to OpenAI direct
const CHAT_API_BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "")
const IS_OPENROUTER = CHAT_API_BASE.includes("openrouter.ai")

// Yes/no fields that benefit from normalization during force-accept
const YES_NO_FIELDS = new Set([
  "highly_skilled", "remote_income", "moving_alone", "spouse_joining",
  "job_offer", "employer_sponsorship", "family_ties", "need_budget_help",
  "pets", "healthcare_needs",
])

// Identity fields that should not be overwritten after first extraction
const IDENTITY_FIELDS = new Set(["purpose", "destination", "citizenship"])

// Normalize ambiguous yes/no answers for force-accept fallback
function normalizeYesNo(text: string): string | null {
  const lower = text.toLowerCase().trim()
  if (/^(yes|yeah|yep|sure|definitely|of course|absolutely|correct|right|i do|i am|i have|affirmative)/i.test(lower)) return "yes"
  if (/^(no|nah|nope|not really|i don't|i'm not|i haven't|never|none|not at all)/i.test(lower)) return "no"
  return null
}

// Build common headers for LLM API calls
function buildApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
  }
  if (IS_OPENROUTER) {
    headers["HTTP-Referer"] = "https://gomate.app"
    headers["X-Title"] = "GoMate"
  }
  return headers
}

// Field confidence levels for extraction tracking
type FieldConfidence = "explicit" | "inferred" | "assumed"

// Extraction result with confidence metadata
type ExtractionResultWithConfidence = {
  fields: Partial<Profile>
  confidence: Record<string, FieldConfidence>
}

// Helper to extract text from UIMessage parts
function getMessageText(message: UIMessage): string {
  return message.parts
    ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("") || ""
}

// Convert UIMessages to OpenAI format
function convertToOpenAIMessages(messages: UIMessage[]): { role: string; content: string }[] {
  return messages.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: getMessageText(msg),
  }))
}

export async function POST(req: Request) {
  try {
    // Check API key first
    if (!process.env.OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // GAP-044: Explicit auth guard — return 401 if no authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    // --- Rate limit: max 15 messages/minute per user ---
    const chatLimit = await checkUsageLimit(user.id, "chat_message")
    if (!chatLimit.allowed) {
      return new Response(
        JSON.stringify({ error: chatLimit.reason }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      )
    }

    const body = await req.json()

    const {
      messages,
      profile: incomingProfile,
      confirmed,
    }: {
      messages: UIMessage[]
      profile?: Profile
      confirmed?: boolean
    } = body

    // Initialize or use incoming profile — always merge with EMPTY_PROFILE
    // to ensure all keys exist (updateProfile requires key presence)
    let profile: Profile = { ...EMPTY_PROFILE, ...(incomingProfile || {}) }
    const userConfirmed = confirmed || false

    // Check if the plan is locked (completed) - if so, skip extraction
    let planLocked = false
    let planStage: string | null = null
    let planId: string | null = null
    let arrivalDate: string | null = null
    let onboardingCompleted = false
    let fieldAttempts: Record<string, number> = {}
    try {
      const { data: plan } = await supabase
        .from("relocation_plans")
        .select("id, locked, profile_data, stage, status, arrival_date, onboarding_completed")
        .eq("user_id", user.id)
        .eq("is_current", true)
        .maybeSingle()

      if (plan) {
        const planAuthority = derivePlanAuthority(plan)
        planId = plan.id
        planStage = planAuthority.stage
        arrivalDate = plan.arrival_date
        onboardingCompleted = !!plan.onboarding_completed
        // Read stuck-field attempt tracker from DB
        if (plan.profile_data && typeof plan.profile_data === "object") {
          fieldAttempts = ((plan.profile_data as Record<string, unknown>).__field_attempts as Record<string, number>) || {}
        }
        if (plan.locked) {
          planLocked = true
          if (plan.profile_data) {
            profile = { ...EMPTY_PROFILE, ...plan.profile_data }
          }
        }
      }
    } catch {
      // Continue without lock check if it fails
    }

    // GAP-046: Termination guard — block chat when interview is done and generation is in progress
    if (planStage === "generating") {
      return new Response(
        JSON.stringify({ error: "Interview complete — generation in progress." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Get the last user message for extraction
    const lastUserMessage = messages.filter((m) => m.role === "user").pop()
    const lastUserText = lastUserMessage ? getMessageText(lastUserMessage) : ""

    // If there's a user message and plan is NOT locked, extract data from it
    let extractionResultWithConfidence: ExtractionResultWithConfidence | null = null
    let extractionAttempted = false
    let profileSaveError = false

    // Track critical fields before extraction for confirmation flow
    const prevDestination = profile.destination
    const prevCitizenship = profile.citizenship

    // Get last AI message for extraction context (helps disambiguate yes/no responses)
    const lastAIMessage = messages.filter((m) => m.role === "assistant").pop()
    const lastAIText = lastAIMessage ? getMessageText(lastAIMessage) : ""

    // GAP-025: Extraction disabled when plan is locked OR stage is arrived
    if (lastUserText && !userConfirmed && !planLocked && planStage !== "arrived") {
      extractionAttempted = true
      const pendingFieldKey_preExtraction = getNextPendingField(profile)
      extractionResultWithConfidence = await extractProfileData(lastUserText, profile, pendingFieldKey_preExtraction, lastAIText)
      if (extractionResultWithConfidence && Object.keys(extractionResultWithConfidence.fields).length > 0) {
        profile = updateProfile(profile, extractionResultWithConfidence.fields)

        // Post-extraction guard: visa_role disambiguation
        // If user has their own purpose (work/study) with a job offer or study admission,
        // they are PRIMARY even if they mention bringing a partner
        if (profile.visa_role === "dependent") {
          const hasOwnPurpose = (
            (profile.purpose === "work" && (profile.job_offer === "yes" || profile.job_field)) ||
            (profile.purpose === "study" && (profile.study_type || profile.study_field)) ||
            profile.purpose === "digital_nomad"
          )
          if (hasOwnPurpose) {
            profile.visa_role = "primary"
          }
        }

        // GAP-005: Persist field confidence alongside profile data
        const existingConfidence = (profile as Record<string, unknown>).__field_confidence as Record<string, string> || {}
        const mergedConfidence = {
          ...existingConfidence,
          ...extractionResultWithConfidence.confidence,
        }

        // If visa_role was auto-corrected by the post-extraction guard,
        // treat it as explicitly confirmed (system override, not AI guess)
        if (
          profile.visa_role === "primary" &&
          extractionResultWithConfidence.fields.visa_role === "dependent"
        ) {
          mergedConfidence.visa_role = "explicit"
        }

        // Check if the pending field was successfully extracted
        if (pendingFieldKey_preExtraction) {
          const postPending = getNextPendingField(profile)
          if (postPending !== pendingFieldKey_preExtraction) {
            // Field was extracted — reset its attempt counter
            delete fieldAttempts[pendingFieldKey_preExtraction]
          }
        }

        const profileWithMeta = {
          ...profile,
          __field_confidence: mergedConfidence,
          __field_attempts: fieldAttempts,
        }

        // GAP-048: Wrap profile save in try-catch — surface errors in metadata
        try {
          await saveProfileToSupabase(profileWithMeta)
        } catch (e) {
          console.error("[GoMate] Profile save failed:", e)
          profileSaveError = true
        }
      }

      // BUG-1 FIX: Stuck field detection and recovery
      // If extraction ran but the pending field didn't change, increment attempt counter
      if (pendingFieldKey_preExtraction) {
        const postPending = getNextPendingField(profile)
        const fieldStillPending = postPending === pendingFieldKey_preExtraction

        if (fieldStillPending) {
          fieldAttempts[pendingFieldKey_preExtraction] = (fieldAttempts[pendingFieldKey_preExtraction] || 0) + 1
          const attempts = fieldAttempts[pendingFieldKey_preExtraction]

          if (attempts >= 5) {
            // Force-accept: use the raw user message as the field value
            let forcedValue = lastUserText.trim()
            if (YES_NO_FIELDS.has(pendingFieldKey_preExtraction)) {
              const normalized = normalizeYesNo(forcedValue)
              if (normalized) forcedValue = normalized
            }
            if (forcedValue) {
              console.warn(`[GoMate] Force-accepting "${forcedValue}" for stuck field "${pendingFieldKey_preExtraction}" after ${attempts} attempts`)
              profile = updateProfile(profile, { [pendingFieldKey_preExtraction]: forcedValue } as Partial<Profile>)
              delete fieldAttempts[pendingFieldKey_preExtraction]
            }
          } else if (attempts >= 3) {
            // Focused extraction: simpler, more direct prompt targeting just this field
            console.warn(`[GoMate] Attempting focused extraction for "${pendingFieldKey_preExtraction}" (attempt ${attempts})`)
            const focusedResult = await extractProfileDataFocused(lastUserText, pendingFieldKey_preExtraction)
            if (focusedResult && Object.keys(focusedResult.fields).length > 0) {
              profile = updateProfile(profile, focusedResult.fields)
              delete fieldAttempts[pendingFieldKey_preExtraction]
            }
          }

          // Save updated attempt counts and any force-accepted values
          const profileWithMeta = {
            ...profile,
            __field_confidence: (profile as Record<string, unknown>).__field_confidence || {},
            __field_attempts: fieldAttempts,
          }
          try {
            await saveProfileToSupabase(profileWithMeta)
          } catch (e) {
            console.error("[GoMate] Profile save failed (stuck field recovery):", e)
            profileSaveError = true
          }
        }
      }
    }

    // Detect first-time critical field extraction for confirmation prompt
    const criticalFieldConfirmations: string[] = []
    if (!prevDestination && profile.destination) {
      criticalFieldConfirmations.push(
        `IMPORTANT: You just extracted destination as "${profile.destination}". Before proceeding, confirm this with the user naturally: "Just to confirm — you're planning to move to ${profile.destination}, correct?" Only continue to the next question after they confirm.`
      )
    }
    if (!prevCitizenship && profile.citizenship) {
      criticalFieldConfirmations.push(
        `IMPORTANT: You just extracted citizenship as "${profile.citizenship}". Confirm this: "And you're a ${profile.citizenship} citizen, right?" Only continue after confirmation.`
      )
    }

    // Determine interview state
    const complete = isProfileComplete(profile)
    const pendingFieldKey = getNextPendingField(profile)

    let interviewState: "interview" | "review" | "confirmed" | "complete" = "interview"
    if (complete && !userConfirmed) {
      interviewState = "review"
    } else if (complete && userConfirmed) {
      interviewState = "complete"
    }

    // Build system prompt based on state
    let systemPrompt: string

    if (planStage === "arrived" && planId) {
      // Post-arrival mode: use settling-in context
      let settlingTasks: Array<{
        title: string; category: string; status: string;
        deadline_days?: number | null; is_legal_requirement?: boolean;
      }> = []
      try {
        const { data: tasks } = await supabase
          .from("settling_in_tasks")
          .select("title, category, status, deadline_days, is_legal_requirement")
          .eq("plan_id", planId)
          .order("sort_order")
        if (tasks) settlingTasks = tasks
      } catch {
        // Continue without tasks
      }
      systemPrompt = buildPostArrivalSystemPrompt(
        {
          destination: profile.destination,
          nationality: profile.nationality,
          occupation: profile.occupation,
          arrivalDate: arrivalDate || undefined,
        },
        settlingTasks
      )
    } else {
      systemPrompt = buildSystemPrompt(profile, pendingFieldKey, interviewState, onboardingCompleted)
    }

    // Inject critical field confirmation instructions (Phase 10)
    if (criticalFieldConfirmations.length > 0) {
      systemPrompt += "\n\n## Critical Field Confirmation (this turn only)\n" +
        criticalFieldConfirmations.join("\n")
    }

    // Build field reminder to inject after conversation history (recency bias fix)
    const fieldReminder = buildFieldReminder(profile, pendingFieldKey)

    // Use fetchWithRetry for streaming — retries on 429/5xx with exponential backoff
    let openaiResponse: Response
    try {
      openaiResponse = await fetchWithRetry(
        `${CHAT_API_BASE}/chat/completions`,
        {
          method: "POST",
          headers: buildApiHeaders(),
          body: JSON.stringify({
            model: "gpt-4o",
            stream: true,
            max_tokens: 500, // GAP-045: Explicit maxTokens on chat LLM call
            messages: [
              { role: "system", content: systemPrompt },
              ...convertToOpenAIMessages(messages),
              // Inject field reminder AFTER history so it's the last thing the LLM sees
              ...(fieldReminder ? [{ role: "system", content: fieldReminder }] : []),
            ],
          }),
        },
        30_000, // 30s timeout for streaming responses
        3,
      )
    } catch (fetchError) {
      console.error("[GoMate] Chat fetch failed after retries:", fetchError)
      return new Response(
        JSON.stringify({ error: "Our AI is temporarily unavailable. Please try again in a moment." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )
    }

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error("[GoMate] OpenAI streaming error:", errorText)
      const isRateLimit = openaiResponse.status === 429 || errorText.includes("rate_limit")
      return new Response(
        JSON.stringify({
          error: isRateLimit
            ? "Our AI is experiencing high demand. Please wait a moment and try again."
            : "OpenAI API error",
        }),
        { status: isRateLimit ? 429 : 500, headers: { "Content-Type": "application/json" } }
      )
    }

    // Create a transform stream to convert OpenAI SSE to our format
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    
    // Get relevant sources based on user message and destination
    const relevantSources = lastUserText && profile.destination
      ? getRelevantSources(lastUserText, profile.destination)
      : []
    
    // Get visa status if we have citizenship and destination
    const visaStatus = profile.citizenship && profile.destination
      ? getVisaStatus(profile.citizenship, profile.destination)
      : null
    
    // Get all official sources for the destination
    const officialSources = profile.destination 
      ? getOfficialSourcesArray(profile.destination)
      : []
    
    // Get dynamic progress info
    const progressInfo = getProgressInfo(profile)
    const requiredFields = getRequiredFields(profile)
    
    // Generate profile summary and visa recommendation when complete
    const profileSummary = complete ? generateProfileSummary(profile) : null
    const visaRecommendation = complete ? generateVisaRecommendation(profile) : null
    const formattedVisaRec = visaRecommendation ? formatVisaRecommendation(visaRecommendation) : null
    
    // Generate research data when complete
    const costOfLivingData = complete && profile.destination 
      ? getCostOfLivingData(profile.destination, profile.target_city || undefined)
      : null
    const budgetData = complete && costOfLivingData 
      ? calculateMonthlyBudget(profile, costOfLivingData)
      : null
    const savingsData = complete && budgetData
      ? calculateSavingsTarget(profile, budgetData.comfortable)
      : null
    const researchReport = complete ? generateResearchReport(profile) : null
    
    const metadata = {
      profile,
      state: planLocked ? "complete" : interviewState,
      pendingField: pendingFieldKey || "",
      filledFields: getFilledFields(profile),
      requiredFields,
      progressInfo,
      relevantSources,
      visaStatus,
      // Only include official sources when profile is complete
      officialSources: complete ? officialSources : [],
      planLocked,
      onboardingCompleted,
      profileSummary,
      visaRecommendation: formattedVisaRec,
      costOfLiving: costOfLivingData,
      budget: budgetData,
      savings: savingsData,
      researchReport,
      profileSaveError, // GAP-048: Surface profile write errors in metadata
// Extraction feedback - helps AI verify data was captured
      lastExtraction: extractionAttempted ? {
        attempted: true,
        fieldsExtracted: extractionResultWithConfidence ? Object.keys(extractionResultWithConfidence.fields) : [],
        extractedValues: extractionResultWithConfidence?.fields || {},
        fieldConfidence: extractionResultWithConfidence?.confidence || {},
        success: extractionResultWithConfidence !== null && Object.keys(extractionResultWithConfidence.fields).length > 0,
        pendingFieldBefore: pendingFieldKey,
      } : null,
    }
    
    const messageId = `msg_${Date.now()}`

    // Accumulate full assistant response for chat history persistence
    let fullAssistantText = ""
    let streamCompleted = false

    const transformStream = new TransformStream({
      start(controller) {
        // Send message start
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "message-start",
          id: messageId,
          role: "assistant",
        })}\n\n`))
      },

      transform(chunk, controller) {
        const text = decoder.decode(chunk)
        const lines = text.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") {
              streamCompleted = true
              // Send message end with metadata
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: "message-end",
                metadata,
              })}\n\n`))
              controller.enqueue(encoder.encode("data: [DONE]\n\n"))
            } else {
              try {
                const parsed = JSON.parse(data)
                const content = parsed.choices?.[0]?.delta?.content
                if (content) {
                  fullAssistantText += content
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: "text-delta",
                    delta: content,
                  })}\n\n`))
                }
              } catch {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        }
      },

      async flush() {
        // Persist chat messages after stream completes successfully
        // Only persist if: stream completed fully, we have a planId, and there's content
        if (!streamCompleted || !planId || !fullAssistantText || !lastUserText) return
        try {
          await supabase.from("chat_messages").insert([
            { plan_id: planId, user_id: user.id, role: "user", content: lastUserText },
            { plan_id: planId, user_id: user.id, role: "assistant", content: fullAssistantText },
          ])
        } catch (e) {
          console.error("[GoMate] Failed to persist chat messages:", e)
        }
      },
    })

    const responseStream = openaiResponse.body?.pipeThrough(transformStream)

    // Record chat usage (fire-and-forget, don't block the stream)
    recordUsage(user.id, "chat_message", undefined, 500).catch(() => {})

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-GoMate-Profile": encodeURIComponent(JSON.stringify(profile)),
        "X-GoMate-State": interviewState,
      },
    })
  } catch (error) {
    console.error("[GoMate] Error in POST request:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

// Extract profile data from user message using fetch
// Returns both extracted fields and confidence levels for each field
async function extractProfileData(
  userMessage: string,
  currentProfile: Profile,
  pendingField?: AllFieldKey | null,
  lastAIMessage?: string
): Promise<ExtractionResultWithConfidence | null> {
  // Build dynamic field list based on current profile state
  const relevantFields = getRequiredFields(currentProfile)
  const fieldDescriptions = relevantFields.map(field => {
    const config = FIELD_CONFIG[field]
    return `- ${field}: ${config.intent}`
  }).join("\n")

  // Build pending field context for yes/no disambiguation
  const pendingFieldConfig = pendingField ? FIELD_CONFIG[pendingField as AllFieldKey] : null
  const pendingContext = pendingField && pendingFieldConfig
    ? `\nCONTEXT — The AI just asked about: "${pendingField}" (${pendingFieldConfig.label})
${lastAIMessage ? `AI's last message: "${lastAIMessage.slice(0, 200)}"` : ""}
If the user responds with "yes", "no", "I think so", "definitely", "not really", etc.:
- FIRST check if the AI's last message was asking about the pending field "${pendingField}" or about something ELSE (e.g., confirming a previous answer)
- If AI was confirming a DIFFERENT field (like destination/citizenship), do NOT map "yes"/"no" to "${pendingField}" — the user is confirming that other field, not answering about "${pendingField}"
- Only map "yes"/"no" to "${pendingField}" when the AI was actually asking about it
ALSO extract ANY additional fields mentioned in the same message — don't stop at just the pending field.
If the user provides information about a DIFFERENT field than "${pendingField}", extract that field instead.
Examples:
- Pending field "highly_skilled", AI asked about highly_skilled, user says "Yes" → highly_skilled="yes"
- Pending field "purpose", AI asked "confirm you're moving to Japan?", user says "Yes" → extract NOTHING (user is confirming destination, not answering purpose)
- Pending field "timeline", user says "I'm transferring with my company for work, around January" → purpose="work", timeline="January", job_offer="yes"
- Pending field "job_offer", user says "Yes, my company is sponsoring" → job_offer="yes", employer_sponsorship="yes"
- Pending field "moving_alone", user says "Yes, with my wife and two kids" → moving_alone="no", spouse_joining="yes", children_count="2"
`
    : ""

  const extractionPrompt = `You are extracting relocation profile information from a user message. Extract ALL fields that are clearly mentioned or strongly implied.

Current profile:
${JSON.stringify(currentProfile, null, 2)}

User message: "${userMessage}"
${pendingContext}
FIELDS TO EXTRACT:
${fieldDescriptions}

EXTRACTION RULES:
1. Extract MULTIPLE fields from one message when applicable
   - "I'm Maria from Brazil, planning to move to Germany for work" → name, citizenship, destination, purpose, visa_role="primary"
   - "I'm Swedish living in Denmark" → citizenship="Swedish", current_location="Denmark"
   
2. VISA_ROLE - CRITICAL for determining visa pathway:
   - "primary" = user is main visa applicant (getting their own visa)
   - "dependent" = user is joining someone else (partner, spouse, family)
   
   DETECT DEPENDENT scenarios:
   - "joining my partner/spouse/husband/wife" → visa_role="dependent"
   - "my fiancé lives in Sweden" → visa_role="dependent", destination="Sweden"
   - "my wife got a job in Berlin" → visa_role="dependent"
   - "following my partner" → visa_role="dependent"
   - "moving to be with my boyfriend" → visa_role="dependent"
   - "I got a job offer" or "I'm studying" → visa_role="primary"

   CRITICAL DISAMBIGUATION — "moving WITH" vs "joining/following":
   - If user has their OWN purpose (job offer, study admission, work transfer) AND
     mentions bringing a partner/family → visa_role="primary", moving_alone="no"
   - "I got a job in Berlin, moving with my partner" → visa_role="primary" (user has own job)
   - "I'm studying in Tokyo, my wife is coming too" → visa_role="primary" (user has own purpose)
   - "dependent" ONLY when user is deriving their visa FROM someone else's status
   - If purpose is already "work" or "study" and user says "with my partner" → keep visa_role="primary"
   
3. PARTNER FIELDS (only when visa_role="dependent" or joining someone):
   - partner_citizenship: "He's Swedish" → partner_citizenship="Swedish"
   - partner_visa_status: "citizen", "permanent_resident", "work_visa", "student_visa", "other"
     - "She's a citizen there" → partner_visa_status="citizen"
     - "He has a work permit" → partner_visa_status="work_visa"
     - "She has PR" → partner_visa_status="permanent_resident"
   - relationship_type: "spouse", "fiancé", "registered_partner", "cohabitant", "parent", "child", "other"
     - "my husband" → relationship_type="spouse"
     - "my fiancée" → relationship_type="fiancé"
     - "my sambo/partner" → relationship_type="cohabitant"
   - partner_residency_duration: "He's lived there for 3 years" → partner_residency_duration="3 years"
   - relationship_duration: "We've been married 2 years" → relationship_duration="2 years"

4. INFER values intelligently:
   - "with my wife and kids" → moving_alone="no", spouse_joining="yes"
   - "just me" or "going solo" → moving_alone="yes", visa_role="primary"
   - "I'm a software engineer" → could indicate job_field, highly_skilled
   - "studying medicine" → purpose="study", study_field="medicine"
   
5. PURPOSE values (use exactly): "study", "work", "settle", "digital_nomad", "other"
   - "university" or "masters" → purpose="study"
   - "job" or "career" → purpose="work"  
   - "retire" or "permanently" → purpose="settle"
   - "remote work" or "freelance" → purpose="digital_nomad"
   - "joining my partner" → purpose="settle" (family reunion)

6. INCOME STABILITY (for digital nomads - IMPORTANT for visa eligibility):
   - income_consistency: "stable", "variable", or "new"
     - "steady income" or "consistent clients" → income_consistency="stable"
     - "income fluctuates" or "varies month to month" → income_consistency="variable"
     - "just started freelancing" or "new business" → income_consistency="new"
   - income_history_months: Extract duration of income history
     - "been freelancing for 2 years" → income_history_months="24 months"
     - "started 6 months ago" → income_history_months="6 months"
     - "working remotely since 2022" → calculate and extract

7. BIRTH YEAR & AGE (for age-restricted visas):
   - birth_year: Extract or calculate from age
     - "I'm 28" → calculate birth_year from current year (e.g., "1997")
     - "born in 1990" → birth_year="1990"
     - "I'll be 30 next year" → calculate appropriately
   - IMPORTANT: Working Holiday visas often have age limits (18-30 or 18-35)
   - Retirement visas often require 50+ years old

8. OTHER CITIZENSHIPS (dual/multiple passports):
   - other_citizenships: Extract additional citizenships beyond primary
     - "I also have an Irish passport" → other_citizenships="Irish"
     - "I'm American but also have German citizenship" → citizenship="American", other_citizenships="German"
     - "dual US/Canadian citizen" → citizenship="US", other_citizenships="Canadian"
   - Multiple additional: "I have Italian and Brazilian passports too" → other_citizenships="Italian, Brazilian"

9. YES/NO fields: Extract "yes" or "no"
10. Numbers: Extract as string ("2" not 2)
11. Countries/cities: Normalize to proper names ("USA" or "United States", not "the states")

IMPORTANT: Extract ALL fields mentioned in one message. Don't leave fields empty if the user provided the information.
Common multi-field messages — extract ALL applicable fields:
- "Yes, my company is sponsoring" → job_offer="yes" AND employer_sponsorship="yes"
- "Moving with my wife and 2 kids" → moving_alone="no", spouse_joining="yes", children_count="2"
- "I've been freelancing for 3 years making about 5000/month" → income_source, monthly_income, income_history_months
- "8 years as a software engineer" → years_experience="8", job_field="software engineering", highly_skilled="yes"

CONFIDENCE LEVELS - For each extracted field, also provide a confidence level:
- "explicit": User directly stated this value (e.g., "I'm moving to Germany" → destination is explicit)
- "inferred": Value was derived from context (e.g., "my husband" → relationship_type="spouse" is inferred)
- "assumed": Reasonable assumption from limited context (e.g., solo traveler mentioning work → visa_role="primary" is assumed)

Respond with a JSON object containing:
{
  "fields": { extracted field values },
  "confidence": { field_name: "explicit" | "inferred" | "assumed" }
}

Example:
User: "I'm Maria, a software engineer from Brazil moving to Berlin to join my German husband"
Response:
{
  "fields": {
    "name": "Maria",
    "citizenship": "Brazilian", 
    "job_field": "software engineering",
    "destination": "Germany",
    "target_city": "Berlin",
    "visa_role": "dependent",
    "relationship_type": "spouse",
    "partner_citizenship": "German"
  },
  "confidence": {
    "name": "explicit",
    "citizenship": "explicit",
    "job_field": "explicit",
    "destination": "inferred",
    "target_city": "explicit",
    "visa_role": "inferred",
    "relationship_type": "inferred",
    "partner_citizenship": "explicit"
  }
}

Return {"fields": {}, "confidence": {}} if nothing extractable.`

  try {
    let response: Response
    try {
      response = await fetchWithRetry(
        `${CHAT_API_BASE}/chat/completions`,
        {
          method: "POST",
          headers: buildApiHeaders(),
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: extractionPrompt }],
            response_format: { type: "json_object" },
            temperature: 0, // GAP-004: Deterministic extraction
            max_tokens: 200, // GAP-045: Explicit maxTokens on extraction LLM call
          }),
        },
        15_000,
        3,
      )
    } catch {
      console.error("[GoMate] Extraction fetch failed after retries")
      return null
    }

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || "{}"
    
    let parsed: { fields?: Record<string, unknown>; confidence?: Record<string, string> }
    try {
      parsed = JSON.parse(text)
    } catch {
      return null
    }
    
    // Handle both old format (flat object) and new format (with fields/confidence)
    const extractedFields = parsed.fields || parsed
    const extractedConfidence = parsed.confidence || {}
    
    // Filter out null/undefined values and validate
    const result: Partial<Profile> = {}
    const resultConfidence: Record<string, FieldConfidence> = {}
    const validKeys = new Set(ALL_FIELDS)
    const validConfidenceLevels = new Set(["explicit", "inferred", "assumed"])
    
    for (const [key, value] of Object.entries(extractedFields)) {
      if (!validKeys.has(key)) continue
      if (typeof value !== "string" || value === "") continue

      // BUG-2 FIX: Don't overwrite identity fields (purpose, destination, citizenship)
      // once they've been set, unless the extraction has explicit confidence
      if (IDENTITY_FIELDS.has(key) && currentProfile[key as keyof Profile]) {
        const confidence = extractedConfidence[key]
        if (confidence !== "explicit") continue
        // Even with explicit confidence, skip if value is the same
        if (currentProfile[key as keyof Profile] === value) continue
      }

      if (key === "purpose") {
        const validPurposes = ["study", "work", "settle", "digital_nomad", "other"]
        const lowerValue = value.toLowerCase()
        if (validPurposes.includes(lowerValue)) {
          result.purpose = lowerValue as Profile["purpose"]
        }
      } else if (key === "visa_role") {
        const validRoles = ["primary", "dependent"]
        const lowerValue = value.toLowerCase()
        if (validRoles.includes(lowerValue)) {
          result.visa_role = lowerValue as Profile["visa_role"]
        }
      } else if (key === "partner_visa_status") {
        const validStatuses = ["citizen", "permanent_resident", "work_visa", "student_visa", "other"]
        const lowerValue = value.toLowerCase().replace(" ", "_")
        if (validStatuses.includes(lowerValue)) {
          result.partner_visa_status = lowerValue as Profile["partner_visa_status"]
        }
      } else if (key === "relationship_type") {
        const validTypes = ["spouse", "fiancé", "registered_partner", "cohabitant", "parent", "child", "other"]
        const lowerValue = value.toLowerCase()
        // Handle variations
        const normalized = lowerValue === "fiancee" ? "fiancé" : lowerValue
        if (validTypes.includes(normalized)) {
          result.relationship_type = normalized as Profile["relationship_type"]
        }
      } else if (key === "income_consistency") {
        const validConsistency = ["stable", "variable", "new"]
        const lowerValue = value.toLowerCase()
        if (validConsistency.includes(lowerValue)) {
          result.income_consistency = lowerValue as Profile["income_consistency"]
        }
      } else {
        result[key as keyof Profile] = value as Profile[keyof Profile]
      }
      
      // Track confidence for successfully extracted fields
      if (result[key as keyof Profile] !== undefined) {
        const confidence = extractedConfidence[key]
        if (confidence && validConfidenceLevels.has(confidence)) {
          resultConfidence[key] = confidence as FieldConfidence
        } else {
          // Default to "explicit" if not specified
          resultConfidence[key] = "explicit"
        }
      }
    }
    
    return Object.keys(result).length > 0 
      ? { fields: result, confidence: resultConfidence } 
      : null
  } catch {
    return null
  }
}

// Focused extraction for stuck fields — simpler prompt targeting a single field
async function extractProfileDataFocused(
  userMessage: string,
  targetField: AllFieldKey,
): Promise<ExtractionResultWithConfidence | null> {
  const config = FIELD_CONFIG[targetField]
  if (!config) return null

  const isYesNo = YES_NO_FIELDS.has(targetField)
  const prompt = `You are extracting a SINGLE field from a user's message in a relocation interview.

The user was asked about: "${config.label}" — ${config.intent}
Their response: "${userMessage}"

Extract the value for field "${targetField}".
${isYesNo ? `This is a yes/no field:
- Any affirmative response (yes, yeah, sure, definitely, of course, I do, I am, I have): extract "yes"
- Any negative response (no, nah, not really, I don't, I'm not, never, none): extract "no"
- "Not really" or "not exactly" = "no"
- "I'd say so" or "I think so" = "yes"` : `Extract the value as a concise string. For amounts, include the number and currency (e.g. "3000 EUR"). For locations, use "City, Country" format.`}

Respond with JSON: {"fields": {"${targetField}": "extracted value"}, "confidence": {"${targetField}": "explicit"}}
If you truly cannot extract anything: {"fields": {}, "confidence": {}}`

  try {
    let response: Response
    try {
      response = await fetchWithRetry(
        `${CHAT_API_BASE}/chat/completions`,
        {
          method: "POST",
          headers: buildApiHeaders(),
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 100,
          }),
        },
        15_000,
        3,
      )
    } catch {
      return null
    }

    if (!response.ok) return null

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || "{}"

    let parsed: { fields?: Record<string, unknown>; confidence?: Record<string, string> }
    try {
      parsed = JSON.parse(text)
    } catch {
      return null
    }

    const fields = parsed.fields || {}
    const confidence = parsed.confidence || {}
    const result: Partial<Profile> = {}
    const resultConfidence: Record<string, FieldConfidence> = {}

    const value = fields[targetField]
    if (typeof value === "string" && value !== "") {
      result[targetField as keyof Profile] = value as Profile[keyof Profile]
      resultConfidence[targetField] = (confidence[targetField] as FieldConfidence) || "explicit"
    }

    return Object.keys(result).length > 0
      ? { fields: result, confidence: resultConfidence }
      : null
  } catch {
    return null
  }
}
