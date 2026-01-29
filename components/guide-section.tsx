import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface GuideSectionProps {
  title: string
  icon?: ReactNode
  children: ReactNode
  className?: string
  variant?: "default" | "highlight" | "callout"
}

export function GuideSection({ title, icon, children, className, variant = "default" }: GuideSectionProps) {
  return (
    <section className={cn(
      "py-8",
      variant === "highlight" && "bg-secondary/50 -mx-6 px-6 rounded-2xl",
      variant === "callout" && "bg-primary/5 border border-primary/20 -mx-6 px-6 py-6 rounded-2xl",
      className
    )}>
      <div className="flex items-center gap-3 mb-6">
        {icon && <div className="text-primary">{icon}</div>}
        <h2 className="text-xl md:text-2xl font-bold text-foreground">{title}</h2>
      </div>
      <div className="prose prose-green max-w-none text-muted-foreground">
        {children}
      </div>
    </section>
  )
}
