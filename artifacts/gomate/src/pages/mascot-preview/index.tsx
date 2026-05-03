import { useState } from "react"
import { Mascot, type AnimationState } from "@/components/mascot"
import { SpeechBubble } from "@/components/speech-bubble"
import { OnboardingInput, type ExpectedAnswerType } from "@/components/onboarding-input"

const ALL_STATES: { state: AnimationState; label: string; line: string }[] = [
  { state: "idle", label: "idle", line: "Just hanging out — gentle breathing and the occasional blink." },
  { state: "nodding", label: "nodding", line: "Got it, thanks for confirming!" },
  { state: "smiling", label: "smiling", line: "Lovely — let's keep going." },
  { state: "tilting_curious", label: "tilting_curious", line: "Hmm, can you tell me a little more about that?" },
  { state: "thinking", label: "thinking", line: "Let me check what we've got so far…" },
  { state: "celebrating", label: "celebrating", line: "All done! I have everything I need 🎉" },
]

const ANSWER_TYPES: ExpectedAnswerType[] = ["text", "yes_no", "number", "currency", "country", "free"]

export default function MascotPreviewPage() {
  const [activeState, setActiveState] = useState<AnimationState>("smiling")
  const [activeAnswerType, setActiveAnswerType] = useState<ExpectedAnswerType>("text")
  const [submittedAnswers, setSubmittedAnswers] = useState<string[]>([])
  const [inputDisabled, setInputDisabled] = useState(false)

  function handleSubmit(text: string) {
    setSubmittedAnswers((prev) => [text, ...prev].slice(0, 5))
    setInputDisabled(true)
    setTimeout(() => setInputDisabled(false), 800)
  }

  const activeLine = ALL_STATES.find((s) => s.state === activeState)?.line ?? ""

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-emerald-50/40 p-8">
      <div className="mx-auto max-w-6xl space-y-12">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">Mascot Preview</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live preview of the onboarding mascot, speech bubble, and input components.
          </p>
        </header>

        {/* Section 1 — All 7 states grid */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-slate-800">All 6 animation states</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {ALL_STATES.map(({ state, label }) => (
              <button
                key={state}
                type="button"
                onClick={() => setActiveState(state)}
                className={`flex flex-col items-center gap-2 rounded-2xl bg-white p-4 ring-1 transition-all hover:scale-[1.02] hover:shadow-md ${
                  activeState === state
                    ? "ring-2 ring-emerald-500 shadow-md"
                    : "ring-slate-200"
                }`}
              >
                <Mascot state={state} size="md" />
                <span className="font-mono text-xs text-slate-700">{label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Section 2 — Active mascot + speech bubble */}
        <section className="rounded-3xl bg-white p-8 ring-1 ring-slate-200 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-slate-800">
            Active state: <span className="font-mono text-emerald-700">{activeState}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-6">
            <Mascot state={activeState} size="lg" />
            <SpeechBubble
              key={activeState + activeLine}
              text={activeLine}
              align="left"
            />
          </div>
        </section>

        {/* Section 3 — Onboarding input variants */}
        <section className="rounded-3xl bg-white p-8 ring-1 ring-slate-200 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Onboarding input</h2>
          <p className="mb-4 text-sm text-slate-600">
            Placeholder + behaviour adapts to the expected answer type.
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {ANSWER_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveAnswerType(t)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
                  activeAnswerType === t
                    ? "bg-emerald-500 text-white ring-emerald-500"
                    : "bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <OnboardingInput
            expectedAnswerType={activeAnswerType}
            pendingFieldLabel={activeAnswerType === "country" ? "destination" : "answer"}
            onSubmit={handleSubmit}
            disabled={inputDisabled}
          />
          {submittedAnswers.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-xs font-medium text-slate-600">Recently submitted:</p>
              <ul className="space-y-1 text-sm text-slate-700">
                {submittedAnswers.map((a, i) => (
                  <li key={i} className="rounded bg-slate-50 px-3 py-1.5 font-mono text-xs">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Section 4 — Speech bubble alignments */}
        <section className="rounded-3xl bg-white p-8 ring-1 ring-slate-200 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-slate-800">Speech bubble alignments</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">align="left" (default)</p>
              <SpeechBubble text="Tail points left toward the mascot." />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">align="right"</p>
              <SpeechBubble text="Tail points right." align="right" />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">align="top"</p>
              <SpeechBubble text="Tail points down (bubble sits above the mascot)." align="top" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
