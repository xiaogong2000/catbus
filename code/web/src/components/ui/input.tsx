import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, type ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
}

export function Input({ icon, className, ...rest }: InputProps) {
  return (
    <div className={cn("relative", className)}>
      {icon && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
          {icon}
        </span>
      )}
      <input
        className={cn(
          "w-full bg-transparent border border-border rounded-md text-text text-[14px] py-2 pr-4 placeholder:text-text-muted transition-[border-color] duration-[--motion-base] ease-[--ease-standard] focus-visible:border-border-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-hover",
          icon ? "pl-10" : "pl-4",
        )}
        {...rest}
      />
    </div>
  );
}
