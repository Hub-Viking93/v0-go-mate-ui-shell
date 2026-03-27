import type { ReactNode } from "react"
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

const variantStyles = {
  default: {
    card: "",
    iconBg: "bg-primary/10",
    iconText: "text-primary",
  },
  primary: {
    card: "bg-gradient-to-br from-emerald-500/8 to-emerald-600/4 border-emerald-500/15",
    iconBg: "bg-emerald-500/15",
    iconText: "text-emerald-600 dark:text-emerald-400",
  },
  emerald: {
    card: "bg-gradient-to-br from-teal-500/8 to-cyan-500/4 border-teal-500/15",
    iconBg: "bg-teal-500/15",
    iconText: "text-teal-600 dark:text-teal-400",
  },
  blue: {
    card: "bg-gradient-to-br from-blue-500/8 to-indigo-500/4 border-blue-500/15",
    iconBg: "bg-blue-500/15",
    iconText: "text-blue-600 dark:text-blue-400",
  },
  amber: {
    card: "bg-gradient-to-br from-amber-500/8 to-orange-500/4 border-amber-500/15",
    iconBg: "bg-amber-500/15",
    iconText: "text-amber-600 dark:text-amber-400",
  },
}

export function StatCard({ title, value, subtitle, icon, trend, variant = "default", className }: StatCardProps) {
  const styles = variantStyles[variant]

  return (
    <div className={cn(
      "gm-card p-6",
      styles.card,
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {icon && (
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", styles.iconBg)}>
            <div className={styles.iconText}>{icon}</div>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-semibold text-foreground font-mono tracking-tight">{value}</p>
        {subtitle && (
          <p className={cn(
            "text-sm",
            trend === "up" && "text-primary",
            trend === "down" && "text-destructive",
            !trend && "text-muted-foreground"
          )}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}
