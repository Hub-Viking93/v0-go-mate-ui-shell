// =============================================================
// PageShell — shared workspace shell for top-level pages
// =============================================================
// Compact, app-like layout. Light sage admin styling per the IA
// design pass. Header + subnav + content area on a content-surface
// background that's distinct from the app canvas.
//
// PageShell does NOT wrap in <AppShell> — that wrapper is already
// supplied by ProtectedRoute in App.tsx. Wrapping again produces a
// double sidebar.
// =============================================================

import type { ReactNode } from "react";

const HEADER_TINTS: Record<string, string> = {
  default: "#FCFDFB",
  immigration: "#F0F5F3",
  preMove: "#F5F3EE",
  postMove: "#F0F4F0",
  documents: "#F0F0F5",
  guidance: "#F5F0EE",
  settings: "#F0F0F0",
};

export interface PageShellProps {
  /** H1-level title — sits at small heading size. */
  title: string;
  /** Single short sentence describing the page. Optional. */
  description?: string;
  /** Right-side actions (buttons / links). */
  actions?: ReactNode;
  /** Sub-navigation rendered below the header (e.g. tabs strip). */
  subnav?: ReactNode;
  /** Page body. Keep cards small + tight. */
  children: ReactNode;
  /** Optional testid for verification specs. */
  testId?: string;
  /** Subtle header tint — gives each workspace a distinct temperature. */
  tint?: keyof typeof HEADER_TINTS;
}

export function PageShell({ title, description, actions, subnav, children, testId, eyebrow, tint = "default" }: PageShellProps & { eyebrow?: string }) {
  const headerBg = HEADER_TINTS[tint] ?? HEADER_TINTS.default;
  return (
    <div className="flex flex-col min-h-screen" data-testid={testId}>
      <header
        className="px-5 md:px-6 lg:px-8 pt-5 pb-3"
        style={{ backgroundColor: headerBg, borderBottom: "1px solid #DCE7DF" }}
      >
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            {eyebrow && <span className="gm-eyebrow mb-2">{eyebrow}</span>}
            <h1
              className={
                "text-[22px] font-semibold tracking-tight text-[#1F2A24] " +
                (eyebrow ? "mt-2" : "")
              }
              data-testid="page-title"
            >
              {title}
            </h1>
            {description && (
              <p className="text-[12.5px] text-[#7E9088] mt-1.5 max-w-2xl leading-relaxed">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
        {subnav && <div className="mt-4 -mx-5 md:-mx-6 lg:-mx-8 px-5 md:px-6 lg:px-8">{subnav}</div>}
      </header>
      <div className="px-5 md:px-6 lg:px-8 py-5 space-y-5 flex-1">{children}</div>
    </div>
  );
}

export interface SubNavItem {
  /** Stable id used for selection + testid. */
  id: string;
  label: string;
  /** Optional badge — e.g. count of urgent items. */
  badge?: number | string;
}

export interface SubNavProps {
  items: SubNavItem[];
  active: string;
  onChange: (id: string) => void;
  testId?: string;
}

export function SubNav({ items, active, onChange, testId }: SubNavProps) {
  return (
    <nav
      className="flex items-center gap-0 -mb-3 overflow-x-auto scrollbar-hide"
      style={{ borderBottom: "1px solid #DCE7DF" }}
      data-testid={testId}
    >
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={
              "group relative px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap " +
              "transition-colors duration-[180ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] " +
              (isActive
                ? "text-[#1F2A24]"
                : "text-[#7E9088] hover:text-[#1F2A24]")
            }
            data-testid={`subnav-${item.id}`}
            data-active={isActive ? "true" : "false"}
          >
            <span className="inline-flex items-center gap-1.5">
              {item.label}
              {item.badge !== undefined && item.badge !== null && (
                <span className="text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-[#ECF1EC] text-[#4E5F57]">
                  {item.badge}
                </span>
              )}
            </span>
            <span
              className={
                "absolute left-3 right-3 -bottom-px transition-all duration-[200ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] " +
                (isActive
                  ? "h-[2px] opacity-100"
                  : "h-[2px] opacity-0 group-hover:opacity-100 group-hover:bg-[#B5D2BC]")
              }
              style={isActive ? { height: "2px", background: "#3F6B53" } : undefined}
            />
          </button>
        );
      })}
    </nav>
  );
}
