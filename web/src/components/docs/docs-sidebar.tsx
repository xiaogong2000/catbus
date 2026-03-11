"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { docCategories } from "@/lib/docs-data";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import Link from "next/link";

interface Props {
  currentSlug: string;
}

export function DocsSidebar({ currentSlug }: Props) {
  const { t } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav className="space-y-6">
      {docCategories
        .filter((c) => !c.comingSoon)
        .map((cat) => (
          <div key={cat.id}>
            <p className="text-[11px] font-semibold text-text-muted uppercase tracking-[1.5px] mb-2 px-3">
              {cat.icon} {t(cat.titleKey)}
            </p>
            <div className="space-y-0.5">
              {cat.pages.map((page) => (
                <Link
                  key={page.slug}
                  href={`/docs/${page.slug}`}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block px-3 py-1.5 rounded-md text-[13px] transition-[color,background] duration-[--motion-base]",
                    page.slug === currentSlug
                      ? "text-text bg-bg-elevated font-medium"
                      : "text-text-dim hover:text-text hover:bg-bg-subtle"
                  )}
                >
                  {t(page.titleKey)}
                </Link>
              ))}
            </div>
          </div>
        ))}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-[240px] shrink-0 border-r border-border py-10 px-4 sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">
        <Link
          href="/docs"
          className="block text-[13px] font-medium text-text-dim hover:text-text mb-6 px-3 transition-[color] duration-[--motion-base]"
        >
          ← {t("docs.backToHub")}
        </Link>
        {nav}
      </aside>

      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-bg-elevated border border-border flex items-center justify-center shadow-lg cursor-pointer"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle docs nav"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-[hsl(0_0%_0%/0.7)]"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-[280px] bg-bg border-r border-border py-6 px-4 overflow-y-auto">
            <Link
              href="/docs"
              onClick={() => setMobileOpen(false)}
              className="block text-[13px] font-medium text-text-dim hover:text-text mb-6 px-3"
            >
              ← {t("docs.backToHub")}
            </Link>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}
