import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  description: string;
  color?: "default" | "success" | "warning" | "danger";
  icon?: ReactNode;
}

const colorMap: Record<string, string> = {
  default: "text-text",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function StatCard({
  label,
  value,
  description,
  color = "default",
  icon,
}: StatCardProps) {
  return (
    <div className="glass rounded-lg p-5">
      <p className="uppercase text-[12px] tracking-[0.6px] text-text-muted mb-2">
        {label}
      </p>
      <p
        className={cn(
          "text-[30px] font-bold leading-[1.2] flex items-center gap-2",
          colorMap[color],
        )}
      >
        {icon}
        {value}
      </p>
      <p className="text-[13px] text-text-dim mt-1">{description}</p>
    </div>
  );
}
