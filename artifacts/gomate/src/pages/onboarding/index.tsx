// =============================================================
// /onboarding page — thin wrapper around ChatPage.
// =============================================================
// Per design feedback: the onboarding experience should be
// visually identical to the post-onboarding free-chat surface.
// The ChatPage component already handles the full lifecycle:
//
//   • interview state (pendingField + field-aware quick replies)
//   • streaming /api/chat responses with message history
//   • interviewState transitions (interview → review → complete)
//   • planLocked + onboardingCompleted metadata from the server
//   • inline GeneratePlanCta when onboardingCompleted &&
//     !planLocked (built into ChatPage)
//   • PlanProtected banner when planLocked
//
// So /onboarding just delegates. Previously this file rendered
// a parallel UI (mascot + speech bubble + WhatWeCoverInline)
// which created two surfaces to maintain and a "tiny chat in a
// big page" feel users found confusing. The legacy widgets are
// removed; ChatPage is the single source of truth for the
// conversational surface.
// =============================================================

import ChatPage from "@/pages/chat"

export default function OnboardingPage() {
  return <ChatPage />
}
