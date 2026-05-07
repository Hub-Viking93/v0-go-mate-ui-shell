import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: ReactNode
  subtitle?: string
  icon?: ReactNode
  trend?: "up" | "down" | "neutral"
  variant?: "default" | "primary" | "emerald" | "blue" | "amber"
  className?: string
}

/**
 * Editorial-warm StatCard. Big serif numbers, tabular numerals, top
 * accent stripe in the variant color, warm domain tint background,
 * spring-eased hover lift, and a soft radial gradient sweep that
 * fades in on hover. The icon slot accepts any ReactNode (typically a
 * Lucide icon at w-5/h-5) and renders it large in the upper-right
 * corner with a subtle scale-up on hover.
 */

const variantStyles = {
  // Forest / brand-primary — used for Destination
  default: {
    accent: "#1E293B",
    tint: "#F4F1EA",
    sweep: "rgba(35,77,58,0.10)",
  },
  primary: {
    accent: "#0F172A",
    tint: "#EEF3EC",
    sweep: "rgba(27,58,45,0.10)",
  },
  // Cultural cream — used for Purpose
  blue: {
    accent: "#7C5A2E",
    tint: "#F8F2E8",
    sweep: "rgba(124,90,46,0.10)",
  },
  // Profile growth — emerald progress
  emerald: {
    accent: "#16A34A",
    tint: "#EEF6EF",
    sweep: "rgba(22,163,74,0.12)",
  },
  // Timeline urgency — coral
  amber: {
    accent: "#E85D3C",
    tint: "#FBEFEC",
    sweep: "rgba(232,93,60,0.10)",
  },
} as const

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  const styles = variantStyles[variant]

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={cn(
        "group relative overflow-hidden rounded-xl border p-4 pt-5 backdrop-blur-sm",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_rgba(15,23,42,0.03)]",
        "transition-shadow duration-300",
        "hover:shadow-[0_4px_8px_rgba(15,23,42,0.05),0_12px_24px_rgba(15,23,42,0.04)]",
        className,
      )}
      style={{
        borderColor: "rgba(120,90,60,0.18)",
        background: `linear-gradient(180deg, ${styles.tint} 0%, rgba(255,252,246,0.85) 70%)`,
      }}
    >
      {/* Top accent stripe */}
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: styles.accent }}
      />

      {/* Big icon glyph, upper-right */}
      {icon && (
        <div
          className="absolute right-4 top-5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]"
          style={{ color: styles.accent, opacity: 0.85 }}
        >
          <div className="[&>svg]:w-5 [&>svg]:h-5 [&>svg]:stroke-[1.5]">{icon}</div>
        </div>
      )}

      <div className="relative pr-10">
        <span
          className="gm-label"
          style={{ color: styles.accent, opacity: 0.85 }}
        >
          {title}
        </span>
        <div
          className="mt-2 font-sans text-[22px] leading-[1.05] tracking-tight text-foreground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </div>
        {subtitle && (
          <p
            className={cn(
              "mt-2 text-[13px]",
              trend === "up" && "font-semibold",
              trend === "down" && "font-semibold",
              !trend && "text-muted-foreground",
            )}
            style={
              trend === "up"
                ? { color: "#16A34A" }
                : trend === "down"
                  ? { color: "#B91C1C" }
                  : undefined
            }
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Hover radial sweep */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 88% 0%, ${styles.sweep}, transparent 55%)`,
        }}
      />
    </motion.div>
  )
}
