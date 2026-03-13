import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  steps?: { label: string; href?: string }[];
  className?: string;
}

export function EmptyState({ icon, title, description, steps, className }: EmptyStateProps) {
  return (
    <div className={cn("text-center py-16 px-4", className)}>
      {icon && (
        <div className="mx-auto w-14 h-14 rounded-2xl bg-bg-elevated border border-border flex items-center justify-center mb-5">
          {icon}
        </div>
      )}
      <h3 className="text-[18px] font-semibold text-text mb-2">{title}</h3>
      {description && (
        <p className="text-[14px] text-text-dim max-w-[400px] mx-auto mb-6 leading-[1.5]">
          {description}
        </p>
      )}
      {steps && steps.length > 0 && (
        <div className="flex flex-col gap-3 max-w-[320px] mx-auto text-left">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-[12px] font-semibold text-text-muted shrink-0">
                {i + 1}
              </span>
              {step.href ? (
                <a
                  href={step.href}
                  className="text-[13px] text-text-dim hover:text-text transition-[color] duration-[--motion-base]"
                >
                  {step.label}
                </a>
              ) : (
                <span className="text-[13px] text-text-dim">{step.label}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
