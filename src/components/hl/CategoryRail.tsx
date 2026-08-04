import { Link } from "@tanstack/react-router";
import {
  Car,
  Droplets,
  Flame,
  GraduationCap,
  Hammer,
  Layers,
  PaintRoller,
  Scissors,
  Sparkles,
  Sprout,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import type { CategoryRow } from "@/lib/types";

const icons: Record<string, LucideIcon> = {
  Zap,
  Droplets,
  Wrench,
  Sparkles,
  PaintRoller,
  GraduationCap,
  Flame,
  Scissors,
  Car,
  Sprout,
  Hammer,
  Layers,
};

export function CategoryRail({ categories }: { categories: CategoryRow[] }) {
  if (categories.length === 0) return null;

  return (
    <ul className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
      {categories.map((category) => {
        const Icon = icons[category.icon] ?? Wrench;
        return (
          <li key={category.slug}>
            <Link
              to="/discover"
              search={{ category: category.slug, tab: "jobs" }}
              className="flex w-[6.5rem] flex-col items-center gap-2.5 rounded-3xl border-2 border-border bg-card px-3 py-4 text-center transition-colors hover:border-primary"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <span className="text-[0.8125rem] leading-tight font-bold text-foreground">
                {category.name}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
