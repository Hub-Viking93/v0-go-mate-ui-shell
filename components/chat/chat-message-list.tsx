"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ChatMessageListProps {
  children: ReactNode
  className?: string
}

export function ChatMessageList({ children, className }: ChatMessageListProps) {
  return (
    <div className={cn(
      "flex flex-col gap-4 p-4 overflow-y-auto",
      className
    )}>
      {children}
    </div>
  )
}
