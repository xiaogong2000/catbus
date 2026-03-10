"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatsRow } from "@/components/data-display/stats-row";
import { DataTable } from "@/components/data-display/data-table";
import { ActivityFeed } from "@/components/data-display/activity-feed";
import { type NetworkStats, type ApiSkill, getStats, getSkills } from "@/lib/api";
import { formatNumber } from "@/lib/utils";

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

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
    getSkills(1, 10).then((res) => setSkills(res.data)).catch(() => {});
  }, []);

  return (
    <div className="py-10">
      <PageHeader
        eyebrow="NETWORK"
        title="Network Overview"
        description="Real-time health and activity of the CatBus network."
      />

      <StatsRow
        items={[
          {
            label: "Nodes Online",
            value: stats ? String(stats.online_nodes) : "—",
            description: "Active nodes on the network",
            color: "success",
          },
          {
            label: "Skills Available",
            value: stats ? String(stats.total_skills) : "—",
            description: "Unique skills registered",
          },
          {
            label: "Calls Today",
            value: stats ? formatNumber(stats.calls_today) : "—",
            description: "Total skill invocations",
            color: "warning",
          },
          {
            label: "Avg Response",
            value: stats ? `${Math.round(stats.avg_latency_ms)}ms` : "—",
            description: "Median response time",
            color: "success",
          },
        ]}
      />

      <div className="mb-10">
        <h2 className="text-[24px] font-bold tracking-[-0.6px] text-text mb-4">
          Top Skills
        </h2>
        {skills.length === 0 ? (
          <p className="text-[14px] text-text-muted py-8 text-center">
            No skills registered yet. Connect an agent to get started.
          </p>
        ) : (
          <DataTable columns={columns} data={skills as unknown as Record<string, unknown>[]} />
        )}
      </div>

      <ActivityFeed items={[]} />
    </div>
  );
}
