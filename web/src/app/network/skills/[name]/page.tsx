"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatsRow } from "@/components/data-display/stats-row";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/motion/page-transition";
import { type ApiSkillDetail, getSkillByName } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { ArrowLeft, Server } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

export default function SkillDetailPage() {
  const params = useParams<{ name: string }>();
  const { t } = useLocale();
  const [skill, setSkill] = useState<ApiSkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSkillByName(decodeURIComponent(params.name))
      .then(setSkill)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [params.name]);

  if (loading) {
    return (
      <div className="py-10">
        <Skeleton variant="text" width={100} height={16} className="mb-4" />
        <Skeleton variant="text" width={200} height={32} className="mb-2" />
        <Skeleton variant="text" width={400} height={16} className="mb-8" />
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="py-4">
              <Skeleton variant="text" width={60} height={28} className="mb-1" />
              <Skeleton variant="text" width={100} height={14} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !skill) {
    return (
      <div className="py-20 text-center">
        <p className="text-[16px] text-text-dim mb-2">{error || t("skillDetail.notFound")}</p>
        <Link
          href="/network/skills"
          className="text-[13px] text-text-muted hover:text-text transition-[color] duration-[--motion-base]"
        >
          {t("skillDetail.backToSkills")}
        </Link>
      </div>
    );
  }

  const stats = [
    {
      label: t("skillDetail.providers"),
      value: String(skill.providers.length),
      description: `${skill.providers.length} ${t("skillDetail.providers").toLowerCase()}`,
      color: "default" as const,
    },
    {
      label: t("skillDetail.totalCalls"),
      value: formatNumber(skill.calls_total),
      description: t("skillDetail.allTimeTotal"),
      color: "success" as const,
    },
    {
      label: t("skillDetail.avgLatency"),
      value: `${skill.avg_latency_ms.toFixed(0)}ms`,
      description: t("skillDetail.acrossAllCalls"),
      color: "warning" as const,
    },
  ];

  const schemaEntries = Object.entries(skill.input_schema || {});

  return (
    <PageTransition>
      <div className="py-10">
        <Link
          href="/network/skills"
          className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text transition-[color] duration-[--motion-base] mb-4"
        >
          <ArrowLeft size={14} />
          {t("skillDetail.backToSkills")}
        </Link>

        <PageHeader
          eyebrow={t("skillDetail.eyebrow")}
          title={skill.name}
          description={skill.description}
        />

        <StatsRow items={stats} columns={3} className="mb-8" />

        {/* Input Schema */}
        {schemaEntries.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[18px] font-bold text-text mb-4">
              {t("skillDetail.inputSchema")}
            </h2>
            <Card hoverable={false}>
              <div className="font-mono text-[13px] space-y-2">
                {schemaEntries.map(([key, type]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-text font-semibold">{key}</span>
                    <span className="text-text-muted">:</span>
                    <span className="text-warning">{type}</span>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}

        {/* Provider Nodes */}
        <section>
          <h2 className="text-[18px] font-bold text-text mb-4">
            {t("skillDetail.providerList")}
          </h2>
          {skill.providers.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {skill.providers.map((p) => (
                <Link key={p.node_id} href={`/network/nodes/${p.node_id}`}>
                  <Card className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-md bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                      <Server size={16} className="text-text-dim" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-text">{p.name}</p>
                      <p className="text-[12px] text-text-muted font-mono">{p.node_id}</p>
                    </div>
                    <Badge status="online" className="ml-auto" />
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card hoverable={false} className="py-8 text-center">
              <p className="text-[14px] text-text-dim">{t("skillDetail.noProviders")}</p>
            </Card>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
