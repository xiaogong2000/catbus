import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  glass?: boolean;
  accent?: "primary" | "success" | "warning" | "danger" | string;
}

const accentMap: Record<string, string> = {
  primary: "hsl(var(--c-primary))",
  success: "hsl(var(--c-success))",
  warning: "hsl(var(--c-warning))",
  danger: "hsl(var(--c-danger))",
};

export function Card({
  hoverable = true,
  glass = false,
  accent,
  className,
  children,
  style,
  ...rest
}: CardProps) {
  const accentColor = accent
    ? accentMap[accent] || accent
    : undefined;

  return (
    <div
      className={cn(
        "rounded-xl p-5 h-full",
        glass
          ? "glass"
          : "bg-transparent border border-border",
        accent && "border-[1.5px]",
        hoverable &&
          "transition-all duration-300 ease-[--ease-standard]",
        hoverable && !glass && !accent &&
          "hover:border-border-hover hover:shadow-[0_0_20px_-4px_hsl(var(--c-primary)/0.15)] hover:-translate-y-0.5",
        hoverable && glass && !accent &&
          "hover:border-[hsl(var(--glass-border))] hover:shadow-[0_8px_24px_-8px_hsl(var(--c-primary)/0.12)] hover:-translate-y-0.5",
        hoverable && accent &&
          "hover:-translate-y-0.5",
        className,
      )}
      style={{
        ...style,
        ...(accentColor
          ? {
              borderColor: accentColor,
              boxShadow: `0 0 20px -4px ${accentColor}33`,
            }
          : {}),
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
