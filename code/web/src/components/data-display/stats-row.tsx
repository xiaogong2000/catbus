import { StatCard } from "./stat-card";
import type { ReactNode } from "react";

interface StatsItem {
  label: string;
  value: string;
  description: string;
  color?: "default" | "success" | "warning" | "danger";
  icon?: ReactNode;
}

interface StatsRowProps {
  items: StatsItem[];
  columns?: number;
  className?: string;
}

export function StatsRow({ items, columns, className }: StatsRowProps) {
  const cols = columns ?? Math.min(items.length, 4);

  return (
    <div
      className={`grid gap-4 mb-10 ${className ?? ""}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {items.map((item) => (
        <StatCard key={item.label} {...item} />
      ))}
    </div>
  );
}
