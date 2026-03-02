import React from "react"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/toaster"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <AppShell>{children}</AppShell>
      <Toaster />
    </>
  )
}
