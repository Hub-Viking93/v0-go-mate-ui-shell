"use client"

/**
 * PDF Generator for GoMate Guides
 * Uses jsPDF to generate downloadable PDF guides
 */

import jsPDF from "jspdf"

interface GuideData {
  title: string
  destination: string
  destination_city?: string
  purpose: string
  overview?: {
    title: string
    subtitle: string
    summary: string
    keyFacts: { label: string; value: string }[]
    lastUpdated: string
  }
  visa_section?: {
    recommendedVisa: string
    visaType: string
    eligibility: string
    processingTime: string
    estimatedCost: string
    requirements: string[]
    applicationSteps: string[]
    tips: string[]
    warnings: string[]
    officialLink?: string
  }
  budget_section?: {
    monthlyBudget: { minimum: number; comfortable: number; breakdown: Record<string, number> }
    savingsTarget: { emergencyFund: number; movingCosts: number; initialSetup: number; visaFees: number; total: number; timeline: string }
    costComparison?: string
    tips: string[]
  }
  housing_section?: {
    overview: string
    averageRent: { studio: string; oneBed: string; twoBed: string }
    rentalPlatforms: { name: string; url: string; description: string }[]
    depositInfo: string
    tips: string[]
    warnings: string[]
  }
  banking_section?: {
    overview: string
    recommendedBanks: { name: string; type: string; features: string[] }[]
    requirements: string[]
    tips: string[]
  }
  healthcare_section?: {
    overview: string
    systemType: string
    insuranceRequired: boolean
    averageCost: string
    emergencyInfo: string
    tips: string[]
  }
  culture_section?: {
    overview: string
    doAndDont: { do: string[]; dont: string[] }
    languageTips: string[]
    socialNorms: string[]
  }
  timeline_section?: {
    phases: { 
      name: string
      timeframe: string
      tasks: { task: string; priority: string; completed?: boolean }[]
    }[]
  }
  checklist_section?: {
    categories: {
      name: string
      items: { item: string; priority: string; completed?: boolean }[]
    }[]
  }
  official_links?: { name: string; url: string; category: string }[]
  useful_tips?: string[]
}

// Colors
const COLORS = {
  primary: [59, 130, 246] as [number, number, number], // Blue
  secondary: [100, 116, 139] as [number, number, number], // Slate
  accent: [16, 185, 129] as [number, number, number], // Green
  warning: [245, 158, 11] as [number, number, number], // Amber
  danger: [239, 68, 68] as [number, number, number], // Red
  text: [15, 23, 42] as [number, number, number], // Slate 900
  textLight: [100, 116, 139] as [number, number, number], // Slate 500
  background: [248, 250, 252] as [number, number, number], // Slate 50
}

export async function generateGuidePDF(guide: GuideData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let yPos = margin

  // Helper functions
  const addNewPageIfNeeded = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage()
      yPos = margin
      return true
    }
    return false
  }

  const drawSectionHeader = (title: string, icon?: string) => {
    addNewPageIfNeeded(20)
    
    // Background bar
    doc.setFillColor(...COLORS.primary)
    doc.roundedRect(margin, yPos, contentWidth, 10, 2, 2, "F")
    
    // Title text
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text(title.toUpperCase(), margin + 5, yPos + 7)
    
    yPos += 15
    doc.setTextColor(...COLORS.text)
  }

  const drawSubHeader = (title: string) => {
    addNewPageIfNeeded(12)
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.primary)
    doc.text(title, margin, yPos)
    yPos += 6
    doc.setTextColor(...COLORS.text)
  }

  const drawParagraph = (text: string, indent = 0) => {
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    const lines = doc.splitTextToSize(text, contentWidth - indent)
    for (const line of lines) {
      addNewPageIfNeeded(6)
      doc.text(line, margin + indent, yPos)
      yPos += 5
    }
    yPos += 2
  }

  const drawBulletList = (items: string[], indent = 5) => {
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    for (const item of items) {
      const lines = doc.splitTextToSize(item, contentWidth - indent - 5)
      for (let i = 0; i < lines.length; i++) {
        addNewPageIfNeeded(6)
        if (i === 0) {
          doc.setFillColor(...COLORS.primary)
          doc.circle(margin + indent, yPos - 1.5, 1, "F")
        }
        doc.text(lines[i], margin + indent + 5, yPos)
        yPos += 5
      }
    }
    yPos += 2
  }

  const drawKeyValuePair = (label: string, value: string, highlight = false) => {
    addNewPageIfNeeded(8)
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...COLORS.textLight)
    doc.text(label + ":", margin, yPos)
    
    doc.setFont("helvetica", "normal")
    doc.setTextColor(highlight ? COLORS.primary : COLORS.text)
    doc.text(value, margin + 45, yPos)
    doc.setTextColor(...COLORS.text)
    yPos += 6
  }

  const drawTipBox = (tips: string[], type: "tip" | "warning" = "tip") => {
    if (tips.length === 0) return
    
    addNewPageIfNeeded(15 + tips.length * 6)
    
    const color = type === "tip" ? COLORS.accent : COLORS.warning
    
    // Box background
    doc.setFillColor(...COLORS.background)
    doc.setDrawColor(...color)
    doc.setLineWidth(0.5)
    
    const boxHeight = 8 + tips.length * 6
    doc.roundedRect(margin, yPos, contentWidth, boxHeight, 2, 2, "FD")
    
    // Icon indicator
    doc.setFillColor(...color)
    doc.circle(margin + 5, yPos + 5, 2, "F")
    
    // Label
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(...color)
    doc.text(type === "tip" ? "TIPS" : "WARNINGS", margin + 10, yPos + 6)
    
    yPos += 10
    doc.setTextColor(...COLORS.text)
    doc.setFont("helvetica", "normal")
    
    for (const tip of tips) {
      const lines = doc.splitTextToSize("• " + tip, contentWidth - 15)
      for (const line of lines) {
        doc.text(line, margin + 5, yPos)
        yPos += 5
      }
    }
    
    yPos += 5
  }

  // ============ COVER PAGE ============
  // Background gradient effect (simulated with rectangles)
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, pageWidth, pageHeight * 0.4, "F")
  
  // Destination name
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(36)
  doc.setFont("helvetica", "bold")
  const destinationText = guide.destination_city 
    ? `${guide.destination_city}, ${guide.destination}`
    : guide.destination
  doc.text(destinationText, pageWidth / 2, 60, { align: "center" })
  
  // Subtitle
  doc.setFontSize(14)
  doc.setFont("helvetica", "normal")
  doc.text("RELOCATION GUIDE", pageWidth / 2, 75, { align: "center" })
  
  // Purpose badge
  const purposeLabels: Record<string, string> = {
    work: "Working Abroad",
    study: "Studying Abroad",
    settle: "Permanent Relocation",
    digital_nomad: "Digital Nomad",
  }
  doc.setFontSize(12)
  doc.text(purposeLabels[guide.purpose] || guide.purpose, pageWidth / 2, 90, { align: "center" })
  
  // Overview section on cover
  if (guide.overview) {
    doc.setTextColor(...COLORS.text)
    yPos = pageHeight * 0.45
    
    doc.setFontSize(11)
    doc.setFont("helvetica", "normal")
    const summaryLines = doc.splitTextToSize(guide.overview.summary, contentWidth)
    for (const line of summaryLines) {
      doc.text(line, margin, yPos)
      yPos += 6
    }
    
    yPos += 10
    
    // Key facts
    if (guide.overview.keyFacts && guide.overview.keyFacts.length > 0) {
      doc.setFillColor(...COLORS.background)
      doc.roundedRect(margin, yPos, contentWidth, 8 + guide.overview.keyFacts.length * 7, 3, 3, "F")
      yPos += 8
      
      for (const fact of guide.overview.keyFacts) {
        doc.setFont("helvetica", "bold")
        doc.setTextColor(...COLORS.textLight)
        doc.text(fact.label + ":", margin + 5, yPos)
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...COLORS.text)
        doc.text(fact.value, margin + 50, yPos)
        yPos += 7
      }
    }
  }
  
  // Footer on cover
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.textLight)
  doc.text(`Generated by GoMate • ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - 15, { align: "center" })

  // ============ VISA SECTION ============
  if (guide.visa_section) {
    doc.addPage()
    yPos = margin
    
    drawSectionHeader("Visa & Immigration")
    
    drawKeyValuePair("Recommended Visa", guide.visa_section.recommendedVisa, true)
    drawKeyValuePair("Visa Type", guide.visa_section.visaType)
    drawKeyValuePair("Processing Time", guide.visa_section.processingTime)
    drawKeyValuePair("Estimated Cost", guide.visa_section.estimatedCost)
    
    yPos += 5
    
    if (guide.visa_section.eligibility) {
      drawSubHeader("Eligibility")
      drawParagraph(guide.visa_section.eligibility)
    }
    
    if (guide.visa_section.requirements.length > 0) {
      drawSubHeader("Requirements")
      drawBulletList(guide.visa_section.requirements)
    }
    
    if (guide.visa_section.applicationSteps.length > 0) {
      drawSubHeader("Application Steps")
      drawBulletList(guide.visa_section.applicationSteps)
    }
    
    if (guide.visa_section.tips.length > 0) {
      drawTipBox(guide.visa_section.tips, "tip")
    }
    
    if (guide.visa_section.warnings.length > 0) {
      drawTipBox(guide.visa_section.warnings, "warning")
    }
  }

  // ============ BUDGET SECTION ============
  if (guide.budget_section) {
    doc.addPage()
    yPos = margin
    
    drawSectionHeader("Budget & Finances")
    
    drawSubHeader("Monthly Budget Estimates")
    drawKeyValuePair("Minimum", `€${guide.budget_section.monthlyBudget.minimum.toLocaleString()}/month`)
    drawKeyValuePair("Comfortable", `€${guide.budget_section.monthlyBudget.comfortable.toLocaleString()}/month`, true)
    
    yPos += 5
    
    if (guide.budget_section.monthlyBudget.breakdown) {
      drawSubHeader("Cost Breakdown")
      for (const [category, amount] of Object.entries(guide.budget_section.monthlyBudget.breakdown)) {
        const formattedCategory = category.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase())
        drawKeyValuePair(formattedCategory, `€${amount.toLocaleString()}`)
      }
    }
    
    yPos += 5
    
    if (guide.budget_section.savingsTarget) {
      drawSubHeader("Savings Target Before Move")
      drawKeyValuePair("Emergency Fund", `€${guide.budget_section.savingsTarget.emergencyFund.toLocaleString()}`)
      drawKeyValuePair("Moving Costs", `€${guide.budget_section.savingsTarget.movingCosts.toLocaleString()}`)
      drawKeyValuePair("Initial Setup", `€${guide.budget_section.savingsTarget.initialSetup.toLocaleString()}`)
      drawKeyValuePair("Visa Fees", `€${guide.budget_section.savingsTarget.visaFees.toLocaleString()}`)
      drawKeyValuePair("Total Target", `€${guide.budget_section.savingsTarget.total.toLocaleString()}`, true)
      if (guide.budget_section.savingsTarget.timeline) {
        drawParagraph(`Timeline: ${guide.budget_section.savingsTarget.timeline}`)
      }
    }
    
    if (guide.budget_section.tips.length > 0) {
      drawTipBox(guide.budget_section.tips, "tip")
    }
  }

  // ============ HOUSING SECTION ============
  if (guide.housing_section) {
    doc.addPage()
    yPos = margin
    
    drawSectionHeader("Housing & Accommodation")
    
    drawParagraph(guide.housing_section.overview)
    
    yPos += 5
    
    drawSubHeader("Average Rent")
    if (guide.housing_section.averageRent) {
      drawKeyValuePair("Studio", guide.housing_section.averageRent.studio)
      drawKeyValuePair("1 Bedroom", guide.housing_section.averageRent.oneBed)
      drawKeyValuePair("2 Bedroom", guide.housing_section.averageRent.twoBed)
    }
    
    if (guide.housing_section.depositInfo) {
      yPos += 5
      drawSubHeader("Deposit Information")
      drawParagraph(guide.housing_section.depositInfo)
    }
    
    if (guide.housing_section.rentalPlatforms && guide.housing_section.rentalPlatforms.length > 0) {
      yPos += 5
      drawSubHeader("Rental Platforms")
      for (const platform of guide.housing_section.rentalPlatforms) {
        drawKeyValuePair(platform.name, platform.description)
      }
    }
    
    if (guide.housing_section.tips.length > 0) {
      drawTipBox(guide.housing_section.tips, "tip")
    }
    
    if (guide.housing_section.warnings.length > 0) {
      drawTipBox(guide.housing_section.warnings, "warning")
    }
  }

  // ============ BANKING SECTION ============
  if (guide.banking_section) {
    doc.addPage()
    yPos = margin
    
    drawSectionHeader("Banking & Finances")
    
    drawParagraph(guide.banking_section.overview)
    
    if (guide.banking_section.recommendedBanks && guide.banking_section.recommendedBanks.length > 0) {
      yPos += 5
      drawSubHeader("Recommended Banks")
      for (const bank of guide.banking_section.recommendedBanks) {
        doc.setFont("helvetica", "bold")
        doc.text(`${bank.name} (${bank.type})`, margin, yPos)
        yPos += 5
        doc.setFont("helvetica", "normal")
        if (bank.features.length > 0) {
          drawBulletList(bank.features, 10)
        }
      }
    }
    
    if (guide.banking_section.requirements && guide.banking_section.requirements.length > 0) {
      drawSubHeader("Requirements")
      drawBulletList(guide.banking_section.requirements)
    }
    
    if (guide.banking_section.tips.length > 0) {
      drawTipBox(guide.banking_section.tips, "tip")
    }
  }

  // ============ HEALTHCARE SECTION ============
  if (guide.healthcare_section) {
    doc.addPage()
    yPos = margin
    
    drawSectionHeader("Healthcare")
    
    drawParagraph(guide.healthcare_section.overview)
    
    yPos += 5
    drawKeyValuePair("System Type", guide.healthcare_section.systemType)
    drawKeyValuePair("Insurance Required", guide.healthcare_section.insuranceRequired ? "Yes" : "No")
    drawKeyValuePair("Average Cost", guide.healthcare_section.averageCost)
    
    if (guide.healthcare_section.emergencyInfo) {
      yPos += 5
      drawSubHeader("Emergency Information")
      drawParagraph(guide.healthcare_section.emergencyInfo)
    }
    
    if (guide.healthcare_section.tips.length > 0) {
      drawTipBox(guide.healthcare_section.tips, "tip")
    }
  }

  // ============ CULTURE SECTION ============
  if (guide.culture_section) {
    doc.addPage()
    yPos = margin
    
    drawSectionHeader("Culture & Lifestyle")
    
    drawParagraph(guide.culture_section.overview)
    
    if (guide.culture_section.doAndDont) {
      yPos += 5
      if (guide.culture_section.doAndDont.do && guide.culture_section.doAndDont.do.length > 0) {
        drawSubHeader("Do's")
        drawBulletList(guide.culture_section.doAndDont.do)
      }
      
      if (guide.culture_section.doAndDont.dont && guide.culture_section.doAndDont.dont.length > 0) {
        drawSubHeader("Don'ts")
        drawBulletList(guide.culture_section.doAndDont.dont)
      }
    }
    
    if (guide.culture_section.languageTips && guide.culture_section.languageTips.length > 0) {
      drawSubHeader("Language Tips")
      drawBulletList(guide.culture_section.languageTips)
    }
    
    if (guide.culture_section.socialNorms && guide.culture_section.socialNorms.length > 0) {
      drawSubHeader("Social Norms")
      drawBulletList(guide.culture_section.socialNorms)
    }
  }

  // ============ TIMELINE SECTION ============
  if (guide.timeline_section && guide.timeline_section.phases) {
    doc.addPage()
    yPos = margin
    
    drawSectionHeader("Relocation Timeline")
    
    for (const phase of guide.timeline_section.phases) {
      addNewPageIfNeeded(20)
      
      // Phase header
      doc.setFillColor(...COLORS.background)
      doc.roundedRect(margin, yPos, contentWidth, 8, 2, 2, "F")
      doc.setFont("helvetica", "bold")
      doc.setFontSize(11)
      doc.setTextColor(...COLORS.primary)
      doc.text(`${phase.name} (${phase.timeframe})`, margin + 5, yPos + 5.5)
      yPos += 12
      
      doc.setTextColor(...COLORS.text)
      
      if (phase.tasks && phase.tasks.length > 0) {
        for (const task of phase.tasks) {
          addNewPageIfNeeded(8)
          
          // Checkbox
          doc.setDrawColor(...COLORS.textLight)
          doc.rect(margin + 5, yPos - 3, 4, 4)
          
          // Priority indicator
          const priorityColor = task.priority === "critical" ? COLORS.danger : 
                                task.priority === "high" ? COLORS.warning : COLORS.textLight
          doc.setFillColor(...priorityColor)
          doc.circle(margin + 15, yPos - 1, 1.5, "F")
          
          // Task text
          doc.setFont("helvetica", "normal")
          doc.setFontSize(10)
          doc.text(task.task, margin + 20, yPos)
          yPos += 7
        }
      }
      
      yPos += 5
    }
  }

  // ============ CHECKLIST SECTION ============
  if (guide.checklist_section && guide.checklist_section.categories) {
    doc.addPage()
    yPos = margin
    
    drawSectionHeader("Document Checklist")
    
    for (const category of guide.checklist_section.categories) {
      addNewPageIfNeeded(15)
      
      drawSubHeader(category.name)
      
      if (category.items && category.items.length > 0) {
        for (const item of category.items) {
          addNewPageIfNeeded(8)
          
          // Checkbox
          doc.setDrawColor(...COLORS.textLight)
          doc.rect(margin + 5, yPos - 3, 4, 4)
          
          // Task text
          doc.setFont("helvetica", "normal")
          doc.setFontSize(10)
          doc.text(item.item, margin + 15, yPos)
          yPos += 7
        }
      }
      
      yPos += 5
    }
  }

  // ============ USEFUL TIPS & LINKS ============
  if ((guide.useful_tips && guide.useful_tips.length > 0) || (guide.official_links && guide.official_links.length > 0)) {
    doc.addPage()
    yPos = margin
    
    drawSectionHeader("Additional Resources")
    
    if (guide.useful_tips && guide.useful_tips.length > 0) {
      drawSubHeader("Useful Tips")
      drawBulletList(guide.useful_tips)
    }
    
    if (guide.official_links && guide.official_links.length > 0) {
      yPos += 5
      drawSubHeader("Official Links")
      for (const link of guide.official_links) {
        addNewPageIfNeeded(10)
        doc.setFont("helvetica", "bold")
        doc.setFontSize(10)
        doc.text(link.name, margin, yPos)
        yPos += 5
        doc.setFont("helvetica", "normal")
        doc.setTextColor(...COLORS.primary)
        doc.text(link.url, margin, yPos)
        doc.setTextColor(...COLORS.text)
        yPos += 7
      }
    }
  }

  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.textLight)
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" })
  }

  return doc.output("blob")
}

export function downloadGuidePDF(guide: GuideData, filename?: string) {
  generateGuidePDF(guide).then((blob) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename || `${guide.destination.replace(/\s+/g, "-").toLowerCase()}-guide.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  })
}
