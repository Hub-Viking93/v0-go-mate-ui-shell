import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  LayoutGrid,
  UserSquare2,
  ShieldCheck,
  Wallet,
  Sparkles,
} from "lucide-react"

export type DashboardTabId =
  | "overview"
  | "profile"
  | "visa"
  | "money"
  | "settling"

interface TabSpec {
  id: DashboardTabId
  label: string
  icon: typeof LayoutGrid
}

const TABS: readonly TabSpec[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "profile", label: "Profile", icon: UserSquare2 },
  { id: "visa", label: "Visa & Legal", icon: ShieldCheck },
  { id: "money", label: "Money", icon: Wallet },
  { id: "settling", label: "Settling", icon: Sparkles },
] as const

interface DashboardTabsProps {
  active: DashboardTabId
  onChange: (id: DashboardTabId) => void
}

/**
 * Sticky editorial tab strip. Replaces the giant single-page scroll
 * with five focused panes. Uses a magnetic underline that animates
 * between tabs via framer-motion's `layoutId`.
 */
export function DashboardTabs({ active, onChange }: DashboardTabsProps) {
  return (
    <div
      className="sticky top-0 z-30 -mx-6 md:-mx-8 lg:-mx-10 mb-8 backdrop-blur-md"
      style={{
        background:
          "linear-gradient(180deg, rgba(250,250,246,0.96) 0%, rgba(250,250,246,0.85) 100%)",
        borderBottom: "1px solid rgba(120,90,60,0.14)",
      }}
    >
      <div className="px-6 md:px-8 lg:px-10">
        <nav
          className="flex items-end gap-1 overflow-x-auto scrollbar-hide"
          role="tablist"
          aria-label="Dashboard sections"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.id === active
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`dashboard-panel-${tab.id}`}
                onClick={() => onChange(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium",
                  "transition-colors duration-200 whitespace-nowrap",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5EE89C]/40 rounded-t-lg",
                  isActive
                    ? "text-[#1B3A2D]"
                    : "text-foreground/55 hover:text-foreground/85",
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4 transition-transform duration-200",
                    isActive && "scale-110",
                  )}
                  strokeWidth={isActive ? 2.4 : 1.8}
                />
                <span style={{ fontFamily: "var(--font-sans)" }}>{tab.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="dashboard-tab-underline"
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full"
                    style={{
                      background:
                        "linear-gradient(90deg, #1B3A2D 0%, #2D6A4F 50%, #5EE89C 100%)",
                    }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

interface DashboardPanelProps {
  id: DashboardTabId
  active: DashboardTabId
  children: React.ReactNode
}

/**
 * Wrapper for a tab's content. Fades + slides up gently on activation.
 */
export function DashboardPanel({ id, active, children }: DashboardPanelProps) {
  if (id !== active) return null
  return (
    <motion.div
      key={id}
      role="tabpanel"
      id={`dashboard-panel-${id}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
