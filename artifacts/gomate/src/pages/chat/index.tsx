

import React, { useState, useRef, useEffect, useCallback } from "react"
import { useSearchParams } from "@/lib/router-compat"
import { Send, Sparkles, Loader2, Globe, CheckCircle2, Shield, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  type Profile,
  EMPTY_PROFILE,
  type AllFieldKey,
  getRequiredFields,
  FIELD_CONFIG,
  type FieldConfig,
} from "@/lib/gomate/profile-schema"
import { getProgressInfo } from "@/lib/gomate/state-machine"
import { OPENING_MESSAGE, getSmartOpeningMessage } from "@/lib/gomate/system-prompt"
import { isProfileComplete } from "@/lib/gomate/state-machine"
import { Confetti } from "@/components/confetti"
import { ChatMessageContent } from "@/components/chat/chat-message-content"
import { OnboardingDisclaimer } from "@/components/legal-disclaimer"
import { GoMateAvatar } from "@/components/gomate-avatar"
import { CountryFlag } from "@/components/country-flag"
import { VisaStatusBadge } from "@/components/visa-status-badge"
import { ProfileSummaryCard } from "@/components/profile-summary-card"
import { BudgetCard } from "@/components/budget-card"
import { TierGate } from "@/components/tier-gate"
import { useTier } from "@/hooks/use-tier"
import { getCurrencyFromCountry } from "@/lib/gomate/currency"
import { ExternalLink } from "lucide-react"
import type { OfficialSource } from "@/lib/gomate/official-sources"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

export default function ChatPage() {
  const searchParams = useSearchParams()
  const fieldParam = searchParams.get("field")
  const labelParam = searchParams.get("label")
  const { tier } = useTier()
  
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState("")
  const [fieldPromptSent, setFieldPromptSent] = useState(false)
  
  const [profile, setProfile] = useState<Profile>({ ...EMPTY_PROFILE })
  const [interviewState, setInterviewState] = useState<
    "interview" | "review" | "confirmed" | "complete"
  >("interview")
  const [pendingField, setPendingField] = useState<AllFieldKey | null>("name")
  const [filledFields, setFilledFields] = useState<AllFieldKey[]>([])
  const [requiredFields, setRequiredFields] = useState<AllFieldKey[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [officialSources, setOfficialSources] = useState<OfficialSource[]>([])
  const [visaStatus, setVisaStatus] = useState<{ visaFree: boolean; reason: string; badge: string } | null>(null)
  const [planLocked, setPlanLocked] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  // Phase 8 — track whether the user has marked themselves as arrived so the
  // chat page can switch to settling-in coach mode (different label, different
  // suggestion chips). The api-server already routes the request server-side
  // when stage="arrived" — this state just makes the mode visible in the UI.
  const [planStage, setPlanStage] = useState<string | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [planVersion, setPlanVersion] = useState<number | null>(null)
  const [researchTriggered, setResearchTriggered] = useState(false)
  const [profileSummary, setProfileSummary] = useState<string | null>(null)
  const [visaRecommendation, setVisaRecommendation] = useState<string | null>(null)
  const [budgetData, setBudgetData] = useState<{ minimum: number; comfortable: number; breakdown: Record<string, number> } | null>(null)
  const [savingsData, setSavingsData] = useState<{ emergencyFund: number; movingCosts: number; initialSetup: number; visaFees: number; total: number; timeline: string } | null>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [confettiShown, setConfettiShown] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyTruncated, setHistoryTruncated] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Calculate progress dynamically based on current profile
  const dynamicRequiredFields = getRequiredFields(profile)
  const progressPercent = dynamicRequiredFields.length > 0
    ? Math.round((filledFields.length / dynamicRequiredFields.length) * 100)
    : 0

  // Load existing profile from Supabase on mount
  useEffect(() => {
    async function loadExistingProfile() {
      try {
        const response = await fetch("/api/profile")
        if (response.ok) {
          const data = await response.json()
          
          // Capture plan ID
          if (data.plan?.id) {
            setPlanId(data.plan.id)
          }

          if (typeof data.plan?.plan_version === "number") {
            setPlanVersion(data.plan.plan_version)
          }
          
          // Check if plan is locked
          if (data.plan?.locked) {
            setPlanLocked(true)
            setInterviewState("complete")
          }
          if (typeof data.plan?.stage === "string") {
            setPlanStage(data.plan.stage)
          }

          // Track if onboarding was already completed (plan shown previously)
          if (data.plan?.onboarding_completed) {
            setOnboardingCompleted(true)
          }
          
          if (data.plan?.profile_data) {
            const savedProfile = data.plan.profile_data as Profile
            const mergedProfile = { ...EMPTY_PROFILE, ...savedProfile }
            setProfile(mergedProfile)
            
            // Calculate required and filled fields dynamically
            const required = getRequiredFields(mergedProfile)
            setRequiredFields(required)
            const filled = required.filter(f => mergedProfile[f as keyof Profile])
            setFilledFields(filled)
            
            // Determine state based on profile completeness (if not locked)
            if (!data.plan?.locked) {
              if (filled.length === required.length) {
                setInterviewState("review")
                setPendingField(null)
              } else {
                // Find next pending field using getProgressInfo
                const progress = getProgressInfo(mergedProfile)
                setPendingField(progress.currentField)
              }
            }
          }
        }
      } catch (error) {
        console.error("[GoMate] Error loading profile:", error)
      } finally {
        setProfileLoaded(true)
      }
    }
    loadExistingProfile()
  }, [])

  // Load chat history after profile has loaded, then fall back to opening message
  useEffect(() => {
    if (!profileLoaded || messages.length > 0) return

    async function loadHistory() {
      try {
        const res = await fetch("/api/chat/history")
        if (res.ok) {
          const data = await res.json()
          if (data.messages && data.messages.length > 0) {
            setMessages(
              data.messages.map((m: { id: string; role: string; content: string }) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
              }))
            )
            if (data.messages.length >= 50) {
              setHistoryTruncated(true)
            }
            setHistoryLoading(false)
            return
          }
        }
      } catch (e) {
        console.error("[GoMate] Failed to load chat history:", e)
      }

      // No history found — show opening message
      const profileComplete = isProfileComplete(profile)
      const hasName = !!profile.name
      const openingContent = profileComplete && hasName
        ? getSmartOpeningMessage(profile)
        : OPENING_MESSAGE
      setMessages([{ id: "opening", role: "assistant", content: openingContent }])
      setHistoryLoading(false)
    }

    loadHistory()
  }, [profileLoaded])

  // Handle field parameter from URL - prompt AI to ask about specific field
  useEffect(() => {
    if (fieldParam && !fieldPromptSent && messages.length > 0 && !isLoading) {
      setFieldPromptSent(true)
      
      // Get field config for context
      const fieldConfig = FIELD_CONFIG[fieldParam as AllFieldKey] as FieldConfig | undefined
      const fieldLabel = labelParam || fieldConfig?.label || fieldParam
      
      // Set this as the pending field
      setPendingField(fieldParam as AllFieldKey)
      
      // Create a contextual opening message asking about this specific field
      const fieldQuestion = fieldConfig?.examples?.[0] || `Could you tell me about your ${fieldLabel.toLowerCase()}?`
      
      // Add an assistant message asking specifically about this field
      const fieldMessage: Message = {
        id: `field_prompt_${Date.now()}`,
        role: "assistant",
        content: `I see you'd like to fill in your **${fieldLabel}**. ${fieldQuestion}`,
      }
      
      setMessages(prev => [...prev, fieldMessage])
    }
  }, [fieldParam, labelParam, fieldPromptSent, messages.length, isLoading])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingContent])

  // Trigger confetti when profile reaches 100% for the first time
  useEffect(() => {
    if (progressPercent === 100 && !confettiShown && !planLocked && interviewState === "review") {
      setShowConfetti(true)
      setConfettiShown(true)
    }
  }, [progressPercent, confettiShown, planLocked, interviewState])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return

    // Add user message
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
    }
    
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setIsLoading(true)
    setStreamingContent("")

    // Cancel any existing request
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            id: m.id,
            role: m.role,
            parts: [{ type: "text", text: m.content }],
          })),
          profile,
          confirmed,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Update profile from headers
      const profileHeader = response.headers.get("X-GoMate-Profile")
      const stateHeader = response.headers.get("X-GoMate-State")
      const pendingHeader = response.headers.get("X-GoMate-Pending-Field")
      const filledHeader = response.headers.get("X-GoMate-Filled-Fields")

      if (profileHeader) {
        try {
          setProfile(JSON.parse(profileHeader))
        } catch {}
      }
      if (stateHeader) {
        setInterviewState(stateHeader as "interview" | "review" | "confirmed" | "complete")
      }
      if (pendingHeader) {
        setPendingField(pendingHeader as AllFieldKey)
      } else {
        setPendingField(null)
      }
      if (filledHeader) {
        try {
          setFilledFields(JSON.parse(filledHeader))
        } catch {}
      }

      // Read the SSE stream
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response body")

      const decoder = new TextDecoder()
      let buffer = ""
      let fullContent = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith("data:")) {
            const data = trimmed.slice(5).trim()
            if (data === "[DONE]") continue
            
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === "text-delta" && parsed.delta) {
                fullContent += parsed.delta
                setStreamingContent(fullContent)
              } else if (parsed.type === "message-end" && parsed.metadata) {
                // Update state from metadata
                if (parsed.metadata.profile) {
                  setProfile(parsed.metadata.profile)
                }
                if (parsed.metadata.state) {
                  setInterviewState(parsed.metadata.state)
                }
                if (parsed.metadata.pendingField !== undefined) {
                  setPendingField(parsed.metadata.pendingField || null)
                }
                if (parsed.metadata.filledFields) {
                  setFilledFields(parsed.metadata.filledFields)
                }
                if (parsed.metadata.requiredFields) {
                  setRequiredFields(parsed.metadata.requiredFields)
                }
                if (parsed.metadata.officialSources) {
                  setOfficialSources(parsed.metadata.officialSources)
                }
                if (parsed.metadata.visaStatus) {
                  setVisaStatus(parsed.metadata.visaStatus)
                }
                if (parsed.metadata.planLocked !== undefined) {
                  setPlanLocked(parsed.metadata.planLocked)
                }
                if (parsed.metadata.onboardingCompleted !== undefined) {
                  setOnboardingCompleted(parsed.metadata.onboardingCompleted)
                }
                if (parsed.metadata.profileSummary) {
                  setProfileSummary(parsed.metadata.profileSummary)
                }
                if (parsed.metadata.visaRecommendation) {
                  setVisaRecommendation(parsed.metadata.visaRecommendation)
                }
                if (parsed.metadata.budget) {
                  setBudgetData(parsed.metadata.budget)
                }
                if (parsed.metadata.savings) {
                  setSavingsData(parsed.metadata.savings)
                }
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // Add assistant message when complete
      if (fullContent) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant_${Date.now()}`,
            role: "assistant",
            content: fullContent,
          },
        ])
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      console.error("[GoMate] Chat error:", error)
      
      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: "assistant",
          content: "I encountered an error. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
      setStreamingContent("")
    }
  }, [messages, profile, confirmed, isLoading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput("")
  }

  const handleConfirm = async () => {
    setConfirmed(true)
    sendMessage("Yes, that looks correct. Please generate my recommendations.")
    
    // Trigger AI research in the background after confirmation
    if (planId && !researchTriggered) {
      setResearchTriggered(true)
      try {
        // Fire and forget - research runs in background
        fetch("/api/research/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId }),
        }).catch(err => {
          console.error("[GoMate] Failed to trigger research:", err)
        })
      } catch (error) {
        console.error("[GoMate] Error triggering research:", error)
      }
    }
  }

  const handleEdit = () => {
    sendMessage("I'd like to make some changes to my profile.")
  }

  const handleQuickSend = (text: string) => {
    if (isLoading) return
    sendMessage(text)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)]">
      {/* Confetti celebration when profile is 100% complete */}
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      
      {/* Header with progress */}
      <div className="flex-shrink-0 p-4 border-b border-border bg-gradient-to-r from-[#1B3A2D]/[0.03] to-transparent">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-[#1B3A2D] to-[#2D6A4F] shadow-sm">
              <Sparkles className="w-5 h-5 text-[#5EE89C]" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground flex items-center gap-2">
                {planStage === "arrived" ? "Settling-In Coach" : "GoMate Chat"}
                {profile.destination && (
                  <span className="flex items-center gap-1.5 text-muted-foreground font-normal text-sm">
                    <CountryFlag country={profile.destination} size="sm" />
                    {profile.destination}
                  </span>
                )}
                {planStage === "arrived" && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0">
                    Post-arrival mode
                  </Badge>
                )}
              </h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                {planStage === "arrived" ? (
                  <>
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    You're settled — ask about registrations, deadlines, or anything you're stuck on
                  </>
                ) : planLocked ? (
                  <>
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    Plan locked - ask questions freely
                  </>
                ) : null}
                {!planLocked && planStage !== "arrived" && interviewState === "interview" && "Let's plan your relocation"}
                {!planLocked && planStage !== "arrived" && interviewState === "review" && "Review your profile"}
                {!planLocked && planStage !== "arrived" && interviewState === "complete" && "Your personalized plan"}
                {visaStatus && profile.citizenship && profile.destination && (
                  <VisaStatusBadge
                    citizenship={profile.citizenship}
                    destination={profile.destination}
                    size="sm"
                  />
                )}
              </p>
            </div>
          </div>
          <Badge
            variant={interviewState === "complete" ? "default" : "secondary"}
            className={cn(
              "flex items-center gap-1.5",
              interviewState === "complete" && "bg-gradient-to-r from-emerald-500 to-emerald-600 border-0"
            )}
          >
            {interviewState === "complete" ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Complete
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5" />
                {progressPercent}%
              </>
            )}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {filledFields.length} of {dynamicRequiredFields.length} fields completed
            {pendingField && interviewState === "interview" && (
              <span className="text-primary ml-2">
                Next: {FIELD_CONFIG[pendingField]?.label || pendingField.replace(/_/g, " ")}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <OnboardingDisclaimer />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Chat history loading skeleton */}
        {historyLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                {i % 2 !== 0 && <div className="w-8 h-8 rounded-full bg-muted animate-pulse mt-1 mr-2.5" />}
                <div className={cn(
                  "rounded-2xl px-4 py-3 animate-pulse",
                  i % 2 === 0 ? "bg-primary/20 w-[60%]" : "bg-muted w-[70%]"
                )}>
                  <div className="h-4 bg-muted-foreground/10 rounded w-full mb-2" />
                  <div className="h-4 bg-muted-foreground/10 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Truncation notice */}
        {historyTruncated && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Showing last 50 messages
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <GoMateAvatar size="sm" className="mt-1 mr-2.5" />
            )}
            <div
              className={cn(
                "max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border"
              )}
            >
              {message.role === "assistant" ? (
                <ChatMessageContent
                  content={message.content}
                  isStreaming={false}
                />
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.content}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Streaming message */}
        {isLoading && streamingContent && (
          <div className="flex justify-start">
            <GoMateAvatar size="sm" className="mt-1 mr-2.5" />
            <div className="max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 bg-card border border-border">
              <ChatMessageContent content={streamingContent} isStreaming={true} />
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isLoading && !streamingContent && (
          <div className="flex justify-start">
            <GoMateAvatar size="sm" className="mt-1 mr-2.5" />
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
                  <span
                    className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <span
                    className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Locked plan indicator */}
        {planLocked && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Lock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground">Plan Protected</h3>
                <p className="text-xs text-muted-foreground">
                  Your profile is locked. Chat freely without changes.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Official sources panel - only show after profile is complete or confirmed, but not after onboarding is done */}
        {officialSources.length > 0 && !onboardingCompleted && (interviewState === "complete" || confirmed || planLocked) && (
          <Card className="p-4 bg-card/80 border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-primary" />
              Official Sources for {profile.destination}
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {officialSources.slice(0, 5).map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors py-1"
                >
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {source.category}
                  </Badge>
                  <span className="truncate">{source.name}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              ))}
            </div>
          </Card>
        )}

        {/* Profile Summary Card - show when review or complete, but not after onboarding is done */}
        {!onboardingCompleted && (interviewState === "review" || interviewState === "complete" || planLocked) && profile.destination && (
          <ProfileSummaryCard profile={profile} />
        )}

        {/* Budget Card - show when profile is complete and we have budget data, but not after onboarding is done */}
        {!onboardingCompleted && (interviewState === "complete" || planLocked) && budgetData && savingsData && profile.destination && (
          <TierGate tier={tier} feature="budget_planner" onUpgrade={() => window.location.href = "/settings"}>
            <BudgetCard
              budget={budgetData}
              savings={savingsData}
              destination={profile.destination}
              currency={getCurrencyFromCountry(profile.destination) || "USD"}
              currentSavings={parseFloat(profile.savings_available || "0") || 0}
              onUpdateSavings={async (amount) => {
                if (planVersion === null) return
                const previousProfile = profile
                // Update local profile state
                const updatedProfile = { ...profile, savings_available: amount.toString() }
                setProfile(updatedProfile)
                
                // Persist to backend
                try {
                  const response = await fetch("/api/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      profileData: { savings_available: amount.toString() },
                      expectedVersion: planVersion,
                    }),
                  })

                  if (!response.ok) {
                    setProfile(previousProfile)
                    return
                  }

                  const data = await response.json()
                  if (data.plan?.profile_data) {
                    setProfile({ ...EMPTY_PROFILE, ...data.plan.profile_data })
                  }
                  if (typeof data.plan?.plan_version === "number") {
                    setPlanVersion(data.plan.plan_version)
                  }
                } catch (error) {
                  setProfile(previousProfile)
                  console.error("[GoMate] Error saving savings:", error)
                }
              }}
            />
          </TierGate>
        )}

        {/* Review confirmation buttons */}
        {interviewState === "review" && !confirmed && !isLoading && (
          <Card className="p-4 bg-primary/5 border-primary/20" data-testid="review-confirm-card">
            <p className="text-sm text-foreground mb-3">
              Ready to generate your personalized relocation plan?
            </p>
            <div className="flex gap-2">
              <Button onClick={handleConfirm} size="sm" data-testid="confirm-plan-btn">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Looks good, generate plan
              </Button>
              <Button onClick={handleEdit} variant="outline" size="sm">
                Make changes
              </Button>
            </div>
          </Card>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 p-4 border-t border-border bg-card/50">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              interviewState === "complete"
                ? "Ask follow-up questions..."
                : "Type your message..."
            }
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-xl border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-12 w-12 rounded-xl"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>

        {/* Quick responses for common answers */}
        {pendingField === "moving_alone" && !isLoading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("I'll be moving alone")}>
              Moving alone
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("With my spouse/partner")}>
              With partner
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("With family including kids")}>
              With family
            </Button>
          </div>
        )}

        {pendingField === "purpose" && !isLoading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("I want to study")}>
              Study
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("I want to work")}>
              Work
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("I want to settle permanently")}>
              Settle
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("I'm a digital nomad / remote worker")}>
              Digital Nomad
            </Button>
          </div>
        )}

        {pendingField === "study_type" && !isLoading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("University degree program")}>
              University
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("Language school")}>
              Language School
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("Vocational training")}>
              Vocational
            </Button>
          </div>
        )}

        {pendingField === "job_offer" && !isLoading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("Yes, I have a job offer")}>
              Have offer
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("No, still looking for a job")}>
              Still looking
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("I'm in the interview process")}>
              In progress
            </Button>
          </div>
        )}

        {pendingField === "healthcare_needs" && !isLoading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("No special healthcare needs")}>
              None
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("I have a chronic condition that requires regular care")}>
              Chronic condition
            </Button>
          </div>
        )}

        {pendingField === "pets" && !isLoading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("No pets")}>
              No pets
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("I have a dog")}>
              Dog
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("I have a cat")}>
              Cat
            </Button>
          </div>
        )}

        {pendingField === "need_budget_help" && !isLoading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("Yes, please help me plan my budget")}>
              Yes, help me
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("No, I have my budget figured out")}>
              No thanks
            </Button>
          </div>
        )}

        {pendingField === "visa_rejections" && !isLoading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("No, never had a visa rejected")}>
              No rejections
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("Yes, I had a visa rejected before")}>
              Had rejection
            </Button>
          </div>
        )}
        
        {pendingField === "special_requirements" && !isLoading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("No special requirements")}>
              None
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("I need wheelchair accessibility")}>
              Accessibility
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickSend("I have dietary restrictions")}>
              Dietary
            </Button>
          </div>
        )}
        
        {/* Smart contextual suggestions — switches between pre-move and
            post-arrival sets based on plan stage. */}
        {(interviewState === "complete" || planLocked || planStage === "arrived") && !isLoading && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {planStage === "arrived" ? (
              <>
                <Button variant="outline" size="sm" onClick={() => handleQuickSend("What's my next priority right now?")}>
                  Next priority
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickSend(`Where do I register at the population authority in ${profile.target_city || profile.destination}?`)}>
                  Where to register
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickSend("How do I get my BankID?")}>
                  BankID setup
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickSend(`Find an English-speaking doctor near ${profile.target_city || profile.destination}.`)}>
                  English-speaking doctor
                </Button>
                {(profile.children_count && Number(profile.children_count) > 0) && (
                  <Button variant="outline" size="sm" onClick={() => handleQuickSend("Where do I register the kids for school in person?")}>
                    School in-person registration
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleQuickSend("I'm feeling overwhelmed by all the paperwork — what should I focus on?")}>
                  I'm overwhelmed
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => handleQuickSend(`What are the best neighborhoods to live in ${profile.target_city || profile.destination}?`)}>
                  Best neighborhoods
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickSend(`How much should I budget for rent in ${profile.target_city || profile.destination}?`)}>
                  Rent costs
                </Button>
                {profile.purpose === "work" && (
                  <Button variant="outline" size="sm" onClick={() => handleQuickSend(`What's the job market like for ${profile.job_field || "my field"} in ${profile.destination}?`)}>
                    Job market
                  </Button>
                )}
                {profile.purpose === "study" && (
                  <Button variant="outline" size="sm" onClick={() => handleQuickSend(`What are the top universities for ${profile.study_field || "my field"} in ${profile.destination}?`)}>
                    Universities
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleQuickSend("What documents should I prepare first?")}>
                  Document checklist
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleQuickSend("What are common mistakes to avoid when relocating?")}>
                  Common mistakes
                </Button>
              </>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center mt-3">
          GoMate provides informational guidance only. Always verify with{" "}
          <a
            href="https://www.gomaterelocate.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            official sources
          </a>
          .
        </p>
      </div>
    </div>
  )
}

