"use client"

import React, { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CountryFlag } from "@/components/country-flag"
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
    <div className="flex items-start gap-3 py-2">
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
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors"
      >
        <div className={`p-2 rounded-lg ${category.bgColor}`}>
          <Icon className={`w-4 h-4 ${category.color}`} />
        </div>
        <div className="flex-1 text-left">
          <p className="font-medium text-foreground text-sm">{category.label}</p>
          <p className="text-xs text-muted-foreground">
            {filledCount} of {fieldsCount} fields completed
          </p>
        </div>
        <Badge 
          variant={progress === 100 ? "default" : "secondary"} 
          className={`text-xs ${progress === 100 ? "bg-green-500/20 text-green-600 border-green-500/30" : ""}`}
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
        <div className="px-4 pb-4 border-t border-border bg-secondary/10">
          <div className="divide-y divide-border/50">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}

export function ProfileDetailsCard({ profile, showAllCategories = true, onFieldClick }: ProfileDetailsCardProps) {
  // Count filled fields for each category
  const countFilled = (fields: (keyof Profile)[]) => {
    return fields.filter(f => profile[f] && profile[f] !== "Not specified").length
  }

  // Journey overview fields
  const journeyFields: (keyof Profile)[] = ["name", "citizenship", "current_location", "destination", "target_city", "purpose", "duration", "timeline"]
  
  // Purpose-specific fields based on purpose
  const getPurposeFields = (): (keyof Profile)[] => {
    switch (profile.purpose) {
      case "study":
        return ["study_type", "study_field", "study_funding"]
      case "work":
        return ["job_offer", "job_field", "employer_sponsorship", "highly_skilled", "years_experience"]
      case "digital_nomad":
        return ["remote_income", "income_source", "monthly_income"]
      case "settle":
        return ["settlement_reason", "family_ties"]
      default:
        return []
    }
  }
  
  // Family fields
  const familyFields: (keyof Profile)[] = ["moving_alone", "spouse_joining", "children_count", "children_ages"]
  const relevantFamilyFields = profile.moving_alone === "no" ? familyFields : ["moving_alone"] as (keyof Profile)[]
  
  // Financial fields
  const financialFields: (keyof Profile)[] = ["savings_available", "monthly_budget", "need_budget_help"]
  
  // Background fields
  const backgroundFields: (keyof Profile)[] = ["language_skill", "education_level", "years_experience"]
  const relevantBackgroundFields = profile.purpose === "work" ? backgroundFields : backgroundFields.filter(f => f !== "years_experience")
  
  // Legal fields
  const legalFields: (keyof Profile)[] = ["prior_visa", "visa_rejections"]
  
  // Special fields
  const specialFields: (keyof Profile)[] = ["healthcare_needs", "pets", "special_requirements"]
  
  const purposeFields = getPurposeFields()

  return (
    <div className="space-y-4">
      {/* Header with overview */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="flex items-start gap-4">
          {profile.destination && (
            <CountryFlag country={profile.destination} size="lg" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground">
              {profile.name ? `${profile.name}'s Relocation Profile` : "Your Relocation Profile"}
            </h2>
            {profile.current_location && profile.destination && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                <span>{profile.current_location}</span>
                <Plane className="w-3.5 h-3.5 rotate-45" />
                <span className="font-medium text-foreground">
                  {profile.target_city ? `${profile.target_city}, ${profile.destination}` : profile.destination}
                </span>
              </p>
            )}
            {profile.purpose && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="gap-1.5">
                  {PURPOSE_ICONS[profile.purpose]}
                  {PURPOSE_LABELS[profile.purpose]}
                </Badge>
                {profile.timeline && (
                  <Badge variant="outline" className="gap-1.5">
                    <Clock className="w-3 h-3" />
                    {profile.timeline}
                  </Badge>
                )}
                {profile.duration && (
                  <Badge variant="outline" className="gap-1.5">
                    <Calendar className="w-3 h-3" />
                    {formatValue(profile.duration)}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Category sections */}
      <div className="space-y-3">
        {/* Journey Overview */}
        <CategorySection 
          category={CATEGORIES[0]} 
          fieldsCount={journeyFields.length}
          filledCount={countFilled(journeyFields)}
        >
          <FieldItem label="Full Name" value={profile.name} icon={User} highlight fieldKey="name" onClick={onFieldClick} />
          <FieldItem label="Citizenship" value={profile.citizenship} icon={Globe} fieldKey="citizenship" onClick={onFieldClick} />
          <FieldItem label="Current Location" value={profile.current_location} icon={MapPin} fieldKey="current_location" onClick={onFieldClick} />
          <FieldItem label="Destination Country" value={profile.destination} icon={MapPin} highlight fieldKey="destination" onClick={onFieldClick} />
          <FieldItem label="Target City" value={profile.target_city} icon={MapPin} fieldKey="target_city" onClick={onFieldClick} />
          <FieldItem label="Purpose" value={profile.purpose ? PURPOSE_LABELS[profile.purpose] : null} fieldKey="purpose" onClick={onFieldClick} />
          <FieldItem label="Duration" value={profile.duration} icon={Calendar} fieldKey="duration" onClick={onFieldClick} />
          <FieldItem label="Timeline" value={profile.timeline} icon={Clock} fieldKey="timeline" onClick={onFieldClick} />
        </CategorySection>

        {/* Purpose-specific section - only show if there are purpose fields */}
        {purposeFields.length > 0 && (
          <CategorySection 
            category={{
              ...CATEGORIES[1],
              label: profile.purpose === "study" ? "Study Details" 
                   : profile.purpose === "work" ? "Work Details"
                   : profile.purpose === "digital_nomad" ? "Remote Work Details"
                   : "Settlement Details"
            }} 
            fieldsCount={purposeFields.length}
            filledCount={countFilled(purposeFields)}
          >
            {profile.purpose === "study" && (
              <>
                <FieldItem label="Type of Study" value={profile.study_type} icon={GraduationCap} fieldKey="study_type" onClick={onFieldClick} />
                <FieldItem label="Field of Study" value={profile.study_field} icon={BookOpen} fieldKey="study_field" onClick={onFieldClick} />
                <FieldItem label="Funding Source" value={profile.study_funding} icon={Wallet} fieldKey="study_funding" onClick={onFieldClick} />
              </>
            )}
            {profile.purpose === "work" && (
              <>
                <FieldItem label="Job Offer Status" value={profile.job_offer} icon={Briefcase} fieldKey="job_offer" onClick={onFieldClick} />
                <FieldItem label="Job Field" value={profile.job_field} icon={Briefcase} fieldKey="job_field" onClick={onFieldClick} />
                <FieldItem label="Employer Sponsorship" value={profile.employer_sponsorship} icon={FileText} fieldKey="employer_sponsorship" onClick={onFieldClick} />
                <FieldItem label="Highly Skilled Professional" value={profile.highly_skilled} icon={GraduationCap} fieldKey="highly_skilled" onClick={onFieldClick} />
                <FieldItem label="Years of Experience" value={profile.years_experience} icon={Clock} fieldKey="years_experience" onClick={onFieldClick} />
              </>
            )}
            {profile.purpose === "digital_nomad" && (
              <>
                <FieldItem label="Remote Income" value={profile.remote_income} icon={Laptop} fieldKey="remote_income" onClick={onFieldClick} />
                <FieldItem label="Income Source" value={profile.income_source} icon={Banknote} fieldKey="income_source" onClick={onFieldClick} />
                <FieldItem label="Monthly Income" value={profile.monthly_income} icon={Wallet} fieldKey="monthly_income" onClick={onFieldClick} />
              </>
            )}
            {profile.purpose === "settle" && (
              <>
                <FieldItem label="Settlement Reason" value={profile.settlement_reason} icon={Home} fieldKey="settlement_reason" onClick={onFieldClick} />
                <FieldItem label="Family Ties in Destination" value={profile.family_ties} icon={Users} fieldKey="family_ties" onClick={onFieldClick} />
              </>
            )}
          </CategorySection>
        )}

        {/* Family & Dependents */}
        <CategorySection 
          category={CATEGORIES[2]} 
          fieldsCount={relevantFamilyFields.length}
          filledCount={countFilled(relevantFamilyFields)}
        >
          <FieldItem label="Moving Alone" value={profile.moving_alone === "yes" ? "Yes, alone" : profile.moving_alone === "no" ? "No, with others" : null} icon={User} fieldKey="moving_alone" onClick={onFieldClick} />
          {profile.moving_alone === "no" && (
            <>
              <FieldItem label="Spouse/Partner Joining" value={profile.spouse_joining} icon={Users} fieldKey="spouse_joining" onClick={onFieldClick} />
              <FieldItem label="Number of Children" value={profile.children_count} icon={Baby} fieldKey="children_count" onClick={onFieldClick} />
              {profile.children_count && profile.children_count !== "0" && (
                <FieldItem label="Children's Ages" value={profile.children_ages} icon={Baby} fieldKey="children_ages" onClick={onFieldClick} />
              )}
            </>
          )}
        </CategorySection>

        {/* Financial Planning */}
        <CategorySection 
          category={CATEGORIES[3]} 
          fieldsCount={financialFields.length}
          filledCount={countFilled(financialFields)}
        >
          <FieldItem label="Available Savings" value={profile.savings_available} icon={Wallet} highlight fieldKey="savings_available" onClick={onFieldClick} />
          <FieldItem label="Monthly Budget" value={profile.monthly_budget} icon={Banknote} fieldKey="monthly_budget" onClick={onFieldClick} />
          <FieldItem label="Need Budget Help" value={profile.need_budget_help} fieldKey="need_budget_help" onClick={onFieldClick} />
        </CategorySection>

        {/* Background */}
        <CategorySection 
          category={CATEGORIES[4]} 
          fieldsCount={relevantBackgroundFields.length}
          filledCount={countFilled(relevantBackgroundFields)}
        >
          <FieldItem label="Language Skills" value={profile.language_skill} icon={Languages} fieldKey="language_skill" onClick={onFieldClick} />
          <FieldItem label="Education Level" value={profile.education_level} icon={GraduationCap} fieldKey="education_level" onClick={onFieldClick} />
          {profile.purpose === "work" && (
            <FieldItem label="Work Experience" value={profile.years_experience} icon={Briefcase} fieldKey="years_experience" onClick={onFieldClick} />
          )}
        </CategorySection>

        {/* Visa & Legal */}
        <CategorySection 
          category={CATEGORIES[5]} 
          fieldsCount={legalFields.length}
          filledCount={countFilled(legalFields)}
        >
          <FieldItem label="Prior Visa for Destination" value={profile.prior_visa} icon={FileText} fieldKey="prior_visa" onClick={onFieldClick} />
          <FieldItem label="Previous Visa Rejections" value={profile.visa_rejections} icon={FileText} fieldKey="visa_rejections" onClick={onFieldClick} />
        </CategorySection>

        {/* Special Considerations */}
        <CategorySection 
          category={CATEGORIES[6]} 
          fieldsCount={specialFields.length}
          filledCount={countFilled(specialFields)}
          defaultExpanded={false}
        >
          <FieldItem label="Healthcare Needs" value={profile.healthcare_needs} icon={Stethoscope} fieldKey="healthcare_needs" onClick={onFieldClick} />
          <FieldItem label="Pets" value={profile.pets} icon={PawPrint} fieldKey="pets" onClick={onFieldClick} />
          <FieldItem label="Special Requirements" value={profile.special_requirements} icon={Heart} fieldKey="special_requirements" onClick={onFieldClick} />
        </CategorySection>
      </div>
    </div>
  )
}
