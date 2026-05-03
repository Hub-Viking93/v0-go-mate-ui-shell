import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { SaveProgressModal } from "@/components/save-progress-modal"

const SAVE_PROGRESS_DISMISSED_KEY = "save-progress-shown"

interface AnonymousSessionContextValue {
  isLoading: boolean
  user: User | null
  isAnonymous: boolean
  openSaveModal: () => void
  /** Opens the save-progress modal once if user is anonymous and >= 5 fields populated. */
  maybeShowSaveModal: (fieldCount: number) => void
}

const AnonymousSessionContext = createContext<AnonymousSessionContextValue | null>(
  null,
)

export function useAnonymousSession(): AnonymousSessionContextValue {
  const ctx = useContext(AnonymousSessionContext)
  if (!ctx) {
    throw new Error(
      "useAnonymousSession must be used within <AnonymousSessionProvider>",
    )
  }
  return ctx
}

interface ProviderProps {
  children: ReactNode
}

export function AnonymousSessionProvider({ children }: ProviderProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const isAnonymous = !!user && (user as User & { is_anonymous?: boolean }).is_anonymous === true

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setIsLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(
      (event, sess: Session | null) => {
        if (!mounted) return
        setUser(sess?.user ?? null)
        // On sign-out, clear the dismissal flag so a *future* anonymous
        // session on this browser can show the modal again. Also clear it
        // when an anonymous user upgrades to permanent (USER_UPDATED with
        // is_anonymous=false), since they no longer need the prompt.
        if (event === "SIGNED_OUT") {
          resetSaveProgressDismissedFlag()
        } else if (
          event === "USER_UPDATED" &&
          sess?.user &&
          !(sess.user as User & { is_anonymous?: boolean }).is_anonymous
        ) {
          resetSaveProgressDismissedFlag()
        }
      },
    )

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const openSaveModal = useCallback(() => {
    setModalOpen(true)
  }, [])

  const dismissModal = useCallback(() => {
    setModalOpen(false)
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SAVE_PROGRESS_DISMISSED_KEY, "1")
      } catch {
        /* ignore */
      }
    }
  }, [])

  const maybeShowSaveModal = useCallback(
    (fieldCount: number) => {
      if (isLoading) return
      if (!isAnonymous) return
      if (fieldCount < 5) return
      if (typeof window === "undefined") return
      try {
        if (window.localStorage.getItem(SAVE_PROGRESS_DISMISSED_KEY) === "1") {
          return
        }
      } catch {
        /* fall through */
      }
      setModalOpen(true)
    },
    [isAnonymous, isLoading],
  )

  const value = useMemo<AnonymousSessionContextValue>(
    () => ({
      isLoading,
      user,
      isAnonymous,
      openSaveModal,
      maybeShowSaveModal,
    }),
    [isLoading, user, isAnonymous, openSaveModal, maybeShowSaveModal],
  )

  return (
    <AnonymousSessionContext.Provider value={value}>
      {children}
      <SaveProgressModal open={modalOpen} onClose={dismissModal} />
    </AnonymousSessionContext.Provider>
  )
}

/** Reset the dismissed flag — call after successful upgrade so a future anonymous session can show the modal again. */
export function resetSaveProgressDismissedFlag() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(SAVE_PROGRESS_DISMISSED_KEY)
  } catch {
    /* ignore */
  }
}
