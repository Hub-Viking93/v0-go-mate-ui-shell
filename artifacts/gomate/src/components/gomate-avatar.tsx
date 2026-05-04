

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface GoMateAvatarProps {
  size?: "sm" | "md" | "lg"
  className?: string
  /** Disable the idle bob + blink animation. Useful inside dense
   *  message lists where 50 bobbing avatars would feel busy. */
  static?: boolean
}

/**
 * GoMate AI avatar — compact mascot head with idle animation.
 *
 * Static appearance mirrors the full <Mascot /> component (sage
 * sphere with wireframe + smiling face). Gentle idle animation:
 * a soft up/down bob plus an occasional blink, so the avatar
 * reads as the same character users met during onboarding.
 *
 * For the large, full-state-machine mascot used in onboarding
 * empty states or hero areas, import <Mascot /> from "./mascot".
 */
export function GoMateAvatar({ size = "md", className, static: isStatic }: GoMateAvatarProps) {
  const sizeClasses = {
    sm: "w-7 h-7",
    md: "w-9 h-9",
    lg: "w-11 h-11",
  }

  return (
    <motion.div
      className={cn(
        "shrink-0 rounded-full overflow-hidden flex items-center justify-center",
        sizeClasses[size],
        className,
      )}
      aria-label="GoMate"
      role="img"
      animate={
        isStatic
          ? undefined
          : {
              y: [0, -1.5, 0, 1, 0],
            }
      }
      transition={
        isStatic
          ? undefined
          : {
              duration: 3.6,
              repeat: Infinity,
              ease: "easeInOut",
            }
      }
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

        {/* Eyes — two layers cross-faded for the blink so pupils
            don't visibly slide upward. Open layer (round pupils +
            whites + highlight) fades out for one frame; closed
            layer (short horizontal lines at the same y) fades in.
            No vertical translation — only opacity changes — so the
            eyes "change shape" rather than shift position. */}
        <motion.g
          animate={
            isStatic
              ? undefined
              : {
                  opacity: [1, 1, 0, 1, 1],
                }
          }
          transition={
            isStatic
              ? undefined
              : {
                  duration: 5.4,
                  times: [0, 0.94, 0.97, 1, 1],
                  repeat: Infinity,
                  ease: "easeInOut",
                }
          }
        >
          {/* Eye whites */}
          <circle cx="78" cy="92" r="11" fill="#FFFFFF" opacity="0.85" />
          <circle cx="122" cy="92" r="11" fill="#FFFFFF" opacity="0.85" />
          {/* Pupils — bumped up from r=5.5 to r=7 for stronger
              expression at small avatar sizes. */}
          <circle cx="78" cy="92" r="7" fill="#1B3A2D" />
          <circle cx="122" cy="92" r="7" fill="#1B3A2D" />
          {/* Highlight catchlight */}
          <circle cx="80.5" cy="89" r="2" fill="#FFFFFF" />
          <circle cx="124.5" cy="89" r="2" fill="#FFFFFF" />
        </motion.g>
        {/* Closed-eye lines — sit at the same y as the open
            pupils, so when the open layer fades out and these
            fade in the eyes look like they "shut" in place. */}
        <motion.g
          animate={
            isStatic
              ? undefined
              : {
                  opacity: [0, 0, 1, 0, 0],
                }
          }
          transition={
            isStatic
              ? undefined
              : {
                  duration: 5.4,
                  times: [0, 0.94, 0.97, 1, 1],
                  repeat: Infinity,
                  ease: "easeInOut",
                }
          }
          style={{ pointerEvents: "none" }}
        >
          <path
            d="M 67 92 L 89 92"
            stroke="#1B3A2D"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M 111 92 L 133 92"
            stroke="#1B3A2D"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </motion.g>
        {/* Mouth — bumped up: wider arc + a touch thicker so it
            reads at avatar size. */}
        <path
          d="M 80 122 Q 100 142 120 122"
          stroke="#1B3A2D"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </motion.div>
  )
}
