import { createContext, useContext, type ReactNode } from "react"

/**
 * Lightweight context that provides ambient identifiers used by the audit
 * popover when the connected <AuditIcon /> component fetches /api/agent-audit.
 * Wrap dashboards / guide pages in <DashboardAuditProvider />.
 */
export interface DashboardAuditContextValue {
  profileId: string | null
  guideId: string | null
}

const DashboardAuditContext = createContext<DashboardAuditContextValue>({
  profileId: null,
  guideId: null,
})

export function DashboardAuditProvider({
  profileId,
  guideId,
  children,
}: {
  profileId: string | null
  guideId?: string | null
  children: ReactNode
}) {
  return (
    <DashboardAuditContext.Provider value={{ profileId, guideId: guideId ?? null }}>
      {children}
    </DashboardAuditContext.Provider>
  )
}

export function useDashboardAudit(): DashboardAuditContextValue {
  return useContext(DashboardAuditContext)
}
