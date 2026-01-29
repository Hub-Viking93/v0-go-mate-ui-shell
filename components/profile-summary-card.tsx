"use client"

import React from "react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CountryFlag } from "@/components/country-flag"
import { VisaStatusBadge } from "@/components/visa-status-badge"
import type { Profile } from "@/lib/gomate/profile-schema"
import { 
  User, 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  Laptop, 
  Home,
  Calendar,
  Users,
  Wallet
} from "lucide-react"

interface ProfileSummaryCardProps {
  profile: Profile
  compact?: boolean
}

export function ProfileSummaryCard({ profile, compact = false }: ProfileSummaryCardProps) {
  if (!profile.name && !profile.destination) {
    return null
  }

  const purposeIcons: Record<string, React.ReactNode> = {
    study: <GraduationCap className="w-3.5 h-3.5" />,
    work: <Briefcase className="w-3.5 h-3.5" />,
    digital_nomad: <Laptop className="w-3.5 h-3.5" />,
    settle: <Home className="w-3.5 h-3.5" />,
  }

  const purposeLabels: Record<string, string> = {
    study: "Study",
    work: "Work",
    digital_nomad: "Digital Nomad",
    settle: "Settlement",
    other: "Other",
  }

  if (compact) {
    return (
      <Card className="p-3 bg-card/80 border-border">
        <div className="flex items-center gap-3">
          {profile.destination && (
            <CountryFlag country={profile.destination} size="md" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">
              {profile.name || "Your Profile"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {profile.current_location && profile.destination
                ? `${profile.current_location} → ${profile.destination}`
                : profile.destination || "Setting up..."}
            </p>
          </div>
          {profile.purpose && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {purposeIcons[profile.purpose]}
            </Badge>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 bg-card/80 border-border">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          {profile.destination && (
            <CountryFlag country={profile.destination} size="md" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {profile.name ? `${profile.name}'s Move` : "Your Move"}
            </h3>
            {profile.citizenship && profile.destination && (
              <VisaStatusBadge 
                citizenship={profile.citizenship} 
                destination={profile.destination}
                size="sm"
              />
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2 text-xs">
          {profile.current_location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">From: {profile.current_location}</span>
            </div>
          )}
          
          {profile.destination && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="truncate">To: {profile.target_city ? `${profile.target_city}, ${profile.destination}` : profile.destination}</span>
            </div>
          )}

          {profile.purpose && (
            <div className="flex items-center gap-2 text-muted-foreground">
              {purposeIcons[profile.purpose] || <Briefcase className="w-3.5 h-3.5 shrink-0" />}
              <span>{purposeLabels[profile.purpose] || profile.purpose}</span>
              {profile.study_type && <Badge variant="outline" className="text-[10px] py-0">{profile.study_type}</Badge>}
              {profile.industry && <Badge variant="outline" className="text-[10px] py-0">{profile.industry}</Badge>}
            </div>
          )}

          {profile.timeline && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>{profile.timeline}</span>
            </div>
          )}

          {profile.moving_alone === "no" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>
                Moving with family
                {profile.children_count && profile.children_count !== "0" && ` (${profile.children_count} children)`}
              </span>
            </div>
          )}

          {(profile.savings_range || profile.monthly_budget) && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {profile.savings_range && `Savings: ${profile.savings_range}`}
                {profile.savings_range && profile.monthly_budget && " | "}
                {profile.monthly_budget && `Budget: ${profile.monthly_budget}/mo`}
              </span>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
