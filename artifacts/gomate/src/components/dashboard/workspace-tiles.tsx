// =============================================================
// WorkspaceTiles — dashboard workspace front-doors
// =============================================================
// Each tile owns one accent hue (rendered as a 4px top stripe)
// and lifts on hover. Larger icon-bricka in the workspace's hue
// + a one-line metadata stub so the row reads as actual nav, not
// five identical rectangles.
// =============================================================

import { Link } from "wouter";
import {
  ArrowRight,
  Compass,
  FolderClosed,
  HomeIcon,
  Plane,
  Shield,
  type LucideIcon,
} from "lucide-react";

interface Tile {
  href: string;
  label: string;
  description: string;
  meta: string;
  icon: LucideIcon;
  testId: string;
  accent: string;
  iconBg: string;
  iconFg: string;
}

const TILES: Tile[] = [
  {
    href: "/immigration",
    label: "Immigration",
    description: "Path, Plan B, readiness, risks, rule changes.",
    meta: "Visa pathway",
    icon: Shield,
    testId: "tile-immigration",
    accent: "#1B7A40",
    iconBg: "#DDEFE3",
    iconFg: "#15663A",
  },
  {
    href: "/pre-move",
    label: "Pre-move",
    description: "Pre-departure tasks, deadlines, action links.",
    meta: "Action checklist",
    icon: Plane,
    testId: "tile-pre-move",
    accent: "#C99746",
    iconBg: "#F6ECD7",
    iconFg: "#8C6B2F",
  },
  {
    href: "/post-move",
    label: "Post-move",
    description: "Settling-in, playbook, banking, healthcare.",
    meta: "Arrival playbook",
    icon: HomeIcon,
    testId: "tile-post-move",
    accent: "#5D9CA5",
    iconBg: "#E1EEF1",
    iconFg: "#3F6B6F",
  },
  {
    href: "/documents",
    label: "Documents",
    description: "Vault, missing docs, proof + prep guidance.",
    meta: "Vault + requirements",
    icon: FolderClosed,
    testId: "tile-documents",
    accent: "#8B7B6E",
    iconBg: "#EDE7E0",
    iconFg: "#5C4F44",
  },
  {
    href: "/guidance",
    label: "Plan & Guidance",
    description: "Housing, departure, pets, tax, rule changes.",
    meta: "Advisory layers",
    icon: Compass,
    testId: "tile-guidance",
    accent: "#B5414C",
    iconBg: "#F5DDDF",
    iconFg: "#8B2F38",
  },
];

export function WorkspaceTiles() {
  return (
    <section
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
      data-testid="workspace-tiles"
    >
      {TILES.map((t) => {
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className="gm-surface gm-lift gm-tile-accent group block px-4 pt-5 pb-4 min-h-[148px] flex flex-col"
            style={{ ["--gm-tile-accent-color" as string]: t.accent }}
            data-testid={t.testId}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <span
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg"
                style={{ background: t.iconBg, color: t.iconFg }}
              >
                <Icon className="w-4 h-4" strokeWidth={1.9} />
              </span>
              <ArrowRight
                className="gm-lift-arrow w-4 h-4 text-[#9CB0A4] mt-2"
                strokeWidth={1.7}
              />
            </div>
            <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#7E9088]">
              {t.meta}
            </div>
            <div className="text-[15px] font-semibold text-[#1F2A24] leading-snug mt-1">
              {t.label}
            </div>
            <div className="text-[11.5px] text-[#7E9088] leading-relaxed mt-1.5 flex-1">
              {t.description}
            </div>
          </Link>
        );
      })}
    </section>
  );
}
