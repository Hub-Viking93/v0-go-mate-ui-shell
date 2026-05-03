import { useCallback, useEffect, useRef, useState } from "react"
import { useLocation } from "wouter"
import { ArrowRight, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Confetti } from "@/components/confetti"
import { Mascot, type AnimationState } from "@/components/mascot"
import { SpeechBubble } from "@/components/speech-bubble"
import { OnboardingInput } from "@/components/onboarding-input"
import { ProfilePreviewList } from "@/components/profile-preview-list"
import {
  EMPTY_PROFILE,
  FIELD_CONFIG,
  type AllFieldKey,
  type Profile,
} from "@/lib/gomate/profile-schema"
import { getInputTypeForField } from "./field-input-type"
import { useAnonymousSession } from "@/lib/anonymous-session"

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

interface MessageEndMetadata {
  profile?: Profile
  pendingField?: string | null
  filledFields?: AllFieldKey[]
  requiredFields?: AllFieldKey[]
  planLocked?: boolean
  onboardingCompleted?: boolean
  animationCue?: AnimationState
  retryHint?: string
}

const VALID_ANIMATION_STATES = new Set<AnimationState>([
  "idle",
  "nodding",
  "smiling",
  "tilting_curious",
  "thinking",
  "celebrating",
])

function coerceCue(value: unknown): AnimationState | null {
  return typeof value === "string" && VALID_ANIMATION_STATES.has(value as AnimationState)
    ? (value as AnimationState)
    : null
}

export default function OnboardingPage() {
  const [, navigate] = useLocation()
  const { maybeShowSaveModal } = useAnonymousSession()

  const [profile, setProfile] = useState<Profile>({ ...EMPTY_PROFILE })
  const [planId, setPlanId] = useState<string | null>(null)
  const [planLocked, setPlanLocked] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [pendingField, setPendingField] = useState<AllFieldKey | null>(null)
  const [filledFields, setFilledFields] = useState<AllFieldKey[]>([])
  const [requiredFields, setRequiredFields] = useState<AllFieldKey[]>([])

  const [currentQuestion, setCurrentQuestion] = useState("")
  const [mascotState, setMascotState] = useState<AnimationState>("idle")
  const [isThinking, setIsThinking] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [confettiShown, setConfettiShown] = useState(false)
  const [thinkingHint, setThinkingHint] = useState<string>("")

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [initialPromptSent, setInitialPromptSent] = useState(false)

  const [triggeringResearch, setTriggeringResearch] = useState(false)
  const [triggerError, setTriggerError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Synchronous in-flight guard — protects against StrictMode double-mount
  // and rapid double-submit. `isThinking` state lags by a render so it can't
  // be the only barrier.
  const turnInFlightRef = useRef(false)

  const completed = onboardingCompleted || planLocked
  const topStatus: string = completed
    ? "Profile complete"
    : requiredFields.length > 0 &&
        filledFields.length / requiredFields.length >= 0.7
      ? "Almost ready"
      : "Building your profile"

  // ========== Initial profile load ==========
  useEffect(() => {
    let cancelled = false
    async function loadProfile() {
      try {
        const r = await fetch("/api/profile")
        if (!r.ok) throw new Error(`profile fetch ${r.status}`)
        const data = await r.json()
        if (cancelled) return

        const plan = data.plan ?? {}
        setPlanId(plan.id ?? null)
        setPlanLocked(!!plan.locked)
        setOnboardingCompleted(!!plan.onboarding_completed)

        if (plan.profile_data && typeof plan.profile_data === "object") {
          const merged = { ...EMPTY_PROFILE, ...plan.profile_data } as Profile
          setProfile(merged)
        }
      } catch (err) {
        console.error("[onboarding] profile load failed:", err)
      } finally {
        if (!cancelled) setProfileLoaded(true)
      }
    }
    loadProfile()
    return () => {
      cancelled = true
    }
  }, [])

  // ========== Send a turn through /api/chat ==========
  const sendTurn = useCallback(
    async (text: string) => {
      if (turnInFlightRef.current) return
      turnInFlightRef.current = true

      let updatedMessages = messages
      if (text.length > 0) {
        const userMsg: ChatMessage = {
          id: `user_${Date.now()}`,
          role: "user",
          content: text,
        }
        updatedMessages = [...messages, userMsg]
        setMessages(updatedMessages)
      }

      setIsThinking(true)
      setMascotState("thinking")
      setCurrentQuestion("")
      setThinkingHint("")

      // After a brief delay, surface a soft "still working…" hint.
      if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current)
      thinkingTimerRef.current = setTimeout(() => {
        setThinkingHint("Analysing your answer…")
      }, 1200)
      const slowHintTimer = setTimeout(() => {
        setThinkingHint("Preparing the next question…")
      }, 4000)

      abortControllerRef.current?.abort()
      abortControllerRef.current = new AbortController()

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              id: m.id,
              role: m.role,
              parts: [{ type: "text", text: m.content }],
            })),
            profile,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!res.ok) throw new Error(`chat ${res.status}`)

        const reader = res.body?.getReader()
        if (!reader) throw new Error("no body")

        const decoder = new TextDecoder()
        let buffer = ""
        let questionBuf = ""
        let finalCue: AnimationState | null = null
        let finalMetadata: MessageEndMetadata | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith("data:")) continue
            const data = trimmed.slice(5).trim()
            if (data === "[DONE]") continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === "text-delta" && typeof parsed.delta === "string") {
                questionBuf += parsed.delta
              } else if (parsed.type === "mascot") {
                if (parsed.kind === "question_ready") {
                  const cue = coerceCue(parsed.animationCue)
                  if (cue) finalCue = cue
                } else if (parsed.kind === "onboarding_complete") {
                  finalCue = "celebrating"
                }
              } else if (parsed.type === "message-end" && parsed.metadata) {
                finalMetadata = parsed.metadata as MessageEndMetadata
              }
            } catch {
              /* skip malformed */
            }
          }
        }

        const questionText = questionBuf.trim()
        if (questionText) {
          setCurrentQuestion(questionText)
          setMessages((prev) => [
            ...prev,
            {
              id: `assistant_${Date.now()}`,
              role: "assistant",
              content: questionText,
            },
          ])
        }

        if (finalMetadata) {
          if (finalMetadata.profile) {
            setProfile({ ...EMPTY_PROFILE, ...finalMetadata.profile })
          }
          if (finalMetadata.pendingField !== undefined) {
            setPendingField(
              (finalMetadata.pendingField as AllFieldKey | null) || null,
            )
          }
          if (Array.isArray(finalMetadata.filledFields)) {
            setFilledFields(finalMetadata.filledFields)
          }
          if (Array.isArray(finalMetadata.requiredFields)) {
            setRequiredFields(finalMetadata.requiredFields)
          }
          if (finalMetadata.planLocked) setPlanLocked(true)
          if (finalMetadata.onboardingCompleted) setOnboardingCompleted(true)
          const metaCue = coerceCue(finalMetadata.animationCue)
          if (metaCue) finalCue = metaCue
        }

        setMascotState(finalCue ?? "idle")

        if (finalMetadata?.onboardingCompleted && !confettiShown) {
          setShowConfetti(true)
          setConfettiShown(true)
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        console.error("[onboarding] turn failed:", err)
        setCurrentQuestion(
          "I had a problem processing that. Could you try again in a moment?",
        )
        setMascotState("tilting_curious")
      } finally {
        if (thinkingTimerRef.current) {
          clearTimeout(thinkingTimerRef.current)
          thinkingTimerRef.current = null
        }
        clearTimeout(slowHintTimer)
        setThinkingHint("")
        setIsThinking(false)
        turnInFlightRef.current = false
      }
    },
    [messages, profile, confettiShown],
  )

  // ========== Initial chat kickoff (after profile loads) ==========
  useEffect(() => {
    if (!profileLoaded || initialPromptSent) return
    setInitialPromptSent(true)

    if (planLocked || onboardingCompleted) {
      setMascotState("celebrating")
      setCurrentQuestion(
        'All set — I have everything I need to start building your relocation plan. ' +
          'Click "Generate my plan" whenever you\'re ready.',
      )
      return
    }

    sendTurn("")
  }, [
    profileLoaded,
    initialPromptSent,
    planLocked,
    onboardingCompleted,
    sendTurn,
  ])

  // Cleanup pending timers and abort any in-flight chat stream on unmount.
  useEffect(() => {
    return () => {
      if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current)
      abortControllerRef.current?.abort()
    }
  }, [])

  // ========== Save-progress modal trigger (anonymous users only) ==========
  // Shows once per session when an anonymous user has populated >= 5 fields.
  useEffect(() => {
    if (filledFields.length >= 5) {
      maybeShowSaveModal(filledFields.length)
    }
  }, [filledFields.length, maybeShowSaveModal])

  // ========== User answer handler ==========
  const handleSubmit = useCallback(
    (text: string) => {
      sendTurn(text)
    },
    [sendTurn],
  )

  // ========== Generate my plan ==========
  const handleTriggerResearch = useCallback(async () => {
    if (triggeringResearch) return
    setTriggeringResearch(true)
    setTriggerError(null)
    try {
      const r = await fetch("/api/plans/trigger-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error || `trigger-research ${r.status}`)
      }
      navigate("/dashboard?research=triggered")
    } catch (err) {
      console.error("[onboarding] trigger-research failed:", err)
      setTriggerError(
        (err as Error).message ?? "Failed to start research. Please try again.",
      )
      setTriggeringResearch(false)
    }
  }, [planId, navigate, triggeringResearch])

  const pendingFieldLabel = pendingField
    ? FIELD_CONFIG[pendingField]?.label || pendingField.replace(/_/g, " ")
    : "answer"
  const expectedAnswerType = getInputTypeForField(pendingField)

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col md:min-h-[calc(100vh-2rem)]">
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Top status bar — soft phrase, no percentages */}
      <div className="flex-shrink-0 border-b border-border bg-gradient-to-r from-[#1B3A2D]/[0.03] to-transparent px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-4 w-4 text-[#5EE89C]" />
          <span
            className="text-sm font-medium text-foreground"
            data-testid="onboarding-status"
          >
            {topStatus}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-6 lg:p-6">
        {/* Main column — chat-window styled card containing mascot + bubble + input */}
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          <div className="flex flex-1 flex-col rounded-3xl border border-stone-200/80 dark:border-stone-800 bg-card/60 backdrop-blur-sm shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* Chat-window header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-stone-200/80 dark:border-stone-800 bg-gradient-to-r from-emerald-50/60 to-transparent dark:from-emerald-950/20">
              <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">GoMate Onboarding</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {completed ? "All set — ready to plan your move" : "Just a few questions to tailor your plan"}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </div>
            </div>

            {/* Conversation area */}
            <div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8 sm:py-12 min-h-[320px]">
              <Mascot state={mascotState} size="lg" />

              {/* Bubble: only render when there's something to say. */}
              {currentQuestion ? (
                <SpeechBubble
                  text={currentQuestion}
                  align="top"
                  className="max-w-md"
                />
              ) : (
                <div
                  className="min-h-[80px] w-full max-w-md"
                  aria-hidden="true"
                  data-testid="bubble-placeholder"
                />
              )}
            </div>

            {/* Input bar — pinned to the bottom of the chat window */}
            <div className="border-t border-stone-200/80 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40 px-5 py-4">
              {completed ? (
              <div className="flex flex-col items-center gap-3">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-[#1B3A2D] to-[#2D6A4F] text-white shadow-lg hover:opacity-95"
                  onClick={handleTriggerResearch}
                  disabled={triggeringResearch}
                  data-testid="button-generate-plan"
                >
                  {triggeringResearch ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting research…
                    </>
                  ) : (
                    <>
                      Generate my plan
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                {triggerError && (
                  <p
                    className="text-sm text-destructive"
                    data-testid="trigger-error"
                  >
                    {triggerError}
                  </p>
                )}
              </div>
            ) : (
              <OnboardingInput
                expectedAnswerType={expectedAnswerType}
                pendingFieldLabel={pendingFieldLabel}
                onSubmit={handleSubmit}
                disabled={isThinking || !pendingField}
              />
            )}

            {isThinking && thinkingHint && (
              <p
                className="mt-3 text-center text-xs text-muted-foreground"
                data-testid="thinking-hint"
              >
                {thinkingHint}
              </p>
            )}
            </div>
          </div>
        </main>

        {/* Right side panel — live profile-fields-filled view.
            Re-enabled (was gated behind `false` while the field-completion
            sync was being verified). Now that fan-out extraction lands
            multiple fields per turn, the preview is consistent with what
            the chat-window declares. */}
        <aside className="w-full lg:w-80 lg:flex-shrink-0">
          <ProfilePreviewList
            profile={profile}
            filledFields={filledFields}
            requiredFieldCount={requiredFields.length || undefined}
            pendingField={pendingField}
          />
        </aside>
      </div>
    </div>
  )
}
