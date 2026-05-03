

import { useState, useEffect } from "react"
import { Heart, X, ExternalLink, MessageCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Link } from "wouter"

type Mood = "great" | "good" | "okay" | "struggling" | "overwhelmed"

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: "great", emoji: "😄", label: "Great" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "okay", emoji: "😐", label: "Okay" },
  { value: "struggling", emoji: "😔", label: "Struggling" },
  { value: "overwhelmed", emoji: "😰", label: "Overwhelmed" },
]

const MENTAL_HEALTH_RESOURCES = [
  { name: "International Association for Suicide Prevention", url: "https://www.iasp.info/resources/Crisis_Centres/" },
  { name: "Befrienders Worldwide", url: "https://www.befrienders.org/find-support" },
  { name: "Crisis Text Line (US/UK/CA)", url: "https://www.crisistextline.org/" },
]

const LS_KEY = "gomate:last-checkin-prompt"
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

interface WellbeingCheckinProps {
  arrivalDate: string
  className?: string
}

interface CommunityResource {
  name: string
  type: string
  url?: string
  description: string
}

interface ExpatHub {
  area: string
  description: string
}

export function WellbeingCheckin({ arrivalDate, className }: WellbeingCheckinProps) {
  const [visible, setVisible] = useState(false)
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null)
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [response, setResponse] = useState<{
    message: string
    resources: { communities: CommunityResource[]; expatHubs: ExpatHub[] } | null
  } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Check if we should show the prompt
    const arrival = new Date(arrivalDate).getTime()
    const now = Date.now()
    const daysSinceArrival = Math.floor((now - arrival) / (1000 * 60 * 60 * 24))

    // Only show after 7 days post-arrival
    if (daysSinceArrival < 7) return

    // Check localStorage for last shown timestamp
    const lastShown = localStorage.getItem(LS_KEY)
    if (lastShown) {
      const lastShownTime = new Date(lastShown).getTime()
      if (now - lastShownTime < SEVEN_DAYS_MS) return
    }

    setVisible(true)
  }, [arrivalDate])

  function handleDismiss() {
    localStorage.setItem(LS_KEY, new Date().toISOString())
    setDismissed(true)
    // Animate out then hide
    setTimeout(() => setVisible(false), 300)
  }

  async function handleSubmit() {
    if (!selectedMood) return
    setSubmitting(true)

    try {
      const res = await fetch("/api/wellbeing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood: selectedMood, note: note.trim() || undefined }),
      })

      if (!res.ok) return

      const data = await res.json()
      setResponse({ message: data.message, resources: data.resources })
      // Mark as shown
      localStorage.setItem(LS_KEY, new Date().toISOString())
    } finally {
      setSubmitting(false)
    }
  }

  if (!visible) return null

  const showResources = response && (selectedMood === "struggling" || selectedMood === "overwhelmed")

  return (
    <div
      className={cn(
        "gm-card-static overflow-hidden transition-all duration-300",
        dismissed && "opacity-0 scale-95",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-rose-500/5 to-amber-500/5">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-semibold text-foreground">Weekly Check-In</h3>
        </div>
        {!response && (
          <button
            onClick={handleDismiss}
            className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {!response ? (
          <>
            <p className="text-sm text-foreground">
              How are you settling in this week?
            </p>

            {/* Mood options */}
            <div className="flex flex-wrap gap-2">
              {MOODS.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMood(mood.value)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all",
                    selectedMood === mood.value
                      ? "border-primary bg-primary/10 text-foreground font-medium ring-1 ring-primary/30"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  <span className="text-base">{mood.emoji}</span>
                  {mood.label}
                </button>
              ))}
            </div>

            {/* Optional note */}
            {selectedMood && (
              <div className="space-y-2">
                <label htmlFor="wellbeing-note" className="text-xs text-muted-foreground">
                  Anything you want to note? (optional)
                </label>
                <textarea
                  id="wellbeing-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="How things are going..."
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>
            )}

            {/* Submit */}
            {selectedMood && (
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="sm"
                className="w-full sm:w-auto"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                ) : (
                  <Heart className="w-4 h-4 mr-1.5" />
                )}
                Submit
              </Button>
            )}
          </>
        ) : (
          <>
            {/* Response message */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <span className="text-xl mt-0.5">
                {MOODS.find((m) => m.value === selectedMood)?.emoji}
              </span>
              <p className="text-sm text-foreground leading-relaxed">
                {response.message}
              </p>
            </div>

            {/* Resources for struggling/overwhelmed */}
            {showResources && (
              <div className="space-y-3">
                {/* Expat community resources */}
                {response.resources && response.resources.communities.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Expat Communities Near You
                    </h4>
                    <div className="space-y-1.5">
                      {response.resources.communities.map((c) => (
                        <div key={c.name} className="flex items-start gap-2 text-sm">
                          {c.url ? (
                            <a
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1"
                            >
                              {c.name}
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-foreground">{c.name}</span>
                          )}
                          <span className="text-muted-foreground">— {c.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mental health resources */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Support Resources
                  </h4>
                  <div className="space-y-1.5">
                    {MENTAL_HEALTH_RESOURCES.map((r) => (
                      <a
                        key={r.name}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        {r.name}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Chat link */}
                <div className="pt-2 border-t border-border">
                  <Link
                    href="/chat"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Talk to your settling-in assistant
                  </Link>
                </div>
              </div>
            )}

            {/* Done button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisible(false)}
            >
              Done
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
