"use client";

import { cn } from "@/lib/utils";
import type { LoginRegion } from "@/lib/types";

interface RegionTabsProps {
  value: LoginRegion;
  onChange: (region: LoginRegion) => void;
}

const tabs: { value: LoginRegion; label: string }[] = [
  { value: "international", label: "International" },
  { value: "china", label: "中国大陆" },
];

export function RegionTabs({ value, onChange }: RegionTabsProps) {
  return (
    <div className="flex rounded-[--radius-md] border border-[hsl(var(--c-border))] overflow-hidden">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={cn(
            "flex-1 py-2 px-4 text-[14px] font-medium transition-[color,background]",
            "duration-[--motion-base] ease-[--ease-standard]",
            value === tab.value
              ? "bg-[hsl(var(--c-text))] text-[hsl(var(--c-bg))]"
              : "bg-transparent text-[hsl(var(--c-text-dim))] hover:text-[hsl(var(--c-text))]"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
