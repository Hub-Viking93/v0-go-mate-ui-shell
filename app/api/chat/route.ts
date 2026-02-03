import { type UIMessage } from "ai"
import { createClient } from "@/lib/supabase/server"
import {
  type Profile,
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
import { buildSystemPrompt } from "@/lib/gomate/system-prompt"
import { getRelevantSources } from "@/lib/gomate/source-linker"
import { getOfficialSourcesArray } from "@/lib/gomate/official-sources"
import { getVisaStatus } from "@/lib/gomate/visa-checker"
import { saveProfileToSupabase } from "@/lib/gomate/supabase-utils"
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

export const maxDuration = 30

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

    // Initialize or use incoming profile
    let profile: Profile = incomingProfile || { ...EMPTY_PROFILE }
    const userConfirmed = confirmed || false
    
    // Check if the plan is locked (completed) - if so, skip extraction
    let planLocked = false
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: plan } = await supabase
          .from("relocation_plans")
          .select("locked, profile_data")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()
        
        if (plan?.locked) {
          planLocked = true
          // Use the locked profile data
          if (plan.profile_data) {
            profile = { ...EMPTY_PROFILE, ...plan.profile_data }
          }
        }
      }
    } catch {
      // Continue without lock check if it fails
    }

    // Get the last user message for extraction
    const lastUserMessage = messages.filter((m) => m.role === "user").pop()
    const lastUserText = lastUserMessage ? getMessageText(lastUserMessage) : ""

    // If there's a user message and plan is NOT locked, extract data from it
    let extractionResult: Partial<Profile> | null = null
    let extractionAttempted = false
    
    if (lastUserText && !userConfirmed && !planLocked) {
      extractionAttempted = true
      extractionResult = await extractProfileData(lastUserText, profile)
      if (extractionResult && Object.keys(extractionResult).length > 0) {
        profile = updateProfile(profile, extractionResult)
        
        // Save the updated profile to Supabase
        await saveProfileToSupabase(profile)
      }
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
    const systemPrompt = buildSystemPrompt(profile, pendingFieldKey, interviewState)

    // Use fetch directly for streaming to avoid OpenAI SDK compatibility issues
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...convertToOpenAIMessages(messages),
        ],
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error("[GoMate] OpenAI streaming error:", errorText)
      return new Response(
        JSON.stringify({ error: "OpenAI API error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
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
      profileSummary,
      visaRecommendation: formattedVisaRec,
      costOfLiving: costOfLivingData,
      budget: budgetData,
      savings: savingsData,
      researchReport,
      // Extraction feedback - helps AI verify data was captured
      lastExtraction: extractionAttempted ? {
        attempted: true,
        fieldsExtracted: extractionResult ? Object.keys(extractionResult) : [],
        extractedValues: extractionResult || {},
        success: extractionResult !== null && Object.keys(extractionResult).length > 0,
        pendingFieldBefore: pendingFieldKey,
      } : null,
    }
    
    const messageId = `msg_${Date.now()}`
    
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
    })

    const responseStream = openaiResponse.body?.pipeThrough(transformStream)

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
async function extractProfileData(
  userMessage: string,
  currentProfile: Profile
): Promise<Partial<Profile> | null> {
  // Build dynamic field list based on current profile state
  const relevantFields = getRequiredFields(currentProfile)
  const fieldDescriptions = relevantFields.map(field => {
    const config = FIELD_CONFIG[field]
    return `- ${field}: ${config.intent}`
  }).join("\n")

  const extractionPrompt = `You are extracting relocation profile information from a user message. Extract ALL fields that are clearly mentioned or strongly implied.

Current profile:
${JSON.stringify(currentProfile, null, 2)}

User message: "${userMessage}"

FIELDS TO EXTRACT:
${fieldDescriptions}

EXTRACTION RULES:
1. Extract MULTIPLE fields from one message when applicable
   - "I'm Maria from Brazil, planning to move to Germany for work" → name, citizenship, destination, purpose
   - "I'm Swedish living in Denmark" → citizenship="Swedish", current_location="Denmark"
   
2. INFER values intelligently:
   - "with my wife and kids" → moving_alone="no", spouse_joining="yes"
   - "just me" or "going solo" → moving_alone="yes"
   - "I'm a software engineer" → could indicate job_field, highly_skilled
   - "studying medicine" → purpose="study", study_field="medicine"
   
3. PURPOSE values (use exactly): "study", "work", "settle", "digital_nomad", "other"
   - "university" or "masters" → purpose="study"
   - "job" or "career" → purpose="work"  
   - "retire" or "permanently" → purpose="settle"
   - "remote work" or "freelance" → purpose="digital_nomad"

4. YES/NO fields: Extract "yes" or "no"
5. Numbers: Extract as string ("2" not 2)
6. Countries/cities: Normalize to proper names ("USA" or "United States", not "the states")

IMPORTANT: Extract everything mentioned. Don't leave fields empty if the user provided the information.

Respond with a JSON object of extracted fields only. Empty object {} if nothing extractable.`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: extractionPrompt }],
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || "{}"
    
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(text)
    } catch {
      return null
    }
    
    // Filter out null/undefined values and validate
    const result: Partial<Profile> = {}
    const validKeys = new Set(ALL_FIELDS)
    
    for (const [key, value] of Object.entries(parsed)) {
      if (!validKeys.has(key)) continue
      if (typeof value !== "string" || value === "") continue
      
      if (key === "purpose") {
        const validPurposes = ["study", "work", "settle", "digital_nomad", "other"]
        const lowerValue = value.toLowerCase()
        if (validPurposes.includes(lowerValue)) {
          result.purpose = lowerValue as Profile["purpose"]
        }
      } else {
        result[key as keyof Profile] = value as Profile[keyof Profile]
      }
    }
    
    return Object.keys(result).length > 0 ? result : null
  } catch {
    return null
  }
}
