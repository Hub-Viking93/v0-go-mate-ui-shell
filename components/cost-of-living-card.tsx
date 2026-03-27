"use client"

import React from "react"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Home,
  Zap,
  ShoppingCart,
  Bus,
  Heart,
  Dumbbell,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  MapPin,
  DollarSign,
  Users,
  Info,
} from "lucide-react"
import type { NumbeoData } from "@/lib/gomate/numbeo-scraper"
import { COUNTRY_TO_CURRENCY, CURRENCY_SYMBOLS, getCurrencyFromCountry, getCurrencySymbol } from "@/lib/gomate/currency"

function getCurrencyFromCitizenship(citizenship: string | undefined): string | null {
  return getCurrencyFromCountry(citizenship)
}

interface CostOfLivingCardProps {
  country: string
  city?: string
  compareFromCity?: string
  compareFromCountry?: string
  citizenship?: string
  householdSize?: "single" | "couple" | "family4"
  onDataLoaded?: (data: NumbeoData) => void
}

interface CategoryBreakdown {
  icon: React.ReactNode
  label: string
  items: { name: string; value: number; unit?: string }[]
  total: number
  color: string
}

export function CostOfLivingCard({
  country,
  city,
  compareFromCity,
  compareFromCountry,
  citizenship,
  householdSize = "single",
  onDataLoaded,
}: CostOfLivingCardProps) {
  const [data, setData] = useState<NumbeoData | null>(null)
  const [comparison, setComparison] = useState<{
    from: NumbeoData | null
    to: NumbeoData | null
    comparison: { rentDifference: number; overallDifference: number; summary: string } | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState("overview")
  const [exchangeRate, setExchangeRate] = useState<number | null>(null)

  // Determine home currency from citizenship
  const homeCurrency = getCurrencyFromCitizenship(citizenship)
  const dataCurrency = data?.currency || "EUR"
  const needsConversion = homeCurrency && homeCurrency !== dataCurrency
  const homeSymbol = homeCurrency ? (CURRENCY_SYMBOLS[homeCurrency] || homeCurrency) : null
  const localSymbol = CURRENCY_SYMBOLS[dataCurrency] || dataCurrency

  // Format a value with optional home currency conversion
  const formatPrice = (value: number, showConversion = true): string => {
    const localFormatted = `${localSymbol}${value.toLocaleString()}`
    if (showConversion && needsConversion && exchangeRate) {
      const converted = Math.round(value * exchangeRate)
      return `${localFormatted} (~${homeSymbol}${converted.toLocaleString()})`
    }
    return localFormatted
  }

  // Fetch exchange rate when we have both currencies
  useEffect(() => {
    if (!needsConversion || !homeCurrency || !dataCurrency) return
    const controller = new AbortController()
    fetch(`https://api.frankfurter.app/latest?from=${dataCurrency}&to=${homeCurrency}`, {
      signal: controller.signal,
    })
      .then(res => res.ok ? res.json() : null)
      .then(result => {
        if (result?.rates?.[homeCurrency]) {
          setExchangeRate(result.rates[homeCurrency])
        }
      })
      .catch(() => {
        // Exchange rate fetch failed — display local currency only
      })
    return () => controller.abort()
  }, [dataCurrency, homeCurrency, needsConversion])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ country })
      if (city) params.set("city", city)
      if (compareFromCity) params.set("compareFrom", compareFromCity)
      if (compareFromCountry) params.set("compareFromCountry", compareFromCountry)

      const response = await fetch(`/api/cost-of-living?${params}`)
      
      if (!response.ok) {
        throw new Error("Failed to fetch data")
      }

      const result = await response.json()

      if (compareFromCity && compareFromCountry) {
        setComparison(result)
        setData(result.to)
        if (result.to) onDataLoaded?.(result.to)
      } else {
        setData(result)
        onDataLoaded?.(result)
      }
    } catch (err) {
      console.error("[GoMate] Cost of living fetch error:", err)
      // Don't show error, just use null state
      setError(null)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (country) {
      fetchData()
    }
  }, [country, city, compareFromCity, compareFromCountry])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-32" />
        </div>
      </Card>
    )
  }

if (!data) {
  return (
  <Card className="p-6">
  <div className="text-center py-8">
  <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
  <h3 className="font-semibold text-foreground mb-2">Cost of Living Data</h3>
  <p className="text-sm text-muted-foreground mb-4">
  {loading ? "Loading data..." : `Loading cost data for ${city || country}...`}
  </p>
  <Button variant="outline" onClick={fetchData} className="gap-2 bg-transparent">
  <RefreshCw className="w-4 h-4" />
  Refresh Data
  </Button>
  </div>
  </Card>
  )
  }

  const budget = data.estimatedMonthlyBudget?.[householdSize] || { minimum: 0, comfortable: 0 }

  const categories: CategoryBreakdown[] = [
    {
      icon: <Home className="w-5 h-5" />,
      label: "Housing",
      color: "bg-blue-500",
      total: data.rent?.apartment1BedCity || 0,
      items: [
        { name: "1-Bed Apartment (City)", value: data.rent?.apartment1BedCity || 0, unit: "/month" },
        { name: "1-Bed Apartment (Outside)", value: data.rent?.apartment1BedOutside || 0, unit: "/month" },
        { name: "3-Bed Apartment (City)", value: data.rent?.apartment3BedCity || 0, unit: "/month" },
      ],
    },
    {
      icon: <Zap className="w-5 h-5" />,
      label: "Utilities",
      color: "bg-yellow-500",
      total: (data.utilities?.basic || 0) + (data.utilities?.internet || 0) + (data.utilities?.mobile || 0),
      items: [
        { name: "Basic (Electric, Heat, Water)", value: data.utilities?.basic || 0, unit: "/month" },
        { name: "Internet", value: data.utilities?.internet || 0, unit: "/month" },
        { name: "Mobile Plan", value: data.utilities?.mobile || 0, unit: "/month" },
      ],
    },
    {
      icon: <ShoppingCart className="w-5 h-5" />,
      label: "Food & Groceries",
      color: "bg-green-500",
      total: (data.food?.mealInexpensive || 0) * 20,
      items: [
        { name: "Meal (Inexpensive Restaurant)", value: data.food?.mealInexpensive || 0 },
        { name: "Meal for 2 (Mid-Range)", value: data.food?.mealMidRange || 0 },
        { name: "Cappuccino", value: data.food?.cappuccino || 0 },
        { name: "Milk (1L)", value: data.food?.milk1L || 0 },
        { name: "Bread", value: data.food?.bread || 0 },
        { name: "Eggs (12)", value: data.food?.eggs12 || 0 },
      ],
    },
    {
      icon: <Bus className="w-5 h-5" />,
      label: "Transportation",
      color: "bg-purple-500",
      total: data.transportation?.monthlyPass || 0,
      items: [
        { name: "Monthly Transit Pass", value: data.transportation?.monthlyPass || 0 },
        { name: "One-Way Ticket", value: data.transportation?.oneWayTicket || 0 },
        { name: "Taxi Start", value: data.transportation?.taxiStart || 0 },
        { name: "Gasoline (per liter)", value: data.transportation?.gasolinePerLiter || 0 },
      ],
    },
    {
      icon: <Heart className="w-5 h-5" />,
      label: "Healthcare",
      color: "bg-red-500",
      total: data.healthcare?.doctorVisit || 0,
      items: [
        { name: "Doctor Visit", value: data.healthcare?.doctorVisit || 0 },
        { name: "Dentist Visit", value: data.healthcare?.dentistVisit || 0 },
      ],
    },
    {
      icon: <Dumbbell className="w-5 h-5" />,
      label: "Lifestyle",
      color: "bg-orange-500",
      total: data.fitness?.gymMonthly || 0,
      items: [
        { name: "Gym Monthly", value: data.fitness?.gymMonthly || 0 },
        { name: "Cinema Ticket", value: data.fitness?.cinemaTicket || 0 },
      ],
    },
  ]

  const renderDifferenceIcon = (diff: number) => {
    if (diff > 5) return <TrendingUp className="w-4 h-4 text-red-500" />
    if (diff < -5) return <TrendingDown className="w-4 h-4 text-green-500" />
    return <Minus className="w-4 h-4 text-muted-foreground" />
  }

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">
                {city || country}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Cost of Living · {data.source}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Monthly Budget Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-background/80 border border-border">
            <p className="text-xs text-muted-foreground mb-1">Minimum Budget</p>
            <p className="text-2xl font-bold text-foreground">
              {formatPrice(budget.minimum)}
              <span className="text-sm font-normal text-muted-foreground">/mo</span>
            </p>
          </div>
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-xs text-primary mb-1">Comfortable Budget</p>
            <p className="text-2xl font-bold text-primary">
              {formatPrice(budget.comfortable)}
              <span className="text-sm font-normal text-primary/70">/mo</span>
            </p>
          </div>
        </div>

        {/* Household Size Indicator */}
        <div className="flex items-center gap-2 mt-4">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {householdSize === "single" && "Single person"}
            {householdSize === "couple" && "Couple"}
            {householdSize === "family4" && "Family of 4"}
          </span>
        </div>
      </div>

      {/* Comparison Banner */}
      {comparison?.comparison && (
        <div className={`p-4 border-b ${
          comparison.comparison.overallDifference > 0 
            ? "bg-red-500/10 border-red-500/20" 
            : comparison.comparison.overallDifference < 0 
              ? "bg-green-500/10 border-green-500/20" 
              : "bg-muted"
        }`}>
          <div className="flex items-center gap-3">
            {renderDifferenceIcon(comparison.comparison.overallDifference)}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {comparison.comparison.summary}
              </p>
              <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                <span>Rent: {comparison.comparison.rentDifference > 0 ? "+" : ""}{comparison.comparison.rentDifference}%</span>
                <span>Overall: {comparison.comparison.overallDifference > 0 ? "+" : ""}{comparison.comparison.overallDifference}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="p-6">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="indices">Indices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Category Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {categories.map((cat) => (
              <div
                key={cat.label}
                className="p-3 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${cat.color} text-white`}>
                    {cat.icon}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{cat.label}</span>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {formatPrice(cat.total, false)}
                </p>
              </div>
            ))}
          </div>

          {/* Info Note */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 text-sm text-muted-foreground">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <p>
              Data sourced from Numbeo.com. Prices may vary based on specific neighborhoods and lifestyle choices.
              Last updated: {data.lastUpdated}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-6">
          {categories.map((cat) => (
            <div key={cat.label} className="space-y-3">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${cat.color} text-white`}>
                  {cat.icon}
                </div>
                <h3 className="font-medium text-foreground">{cat.label}</h3>
              </div>
              <div className="space-y-2 pl-8">
                {cat.items.map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <span className="text-sm font-medium text-foreground">
                      {formatPrice(item.value, false)}{item.unit || ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="indices" className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            Indices relative to New York City (NYC = 100). Higher values indicate higher costs.
          </p>
          
          {[
            { label: "Cost of Living Index", value: data.costOfLivingIndex, color: "bg-blue-500" },
            { label: "Rent Index", value: data.rentIndex, color: "bg-purple-500" },
            { label: "Groceries Index", value: data.groceriesIndex, color: "bg-green-500" },
            { label: "Restaurant Price Index", value: data.restaurantPriceIndex, color: "bg-orange-500" },
            { label: "Purchasing Power Index", value: data.purchasingPowerIndex, color: "bg-primary" },
          ].map((index) => (
            <div key={index.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground">{index.label}</span>
                <Badge variant={index.value > 100 ? "destructive" : index.value > 80 ? "secondary" : "default"}>
                  {index.value || "N/A"}
                </Badge>
              </div>
              {index.value > 0 && (
                <Progress value={Math.min(index.value, 150) / 1.5} className="h-2" />
              )}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </Card>
  )
}
