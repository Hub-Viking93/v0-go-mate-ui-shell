import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: ReactNode
  trend?: "up" | "down" | "neutral"
  className?: string
}

export function StatCard({ title, value, subtitle, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn(
      "gm-card p-6",
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {icon && <div className="text-primary">{icon}</div>}
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
