/**
 * Destination Image Service
 *
 * Resolves hero images for guides using the fallback chain:
 * 1. DB cache (country + city) → 2. DB cache (country only) →
 * 3. Unsplash search (city + country) → 4. Unsplash search (country) →
 * 5. Static placeholder
 *
 * Images are fetched from Unsplash, stored in Supabase Storage, and
 * cached in the destination_images table for permanent reuse.
 */

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { fetchWithRetry } from "./fetch-with-retry"

export interface DestinationImage {
  id: string | null
  storageUrl: string
  photographerName?: string
  photographerUrl?: string
  blurHash?: string
  width?: number
  height?: number
}

interface UnsplashPhoto {
  id: string
  urls: { regular: string; small: string; raw: string }
  links: { download_location: string }
  blur_hash: string | null
  width: number
  height: number
  user: { name: string; links: { html: string } }
}

const PLACEHOLDER_URL = "/images/guide-placeholder.jpg"

/**
 * Normalize a string into a URL-safe storage path segment.
 */
function normalizeSegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Build the storage path for a destination image.
 */
function buildStoragePath(country: string, city?: string | null): string {
  const countrySlug = normalizeSegment(country)
  const citySlug = city ? normalizeSegment(city) : "_hero"
  return `${countrySlug}/${citySlug}.jpg`
}

/**
 * Look up a cached image from the destination_images table.
 */
async function lookupCached(
  country: string,
  city?: string | null
): Promise<DestinationImage | null> {
  const supabase = await createClient()

  let query = supabase
    .from("destination_images")
    .select("id, storage_url, photographer_name, photographer_url, blur_hash, width, height")
    .ilike("country", country)

  if (city) {
    query = query.ilike("city", city)
  } else {
    query = query.is("city", null)
  }

  const { data } = await query.maybeSingle()
  if (!data) return null

  return {
    id: data.id,
    storageUrl: data.storage_url,
    photographerName: data.photographer_name ?? undefined,
    photographerUrl: data.photographer_url ?? undefined,
    blurHash: data.blur_hash ?? undefined,
    width: data.width ?? undefined,
    height: data.height ?? undefined,
  }
}

/**
 * Search Unsplash for a landscape photo matching the query.
 * Returns the first result or null.
 */
async function fetchFromUnsplash(
  query: string
): Promise<UnsplashPhoto | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) {
    console.error("[GoMate] UNSPLASH_ACCESS_KEY not set — skipping image fetch")
    return null
  }

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=1`
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    })

    if (!res.ok) {
      console.error(`[GoMate] Unsplash search failed: ${res.status}`)
      return null
    }

    const data = await res.json()
    const photo = data.results?.[0] as UnsplashPhoto | undefined
    if (!photo) return null

    // Trigger download endpoint per Unsplash API guidelines (fire-and-forget)
    fetchWithRetry(photo.links.download_location, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    }).catch(() => {})

    return photo
  } catch (err) {
    console.error("[GoMate] Unsplash search error:", err)
    return null
  }
}

/**
 * Download image from URL and upload to Supabase Storage.
 * Returns the public URL of the stored image.
 */
async function uploadToStorage(
  imageUrl: string,
  storagePath: string
): Promise<string> {
  // Download image bytes
  const res = await fetchWithRetry(imageUrl, {}, 30_000, 2)
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`)

  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Upload via service role client (bypasses RLS)
  const serviceClient = createServiceClient()
  const { error: uploadError } = await serviceClient.storage
    .from("destination-images")
    .upload(storagePath, buffer, {
      contentType: "image/jpeg",
      upsert: true,
    })

  if (uploadError) throw uploadError

  // Get public URL
  const { data: urlData } = serviceClient.storage
    .from("destination-images")
    .getPublicUrl(storagePath)

  return urlData.publicUrl
}

/**
 * Insert or update image metadata in the destination_images table.
 * Uses a check-then-insert/update pattern because the unique index
 * is expression-based and can't be used with Supabase JS upsert.
 */
async function insertMetadata(
  country: string,
  city: string | null | undefined,
  storagePath: string,
  storageUrl: string,
  photo: UnsplashPhoto
): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("[GoMate] No SUPABASE_SERVICE_ROLE_KEY — skipping DB cache for destination image")
    return ""
  }
  const serviceClient = createServiceClient()
  const cityVal = city || null

  // Check if a row already exists for this (country, city)
  let query = serviceClient
    .from("destination_images")
    .select("id")
    .ilike("country", country)

  if (cityVal) {
    query = query.ilike("city", cityVal)
  } else {
    query = query.is("city", null)
  }

  const { data: existing } = await query.maybeSingle()

  const row = {
    country,
    city: cityVal,
    storage_path: storagePath,
    storage_url: storageUrl,
    unsplash_photo_id: photo.id,
    photographer_name: photo.user.name,
    photographer_url: photo.user.links.html,
    width: photo.width,
    height: photo.height,
    blur_hash: photo.blur_hash,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await serviceClient
      .from("destination_images")
      .update(row)
      .eq("id", existing.id)
    if (error) throw error
    return existing.id
  }

  const { data, error } = await serviceClient
    .from("destination_images")
    .insert(row)
    .select("id")
    .single()

  if (error) throw error
  return data.id
}

/**
 * Fetch an image from Unsplash, upload to storage, and cache metadata.
 * Falls back to using the Unsplash URL directly if storage upload fails.
 */
async function fetchAndStore(
  searchQuery: string,
  country: string,
  city?: string | null
): Promise<DestinationImage | null> {
  const photo = await fetchFromUnsplash(searchQuery)
  if (!photo) return null

  try {
    const storagePath = buildStoragePath(country, city)
    let storageUrl: string

    // Try uploading to Supabase Storage, fall back to Unsplash URL directly
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      storageUrl = await uploadToStorage(photo.urls.regular, storagePath)
    } else {
      console.log("[GoMate] No SUPABASE_SERVICE_ROLE_KEY — using Unsplash URL directly")
      storageUrl = photo.urls.regular
    }

    const id = await insertMetadata(country, city, storagePath, storageUrl, photo)

    return {
      id,
      storageUrl,
      photographerName: photo.user.name,
      photographerUrl: photo.user.links.html,
      blurHash: photo.blur_hash ?? undefined,
      width: photo.width,
      height: photo.height,
    }
  } catch (err) {
    console.error("[GoMate] Failed to store destination image:", err)
    // Return the image with Unsplash URL directly (no DB caching)
    return {
      id: null,
      storageUrl: photo.urls.regular,
      photographerName: photo.user.name,
      photographerUrl: photo.user.links.html,
      blurHash: photo.blur_hash ?? undefined,
      width: photo.width,
      height: photo.height,
    }
  }
}

/**
 * Main entry point: resolve a hero image for a destination.
 *
 * Runs the full fallback chain:
 * 1. DB cache (country, city)
 * 2. DB cache (country, null)
 * 3. Unsplash search "{city} {country}"
 * 4. Unsplash search "{country}"
 * 5. Static placeholder
 */
export async function resolveGuideImage(
  country: string,
  city?: string | null
): Promise<DestinationImage> {
  const placeholder: DestinationImage = { id: null, storageUrl: PLACEHOLDER_URL }

  if (!country) return placeholder

  try {
    // 1. Exact cache hit (country + city)
    if (city) {
      const cached = await lookupCached(country, city)
      if (cached) return cached
    }

    // 2. Country-level cache hit
    const countryCached = await lookupCached(country, null)
    if (countryCached) return countryCached

    // 3. Unsplash search: city + country
    if (city) {
      const result = await fetchAndStore(`${city} ${country} cityscape`, country, city)
      if (result) return result
    }

    // 4. Unsplash search: country only
    const countryResult = await fetchAndStore(`${country} landscape`, country, null)
    if (countryResult) return countryResult

    // 5. Static placeholder
    return placeholder
  } catch (err) {
    console.error("[GoMate] Image resolution failed, using placeholder:", err)
    return placeholder
  }
}
