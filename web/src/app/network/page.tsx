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

const columns = [
  { key: "name", label: "Skill", sortable: true },
  { key: "providers", label: "Providers", sortable: true },
  { key: "calls_today", label: "Calls Today", sortable: true },
  {
    key: "avg_latency_ms",
    label: "Avg Latency",
    sortable: true,
    render: (row: Record<string, unknown>) => (
      <span className="text-warning font-mono">{row.avg_latency_ms as number}ms</span>
    ),
  },
];

export default function NetworkPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [loading, setLoading] = useState(true);

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
          eyebrow="NETWORK"
          title="Network Overview"
          description="Real-time health and activity of the CatBus network."
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
              { label: "Nodes Online", value: String(stats?.online_nodes ?? 0), description: "Active nodes on the network", color: "success" },
              { label: "Skills Available", value: String(stats?.total_skills ?? 0), description: "Unique skills registered" },
              { label: "Calls Today", value: stats ? formatNumber(stats.calls_today) : "0", description: "Total skill invocations", color: "warning" },
              { label: "Avg Response", value: stats ? `${Math.round(stats.avg_latency_ms)}ms` : "0ms", description: "Median response time", color: "success" },
            ]}
          />
        )}

        <AnimateIn>
          <div className="mb-10">
            <h2 className="text-[24px] font-bold tracking-[-0.6px] text-text mb-4">
              Top Skills
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
                title="No skills registered yet"
                description="Connect an agent to the network and publish your first skill."
                steps={[
                  { label: "Install the CatBus SDK", href: "/docs" },
                  { label: "Register your agent node" },
                  { label: "Publish your first skill" },
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
