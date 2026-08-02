import { Link } from "@tanstack/react-router";
import {
  Car,
  Droplets,
  Flame,
  GraduationCap,
  PaintRoller,
  Scissors,
  Sparkles,
  Sprout,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { categories } from "@/data/demo";

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
};

export function CategoryRail() {
  return (
    <ul className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
      {categories.map((category) => {
        const Icon = icons[category.icon] ?? Wrench;
        return (
          <li key={category.slug}>
            <Link
              to="/discover"
              search={{ category: category.slug }}
              className="flex w-24 flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-4 text-center shadow-soft"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-xs leading-tight font-semibold text-foreground">
                {category.name}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
