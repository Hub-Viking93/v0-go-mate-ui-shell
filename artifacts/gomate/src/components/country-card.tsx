import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { MapPin, ExternalLink } from "lucide-react"

interface CountryCardProps {
  name: string
  slug: string
  tags: string[]
  imageUrl?: string
  className?: string
  external?: boolean
}

export function CountryCard({ name, slug, tags, imageUrl, className, external = true }: CountryCardProps) {
  const href = external 
    ? `https://www.gomaterelocate.com/guides/${slug}` 
    : `/guides/${slug}`

  return (
    <a 
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        "group block gm-card overflow-hidden",
        className
      )}
    >
      <div className="aspect-[4/3] relative bg-secondary overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl || "/placeholder.svg"}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
            <MapPin className="w-12 h-12 text-primary/40" />
          </div>
        )}
        {external && (
          <div className="absolute top-3 right-3 p-1.5 rounded-lg bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="w-4 h-4 text-primary" />
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
            {name}
          </h3>
          {external && (
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge 
              key={tag} 
              variant="secondary"
              className="text-xs font-medium"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </a>
  )
}
