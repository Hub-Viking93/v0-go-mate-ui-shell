// =============================================================
// /checklist — legacy back-compat redirect
// =============================================================
// The IA refresh split this page across three top-level workspaces:
//   • /pre-move   — PreDepartureTimeline (formerly tab=pre-move)
//   • /post-move  — SettlingInPage       (formerly tab=post-move)
//   • /documents  — Vault + Requirements (formerly tab=documents)
//
// We keep /checklist mounted for any deep links + components that
// still reference it (notification target_route, action-link cards,
// etc.). Query-param ?tab=… resolves to the right new destination.
// =============================================================

import { useEffect } from "react";
import { useLocation } from "wouter";

export default function ChecklistPage() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const target =
      tab === "post-move"
        ? "/post-move"
        : tab === "documents"
          ? "/documents#requirements"
          : "/pre-move";
    setLocation(target, { replace: true });
  }, [setLocation]);
  return null;
}
