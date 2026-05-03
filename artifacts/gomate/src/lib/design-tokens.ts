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
  brandForest: "#1B3A2D",
  brandForestMid: "#234D3A",
  brandForestLight: "#2D6A4F",
  brandMint: "#5EE89C",
  brandSage: "#A7D7C5",

  // Warm primary action — coral/amber, used sparingly.
  actionCoral: "#E85D3C",
  actionAmber: "#F59E0B",

  // Status (deeper, not pastel)
  successGreen: "#16A34A",
  warningHoney: "#D97706",
  errorBurgundy: "#B91C1C",

  // Hairline borders — warm tint of brown/amber.
  borderHairline: "rgba(120, 90, 60, 0.15)",
  borderHairlineStrong: "rgba(120, 90, 60, 0.28)",

  // Domain tints (soft, < 8% saturated)
  tintCultural: "#F8F2E8",
  tintCompliance: "#F2F0EC",
  tintHealthcare: "#F8EDEC",
  tintFinance: "#EEF3EC",
} as const

export const typography = {
  serif: "'Source Serif 4', 'Source Serif Pro', Georgia, serif",
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
