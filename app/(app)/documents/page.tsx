"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, FileCheck, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  InteractiveDocumentChecklist,
  type DocumentItem,
  type DocumentStatus,
} from "@/components/interactive-document-checklist"
import type { Profile } from "@/lib/gomate/profile-schema"

// Generate document checklist based on profile
function generateDocumentChecklist(profile: Profile): DocumentItem[] {
  const items: DocumentItem[] = []
  const destination = profile.destination?.toLowerCase() || ""
  const purpose = profile.purpose || "other"

  // Identity Documents (always required)
  items.push({
    id: "passport",
    document: "Valid Passport",
    description: "Must be valid for at least 6 months beyond your intended stay",
    priority: "critical",
    required: true,
    category: "identity",
    tips: ["Check expiry date", "Ensure at least 2 blank pages"],
  })

  items.push({
    id: "passport_photos",
    document: "Passport Photos",
    description: "Recent biometric photos meeting destination country requirements",
    priority: "high",
    required: true,
    category: "identity",
    tips: ["Usually 35x45mm with white background"],
  })

  items.push({
    id: "birth_certificate",
    document: "Birth Certificate",
    description: "Original or certified copy, may need apostille",
    priority: "medium",
    required: false,
    category: "identity",
  })

  // Visa & Immigration
  items.push({
    id: "visa_application",
    document: "Visa Application Form",
    description: "Completed application for your visa type",
    priority: "critical",
    required: true,
    category: "visa",
    tips: ["Double-check all information before submitting"],
  })

  if (purpose === "work") {
    items.push({
      id: "job_contract",
      document: "Employment Contract",
      description: "Signed contract from your employer",
      priority: "critical",
      required: true,
      category: "visa",
    })

    items.push({
      id: "employer_letter",
      document: "Employer Sponsorship Letter",
      description: "Letter confirming your employment and sponsorship",
      priority: "high",
      required: true,
      category: "visa",
    })
  }

  if (purpose === "study") {
    items.push({
      id: "admission_letter",
      document: "University Admission Letter",
      description: "Official acceptance letter from your institution",
      priority: "critical",
      required: true,
      category: "visa",
    })

    items.push({
      id: "enrollment_proof",
      document: "Proof of Enrollment",
      description: "Confirmation of course registration",
      priority: "high",
      required: true,
      category: "visa",
    })
  }

  // Financial Documents
  items.push({
    id: "bank_statements",
    document: "Bank Statements",
    description: "Last 3-6 months showing sufficient funds",
    priority: "critical",
    required: true,
    category: "financial",
    tips: ["Usually need to show 3-6 months of living expenses"],
  })

  items.push({
    id: "proof_of_funds",
    document: "Proof of Financial Support",
    description: "Evidence of income, savings, or sponsorship",
    priority: "high",
    required: true,
    category: "financial",
  })

  if (purpose === "study") {
    items.push({
      id: "scholarship_letter",
      document: "Scholarship Letter (if applicable)",
      description: "Proof of scholarship or financial aid",
      priority: "medium",
      required: false,
      category: "financial",
    })
  }

  // Medical Records
  items.push({
    id: "health_insurance",
    document: "Health Insurance Certificate",
    description: "Valid health insurance for your destination",
    priority: "critical",
    required: true,
    category: "medical",
    tips: ["Ensure coverage meets visa requirements"],
  })

  items.push({
    id: "vaccination_records",
    document: "Vaccination Records",
    description: "Proof of required vaccinations",
    priority: "high",
    required: true,
    category: "medical",
  })

  items.push({
    id: "medical_certificate",
    document: "Medical Certificate",
    description: "Health clearance from authorized physician",
    priority: "medium",
    required: false,
    category: "medical",
  })

  // Education & Employment
  items.push({
    id: "degree_certificates",
    document: "Degree Certificates",
    description: "Original or certified copies of your qualifications",
    priority: purpose === "work" || purpose === "study" ? "high" : "medium",
    required: purpose === "work" || purpose === "study",
    category: "education",
  })

  items.push({
    id: "transcripts",
    document: "Academic Transcripts",
    description: "Official transcripts from educational institutions",
    priority: purpose === "study" ? "high" : "low",
    required: purpose === "study",
    category: "education",
  })

  if (purpose === "work") {
    items.push({
      id: "cv_resume",
      document: "CV / Resume",
      description: "Updated curriculum vitae",
      priority: "medium",
      required: false,
      category: "education",
    })

    items.push({
      id: "reference_letters",
      document: "Reference Letters",
      description: "Professional references from previous employers",
      priority: "low",
      required: false,
      category: "education",
    })
  }

  // Housing
  items.push({
    id: "accommodation_proof",
    document: "Proof of Accommodation",
    description: "Rental agreement, hotel booking, or host letter",
    priority: "high",
    required: true,
    category: "housing",
    tips: ["May need for first 3 months minimum"],
  })

  // Travel
  items.push({
    id: "flight_booking",
    document: "Flight Itinerary",
    description: "Booked or reserved flight tickets",
    priority: "medium",
    required: false,
    category: "travel",
    tips: ["Consider flexible booking until visa approved"],
  })

  items.push({
    id: "travel_insurance",
    document: "Travel Insurance",
    description: "Coverage for your journey",
    priority: "medium",
    required: false,
    category: "travel",
  })

  // Country-specific documents
  if (destination.includes("germany") || destination.includes("german")) {
    items.push({
      id: "blocked_account",
      document: "Blocked Account (Sperrkonto)",
      description: "Required for students with ~11,208 EUR",
      priority: purpose === "study" ? "critical" : "low",
      required: purpose === "study",
      category: "financial",
      tips: ["Open with Fintiba, Expatrio, or Deutsche Bank"],
    })
  }

  if (destination.includes("netherlands") || destination.includes("dutch")) {
    items.push({
      id: "digid",
      document: "DigiD Application Prepared",
      description: "Dutch digital identity for government services",
      priority: "medium",
      required: false,
      category: "other",
    })
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return items
}

export default function DocumentsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [statuses, setStatuses] = useState<Record<string, DocumentStatus>>({})
  const [items, setItems] = useState<DocumentItem[]>([])

  // Fetch profile and document statuses
  useEffect(() => {
    async function fetchData() {
      try {
        const [profileRes, docsRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/documents"),
        ])

        if (profileRes.ok) {
          const data = await profileRes.json()
          const profileData = data.plan?.profile_data as Profile
          setProfile(profileData)
          
          if (profileData) {
            setItems(generateDocumentChecklist(profileData))
          }
        }

        if (docsRes.ok) {
          const data = await docsRes.json()
          setStatuses(data.statuses || {})
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Handle status change
  const handleStatusChange = useCallback(async (documentId: string, completed: boolean) => {
    // Optimistic update
    setStatuses((prev) => ({
      ...prev,
      [documentId]: {
        completed,
        completedAt: completed ? new Date().toISOString() : undefined,
      },
    }))

    setSaving(true)
    try {
      const response = await fetch("/api/documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, completed }),
      })

      if (!response.ok) {
        // Revert on failure
        setStatuses((prev) => ({
          ...prev,
          [documentId]: {
            completed: !completed,
            completedAt: !completed ? new Date().toISOString() : undefined,
          },
        }))
      }
    } catch (error) {
      console.error("Error updating status:", error)
      // Revert on error
      setStatuses((prev) => ({
        ...prev,
        [documentId]: {
          completed: !completed,
          completedAt: !completed ? new Date().toISOString() : undefined,
        },
      }))
    } finally {
      setSaving(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[600px] w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <FileCheck className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">No Profile Found</h2>
          <p className="text-muted-foreground">Complete your profile to see your document checklist.</p>
          <Button asChild>
            <Link href="/chat">Start Profile</Link>
          </Button>
        </div>
      </div>
    )
  }

  const completedCount = items.filter((item) => statuses[item.id]?.completed).length

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Document Checklist</h1>
              <p className="text-muted-foreground">
                {profile.destination ? `For your move to ${profile.destination}` : "Prepare your documents"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-card border border-border">
            <p className="text-3xl font-bold text-foreground">{items.length}</p>
            <p className="text-sm text-muted-foreground">Total Documents</p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{completedCount}</p>
            <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70">Completed</p>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {items.length - completedCount}
            </p>
            <p className="text-sm text-amber-600/70 dark:text-amber-400/70">Remaining</p>
          </div>
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {items.filter((i) => i.priority === "critical" && !statuses[i.id]?.completed).length}
            </p>
            <p className="text-sm text-red-600/70 dark:text-red-400/70">Critical Pending</p>
          </div>
        </div>

        {/* Interactive Checklist */}
        <InteractiveDocumentChecklist
          items={items}
          statuses={statuses}
          onStatusChange={handleStatusChange}
          title="Your Documents"
          collapsible={false}
          defaultExpanded={true}
        />

        {/* Help Section */}
        <div className="p-6 rounded-2xl bg-muted/30 border border-border">
          <h3 className="font-semibold text-foreground mb-2">Need Help?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Not sure where to get a document or need help understanding requirements?
          </p>
          <Button variant="outline" asChild>
            <Link href="/chat">Ask GoMate Assistant</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
