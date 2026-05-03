import { useState, type FormEvent } from "react"
import { Sparkles, X, Mail, Lock, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"

interface SaveProgressModalProps {
  open: boolean
  onClose: () => void
}

// Outer wrapper handles open/close. The inner component is keyed by `open`,
// which guarantees fresh state every time the modal opens (no stale "sent" /
// stale email / stale submitting flags).
export function SaveProgressModal({ open, onClose }: SaveProgressModalProps) {
  if (!open) return null
  return <SaveProgressModalInner key="open" onClose={onClose} />
}

function SaveProgressModalInner({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const { toast } = useToast()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return
    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Use at least 6 characters.",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      // For an anonymous user, updateUser({ email, password }) attaches
      // the email + password to the existing user. user_id stays the same,
      // so all relocation_plans / chat history / agent_audit rows remain
      // owned by this user when they confirm via email.
      const { error } = await supabase.auth.updateUser({
        email: trimmedEmail,
        password,
      })

      if (error) {
        toast({
          title: "Couldn't save your progress",
          description: error.message,
          variant: "destructive",
        })
        setSubmitting(false)
        return
      }

      setSent(true)
      toast({
        title: "Check your inbox",
        description: `We sent a confirmation link to ${trimmedEmail}.`,
      })
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: (err as Error).message,
        variant: "destructive",
      })
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-progress-title"
      data-testid="save-progress-modal"
    >
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-border p-6 sm:p-8 relative animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>

        <div
          className="inline-flex items-center justify-center h-12 w-12 rounded-2xl mb-4"
          style={{ background: "rgba(34, 197, 94, 0.12)", color: "var(--gm-forest)" }}
        >
          <Sparkles className="h-6 w-6" />
        </div>

        <h2
          id="save-progress-title"
          className="text-2xl font-bold tracking-tight mb-2"
          style={{ color: "var(--gm-forest)" }}
        >
          {sent ? "Check your inbox" : "Save your progress?"}
        </h2>

        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          {sent
            ? `We sent a confirmation link to ${email}. Click it to permanently keep your relocation plan.`
            : "Add an email and password to keep your relocation plan across devices and sessions. We'll send a confirmation link."}
        </p>

        {!sent && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                inputMode="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 pl-10 rounded-xl"
                disabled={submitting}
                data-testid="save-progress-email-input"
                aria-label="Email"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password (6+ chars)"
                className="h-12 pl-10 rounded-xl"
                disabled={submitting}
                data-testid="save-progress-password-input"
                aria-label="Password"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-12 rounded-full font-medium"
              disabled={submitting || email.trim().length === 0 || password.length < 6}
              data-testid="save-progress-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save progress"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="h-11 rounded-full text-muted-foreground hover:text-foreground"
              onClick={onClose}
              data-testid="save-progress-skip"
            >
              Continue without saving
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mt-1">
              No spam, no card. We'll only email about your relocation plan.
            </p>
          </form>
        )}

        {sent && (
          <Button
            size="lg"
            className="w-full h-12 rounded-full font-medium"
            onClick={onClose}
          >
            Got it
          </Button>
        )}
      </div>
    </div>
  )
}
