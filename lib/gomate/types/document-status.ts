export type DocumentStatus =
  | "not_started"
  | "gathering"
  | "ready"
  | "submitted"
  | "expiring"
  | "expired"

export type DocumentStatusEntry = {
  status: DocumentStatus
  documentName?: string
  completedAt?: string
  externalLink?: string
  notes?: string
  expiryDate?: string
}

/**
 * Normalize legacy document status entries ({ completed: boolean }) to the
 * new 5-state shape. Applied on read so the frontend always receives the
 * current shape. Old data is migrated lazily on next PATCH.
 */
export function normalizeDocumentStatus(raw: unknown): DocumentStatusEntry {
  if (raw && typeof raw === "object" && "status" in raw && typeof (raw as Record<string, unknown>).status === "string") {
    return raw as DocumentStatusEntry
  }
  const legacy = raw as { completed?: boolean; completedAt?: string; documentName?: string } | null
  return {
    status: legacy?.completed ? "ready" : "not_started",
    completedAt: legacy?.completedAt,
    documentName: legacy?.documentName,
  }
}

/** Validate an external link — must be https:// if present. */
export function isValidExternalLink(url: string): boolean {
  if (!url) return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:"
  } catch {
    return false
  }
}
