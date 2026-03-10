import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  glass?: boolean;
}

export function Card({
  hoverable = true,
  glass = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl p-5 h-full",
        glass
          ? "glass"
          : "bg-transparent border border-border",
        hoverable &&
          "transition-all duration-300 ease-[--ease-standard]",
        hoverable && !glass &&
          "hover:border-border-hover hover:shadow-[0_0_20px_-4px_hsl(var(--c-primary)/0.15)] hover:-translate-y-0.5",
        hoverable && glass &&
          "hover:border-[hsl(var(--glass-border))] hover:shadow-[0_8px_24px_-8px_hsl(var(--c-primary)/0.12)] hover:-translate-y-0.5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
