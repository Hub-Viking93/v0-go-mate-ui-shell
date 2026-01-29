"use client"

import React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Send } from "lucide-react"

interface ChatComposerProps {
  onSend?: (message: string) => void
  placeholder?: string
  disabled?: boolean
}

export function ChatComposer({ onSend, placeholder = "Type your message...", disabled }: ChatComposerProps) {
  const [message, setMessage] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && onSend) {
      onSend(message.trim())
      setMessage("")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end">
      <div className="flex-1 relative">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 min-h-[48px] max-h-[120px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e)
            }
          }}
        />
      </div>
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !message.trim()}
        className="rounded-full h-12 w-12 shrink-0"
      >
        <Send className="w-4 h-4" />
        <span className="sr-only">Send message</span>
      </Button>
    </form>
  )
}
