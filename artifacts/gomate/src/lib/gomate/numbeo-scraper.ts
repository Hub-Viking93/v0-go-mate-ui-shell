export interface NumbeoData {
  city?: string
  country?: string
  currency?: string
  costOfLivingIndex?: number
  rentIndex?: number
  groceriesIndex?: number
  restaurantsIndex?: number
  localPurchasingPowerIndex?: number
  monthlyExpenses?: {
    singlePerson?: number
    family?: number
  }
  rentMonthly?: {
    apartment1BedCenter?: number
    apartment1BedOutside?: number
    apartment3BedCenter?: number
    apartment3BedOutside?: number
  }
  source?: string
  url?: string
  fetchedAt?: string
  lastUpdated?: string
  // Detailed category breakdowns consumed by cost-of-living UI. The scraper
  // populates these when available; UI guards every read with optional chaining.
  rent?: {
    apartment1BedCity?: number
    apartment1BedOutside?: number
    apartment3BedCity?: number
    apartment3BedOutside?: number
  }
  utilities?: {
    basic?: number
    internet?: number
    mobile?: number
  }
  food?: {
    mealInexpensive?: number
    mealMidRange?: number
    cappuccino?: number
    milk1L?: number
    bread?: number
    eggs12?: number
  }
  transportation?: {
    monthlyPass?: number
    oneWayTicket?: number
    taxiStart?: number
    gasolinePerLiter?: number
  }
  healthcare?: {
    doctorVisit?: number
    dentistVisit?: number
  }
  fitness?: {
    gymMonthly?: number
    cinemaTicket?: number
  }
  estimatedMonthlyBudget?: {
    [householdSize: string]: { minimum: number; comfortable: number } | undefined
  }
}
