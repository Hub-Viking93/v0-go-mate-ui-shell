"use client"

import React, { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CountryFlag } from "@/components/country-flag"
import type { Profile, AllFieldKey } from "@/lib/gomate/profile-schema"
import { getRequiredFields } from "@/lib/gomate/profile-schema"
import { 
  User, 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  Laptop, 
  Home,
  Calendar,
  Users,
  Wallet,
  Globe,
  FileText,
  Heart,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Plane,
  Clock,
  Baby,
  PawPrint,
  Stethoscope,
  BookOpen,
  Languages,
  Banknote
} from "lucide-react"

interface ProfileDetailsCardProps {
  profile: Profile
  showAllCategories?: boolean
  onFieldClick?: (fieldKey: string, fieldLabel: string) => void
}

// Category configuration
const CATEGORIES = [
  {
    id: "journey",
    label: "Journey Overview",
    icon: Plane,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    id: "purpose",
    label: "Purpose Details",
    icon: Briefcase,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    id: "family",
    label: "Family & Dependents",
    icon: Users,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
  },
  {
    id: "financial",
    label: "Financial Planning",
    icon: Wallet,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  {
    id: "background",
    label: "Background",
    icon: BookOpen,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    id: "legal",
    label: "Visa & Legal",
    icon: FileText,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  {
    id: "special",
    label: "Special Considerations",
    icon: Heart,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
]

// Purpose-specific icons
const PURPOSE_ICONS: Record<string, React.ReactNode> = {
  study: <GraduationCap className="w-4 h-4" />,
  work: <Briefcase className="w-4 h-4" />,
  digital_nomad: <Laptop className="w-4 h-4" />,
  settle: <Home className="w-4 h-4" />,
  other: <Globe className="w-4 h-4" />,
}

const PURPOSE_LABELS: Record<string, string> = {
  study: "Study",
  work: "Work",
  digital_nomad: "Digital Nomad",
  settle: "Settlement",
  other: "Other",
}

// Helper to format field values nicely
function formatValue(value: string | null | undefined): string {
  if (!value) return "Not specified"
  // Capitalize and replace underscores
  return value
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

// Field item component
function FieldItem({ 
  label, 
  value, 
  icon: Icon,
  highlight = false,
  fieldKey,
  onClick
}: { 
  label: string
  value: string | null | undefined
  icon?: React.ElementType
  highlight?: boolean
  fieldKey?: string
  onClick?: (fieldKey: string, fieldLabel: string) => void
}) {
  const hasValue = value && value !== "Not specified"
  const isClickable = !hasValue && onClick && fieldKey
  
  const content = (
    <>
      <div className={`mt-0.5 ${hasValue ? "text-primary" : "text-muted-foreground/50"}`}>
        {hasValue ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          <Circle className="w-4 h-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium truncate ${
          hasValue 
            ? highlight ? "text-primary" : "text-foreground" 
            : isClickable ? "text-primary/70 italic" : "text-muted-foreground/50 italic"
        }`}>
          {hasValue ? formatValue(value) : isClickable ? "Click to add" : "Not specified"}
        </p>
      </div>
      {Icon && hasValue && (
        <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
      )}
    </>
  )
  
  if (isClickable) {
    return (
      <button
        onClick={() => onClick(fieldKey, label)}
        className="w-full flex items-start gap-3 py-2 hover:bg-primary/5 rounded-lg px-2 -mx-2 transition-colors text-left group"
      >
        {content}
        <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
          Add
        </span>
      </button>
    )
  }
  
  return (
    <div className="flex items-start gap-3 py-2.5">
      {content}
    </div>
  )
}

// Category section component
function CategorySection({ 
  category, 
  children,
  defaultExpanded = true,
  fieldsCount,
  filledCount
}: { 
  category: typeof CATEGORIES[number]
  children: React.ReactNode
  defaultExpanded?: boolean
  fieldsCount: number
  filledCount: number
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const Icon = category.icon
  const progress = fieldsCount > 0 ? Math.round((filledCount / fieldsCount) * 100) : 0
  
  return (
    <div className="gm-card-static overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${category.bgColor}`}>
          <Icon className={`w-5 h-5 ${category.color}`} />
        </div>
        <div className="flex-1 text-left">
          <p className="font-semibold text-foreground text-sm">{category.label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground font-mono">
              {filledCount}/{fieldsCount}
            </span>
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progress === 100 ? "bg-emerald-500" : "bg-primary"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
        <Badge
          variant={progress === 100 ? "default" : "secondary"}
          className={`text-xs ${progress === 100 ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/25" : ""}`}
        >
          {progress}%
        </Badge>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-border">
          <div className="divide-y divide-border/50">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

// Field display config: label, icon, highlight, and custom value formatter
const FIELD_DISPLAY: Record<string, { label: string; icon?: React.ElementType; highlight?: boolean; formatValue?: (profile: Profile) => string | null }> = {
  name: { label: "Full Name", icon: User, highlight: true },
  citizenship: { label: "Citizenship", icon: Globe },
  current_location: { label: "Current Location", icon: MapPin },
  destination: { label: "Destination Country", icon: MapPin, highlight: true },
  target_city: { label: "Target City", icon: MapPin },
  purpose: { label: "Purpose", formatValue: (p) => p.purpose ? PURPOSE_LABELS[p.purpose] : null },
  duration: { label: "Duration", icon: Calendar },
  timeline: { label: "Timeline", icon: Clock },
  visa_role: { label: "Visa Role", icon: Globe },
  study_type: { label: "Type of Study", icon: GraduationCap },
  study_field: { label: "Field of Study", icon: BookOpen },
  study_funding: { label: "Funding Source", icon: Wallet },
  job_offer: { label: "Job Offer Status", icon: Briefcase },
  job_field: { label: "Job Field", icon: Briefcase },
  employer_sponsorship: { label: "Employer Sponsorship", icon: FileText },
  highly_skilled: { label: "Highly Skilled Professional", icon: GraduationCap },
  years_experience: { label: "Work Experience", icon: Clock },
  remote_income: { label: "Remote Income", icon: Laptop },
  income_source: { label: "Income Source", icon: Banknote },
  monthly_income: { label: "Monthly Income", icon: Wallet },
  income_consistency: { label: "Income Consistency", icon: Wallet },
  income_history_months: { label: "Income History", icon: Clock },
  settlement_reason: { label: "Settlement Reason", icon: Home },
  family_ties: { label: "Family Ties in Destination", icon: Users },
  moving_alone: { label: "Moving Alone", icon: User, formatValue: (p) => p.moving_alone === "yes" ? "Yes, alone" : p.moving_alone === "no" ? "No, with others" : null },
  spouse_joining: { label: "Spouse/Partner Joining", icon: Users },
  children_count: { label: "Number of Children", icon: Baby },
  children_ages: { label: "Children's Ages", icon: Baby },
  partner_citizenship: { label: "Partner's Citizenship", icon: Globe },
  partner_visa_status: { label: "Partner's Visa Status", icon: FileText },
  partner_residency_duration: { label: "Partner's Time in Country", icon: Clock },
  relationship_type: { label: "Relationship Type", icon: Users },
  relationship_duration: { label: "Relationship Duration", icon: Clock },
  savings_available: { label: "Available Savings", icon: Wallet, highlight: true },
  monthly_budget: { label: "Monthly Budget", icon: Banknote },
  need_budget_help: { label: "Need Budget Help" },
  language_skill: { label: "Language Skills", icon: Languages },
  education_level: { label: "Education Level", icon: GraduationCap },
  prior_visa: { label: "Prior Visa for Destination", icon: FileText },
  visa_rejections: { label: "Previous Visa Rejections", icon: FileText },
  healthcare_needs: { label: "Healthcare Needs", icon: Stethoscope },
  pets: { label: "Pets", icon: PawPrint },
  special_requirements: { label: "Special Requirements", icon: Heart },
}

// Map each field to a category ID
const FIELD_TO_CATEGORY: Record<string, string> = {
  name: "journey", citizenship: "journey", current_location: "journey",
  destination: "journey", target_city: "journey", purpose: "journey",
  duration: "journey", timeline: "journey", visa_role: "journey",
  study_type: "purpose", study_field: "purpose", study_funding: "purpose",
  job_offer: "purpose", job_field: "purpose", employer_sponsorship: "purpose",
  highly_skilled: "purpose", years_experience: "purpose",
  remote_income: "purpose", income_source: "purpose", monthly_income: "purpose",
  income_consistency: "purpose", income_history_months: "purpose",
  settlement_reason: "purpose", family_ties: "purpose",
  moving_alone: "family", spouse_joining: "family", children_count: "family", children_ages: "family",
  partner_citizenship: "family", partner_visa_status: "family",
  partner_residency_duration: "family", relationship_type: "family", relationship_duration: "family",
  savings_available: "financial", monthly_budget: "financial", need_budget_help: "financial",
  language_skill: "background", education_level: "background",
  prior_visa: "legal", visa_rejections: "legal",
  healthcare_needs: "special", pets: "special", special_requirements: "special",
}

export function ProfileDetailsCard({ profile, showAllCategories = true, onFieldClick }: ProfileDetailsCardProps) {
  const requiredFields = getRequiredFields(profile)
  const requiredSet = new Set<string>(requiredFields)

  // Group required fields by category
  const categoryFields: Record<string, AllFieldKey[]> = {}
  for (const field of requiredFields) {
    const cat = FIELD_TO_CATEGORY[field] || "special"
    if (!categoryFields[cat]) categoryFields[cat] = []
    categoryFields[cat].push(field)
  }

  const countFilled = (fields: AllFieldKey[]) => {
    return fields.filter(f => {
      const value = profile[f as keyof Profile]
      return value !== null && value !== undefined && value !== ""
    }).length
  }

  // Dynamic purpose category label
  const purposeCategoryLabel = profile.purpose === "study" ? "Study Details"
    : profile.purpose === "work" ? "Work Details"
    : profile.purpose === "digital_nomad" ? "Remote Work Details"
    : profile.purpose === "settle" ? "Settlement Details"
    : "Purpose Details"

  const renderField = (field: AllFieldKey) => {
    if (!requiredSet.has(field)) return null
    const display = FIELD_DISPLAY[field]
    if (!display) return null
    const value = display.formatValue
      ? display.formatValue(profile)
      : profile[field as keyof Profile] as string | null
    return (
      <FieldItem
        key={field}
        label={display.label}
        value={value}
        icon={display.icon}
        highlight={display.highlight}
        fieldKey={field}
        onClick={onFieldClick}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with overview */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1B3A2D] via-[#234D3A] to-[#2D6A4F] p-5 md:p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(94,232,156,0.12),transparent_60%)]" />
        <div className="relative flex items-start gap-4">
          {profile.destination && (
            <CountryFlag country={profile.destination} size="lg" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-white">
              {profile.name ? `${profile.name}'s Relocation Profile` : "Your Relocation Profile"}
            </h2>
            {profile.current_location && profile.destination && (
              <p className="text-sm text-white/50 mt-1 flex items-center gap-2">
                <span>{profile.current_location}</span>
                <Plane className="w-3.5 h-3.5 rotate-45" />
                <span className="font-medium text-white/80">
                  {profile.target_city ? `${profile.target_city}, ${profile.destination}` : profile.destination}
                </span>
              </p>
            )}
            {profile.purpose && (
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <Badge className="gap-1.5 bg-white/15 text-white border-white/20 backdrop-blur-sm">
                  {PURPOSE_ICONS[profile.purpose]}
                  {PURPOSE_LABELS[profile.purpose]}
                </Badge>
                {profile.timeline && (
                  <Badge className="gap-1.5 bg-white/10 text-white/80 border-white/15 backdrop-blur-sm">
                    <Clock className="w-3 h-3" />
                    {profile.timeline}
                  </Badge>
                )}
                {profile.duration && (
                  <Badge className="gap-1.5 bg-white/10 text-white/80 border-white/15 backdrop-blur-sm">
                    <Calendar className="w-3 h-3" />
                    {formatValue(profile.duration)}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category sections — only show categories that have required fields */}
      <div className="space-y-3">
        {CATEGORIES.map((category) => {
          const fields = categoryFields[category.id]
          if (!fields || fields.length === 0) return null

          const catConfig = category.id === "purpose"
            ? { ...category, label: purposeCategoryLabel }
            : category

          return (
            <CategorySection
              key={category.id}
              category={catConfig}
              fieldsCount={fields.length}
              filledCount={countFilled(fields)}
              defaultExpanded={category.id !== "special"}
            >
              {fields.map(renderField)}
            </CategorySection>
          )
        })}
      </div>
    </div>
  )
}
