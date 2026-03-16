"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const COUNTRY_CODES = [
  { code: "+86", label: "China (+86)" },
  { code: "+1", label: "US/Canada (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+82", label: "Korea (+82)" },
  { code: "+65", label: "Singapore (+65)" },
  { code: "+852", label: "Hong Kong (+852)" },
  { code: "+886", label: "Taiwan (+886)" },
];

interface PhoneInputProps {
  countryCode: string;
  phone: string;
  onCountryCodeChange: (code: string) => void;
  onPhoneChange: (phone: string) => void;
  disabled?: boolean;
}

export function PhoneInput({
  countryCode,
  phone,
  onCountryCodeChange,
  onPhoneChange,
  disabled,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback(
    (code: string) => {
      onCountryCodeChange(code);
      setOpen(false);
    },
    [onCountryCodeChange]
  );

  return (
    <div className="relative flex gap-2">
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={cn(
            "h-10 px-3 rounded-[--radius-md] border border-[hsl(var(--c-border))]",
            "bg-transparent text-[hsl(var(--c-text))] text-[14px]",
            "transition-[border-color] duration-[--motion-base] ease-[--ease-standard]",
            "hover:border-[hsl(var(--c-border-hover))] focus:border-[hsl(var(--c-border-hover))] focus:outline-none",
            "min-w-[80px] text-left"
          )}
        >
          {countryCode}
        </button>
        {open && (
          <ul className="absolute top-full left-0 mt-1 z-50 w-[200px] rounded-[--radius-md] border border-[hsl(var(--c-border))] bg-[hsl(var(--c-bg-elevated))] py-1 max-h-[200px] overflow-y-auto">
            {COUNTRY_CODES.map((item) => (
              <li key={item.code}>
                <button
                  type="button"
                  onClick={() => handleSelect(item.code)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-[13px]",
                    "hover:bg-[hsl(var(--c-bg-subtle))]",
                    item.code === countryCode
                      ? "text-[hsl(var(--c-text))]"
                      : "text-[hsl(var(--c-text-dim))]"
                  )}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input
        type="tel"
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        disabled={disabled}
        placeholder="Phone number"
        className={cn(
          "flex-1 h-10 px-4 rounded-[--radius-md] border border-[hsl(var(--c-border))]",
          "bg-transparent text-[hsl(var(--c-text))] text-[14px]",
          "placeholder:text-[hsl(var(--c-text-muted))]",
          "transition-[border-color] duration-[--motion-base] ease-[--ease-standard]",
          "hover:border-[hsl(var(--c-border-hover))] focus:border-[hsl(var(--c-border-hover))] focus:outline-none"
        )}
      />
    </div>
  );
}
