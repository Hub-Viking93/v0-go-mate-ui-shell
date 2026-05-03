import { SchoolsCard } from "@/components/dashboard-cards/schools-card"
import { PetRelocationCard } from "@/components/dashboard-cards/pet-relocation-card"
import { IncomeComplianceCard } from "@/components/dashboard-cards/income-compliance-card"
import { FamilyReunionCard } from "@/components/dashboard-cards/family-reunion-card"
import { DepartureTaxCard } from "@/components/dashboard-cards/departure-tax-card"
import { VehicleImportCard } from "@/components/dashboard-cards/vehicle-import-card"
import { PropertyPurchaseCard } from "@/components/dashboard-cards/property-purchase-card"
import { PostedWorkerCard } from "@/components/dashboard-cards/posted-worker-card"
import { TrailingSpouseCard } from "@/components/dashboard-cards/trailing-spouse-card"
import { ChronicHealthCard } from "@/components/dashboard-cards/chronic-health-card"
import { PriorVisaHistoryCard } from "@/components/dashboard-cards/prior-visa-history-card"
import {
  sampleSchools,
  samplePet,
  sampleIncome,
  sampleFamilyReunion,
  sampleDepartureTax,
  sampleVehicle,
  sampleProperty,
  samplePostedWorker,
  sampleTrailingSpouse,
  sampleChronicHealth,
  samplePriorVisaHistory,
} from "@/components/dashboard-cards/sample-data"

const cards: Array<{ reason: string; node: React.ReactNode }> = [
  {
    reason: "You said you have 2 children",
    node: <SchoolsCard data={sampleSchools} reason="You said you have 2 children" />,
  },
  {
    reason: "You’re bringing a dog from the US",
    node: <PetRelocationCard data={samplePet} reason="You’re bringing a dog from the US" />,
  },
  {
    reason: "Digital-nomad visa under consideration",
    node: <IncomeComplianceCard data={sampleIncome} reason="Digital-nomad visa under consideration" />,
  },
  {
    reason: "You’re joining your spouse",
    node: <FamilyReunionCard data={sampleFamilyReunion} reason="You’re joining your spouse" />,
  },
  {
    reason: "Substantial assets in your origin country",
    node: <DepartureTaxCard data={sampleDepartureTax} reason="Substantial assets in your origin country" />,
  },
  {
    reason: "You said you’re shipping your car",
    node: <VehicleImportCard data={sampleVehicle} reason="You said you’re shipping your car" />,
  },
  {
    reason: "You plan to buy property in destination",
    node: <PropertyPurchaseCard data={sampleProperty} reason="You plan to buy property in destination" />,
  },
  {
    reason: "Corporate posting / secondment",
    node: <PostedWorkerCard data={samplePostedWorker} reason="Corporate posting / secondment" />,
  },
  {
    reason: "Trailing spouse — career transition",
    node: <TrailingSpouseCard data={sampleTrailingSpouse} reason="Trailing spouse — career transition" />,
  },
  {
    reason: "You flagged a chronic condition",
    node: <ChronicHealthCard data={sampleChronicHealth} reason="You flagged a chronic condition" />,
  },
  {
    reason: "Prior visa history on record",
    node: <PriorVisaHistoryCard data={samplePriorVisaHistory} reason="Prior visa history on record" />,
  },
]

export default function SpecialistCardsPreviewPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Specialist Cards Preview
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dev-only: 11 conditional dashboard cards rendered with sample data. Replaces the
            placeholder cards once specialist outputs are wired through to the dashboard.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c, i) => (
            <div key={i}>{c.node}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
