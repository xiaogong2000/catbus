"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatsRow } from "@/components/data-display/stats-row";
import { DataTable } from "@/components/data-display/data-table";
import { ActivityFeed } from "@/components/data-display/activity-feed";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AnimateIn } from "@/components/motion/animate-in";
import { PageTransition } from "@/components/motion/page-transition";
import { type NetworkStats, type ApiSkill, getStats, getSkills } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { Globe } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

export default function NetworkPage() {
  const { t } = useLocale();
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [loading, setLoading] = useState(true);

  const columns = [
    { key: "name", label: t("network.table.skill"), sortable: true },
    { key: "providers", label: t("network.table.providers"), sortable: true },
    { key: "calls_today", label: t("network.table.callsToday"), sortable: true },
    {
      key: "avg_latency_ms",
      label: t("network.table.avgLatency"),
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-warning font-mono">{row.avg_latency_ms as number}ms</span>
      ),
    },
  ];

  useEffect(() => {
    Promise.all([
      getStats().then(setStats),
      getSkills(1, 10).then((res) => setSkills(res.data)),
    ])
      .catch((err) => console.error("Failed to fetch network data:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageTransition>
      <div className="py-10">
        <PageHeader
          eyebrow={t("network.eyebrow")}
          title={t("network.title")}
          description={t("network.desc")}
        />

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={100} />
            ))}
          </div>
        ) : (
          <StatsRow
            items={[
              { label: t("network.stat.nodesOnline"), value: String(stats?.online_nodes ?? 0), description: t("network.stat.nodesOnlineDesc"), color: "success" },
              { label: t("network.stat.skillsAvailable"), value: String(stats?.total_skills ?? 0), description: t("network.stat.skillsAvailableDesc") },
              { label: t("network.stat.callsToday"), value: stats ? formatNumber(stats.calls_today) : "0", description: t("network.stat.callsTodayDesc"), color: "warning" },
              { label: t("network.stat.avgResponse"), value: stats ? `${Math.round(stats.avg_latency_ms)}ms` : "0ms", description: t("network.stat.avgResponseDesc"), color: "success" },
            ]}
          />
        )}

        <AnimateIn>
          <div className="mb-10">
            <h2 className="text-[24px] font-bold tracking-[-0.6px] text-text mb-4">
              {t("network.topSkills")}
            </h2>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} height={48} />
                ))}
              </div>
            ) : skills.length === 0 ? (
              <EmptyState
                icon={<Globe size={24} className="text-text-dim" />}
                title={t("network.empty.title")}
                description={t("network.empty.desc")}
                steps={[
                  { label: t("network.empty.step1"), href: "/docs" },
                  { label: t("network.empty.step2") },
                  { label: t("network.empty.step3") },
                ]}
              />
            ) : (
              <DataTable columns={columns} data={skills as unknown as Record<string, unknown>[]} />
            )}
          </div>
        </AnimateIn>

        <AnimateIn>
          <ActivityFeed items={[]} />
        </AnimateIn>
      </div>
    </PageTransition>
  );
}
