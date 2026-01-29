"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  DollarSign,
  Home,
  CheckCircle,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface VisaRoute {
  name?: string
  official_visa_name?: string
  difficulty?: string
  description?: string
  why_recommended?: string
  who_its_for?: string
  processing_time?: string
  estimated_cost?: string
  family_total_cost?: string
  validity_period?: string
  path_to_residence?: string
  requirements?: string[]
  how_to_apply?: string[]
  spouse_visa_type?: string
  spouse_can_work?: boolean
  children_visa_type?: string
  official_url?: string
  officialLink?: string // Alternative property name
}

export interface VisaData {
  summary?: string
  embassyLocation?: string
  routes?: VisaRoute[]
}

interface VisaRoutesCardProps {
  visaData: VisaData
  onSelectRoute?: (index: number) => void
  selectedRouteIndex?: number
  onCompare?: () => void
}

function DifficultyBadge({ difficulty }: { difficulty?: string }) {
  const config: Record<string, { color: string; label: string }> = {
    Easy: {
      color: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30",
      label: "Easy",
    },
    Moderate: {
      color: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
      label: "Moderate",
    },
    Challenging: {
      color: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
      label: "Challenging",
    },
  }
  const c = config[difficulty || "Moderate"] || config["Moderate"]

  return (
    <Badge variant="outline" className={cn("text-xs", c.color)}>
      {c.label}
    </Badge>
  )
}

function RouteCard({
  route,
  index,
  onSelect,
  isSelected,
}: {
  route: VisaRoute
  index: number
  onSelect?: (index: number) => void
  isSelected: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={cn(
        "border rounded-xl p-4 transition-all",
        isSelected
          ? "border-primary bg-primary/10"
          : "border-border bg-card/50 hover:border-border/80"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs text-muted-foreground">Option {index + 1}</span>
            <DifficultyBadge difficulty={route.difficulty} />
          </div>
          <h4 className="font-medium text-foreground truncate">
            {route.name || route.official_visa_name}
          </h4>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {route.why_recommended || route.description || route.who_its_for}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
        {route.processing_time && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {route.processing_time}
          </span>
        )}
        {(route.family_total_cost || route.estimated_cost) && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {route.family_total_cost || route.estimated_cost}
          </span>
        )}
        {route.validity_period && (
          <span className="flex items-center gap-1">{route.validity_period}</span>
        )}
        {route.path_to_residence && (
          <span className="flex items-center gap-1">
            <Home className="w-3 h-3" />
            PR possible
          </span>
        )}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-primary mt-3 hover:text-primary/80"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? "Less details" : "More details"}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {route.requirements && route.requirements.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">Requirements:</p>
              <ul className="space-y-1">
                {route.requirements.slice(0, 5).map((req, i) => (
                  <li
                    key={i}
                    className="text-xs text-muted-foreground flex items-start gap-2"
                  >
                    <CheckCircle className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(route.spouse_visa_type || route.children_visa_type) && (
            <div className="bg-muted/30 rounded-lg p-2.5">
              <p className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1">
                <Users className="w-3 h-3" /> Family Visas:
              </p>
              <div className="space-y-1 text-xs text-muted-foreground">
                {route.spouse_visa_type && (
                  <p>
                    Partner: {route.spouse_visa_type}{" "}
                    {route.spouse_can_work ? "(can work)" : ""}
                  </p>
                )}
                {route.children_visa_type && <p>Children: {route.children_visa_type}</p>}
              </div>
            </div>
          )}

          {route.how_to_apply && route.how_to_apply.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1.5">How to apply:</p>
              <ol className="space-y-1 list-decimal list-inside">
                {route.how_to_apply.slice(0, 4).map((step, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {(route.official_url || route.officialLink) && (
            <a
              href={route.official_url || route.officialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 bg-primary/10 px-2 py-1 rounded"
            >
              <ExternalLink className="w-3 h-3" />
              Official visa page
            </a>
          )}
        </div>
      )}

      {onSelect && (
        <Button
          onClick={() => onSelect(index)}
          size="sm"
          className={cn("w-full mt-3", isSelected ? "" : "bg-muted hover:bg-muted/80 text-foreground")}
          variant={isSelected ? "default" : "secondary"}
        >
          {isSelected ? "Selected" : "Choose this route"}
        </Button>
      )}
    </div>
  )
}

export function VisaRoutesCard({
  visaData,
  onSelectRoute,
  selectedRouteIndex,
  onCompare,
}: VisaRoutesCardProps) {
  if (!visaData?.routes?.length) return null

  return (
    <div className="space-y-4">
      {visaData.summary && <p className="text-sm text-muted-foreground">{visaData.summary}</p>}

      {visaData.embassyLocation && (
        <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
          {visaData.embassyLocation.replace(/📍\s*\*\*Where to apply\*\*:\s*/, "")}
        </p>
      )}

      <div className="space-y-3">
        {visaData.routes.map((route, index) => (
          <RouteCard
            key={index}
            route={route}
            index={index}
            onSelect={onSelectRoute}
            isSelected={selectedRouteIndex === index}
          />
        ))}
      </div>

      {visaData.routes.length > 1 && onCompare && (
        <Button variant="outline" size="sm" onClick={onCompare} className="w-full bg-transparent">
          Compare all options side-by-side
        </Button>
      )}

      <div className="text-xs text-muted-foreground mt-3 p-3 bg-muted/30 rounded-lg border border-border/50">
        <p className="font-medium mb-1">Important</p>
        <p>
          Visa requirements, fees, and processing times change frequently. Always verify ALL
          information on official government websites before making decisions or applications.
        </p>
      </div>
    </div>
  )
}
