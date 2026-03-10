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
        "rounded-xl p-5",
        glass
          ? "glass"
          : "bg-transparent border border-border",
        hoverable &&
          "transition-[border-color,box-shadow] duration-[--motion-base] ease-[--ease-standard] hover:border-border-hover",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
