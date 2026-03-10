"use client";

import { useEffect, useRef, useState } from "react";
import { Languages, Palette } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useLocale } from "@/components/locale-provider";
import { locales } from "@/lib/i18n";

type Tab = "language" | "theme";

export function SettingsDropdown() {
  const { colorTheme, setColorTheme, themes } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("language");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeLocale = locales.find((l) => l.id === locale) || locales[0];

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center">
        <button
          onClick={() => { setTab("language"); setOpen(!open || tab !== "language"); }}
          aria-label={t("settings.language")}
          className="p-1.5 rounded-md text-text-dim hover:text-text transition-[color] duration-[--motion-base] cursor-pointer focus-visible:ring-1 focus-visible:ring-border-hover focus-visible:outline-none"
        >
          <Languages size={16} />
        </button>
        <button
          onClick={() => { setTab("theme"); setOpen(!open || tab !== "theme"); }}
          aria-label={t("settings.theme")}
          className="p-1.5 rounded-md text-text-dim hover:text-text transition-[color] duration-[--motion-base] cursor-pointer focus-visible:ring-1 focus-visible:ring-border-hover focus-visible:outline-none"
        >
          <Palette size={16} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-10 w-56 rounded-lg border border-border bg-bg-elevated shadow-lg z-50 overflow-hidden">
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab("language")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium transition-[color,background] duration-[--motion-base] cursor-pointer ${
                tab === "language" ? "text-text bg-bg-subtle" : "text-text-muted hover:text-text-dim"
              }`}
            >
              <Languages size={13} />
              {activeLocale.label}
            </button>
            <button
              onClick={() => setTab("theme")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium transition-[color,background] duration-[--motion-base] cursor-pointer ${
                tab === "theme" ? "text-text bg-bg-subtle" : "text-text-muted hover:text-text-dim"
              }`}
            >
              <Palette size={13} />
              {t("settings.theme")}
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {tab === "language" ? (
              locales.map((l) => (
                <button
                  key={l.id}
                  onClick={() => { setLocale(l.id); setOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-[14px] text-text-dim hover:text-text hover:bg-bg-subtle transition-[color,background] duration-[--motion-base] cursor-pointer"
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    locale === l.id ? "bg-text" : "bg-transparent"
                  }`} />
                  {l.label}
                </button>
              ))
            ) : (
              themes.map((th) => (
                <button
                  key={th.id}
                  onClick={() => { setColorTheme(th.id); setOpen(false); }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-[14px] text-left hover:bg-bg-subtle transition-[color,background] duration-[--motion-base] cursor-pointer"
                  style={{ color: th.accent }}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    colorTheme === th.id ? "bg-current" : "bg-transparent"
                  }`} />
                  {th.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
