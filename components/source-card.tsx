import { ExternalLink, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface SourceCardProps {
  title: string
  description?: string
  url?: string
  className?: string
}

export function SourceCard({ title, description, url, className }: SourceCardProps) {
  return (
    <a
      href={url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex items-start gap-3 p-4 gm-card",
        className
      )}
    >
      <div className="shrink-0 p-2 rounded-lg bg-secondary text-primary">
        <FileText className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {title}
          </h4>
          <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
        )}
      </div>
    </a>
  )
}
