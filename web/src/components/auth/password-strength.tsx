"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
}

interface StrengthResult {
  score: number;
  label: string;
  color: string;
}

function evaluateStrength(password: string): StrengthResult {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: "Weak", color: "hsl(var(--c-danger))" };
  if (score <= 3) return { score, label: "Fair", color: "hsl(var(--c-warning))" };
  if (score <= 4) return { score, label: "Good", color: "hsl(var(--c-primary))" };
  return { score, label: "Strong", color: "hsl(var(--c-success))" };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo(() => evaluateStrength(password), [password]);

  if (!password) return null;

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-[background-color] duration-[--motion-base]"
            )}
            style={{
              backgroundColor:
                i <= strength.score ? strength.color : "hsl(var(--c-border))",
            }}
          />
        ))}
      </div>
      <p className="text-[12px]" style={{ color: strength.color }}>
        {strength.label}
      </p>
    </div>
  );
}
