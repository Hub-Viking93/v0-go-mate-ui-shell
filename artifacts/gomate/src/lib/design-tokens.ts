/**
 * GoMate design tokens — single source of truth for the editorial-warm
 * premium palette. CSS variables in `src/index.css` mirror these values;
 * use this module from TS when you need a token outside of Tailwind/CSS
 * (e.g. inline SVG fills, framer-motion color values, chart palettes).
 */

export const colors = {
  // Canvas
  background: "#FAFAF6",
  foreground: "#1A1614",
  card: "rgba(255, 252, 246, 0.78)",

  // Brand
  brandForest: "#0F172A",
  brandForestMid: "#1E293B",
  brandForestLight: "#334155",
  brandMint: "#0D9488",
  brandSage: "#94A3B8",

  // Warm primary action — coral/amber, used sparingly.
  actionCoral: "#0F172A",
  actionAmber: "#1E293B",

  // Status (deeper, not pastel)
  successGreen: "#0D9488",
  warningHoney: "#D97706",
  errorBurgundy: "#B91C1C",

  // Hairline borders — cool neutral.
  borderHairline: "rgba(15, 23, 42, 0.08)",
  borderHairlineStrong: "rgba(15, 23, 42, 0.16)",

  // Domain tints (soft, < 8% saturated)
  tintCultural: "#F8F2E8",
  tintCompliance: "#F2F0EC",
  tintHealthcare: "#F8EDEC",
  tintFinance: "#EEF3EC",
} as const

export const typography = {
  serif: "'Inter', 'Geist', system-ui, sans-serif",
  sans: "'Inter', 'Geist', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Geist Mono', monospace",
  // Display sizes (px)
  h1Display: 56,
  h1: 40,
  h2: 30,
  h3: 22,
  body: 16,
  caption: 13,
} as const

export const motion = {
  // Eased curves
  cubicSoft: "cubic-bezier(0.22, 1, 0.36, 1)",
  durationFast: 150,
  durationBase: 250,
  durationSlow: 400,
} as const

export type DesignTokens = typeof colors & typeof typography & typeof motion
