import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export type AnimationState =
  | "idle"
  | "nodding"
  | "smiling"
  | "tilting_curious"
  | "thinking"
  | "celebrating"

export interface MascotProps {
  state: AnimationState
  size?: "sm" | "md" | "lg"
  className?: string
}

const SIZE_PX: Record<NonNullable<MascotProps["size"]>, number> = {
  sm: 80,
  md: 140,
  lg: 220,
}

/**
 * GoMate mascot — the brand logo (wireframe globe + airplane swoop)
 * brought to life with eye/mouth animation. Same animation API as
 * before (state, size, Framer Motion transitions) minus the deprecated
 * "waving" state.
 *
 * Visual reference: artifacts/gomate/public/images/gomate-logo.png.
 */
export function Mascot({ state, size = "md", className }: MascotProps) {
  const px = SIZE_PX[size]

  return (
    <div
      className={cn("inline-block select-none", className)}
      style={{ width: px, height: px }}
      data-state={state}
      data-testid={`mascot-${state}`}
      role="img"
      aria-label={`GoMate mascot, ${state.replace("_", " ")}`}
    >
      <MascotSvg state={state} />
    </div>
  )
}

function MascotSvg({ state }: { state: AnimationState }) {
  const breathing =
    state === "idle"
      ? {
          y: [0, -3, 0],
          scale: [1, 1.012, 1],
          transition: { duration: 3.4, repeat: Infinity, ease: "easeInOut" as const },
        }
      : undefined

  const nodding =
    state === "nodding"
      ? {
          rotate: [0, 8, -3, 6, 0],
          transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" as const },
        }
      : undefined

  const tilting =
    state === "tilting_curious"
      ? {
          rotate: [-10, -7, -10],
          transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const },
        }
      : undefined

  const celebrating =
    state === "celebrating"
      ? {
          y: [0, -12, 0, -8, 0],
          rotate: [0, -4, 4, -2, 0],
          transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const },
        }
      : undefined

  const bodyAnim = breathing ?? nodding ?? tilting ?? celebrating ?? {}

  const SAGE = "#8DB78A"
  const SAGE_DEEP = "#6B9870"
  const INK = "#1B3A2D"

  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <radialGradient id="mascotShine" cx="32%" cy="28%" r="48%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft drop shadow */}
      <ellipse cx="100" cy="186" rx="62" ry="6" fill="#18140E" opacity="0.08" />

      {/* Confetti for celebrating */}
      {state === "celebrating" && <Confetti />}

      {/* Thinking dots — three soft circles above the head */}
      <AnimatePresence>{state === "thinking" && <ThinkingDots />}</AnimatePresence>

      {/* Whole-body group — globe, airplane, face all move together */}
      <motion.g
        style={{ originX: "100px", originY: "100px" } as React.CSSProperties}
        animate={bodyAnim}
      >
        {/* Wireframe globe — the GoMate mark, recolored as a soft sage
            sphere with white wireframe. Outer circle + 2 latitudes +
            equator + meridian, mirroring the logo PNG. */}
        <circle cx="100" cy="100" r="68" fill={SAGE} stroke={INK} strokeWidth="0" />
        <circle cx="100" cy="100" r="68" fill="url(#mascotShine)" />

        {/* Wireframe lines (white, like the logo) */}
        <g stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.95">
          {/* Equator */}
          <ellipse cx="100" cy="100" rx="68" ry="22" />
          {/* Upper latitude */}
          <path d="M 44 78 Q 100 60 156 78" />
          {/* Lower latitude */}
          <path d="M 44 122 Q 100 140 156 122" />
          {/* Meridian (vertical) */}
          <ellipse cx="100" cy="100" rx="22" ry="68" />
        </g>

        {/* Outer rim for definition */}
        <circle
          cx="100"
          cy="100"
          r="68"
          fill="none"
          stroke={SAGE_DEEP}
          strokeWidth="2"
          opacity="0.45"
        />

        {/* Face overlay — eyes + mouth painted onto the globe */}
        <Eyes state={state} />
        <Mouth state={state} />

        {/* Cheeks for smiling */}
        <AnimatePresence>
          {state === "smiling" && (
            <>
              <motion.ellipse
                cx="74"
                cy="112"
                rx="5"
                ry="3.5"
                fill="#FF9B8A"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 0.55, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
              />
              <motion.ellipse
                cx="126"
                cy="112"
                rx="5"
                ry="3.5"
                fill="#FF9B8A"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 0.55, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
              />
            </>
          )}
        </AnimatePresence>
      </motion.g>

      {/* Airplane removed per design feedback — the wireframe globe
          now stands on its own as the mascot. The Airplane component
          definition is retained below in case we want to reintroduce
          it later as an accent. */}
    </svg>
  )
}

function Eyes({ state }: { state: AnimationState }) {
  const [blinking, setBlinking] = useState(false)

  useEffect(() => {
    if (
      state !== "idle" &&
      state !== "smiling" &&
      state !== "tilting_curious" &&
      state !== "nodding"
    ) {
      setBlinking(false)
      return
    }
    let cancelled = false
    let blinkCloseTimer: ReturnType<typeof setTimeout> | null = null
    const tick = () => {
      if (cancelled) return
      setBlinking(true)
      blinkCloseTimer = setTimeout(() => {
        if (!cancelled) setBlinking(false)
      }, 140)
    }
    const interval = setInterval(tick, 3500 + Math.random() * 1500)
    return () => {
      cancelled = true
      clearInterval(interval)
      if (blinkCloseTimer) clearTimeout(blinkCloseTimer)
      setBlinking(false)
    }
  }, [state])

  // Celebrating — happy upturned crescents
  if (state === "celebrating") {
    return (
      <g stroke="#18140E" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M 76 100 Q 84 92 92 100" />
        <path d="M 108 100 Q 116 92 124 100" />
      </g>
    )
  }

  // Smiling — softer crescents
  if (state === "smiling") {
    return (
      <g stroke="#18140E" strokeWidth="2.8" strokeLinecap="round" fill="none">
        <path d="M 76 100 Q 84 94 92 100" />
        <path d="M 108 100 Q 116 94 124 100" />
      </g>
    )
  }

  // Thinking — eyes look up & to the side
  if (state === "thinking") {
    return (
      <g>
        <ellipse cx="82" cy="97" rx="6" ry="8" fill="#18140E" />
        <ellipse cx="114" cy="97" rx="6" ry="8" fill="#18140E" />
        <circle cx="84.5" cy="93" r="1.8" fill="#FFFFFF" opacity="0.9" />
        <circle cx="116.5" cy="93" r="1.8" fill="#FFFFFF" opacity="0.9" />
      </g>
    )
  }

  // Default — friendly round eyes; blink collapses Y radius
  const ry = blinking ? 0.8 : 8
  return (
    <g>
      <ellipse cx="84" cy="100" rx="6" ry={ry} fill="#18140E" />
      <ellipse cx="116" cy="100" rx="6" ry={ry} fill="#18140E" />
      {!blinking && (
        <>
          <circle cx="86" cy="97" r="1.8" fill="#FFFFFF" opacity="0.9" />
          <circle cx="118" cy="97" r="1.8" fill="#FFFFFF" opacity="0.9" />
        </>
      )}
    </g>
  )
}

function Mouth({ state }: { state: AnimationState }) {
  if (state === "celebrating") {
    return (
      <motion.path
        d="M 86 122 Q 100 138 114 122 Q 100 130 86 122 Z"
        fill="#18140E"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        style={{ originX: "100px", originY: "124px" } as React.CSSProperties}
      />
    )
  }

  if (state === "smiling") {
    return (
      <motion.path
        d="M 84 120 Q 100 134 116 120"
        stroke="#18140E"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4 }}
      />
    )
  }

  if (state === "tilting_curious") {
    return <ellipse cx="100" cy="124" rx="3.5" ry="3" fill="#18140E" />
  }

  if (state === "thinking") {
    return (
      <line
        x1="92"
        y1="124"
        x2="108"
        y2="124"
        stroke="#18140E"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    )
  }

  // Nodding & idle — gentle smile
  return (
    <path
      d="M 88 122 Q 100 130 112 122"
      stroke="#18140E"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
  )
}

/**
 * Airplane that swoops through the globe — same visual element as the
 * logo. Idle state: the plane gently bobs along its diagonal axis.
 * Celebrating: takes a small loop. Thinking: parks (thinking dots
 * take over the visual focus).
 */
function Airplane({ state, sage }: { state: AnimationState; sage: string }) {
  // The plane shape, drawn pointing up-right diagonally, just like the logo.
  // Tail extends down-left, tip extends up-right.
  const planeShape = (
    <g>
      {/* Main body — sweeping diagonal silhouette */}
      <path
        d="M 60 138 L 154 56 L 144 84 L 116 96 L 96 132 L 84 132 L 92 116 L 76 122 Z"
        fill={sage}
        stroke="#1B3A2D"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.95"
      />
      {/* Highlight stripe along the wing */}
      <path
        d="M 100 110 L 138 78"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </g>
  )

  if (state === "thinking") {
    // Plane fades out — thinking dots take over.
    return (
      <motion.g
        initial={{ opacity: 0.95 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        {planeShape}
      </motion.g>
    )
  }

  if (state === "celebrating") {
    return (
      <motion.g
        style={{ originX: "100px", originY: "100px" } as React.CSSProperties}
        animate={{ rotate: [0, 6, 0, -6, 0], y: [0, -4, 0, -2, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        {planeShape}
      </motion.g>
    )
  }

  if (state === "smiling") {
    return (
      <motion.g
        style={{ originX: "107px", originY: "97px" } as React.CSSProperties}
        animate={{ x: [0, 2, 0, -2, 0], y: [0, -1, 0, 1, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        {planeShape}
      </motion.g>
    )
  }

  // Idle / nodding / tilting_curious — gentle hover along its diagonal
  return (
    <motion.g
      style={{ originX: "107px", originY: "97px" } as React.CSSProperties}
      animate={{ x: [0, 1.5, 0], y: [0, -1.5, 0] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
    >
      {planeShape}
    </motion.g>
  )
}

function ThinkingDots() {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={84 + i * 16}
          cy={26}
          r={4}
          fill="#1B3A2D"
          initial={{ opacity: 0.2 }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
        />
      ))}
    </g>
  )
}

function Confetti() {
  const pieces = [
    { x: 40, y: 40, color: "#5EE89C", rot: 12 },
    { x: 160, y: 50, color: "#F59E0B", rot: -18 },
    { x: 30, y: 120, color: "#E85D3C", rot: 8 },
    { x: 170, y: 130, color: "#22C55E", rot: -10 },
    { x: 100, y: 22, color: "#FBBF24", rot: 24 },
    { x: 60, y: 168, color: "#5EE89C", rot: -22 },
    { x: 140, y: 168, color: "#E85D3C", rot: 14 },
  ]
  return (
    <g>
      {pieces.map((p, i) => (
        <motion.rect
          key={i}
          x={p.x - 3}
          y={p.y - 6}
          width={6}
          height={12}
          rx={1.5}
          fill={p.color}
          transform={`rotate(${p.rot} ${p.x} ${p.y})`}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 1, 1, 0], y: [0, -10, -16, -28] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            delay: i * 0.08,
            ease: "easeOut",
          }}
        />
      ))}
    </g>
  )
}
