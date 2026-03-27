"use client"

import { cn } from "@/lib/utils"

interface GoMateAvatarProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

/**
 * GoMate AI avatar — branded globe + airplane mark.
 * Used in chat messages and anywhere the AI identity appears.
 */
export function GoMateAvatar({ size = "md", className }: GoMateAvatarProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  }

  return (
    <div
      className={cn(
        "shrink-0 rounded-full bg-gradient-to-br from-[#1B3A2D] to-[#2D6A4F] flex items-center justify-center shadow-sm",
        sizeClasses[size],
        className
      )}
    >
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          size === "sm" ? "w-3.5 h-3.5" : size === "md" ? "w-4.5 h-4.5" : "w-5.5 h-5.5"
        )}
      >
        {/* Globe */}
        <circle cx="16" cy="16" r="11" stroke="#5EE89C" strokeWidth="1.8" fill="none" />
        <ellipse cx="16" cy="16" rx="5" ry="11" stroke="#5EE89C" strokeWidth="1.2" fill="none" />
        <line x1="5.5" y1="12" x2="26.5" y2="12" stroke="#5EE89C" strokeWidth="1.1" />
        <line x1="5" y1="16" x2="27" y2="16" stroke="#5EE89C" strokeWidth="1.1" />
        <line x1="5.5" y1="20" x2="26.5" y2="20" stroke="#5EE89C" strokeWidth="1.1" />
        {/* Airplane swooping around globe */}
        <path
          d="M24,8 Q28,16 22,24"
          stroke="#5EE89C"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M22,24 L19.5,22 L21,26 Z"
          fill="#5EE89C"
        />
      </svg>
    </div>
  )
}
