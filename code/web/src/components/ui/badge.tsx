import { cn } from "@/lib/utils";

interface BadgeProps {
  status: "online" | "offline" | "error";
  label?: string;
  className?: string;
}

const dotColor: Record<string, string> = {
  online: "bg-success",
  offline: "bg-text-muted",
  error: "bg-danger",
};

export function Badge({ status, label, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] text-text-dim",
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full shrink-0", dotColor[status])} />
      {label ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
