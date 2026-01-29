import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface InfoCardProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  children?: ReactNode
  className?: string
  variant?: "default" | "highlight" | "warning"
}

export function InfoCard({ 
  title, 
  description, 
  icon, 
  action, 
  children,
  className,
  variant = "default"
}: InfoCardProps) {
  return (
    <div className={cn(
      "rounded-2xl border p-6 transition-shadow hover:shadow-md",
      variant === "default" && "border-border bg-card",
      variant === "highlight" && "border-primary/20 bg-primary/5",
      variant === "warning" && "border-amber-500/20 bg-amber-50",
      className
    )}>
      <div className="flex items-start gap-4">
        {icon && (
          <div className={cn(
            "shrink-0 p-2 rounded-xl",
            variant === "default" && "bg-secondary text-primary",
            variant === "highlight" && "bg-primary/10 text-primary",
            variant === "warning" && "bg-amber-100 text-amber-700"
          )}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{title}</h3>
              {description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </div>
  )
}
