"use client"

import { cn } from "@/lib/utils"
import { Bot, User } from "lucide-react"

interface ChatMessageProps {
  role: "user" | "assistant"
  content: string
  timestamp?: string
}

export function ChatMessage({ role, content, timestamp }: ChatMessageProps) {
  const isAssistant = role === "assistant"
  
  return (
    <div className={cn(
      "flex gap-3",
      !isAssistant && "flex-row-reverse"
    )}>
      <div className={cn(
        "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
        isAssistant ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
      )}>
        {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
      </div>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3",
        isAssistant 
          ? "bg-card border border-border rounded-tl-md" 
          : "bg-primary text-primary-foreground rounded-tr-md"
      )}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        {timestamp && (
          <p className={cn(
            "text-xs mt-2",
            isAssistant ? "text-muted-foreground" : "text-primary-foreground/70"
          )}>
            {timestamp}
          </p>
        )}
      </div>
    </div>
  )
}
