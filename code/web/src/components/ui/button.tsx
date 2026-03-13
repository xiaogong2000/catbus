import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "tag";
  size?: "sm" | "md" | "lg";
  active?: boolean;
}

const variantStyles: Record<string, string> = {
  primary:
    "bg-transparent border border-border text-text hover:border-border-hover",
  ghost: "bg-transparent border-0 text-text hover:text-primary-fg",
  tag: "bg-bg-elevated border border-border text-text-dim rounded-full text-[12px] hover:border-border-hover",
};

const sizeStyles: Record<string, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-6 text-[16px]",
  lg: "h-12 px-8 text-[16px]",
};

const tagSizeStyles: Record<string, string> = {
  sm: "min-w-[3.5rem] px-2 py-0.5 text-[11px]",
  md: "min-w-[4.5rem] px-3 py-1 text-[12px]",
  lg: "min-w-[5.5rem] px-4 py-1.5 text-[13px]",
};

export function Button({
  variant = "primary",
  size = "md",
  active,
  className,
  children,
  ...rest
}: ButtonProps) {
  const isTag = variant === "tag";

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-medium transition-[border-color,color,background] duration-[--motion-base] ease-[--ease-standard] cursor-pointer focus-visible:ring-1 focus-visible:ring-border-hover focus-visible:outline-none",
        isTag ? "" : "rounded-md",
        variantStyles[variant],
        isTag ? tagSizeStyles[size] : sizeStyles[size],
        active && variant === "tag" && "bg-text text-bg border-transparent",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
