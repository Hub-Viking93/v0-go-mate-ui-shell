import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DashboardGuidedTour } from "@/components/dashboard/dashboard-guided-tour"

export default function TourPreviewPage() {
  const [open, setOpen] = useState(true)
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tour Preview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dev preview for the new-user dashboard guided tour. Use the button
            to re-open the popup after closing it.
          </p>
        </div>
        <Button data-testid="tour-preview-open" onClick={() => setOpen(true)}>
          Open tour
        </Button>
        <DashboardGuidedTour open={open} onClose={() => setOpen(false)} />
      </div>
    </div>
  )
}
