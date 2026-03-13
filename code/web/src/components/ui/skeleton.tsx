import { cn } from "@/lib/utils";

interface SkeletonProps {
  variant?: "rect" | "circle" | "text";
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({
  variant = "rect",
  width,
  height,
  className,
}: SkeletonProps) {
  const base = "animate-pulse bg-bg-elevated";

  if (variant === "circle") {
    const size = width ?? height ?? 40;
    return (
      <div
        className={cn(base, "rounded-full", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  if (variant === "text") {
    return (
      <div
        className={cn(base, "rounded-md h-4", className)}
        style={{ width: width ?? "100%", height: height }}
      />
    );
  }

  return (
    <div
      className={cn(base, "rounded-lg", className)}
      style={{ width: width ?? "100%", height: height ?? 80 }}
    />
  );
}
