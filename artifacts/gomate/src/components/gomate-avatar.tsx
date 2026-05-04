

import { cn } from "@/lib/utils"

interface GoMateAvatarProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

/**
 * GoMate AI avatar — compact mascot head.
 *
 * Static, non-animated mini-version of the full <Mascot /> component
 * (sage wireframe globe + smiling face). Used as the message-bubble
 * avatar in chat and as the brand mark in chat headers, so the
 * conversational AI is visually anchored to the mascot users met
 * during onboarding.
 *
 * For the animated, larger mascot used in onboarding/empty states,
 * import <Mascot /> from "./mascot" instead.
 */
export function GoMateAvatar({ size = "md", className }: GoMateAvatarProps) {
  const sizeClasses = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-11 h-11",
  }

  return (
    <div
      className={cn(
        "shrink-0 rounded-full overflow-hidden flex items-center justify-center",
        sizeClasses[size],
        className,
      )}
      aria-label="GoMate"
      role="img"
    >
      <svg
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <radialGradient id="gma-shine" cx="0.35" cy="0.32" r="0.7">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sage sphere — same fill as the full mascot */}
        <circle cx="100" cy="100" r="96" fill="#A8C9A0" />
        <circle cx="100" cy="100" r="96" fill="url(#gma-shine)" />

        {/* Wireframe — same equator + meridian + soft latitudes as the
            full mascot, kept thinner so it reads at avatar sizes. */}
        <g stroke="#FFFFFF" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.95">
          <ellipse cx="100" cy="100" rx="96" ry="30" />
          <path d="M 18 78 Q 100 56 182 78" />
          <path d="M 18 122 Q 100 144 182 122" />
          <ellipse cx="100" cy="100" rx="30" ry="96" />
        </g>

        {/* Outer rim for definition (deeper sage) */}
        <circle cx="100" cy="100" r="96" fill="none" stroke="#3F6B45" strokeWidth="3" opacity="0.45" />

        {/* Face — small smiling eyes + soft mouth, mirroring the
            mascot's idle/smiling state so the avatar reads as the
            same character. */}
        <g fill="#1B3A2D">
          {/* Left eye (smiling crescent) */}
          <path d="M 70 92 Q 78 84 86 92" stroke="#1B3A2D" strokeWidth="6" fill="none" strokeLinecap="round" />
          {/* Right eye */}
          <path d="M 114 92 Q 122 84 130 92" stroke="#1B3A2D" strokeWidth="6" fill="none" strokeLinecap="round" />
        </g>
        {/* Mouth */}
        <path
          d="M 84 124 Q 100 138 116 124"
          stroke="#1B3A2D"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
