// =============================================================
// WorkspaceTiles — dashboard workspace front-doors
// =============================================================
// Each tile owns one accent hue (rendered as a 2px top stripe)
// and lifts on hover. Color-coding is reserved for this one
// surface — it's the only place identity-by-color helps the
// user navigate.
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
    icon: Shield,
    testId: "tile-immigration",
    accent: "#3F8E5A",
    iconBg: "#E4F2EA",
    iconFg: "#2C6440",
  },
  {
    href: "/pre-move",
    label: "Pre-move",
    description: "Pre-departure tasks, deadlines, action links.",
    icon: Plane,
    testId: "tile-pre-move",
    accent: "#C99746",
    iconBg: "#F6ECD7",
    iconFg: "#8C6B2F",
  },
  {
    href: "/post-move",
    label: "Post-move",
    description: "Settling-in, playbook, banking, healthcare, orientation.",
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
            className="gm-surface gm-lift gm-tile-accent group block px-3.5 pt-4 pb-3"
            style={{ ["--gm-tile-accent-color" as string]: t.accent }}
            data-testid={t.testId}
          >
            <div className="flex items-start justify-between gap-2 mb-2.5">
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-md"
                style={{ background: t.iconBg, color: t.iconFg }}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
              </span>
              <ArrowRight
                className="gm-lift-arrow w-3.5 h-3.5 text-[#7E9088] mt-1.5"
                strokeWidth={1.7}
              />
            </div>
            <div className="text-[13.5px] font-semibold text-[#1F2A24] leading-snug">
              {t.label}
            </div>
            <div className="text-[11.5px] text-[#7E9088] leading-relaxed mt-0.5">
              {t.description}
            </div>
          </Link>
        );
      })}
    </section>
  );
}
