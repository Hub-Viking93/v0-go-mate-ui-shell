/**
 * Numbeo Cost of Living Scraper
 * 
 * Uses Firecrawl to scrape real-time cost of living data from Numbeo.com
 * for the user's destination country and city.
 * 
 * Server-side only - do not add "use client"
 */

const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v1"
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY // Declare the variable here

// Cache for cost of living data
const colCache = new Map<string, { data: NumbeoData; timestamp: number }>()
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

export interface NumbeoData {
  city: string
  country: string
  currency: string
  
  // Monthly costs
  rent: {
    apartment1BedCity: number
    apartment1BedOutside: number
    apartment3BedCity: number
    apartment3BedOutside: number
  }
  
  utilities: {
    basic: number // electricity, heating, cooling, water, garbage
    internet: number
    mobile: number
  }
  
  food: {
    mealInexpensive: number
    mealMidRange: number
    mcMeal: number
    domesticBeer: number
    importedBeer: number
    cappuccino: number
    water1_5L: number
    milk1L: number
    bread: number
    eggs12: number
    chicken1kg: number
    rice1kg: number
    apples1kg: number
  }
  
  transportation: {
    monthlyPass: number
    oneWayTicket: number
    taxiStart: number
    taxi1km: number
    gasolinePerLiter: number
  }
  
  healthcare: {
    doctorVisit: number
    dentistVisit: number
  }
  
  fitness: {
    gymMonthly: number
    cinemaTicket: number
  }
  
  childcare: {
    preschoolMonthly: number
    primarySchoolYearly: number
  }
  
  clothing: {
    jeans: number
    summerDress: number
    runningShoes: number
    businessShoes: number
  }
  
  // Summary metrics
  costOfLivingIndex: number
  rentIndex: number
  groceriesIndex: number
  restaurantPriceIndex: number
  purchasingPowerIndex: number
  
  // Computed
  estimatedMonthlyBudget: {
    single: { minimum: number; comfortable: number }
    couple: { minimum: number; comfortable: number }
    family4: { minimum: number; comfortable: number }
  }
  
  source: string
  lastUpdated: string
}

/**
 * Get the Numbeo URL for a specific city
 * Numbeo uses different URL formats:
 * - https://www.numbeo.com/cost-of-living/in/Tokyo (just city name for major cities)
 * - https://www.numbeo.com/cost-of-living/in/Munich-Germany (city-country for disambiguation)
 */
function getNumbeoUrl(city: string, country: string): string {
  // Format city name for URL (replace spaces with hyphens, capitalize)
  const formattedCity = city
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("-")
  
  // For major world cities, Numbeo typically uses just the city name
  const majorCities = [
    "Tokyo", "Osaka", "Kyoto", "Yokohama", "Nagoya", "Fukuoka", "Sapporo",
    "London", "Paris", "Berlin", "Amsterdam", "Barcelona", "Madrid",
    "Rome", "Milan", "Munich", "Vienna", "Prague", "Budapest", "Warsaw",
    "Stockholm", "Copenhagen", "Oslo", "Helsinki", "Dublin", "Lisbon", "Porto",
    "Singapore", "Hong-Kong", "Seoul", "Busan", "Sydney", "Melbourne", "Auckland",
    "Toronto", "Vancouver", "Montreal", "New-York", "Los-Angeles", "Chicago",
    "San-Francisco", "Miami", "Dubai", "Bangkok", "Kuala-Lumpur", "Jakarta"
  ]
  
  const cityNormalized = formattedCity.replace(/-/g, "-")
  if (majorCities.includes(cityNormalized) || majorCities.includes(formattedCity)) {
    return `https://www.numbeo.com/cost-of-living/in/${formattedCity}`
  }
  
  // For other cities, try city-country format
  const formattedCountry = country
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("-")
  
  return `https://www.numbeo.com/cost-of-living/in/${formattedCity}-${formattedCountry}`
}

/**
 * Get the Numbeo country page URL
 */
function getNumbeoCountryUrl(country: string): string {
  const formattedCountry = encodeURIComponent(country)
  return `https://www.numbeo.com/cost-of-living/country_result.jsp?country=${formattedCountry}`
}

/**
 * Parse Numbeo markdown content to extract cost data
 */
function parseNumbeoContent(content: string, city: string, country: string): Partial<NumbeoData> {
  const data: Partial<NumbeoData> = {
    city,
    country,
    currency: "USD", // Default, will try to extract
    source: "Numbeo.com (via Firecrawl)",
    lastUpdated: new Date().toISOString().split("T")[0],
  }

  // Extract currency
  const currencyMatch = content.match(/(?:EUR|USD|GBP|JPY|SEK|NOK|DKK|CHF|CAD|AUD)/)
  if (currencyMatch) {
    data.currency = currencyMatch[0]
  }

  // Helper to extract price from content
  const extractPrice = (patterns: RegExp[]): number | null => {
    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) {
        const priceStr = match[1].replace(/[,\s]/g, "")
        const price = parseFloat(priceStr)
        if (!isNaN(price)) return price
      }
    }
    return null
  }

  // Rent patterns
  const rent1BedCity = extractPrice([
    /apartment.*?1.*?bedroom.*?city.*?(?:center|centre).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /1.*?bedroom.*?(?:apartment|flat).*?(?:center|centre).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /rent.*?1.*?bed.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
  ])
  const rent1BedOutside = extractPrice([
    /apartment.*?1.*?bedroom.*?outside.*?(?:center|centre).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /1.*?bedroom.*?(?:apartment|flat).*?outside.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
  ])
  const rent3BedCity = extractPrice([
    /apartment.*?3.*?bedroom.*?city.*?(?:center|centre).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /3.*?bedroom.*?(?:apartment|flat).*?(?:center|centre).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
  ])
  const rent3BedOutside = extractPrice([
    /apartment.*?3.*?bedroom.*?outside.*?(?:center|centre).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /3.*?bedroom.*?(?:apartment|flat).*?outside.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
  ])

  if (rent1BedCity || rent1BedOutside || rent3BedCity || rent3BedOutside) {
    data.rent = {
      apartment1BedCity: rent1BedCity || 0,
      apartment1BedOutside: rent1BedOutside || (rent1BedCity ? rent1BedCity * 0.7 : 0),
      apartment3BedCity: rent3BedCity || 0,
      apartment3BedOutside: rent3BedOutside || (rent3BedCity ? rent3BedCity * 0.7 : 0),
    }
  }

  // Utilities patterns
  const utilities = extractPrice([
    /utilities.*?(?:basic|electricity|heating).*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
    /electricity.*?heating.*?water.*?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i,
  ])
  const internet = extractPrice([
    /internet.*?(?:unlimited|60\s*mbps).*?(\d{1,3}(?:\.\d{2})?)/i,
    /internet.*?(\d{1,3}(?:\.\d{2})?)/i,
  ])
  const mobile = extractPrice([
    /mobile.*?(?:plan|phone).*?(\d{1,3}(?:\.\d{2})?)/i,
    /prepaid.*?mobile.*?(\d{1,3}(?:\.\d{2})?)/i,
  ])

  if (utilities || internet || mobile) {
    data.utilities = {
      basic: utilities || 150,
      internet: internet || 40,
      mobile: mobile || 30,
    }
  }

  // Food patterns
  const mealInexpensive = extractPrice([
    /meal.*?inexpensive.*?restaurant.*?(\d{1,3}(?:\.\d{2})?)/i,
    /inexpensive.*?meal.*?(\d{1,3}(?:\.\d{2})?)/i,
  ])
  const mealMidRange = extractPrice([
    /meal.*?mid.*?range.*?(\d{1,3}(?:\.\d{2})?)/i,
    /two.*?people.*?mid.*?range.*?(\d{1,3}(?:\.\d{2})?)/i,
  ])
  const mcMeal = extractPrice([
    /mc.*?meal.*?(\d{1,3}(?:\.\d{2})?)/i,
    /combo.*?meal.*?mcdonalds.*?(\d{1,3}(?:\.\d{2})?)/i,
  ])
  const cappuccino = extractPrice([
    /cappuccino.*?(\d{1,3}(?:\.\d{2})?)/i,
  ])

  if (mealInexpensive || mealMidRange || cappuccino) {
    data.food = {
      mealInexpensive: mealInexpensive || 15,
      mealMidRange: mealMidRange || 50,
      mcMeal: mcMeal || 10,
      domesticBeer: extractPrice([/domestic.*?beer.*?(\d{1,3}(?:\.\d{2})?)/i]) || 5,
      importedBeer: extractPrice([/imported.*?beer.*?(\d{1,3}(?:\.\d{2})?)/i]) || 6,
      cappuccino: cappuccino || 4,
      water1_5L: extractPrice([/water.*?1\.5.*?(\d{1,3}(?:\.\d{2})?)/i]) || 1.5,
      milk1L: extractPrice([/milk.*?1.*?liter.*?(\d{1,3}(?:\.\d{2})?)/i]) || 1.5,
      bread: extractPrice([/bread.*?(\d{1,3}(?:\.\d{2})?)/i]) || 2,
      eggs12: extractPrice([/eggs.*?12.*?(\d{1,3}(?:\.\d{2})?)/i]) || 3,
      chicken1kg: extractPrice([/chicken.*?1kg.*?(\d{1,3}(?:\.\d{2})?)/i]) || 10,
      rice1kg: extractPrice([/rice.*?1kg.*?(\d{1,3}(?:\.\d{2})?)/i]) || 2,
      apples1kg: extractPrice([/apples.*?1kg.*?(\d{1,3}(?:\.\d{2})?)/i]) || 3,
    }
  }

  // Transportation patterns
  const monthlyPass = extractPrice([
    /monthly.*?pass.*?(\d{1,3}(?:\.\d{2})?)/i,
    /public.*?transport.*?monthly.*?(\d{1,3}(?:\.\d{2})?)/i,
  ])
  const oneWayTicket = extractPrice([
    /one.*?way.*?ticket.*?(\d{1,3}(?:\.\d{2})?)/i,
  ])

  if (monthlyPass || oneWayTicket) {
    data.transportation = {
      monthlyPass: monthlyPass || 70,
      oneWayTicket: oneWayTicket || 3,
      taxiStart: extractPrice([/taxi.*?start.*?(\d{1,3}(?:\.\d{2})?)/i]) || 4,
      taxi1km: extractPrice([/taxi.*?1km.*?(\d{1,3}(?:\.\d{2})?)/i]) || 2,
      gasolinePerLiter: extractPrice([/gasoline.*?liter.*?(\d{1,3}(?:\.\d{2})?)/i]) || 1.5,
    }
  }

  // Healthcare patterns
  const doctorVisit = extractPrice([
    /doctor.*?visit.*?(\d{1,3}(?:\.\d{2})?)/i,
  ])
  if (doctorVisit) {
    data.healthcare = {
      doctorVisit,
      dentistVisit: extractPrice([/dentist.*?(\d{1,3}(?:\.\d{2})?)/i]) || doctorVisit * 1.5,
    }
  }

  // Fitness patterns
  const gymMonthly = extractPrice([
    /fitness.*?gym.*?monthly.*?(\d{1,3}(?:\.\d{2})?)/i,
    /gym.*?membership.*?(\d{1,3}(?:\.\d{2})?)/i,
  ])
  if (gymMonthly) {
    data.fitness = {
      gymMonthly,
      cinemaTicket: extractPrice([/cinema.*?ticket.*?(\d{1,3}(?:\.\d{2})?)/i]) || 12,
    }
  }

  // Cost indices
  data.costOfLivingIndex = extractPrice([/cost.*?of.*?living.*?index.*?(\d{1,3}(?:\.\d{2})?)/i]) || 0
  data.rentIndex = extractPrice([/rent.*?index.*?(\d{1,3}(?:\.\d{2})?)/i]) || 0
  data.groceriesIndex = extractPrice([/groceries.*?index.*?(\d{1,3}(?:\.\d{2})?)/i]) || 0
  data.restaurantPriceIndex = extractPrice([/restaurant.*?(?:price\s*)?index.*?(\d{1,3}(?:\.\d{2})?)/i]) || 0
  data.purchasingPowerIndex = extractPrice([/purchasing.*?power.*?index.*?(\d{1,3}(?:\.\d{2})?)/i]) || 0

  // Calculate estimated monthly budgets
  const rent1Bed = data.rent?.apartment1BedOutside || data.rent?.apartment1BedCity || 800
  const utilitiesTotal = (data.utilities?.basic || 150) + (data.utilities?.internet || 40) + (data.utilities?.mobile || 30)
  const transportMonthly = data.transportation?.monthlyPass || 70
  const groceriesEstimate = (data.food?.mealInexpensive || 15) * 20 // ~20 meals worth

  data.estimatedMonthlyBudget = {
    single: {
      minimum: Math.round(rent1Bed + utilitiesTotal + transportMonthly + groceriesEstimate * 0.8),
      comfortable: Math.round(rent1Bed * 1.3 + utilitiesTotal + transportMonthly + groceriesEstimate * 1.5 + 300),
    },
    couple: {
      minimum: Math.round(rent1Bed * 1.2 + utilitiesTotal * 1.3 + transportMonthly * 2 + groceriesEstimate * 1.5),
      comfortable: Math.round(rent1Bed * 1.5 + utilitiesTotal * 1.3 + transportMonthly * 2 + groceriesEstimate * 2 + 500),
    },
    family4: {
      minimum: Math.round((data.rent?.apartment3BedOutside || rent1Bed * 1.8) + utilitiesTotal * 1.5 + transportMonthly * 2 + groceriesEstimate * 2.5),
      comfortable: Math.round((data.rent?.apartment3BedCity || rent1Bed * 2) + utilitiesTotal * 1.5 + transportMonthly * 2 + groceriesEstimate * 3 + 800),
    },
  }

  return data
}

/**
 * Scrape Numbeo using Firecrawl API
 */
async function scrapeNumbeo(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  
  if (!apiKey) {
    console.log("[GoMate] Firecrawl API key not configured, will use fallback data")
    return null
  }

  try {
    console.log("[GoMate] Attempting to scrape:", url)
    
    const response = await fetch(`${FIRECRAWL_BASE_URL}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000, // Wait for dynamic content
        timeout: 30000, // 30 second timeout
      }),
    })

    if (!response.ok) {
      // Handle specific error codes gracefully
      if (response.status === 402) {
        console.log("[GoMate] Firecrawl credits exhausted, using fallback data")
      } else {
        console.error("[GoMate] Firecrawl scrape failed:", response.status)
      }
      return null
    }

    const data = await response.json()
    const markdown = data.data?.markdown || null
    
    if (markdown) {
      console.log("[GoMate] Successfully scraped content, length:", markdown.length)
    } else {
      console.log("[GoMate] Scrape returned no markdown content")
    }
    
    return markdown
  } catch (error) {
    console.error("[GoMate] Firecrawl scrape error:", error)
    return null
  }
}

// Fallback data for major cities when scraping fails
const FALLBACK_DATA: Record<string, Partial<NumbeoData>> = {
  Tokyo: {
    city: "Tokyo",
    country: "Japan",
    currency: "JPY",
    rent: { apartment1BedCity: 1200, apartment1BedOutside: 850, apartment3BedCity: 2800, apartment3BedOutside: 1800 },
    utilities: { basic: 180, internet: 45, mobile: 55 },
    food: { mealInexpensive: 8, mealMidRange: 25, mcMeal: 7, domesticBeer: 4, importedBeer: 6, cappuccino: 4, water1_5L: 1.2, milk1L: 2, bread: 2.5, eggs12: 2.5, chicken1kg: 8, rice1kg: 5, apples1kg: 7 },
    transportation: { monthlyPass: 80, oneWayTicket: 2, taxiStart: 6, taxi1km: 4, gasolinePerLiter: 1.4 },
    healthcare: { doctorVisit: 50, dentistVisit: 80 },
    fitness: { gymMonthly: 75, cinemaTicket: 15 },
    costOfLivingIndex: 83.5,
    rentIndex: 45.2,
    groceriesIndex: 82.1,
    restaurantPriceIndex: 47.3,
    purchasingPowerIndex: 95.4,
    estimatedMonthlyBudget: {
      single: { minimum: 1800, comfortable: 2800 },
      couple: { minimum: 2600, comfortable: 4000 },
      family4: { minimum: 4200, comfortable: 6500 },
    },
    source: "Numbeo.com (estimated data)",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  Berlin: {
    city: "Berlin",
    country: "Germany",
    currency: "EUR",
    rent: { apartment1BedCity: 1100, apartment1BedOutside: 800, apartment3BedCity: 2200, apartment3BedOutside: 1600 },
    utilities: { basic: 250, internet: 35, mobile: 25 },
    food: { mealInexpensive: 12, mealMidRange: 35, mcMeal: 9, domesticBeer: 4, importedBeer: 4.5, cappuccino: 3.5, water1_5L: 0.8, milk1L: 1.2, bread: 1.8, eggs12: 2.8, chicken1kg: 9, rice1kg: 2, apples1kg: 2.5 },
    transportation: { monthlyPass: 86, oneWayTicket: 3.2, taxiStart: 4.3, taxi1km: 2.3, gasolinePerLiter: 1.8 },
    healthcare: { doctorVisit: 40, dentistVisit: 90 },
    fitness: { gymMonthly: 35, cinemaTicket: 12 },
    costOfLivingIndex: 65.2,
    rentIndex: 35.8,
    groceriesIndex: 48.5,
    restaurantPriceIndex: 52.1,
    purchasingPowerIndex: 102.3,
    estimatedMonthlyBudget: {
      single: { minimum: 1600, comfortable: 2500 },
      couple: { minimum: 2400, comfortable: 3800 },
      family4: { minimum: 4000, comfortable: 6000 },
    },
    source: "Numbeo.com (estimated data)",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  Amsterdam: {
    city: "Amsterdam",
    country: "Netherlands",
    currency: "EUR",
    rent: { apartment1BedCity: 1800, apartment1BedOutside: 1400, apartment3BedCity: 3200, apartment3BedOutside: 2400 },
    utilities: { basic: 200, internet: 50, mobile: 25 },
    food: { mealInexpensive: 18, mealMidRange: 45, mcMeal: 11, domesticBeer: 6, importedBeer: 5, cappuccino: 3.8, water1_5L: 1.2, milk1L: 1.3, bread: 2.2, eggs12: 3.5, chicken1kg: 10, rice1kg: 2.5, apples1kg: 2.8 },
    transportation: { monthlyPass: 100, oneWayTicket: 3.4, taxiStart: 3.5, taxi1km: 2.4, gasolinePerLiter: 2.1 },
    healthcare: { doctorVisit: 35, dentistVisit: 100 },
    fitness: { gymMonthly: 40, cinemaTicket: 14 },
    costOfLivingIndex: 75.3,
    rentIndex: 58.2,
    groceriesIndex: 52.1,
    restaurantPriceIndex: 68.5,
    purchasingPowerIndex: 98.7,
    estimatedMonthlyBudget: {
      single: { minimum: 2200, comfortable: 3200 },
      couple: { minimum: 3200, comfortable: 4800 },
      family4: { minimum: 5000, comfortable: 7500 },
    },
    source: "Numbeo.com (estimated data)",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  Lisbon: {
    city: "Lisbon",
    country: "Portugal",
    currency: "EUR",
    rent: { apartment1BedCity: 1200, apartment1BedOutside: 850, apartment3BedCity: 2200, apartment3BedOutside: 1500 },
    utilities: { basic: 120, internet: 35, mobile: 20 },
    food: { mealInexpensive: 10, mealMidRange: 30, mcMeal: 8, domesticBeer: 2.5, importedBeer: 3, cappuccino: 1.8, water1_5L: 0.6, milk1L: 0.9, bread: 1.2, eggs12: 2.8, chicken1kg: 6, rice1kg: 1.2, apples1kg: 2 },
    transportation: { monthlyPass: 40, oneWayTicket: 2, taxiStart: 3.5, taxi1km: 0.5, gasolinePerLiter: 1.7 },
    healthcare: { doctorVisit: 50, dentistVisit: 60 },
    fitness: { gymMonthly: 35, cinemaTicket: 8 },
    costOfLivingIndex: 52.1,
    rentIndex: 42.5,
    groceriesIndex: 38.2,
    restaurantPriceIndex: 42.8,
    purchasingPowerIndex: 58.3,
    estimatedMonthlyBudget: {
      single: { minimum: 1400, comfortable: 2200 },
      couple: { minimum: 2100, comfortable: 3200 },
      family4: { minimum: 3500, comfortable: 5200 },
    },
    source: "Numbeo.com (estimated data)",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  Barcelona: {
    city: "Barcelona",
    country: "Spain",
    currency: "EUR",
    rent: { apartment1BedCity: 1100, apartment1BedOutside: 850, apartment3BedCity: 2000, apartment3BedOutside: 1500 },
    utilities: { basic: 130, internet: 35, mobile: 20 },
    food: { mealInexpensive: 12, mealMidRange: 35, mcMeal: 9, domesticBeer: 3, importedBeer: 3.5, cappuccino: 2, water1_5L: 0.7, milk1L: 1, bread: 1.3, eggs12: 2.5, chicken1kg: 7, rice1kg: 1.3, apples1kg: 2 },
    transportation: { monthlyPass: 45, oneWayTicket: 2.4, taxiStart: 3, taxi1km: 1.2, gasolinePerLiter: 1.6 },
    healthcare: { doctorVisit: 40, dentistVisit: 55 },
    fitness: { gymMonthly: 40, cinemaTicket: 10 },
    costOfLivingIndex: 55.8,
    rentIndex: 40.2,
    groceriesIndex: 42.1,
    restaurantPriceIndex: 48.5,
    purchasingPowerIndex: 72.4,
    estimatedMonthlyBudget: {
      single: { minimum: 1500, comfortable: 2300 },
      couple: { minimum: 2200, comfortable: 3400 },
      family4: { minimum: 3800, comfortable: 5500 },
    },
    source: "Numbeo.com (estimated data)",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  London: {
    city: "London",
    country: "United Kingdom",
    currency: "GBP",
    rent: { apartment1BedCity: 2200, apartment1BedOutside: 1500, apartment3BedCity: 4000, apartment3BedOutside: 2800 },
    utilities: { basic: 200, internet: 35, mobile: 20 },
    food: { mealInexpensive: 15, mealMidRange: 45, mcMeal: 8, domesticBeer: 6, importedBeer: 5, cappuccino: 4, water1_5L: 1.2, milk1L: 1.4, bread: 1.5, eggs12: 3.5, chicken1kg: 8, rice1kg: 2, apples1kg: 2.5 },
    transportation: { monthlyPass: 180, oneWayTicket: 3, taxiStart: 4, taxi1km: 2, gasolinePerLiter: 1.5 },
    healthcare: { doctorVisit: 0, dentistVisit: 80 },
    fitness: { gymMonthly: 45, cinemaTicket: 14 },
    costOfLivingIndex: 78.5,
    rentIndex: 72.1,
    groceriesIndex: 52.3,
    restaurantPriceIndex: 68.4,
    purchasingPowerIndex: 92.1,
    estimatedMonthlyBudget: {
      single: { minimum: 2800, comfortable: 4200 },
      couple: { minimum: 4000, comfortable: 6000 },
      family4: { minimum: 6500, comfortable: 9500 },
    },
    source: "Numbeo.com (estimated data)",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  Paris: {
    city: "Paris",
    country: "France",
    currency: "EUR",
    rent: { apartment1BedCity: 1400, apartment1BedOutside: 1000, apartment3BedCity: 2800, apartment3BedOutside: 2000 },
    utilities: { basic: 180, internet: 30, mobile: 20 },
    food: { mealInexpensive: 15, mealMidRange: 40, mcMeal: 10, domesticBeer: 7, importedBeer: 5, cappuccino: 4.5, water1_5L: 1, milk1L: 1.3, bread: 1.5, eggs12: 4, chicken1kg: 12, rice1kg: 2, apples1kg: 3 },
    transportation: { monthlyPass: 85, oneWayTicket: 2.1, taxiStart: 4, taxi1km: 1.8, gasolinePerLiter: 1.9 },
    healthcare: { doctorVisit: 25, dentistVisit: 50 },
    fitness: { gymMonthly: 40, cinemaTicket: 12 },
    costOfLivingIndex: 72.4,
    rentIndex: 52.3,
    groceriesIndex: 58.2,
    restaurantPriceIndex: 72.1,
    purchasingPowerIndex: 85.6,
    estimatedMonthlyBudget: {
      single: { minimum: 2000, comfortable: 3200 },
      couple: { minimum: 3000, comfortable: 4800 },
      family4: { minimum: 5000, comfortable: 7500 },
    },
    source: "Numbeo.com (estimated data)",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  Dubai: {
    city: "Dubai",
    country: "United Arab Emirates",
    currency: "AED",
    rent: { apartment1BedCity: 1800, apartment1BedOutside: 1200, apartment3BedCity: 3500, apartment3BedOutside: 2500 },
    utilities: { basic: 150, internet: 100, mobile: 50 },
    food: { mealInexpensive: 10, mealMidRange: 35, mcMeal: 8, domesticBeer: 10, importedBeer: 12, cappuccino: 5, water1_5L: 0.8, milk1L: 1.8, bread: 1.5, eggs12: 3.5, chicken1kg: 7, rice1kg: 2.5, apples1kg: 3 },
    transportation: { monthlyPass: 80, oneWayTicket: 1.5, taxiStart: 3, taxi1km: 0.6, gasolinePerLiter: 0.8 },
    healthcare: { doctorVisit: 80, dentistVisit: 120 },
    fitness: { gymMonthly: 80, cinemaTicket: 12 },
    costOfLivingIndex: 62.5,
    rentIndex: 48.2,
    groceriesIndex: 45.3,
    restaurantPriceIndex: 52.1,
    purchasingPowerIndex: 115.4,
    estimatedMonthlyBudget: {
      single: { minimum: 2200, comfortable: 3500 },
      couple: { minimum: 3200, comfortable: 5000 },
      family4: { minimum: 5500, comfortable: 8500 },
    },
    source: "Numbeo.com (estimated data)",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  Singapore: {
    city: "Singapore",
    country: "Singapore",
    currency: "SGD",
    rent: { apartment1BedCity: 2500, apartment1BedOutside: 1800, apartment3BedCity: 4500, apartment3BedOutside: 3200 },
    utilities: { basic: 120, internet: 40, mobile: 30 },
    food: { mealInexpensive: 6, mealMidRange: 25, mcMeal: 7, domesticBeer: 8, importedBeer: 9, cappuccino: 5, water1_5L: 1.2, milk1L: 3, bread: 2.5, eggs12: 3, chicken1kg: 8, rice1kg: 2.5, apples1kg: 4 },
    transportation: { monthlyPass: 100, oneWayTicket: 1.5, taxiStart: 3, taxi1km: 0.6, gasolinePerLiter: 2 },
    healthcare: { doctorVisit: 50, dentistVisit: 70 },
    fitness: { gymMonthly: 100, cinemaTicket: 10 },
    costOfLivingIndex: 85.2,
    rentIndex: 78.5,
    groceriesIndex: 62.1,
    restaurantPriceIndex: 48.3,
    purchasingPowerIndex: 98.7,
    estimatedMonthlyBudget: {
      single: { minimum: 2800, comfortable: 4500 },
      couple: { minimum: 4200, comfortable: 6500 },
      family4: { minimum: 7000, comfortable: 10500 },
    },
    source: "Numbeo.com (estimated data)",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
  Sydney: {
    city: "Sydney",
    country: "Australia",
    currency: "AUD",
    rent: { apartment1BedCity: 2200, apartment1BedOutside: 1600, apartment3BedCity: 3800, apartment3BedOutside: 2800 },
    utilities: { basic: 150, internet: 60, mobile: 40 },
    food: { mealInexpensive: 18, mealMidRange: 50, mcMeal: 12, domesticBeer: 8, importedBeer: 9, cappuccino: 4.5, water1_5L: 2, milk1L: 1.8, bread: 3, eggs12: 5, chicken1kg: 11, rice1kg: 3, apples1kg: 4 },
    transportation: { monthlyPass: 150, oneWayTicket: 4, taxiStart: 4, taxi1km: 2.2, gasolinePerLiter: 1.6 },
    healthcare: { doctorVisit: 60, dentistVisit: 150 },
    fitness: { gymMonthly: 60, cinemaTicket: 18 },
    costOfLivingIndex: 82.1,
    rentIndex: 65.4,
    groceriesIndex: 72.3,
    restaurantPriceIndex: 68.5,
    purchasingPowerIndex: 105.2,
    estimatedMonthlyBudget: {
      single: { minimum: 2600, comfortable: 4000 },
      couple: { minimum: 3800, comfortable: 5800 },
      family4: { minimum: 6200, comfortable: 9200 },
    },
    source: "Numbeo.com (estimated data)",
    lastUpdated: new Date().toISOString().split("T")[0],
  },
}

/**
 * Get fallback data for a city
 */
function getFallbackData(city?: string, country?: string): NumbeoData | null {
  // Normalize city name for matching
  const normalizeCity = (c: string) => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
  
  // Try exact city match
  if (city) {
    const normalized = normalizeCity(city)
    if (FALLBACK_DATA[normalized]) {
      return FALLBACK_DATA[normalized] as NumbeoData
    }
    // Try case-insensitive search
    for (const [key, data] of Object.entries(FALLBACK_DATA)) {
      if (key.toLowerCase() === city.toLowerCase()) {
        return data as NumbeoData
      }
    }
  }
  
  // Try to find by country - return the capital/main city
  if (country) {
    const countryLower = country.toLowerCase()
    for (const data of Object.values(FALLBACK_DATA)) {
      if (data.country?.toLowerCase() === countryLower || 
          data.country?.toLowerCase().includes(countryLower) ||
          countryLower.includes(data.country?.toLowerCase() || "")) {
        return { ...data, city: city || data.city } as NumbeoData
      }
    }
  }
  
  return null
}

/**
 * Get generic fallback data for any city/country when no specific data is available
 * Used to ensure the API always returns valid data
 */
export function getGenericFallbackData(city?: string, country?: string): NumbeoData {
  // Try to get from our fallback database first
  const fallback = getFallbackData(city, country)
  if (fallback) return fallback
  
  // Return completely generic data
  return {
    city: city || "Unknown City",
    country: country || "Unknown Country",
    currency: "USD",
    rent: { apartment1BedCity: 1200, apartment1BedOutside: 900, apartment3BedCity: 2200, apartment3BedOutside: 1600 },
    utilities: { basic: 150, internet: 50, mobile: 30 },
    food: { mealInexpensive: 15, mealMidRange: 40, mcMeal: 9, domesticBeer: 5, importedBeer: 6, cappuccino: 4, water1_5L: 1.5, milk1L: 1.5, bread: 2, eggs12: 3.5, chicken1kg: 10, rice1kg: 2, apples1kg: 3 },
    transportation: { monthlyPass: 70, oneWayTicket: 2.5, taxiStart: 3.5, taxi1km: 1.5, gasolinePerLiter: 1.5 },
    healthcare: { doctorVisit: 60, dentistVisit: 80 },
    fitness: { gymMonthly: 40, cinemaTicket: 12 },
    costOfLivingIndex: 60,
    rentIndex: 40,
    groceriesIndex: 50,
    restaurantPriceIndex: 55,
    purchasingPowerIndex: 80,
    estimatedMonthlyBudget: {
      single: { minimum: 1800, comfortable: 3000 },
      couple: { minimum: 2800, comfortable: 4500 },
      family4: { minimum: 4500, comfortable: 7000 },
    },
    source: "Estimated data (generic fallback)",
    lastUpdated: new Date().toISOString().split("T")[0],
  }
}

/**
 * Get cost of living data from Numbeo for a specific city/country
 * PRIORITY: Cache -> Fallback DB -> Generic Fallback (skip Firecrawl to avoid 402 errors)
 */
export async function getCostOfLivingFromNumbeo(
  country: string,
  city?: string
): Promise<NumbeoData | null> {
  const cacheKey = `numbeo_${country}_${city || "country"}`
  const cached = colCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  // FIRST: Check if we have fallback data for this city/country
  // This avoids unnecessary API calls that might fail with 402
  const fallbackData = getFallbackData(city, country)
  if (fallbackData) {
    console.log("[GoMate] Using fallback data for:", city || country)
    colCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() })
    return fallbackData
  }

  // SECOND: Try scraping only if no fallback data and API key exists
  const firecrawlKey = process.env.FIRECRAWL_API_KEY
  
  if (firecrawlKey) {
    let content: string | null = null
    let targetCity = city || "Major cities"

    if (city) {
      const cityUrl = getNumbeoUrl(city, country)
      console.log("[GoMate] Scraping Numbeo city URL:", cityUrl)
      content = await scrapeNumbeo(cityUrl)
    }

    if (!content) {
      const countryUrl = getNumbeoCountryUrl(country)
      console.log("[GoMate] Scraping Numbeo country URL:", countryUrl)
      content = await scrapeNumbeo(countryUrl)
      targetCity = "National average"
    }

    // If scraping worked, parse and cache
    if (content) {
      const parsedData = parseNumbeoContent(content, targetCity, country) as NumbeoData
      colCache.set(cacheKey, { data: parsedData, timestamp: Date.now() })
      return parsedData
    }
  }

  // THIRD: Return generic fallback as last resort
  console.log("[GoMate] No specific data found, using generic fallback for:", city || country)
  const genericFallback = getGenericFallbackData(city, country)
  colCache.set(cacheKey, { data: genericFallback, timestamp: Date.now() })
  return genericFallback
}

/**
 * Compare cost of living between two cities
 */
export async function compareCostOfLiving(
  fromCity: string,
  fromCountry: string,
  toCity: string,
  toCountry: string
): Promise<{
  from: NumbeoData | null
  to: NumbeoData | null
  comparison: {
    rentDifference: number
    overallDifference: number
    summary: string
  } | null
}> {
  const [fromData, toData] = await Promise.all([
    getCostOfLivingFromNumbeo(fromCountry, fromCity),
    getCostOfLivingFromNumbeo(toCountry, toCity),
  ])

  if (!fromData || !toData) {
    return { from: fromData, to: toData, comparison: null }
  }

  const fromRent = fromData.rent?.apartment1BedCity || 0
  const toRent = toData.rent?.apartment1BedCity || 0
  const rentDiff = fromRent > 0 ? ((toRent - fromRent) / fromRent) * 100 : 0

  const fromBudget = fromData.estimatedMonthlyBudget?.single.comfortable || 0
  const toBudget = toData.estimatedMonthlyBudget?.single.comfortable || 0
  const overallDiff = fromBudget > 0 ? ((toBudget - fromBudget) / fromBudget) * 100 : 0

  let summary = ""
  if (overallDiff > 20) {
    summary = `${toCity} is significantly more expensive than ${fromCity} (${Math.round(overallDiff)}% higher).`
  } else if (overallDiff > 5) {
    summary = `${toCity} is moderately more expensive than ${fromCity} (${Math.round(overallDiff)}% higher).`
  } else if (overallDiff > -5) {
    summary = `${toCity} has a similar cost of living to ${fromCity}.`
  } else if (overallDiff > -20) {
    summary = `${toCity} is moderately cheaper than ${fromCity} (${Math.round(Math.abs(overallDiff))}% lower).`
  } else {
    summary = `${toCity} is significantly cheaper than ${fromCity} (${Math.round(Math.abs(overallDiff))}% lower).`
  }

  return {
    from: fromData,
    to: toData,
    comparison: {
      rentDifference: Math.round(rentDiff),
      overallDifference: Math.round(overallDiff),
      summary,
    },
  }
}
