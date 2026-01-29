"use client"

import { Badge } from "@/components/ui/badge"
import { Check, AlertCircle, HelpCircle } from "lucide-react"
import { getVisaStatus, type VisaBadgeType } from "@/lib/gomate/visa-checker"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface VisaStatusBadgeProps {
  citizenship: string | null
  destination: string | null
  showTooltip?: boolean
  size?: "sm" | "md"
}

export function VisaStatusBadge({ 
  citizenship, 
  destination, 
  showTooltip = true,
  size = "md" 
}: VisaStatusBadgeProps) {
  if (!citizenship || !destination) return null
  
  const status = getVisaStatus(citizenship, destination)
  
  const badgeConfig: Record<VisaBadgeType, {
    variant: "default" | "secondary" | "destructive" | "outline"
    icon: typeof Check
    label: string
    className: string
  }> = {
    "visa-free": {
      variant: "default",
      icon: Check,
      label: "Visa Free",
      className: "bg-green-600 hover:bg-green-700 text-white",
    },
    "visa-required": {
      variant: "destructive",
      icon: AlertCircle,
      label: "Visa Required",
      className: "",
    },
    "check-required": {
      variant: "secondary",
      icon: HelpCircle,
      label: "Check Required",
      className: "bg-amber-100 text-amber-800 hover:bg-amber-200",
    },
  }
  
  const config = badgeConfig[status.badge]
  const Icon = config.icon
  
  const badge = (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${size === "sm" ? "text-xs px-2 py-0.5" : ""}`}
    >
      <Icon className={`${size === "sm" ? "w-3 h-3" : "w-4 h-4"} mr-1`} />
      {config.label}
    </Badge>
  )
  
  if (!showTooltip) return badge
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{status.reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
