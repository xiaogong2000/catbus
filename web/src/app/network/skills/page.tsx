"use client";

import { Suspense } from "react";
import { SkillsContent } from "./skills-content";
import { PageHeader } from "@/components/layout/page-header";
import { useLocale } from "@/components/locale-provider";

export default function SkillsPage() {
  const { t } = useLocale();

  return (
    <div className="py-10">
      <PageHeader
        eyebrow={t("skills.eyebrow")}
        title={t("skills.title")}
        description={t("skills.desc")}
      />
      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border border-border rounded-xl p-5 animate-pulse"
              >
                <div className="h-4 bg-bg-elevated rounded w-1/2 mb-3" />
                <div className="h-3 bg-bg-elevated rounded w-full mb-2" />
                <div className="h-3 bg-bg-elevated rounded w-3/4" />
              </div>
            ))}
          </div>
        }
      >
        <SkillsContent />
      </Suspense>
    </div>
  );
}
