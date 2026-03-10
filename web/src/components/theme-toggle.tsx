"use client";

import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Monitor } from "lucide-react";

const icons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const cycle: ("light" | "dark" | "system")[] = ["light", "dark", "system"];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = icons[theme];

  const next = () => {
    const idx = cycle.indexOf(theme);
    setTheme(cycle[(idx + 1) % cycle.length]);
  };

  return (
    <button
      onClick={next}
      aria-label={`Theme: ${theme}. Click to switch.`}
      className="p-1.5 rounded-md text-text-dim hover:text-text transition-[color] duration-[--motion-base] cursor-pointer focus-visible:ring-1 focus-visible:ring-border-hover focus-visible:outline-none"
    >
      <Icon size={16} />
    </button>
  );
}
