"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { AnimateIn, StaggerContainer, StaggerItem } from "@/components/motion/animate-in";
import { PageTransition } from "@/components/motion/page-transition";
import { useLocale } from "@/components/locale-provider";
import { docCategories } from "@/lib/docs-data";
import { Search } from "lucide-react";
import Link from "next/link";

export default function DocsPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState("");

  const filtered = docCategories.filter((cat) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t(cat.titleKey).toLowerCase().includes(q) ||
      t(cat.descKey).toLowerCase().includes(q) ||
      cat.pages.some(
        (p) =>
          t(p.titleKey).toLowerCase().includes(q) ||
          t(p.descKey).toLowerCase().includes(q)
      )
    );
  });

  return (
    <PageTransition>
      <div className="py-10">
        <AnimateIn>
          <h1 className="text-[36px] font-bold tracking-[-1px] text-text mb-3">
            {t("docs.hub.title")}
          </h1>
          <p className="text-[16px] text-text-dim mb-8 max-w-[560px]">
            {t("docs.hub.desc")}
          </p>
        </AnimateIn>

        <AnimateIn delay={0.1}>
          <div className="relative mb-10 max-w-[480px]">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("docs.hub.search")}
              className="w-full h-11 pl-11 pr-4 rounded-lg bg-bg-elevated border border-border text-[14px] text-text placeholder:text-text-muted focus:outline-none focus:border-border-hover transition-[border-color] duration-[--motion-base]"
            />
          </div>
        </AnimateIn>

        <StaggerContainer key={search.trim()} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cat) => (
            <StaggerItem key={cat.id}>
              {cat.comingSoon ? (
                <div className="relative h-full">
                  <Card
                    className="opacity-50 pointer-events-none select-none h-full flex flex-col"
                    accent={cat.accent}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-[24px]">{cat.icon}</span>
                      <div>
                        <h3 className="text-[16px] font-semibold text-text">
                          {t(cat.titleKey)}
                        </h3>
                        <p className="text-[13px] text-text-dim mt-1">
                          {t(cat.descKey)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-auto">
                      <span className="text-[12px] text-text-muted bg-bg-elevated border border-border rounded-full px-2.5 py-0.5">
                        Coming Soon
                      </span>
                    </div>
                  </Card>
                  <span className="absolute top-3 right-3 text-[11px] font-medium text-text-muted bg-bg-elevated border border-border rounded-full px-2.5 py-0.5">
                    Coming Soon
                  </span>
                </div>
              ) : (
                <Link href={`/docs/${cat.pages[0]?.slug ?? ""}`} className="h-full block">
                  <Card
                    glass
                    accent={cat.accent}
                    className="h-full flex flex-col"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-[24px]">{cat.icon}</span>
                      <div>
                        <h3 className="text-[16px] font-semibold text-text">
                          {t(cat.titleKey)}
                        </h3>
                        <p className="text-[13px] text-text-dim mt-1">
                          {t(cat.descKey)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-auto">
                      {cat.pages.map((p) => (
                        <span
                          key={p.slug}
                          className="text-[12px] text-text-muted bg-bg-elevated border border-border rounded-full px-2.5 py-0.5"
                        >
                          {t(p.titleKey)}
                        </span>
                      ))}
                    </div>
                  </Card>
                </Link>
              )}
            </StaggerItem>
          ))}
        </StaggerContainer>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[14px] text-text-muted">{t("docs.hub.noResults")}</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
