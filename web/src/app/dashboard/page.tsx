"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PageTransition } from "@/components/motion/page-transition";
import { StatsRow } from "@/components/data-display/stats-row";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUptime, relativeTime } from "@/lib/mock-data-dashboard";
import type { Agent, CallRecord, DashboardStats } from "@/lib/mock-data-dashboard";
import { fetchDashboardStats, fetchAgents, fetchCalls } from "@/lib/dashboard-api";
import { cn, formatNumber } from "@/lib/utils";
import { thClass, tdBaseClass, trHoverClass } from "@/lib/table-styles";
import { Bot, ArrowDownLeft, ArrowUpRight, Link2, Coins, Trophy } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { getEarnings, getLeaderboard } from "@/lib/dashboard-api";
import type { EarningsOverview, LeaderboardResponse } from "@/lib/provider-types";
import Link from "next/link";

export default function DashboardPage() {
  const { t } = useLocale();
  const [statsData, setStatsData] = useState<DashboardStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallRecord[]>([]);
  const [earnings, setEarnings] = useState<EarningsOverview | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [s, a, c, e, lb] = await Promise.all([
          fetchDashboardStats(),
          fetchAgents(),
          fetchCalls({ page: 1, limit: 5 }),
          getEarnings().catch(() => null),
          getLeaderboard(1).catch(() => null),
        ]);
        setStatsData(s);
        setAgents(a);
        setRecentCalls(c.data);
        setEarnings(e);
        setLeaderboard(lb);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stats = statsData
    ? [
        {
          label: t("dash.overview.myAgents"),
          value: String(statsData.my_agents),
          description: `${statsData.my_skills} ${t("dash.overview.skillsRegistered")}`,
          color: "default" as const,
        },
        {
          label: t("dash.overview.callsReceived"),
          value: formatNumber(statsData.calls_received),
          description: t("dash.overview.inboundCalls"),
          color: "success" as const,
        },
        {
          label: t("dash.overview.callsMade"),
          value: formatNumber(statsData.calls_made),
          description: t("dash.overview.outboundCalls"),
          color: "warning" as const,
        },
        {
          label: t("dash.overview.successRate"),
          value: `${statsData.success_rate}%`,
          description: `${t("dash.overview.avgLatency")} ${statsData.avg_latency_ms}ms`,
          color: "success" as const,
        },
      ]
    : [];

  if (error) {
    return (
      <>
        <PageHeader eyebrow={t("dash.eyebrow")} title={t("dash.overview.title")} description={t("dash.overview.desc")} />
        <Card hoverable={false} className="py-12 text-center">
          <p className="text-[14px] text-danger mb-1">{t("dash.overview.loadFailed")}</p>
          <p className="text-[13px] text-text-muted">{error}</p>
        </Card>
      </>
    );
  }

  return (
    <PageTransition>
      <PageHeader
        eyebrow={t("dash.eyebrow")}
        title={t("dash.overview.title")}
        description={t("dash.overview.desc")}
      />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="py-4 px-3">
              <Skeleton variant="text" width={60} height={28} className="mb-1" />
              <Skeleton variant="text" width={100} height={14} />
            </div>
          ))}
        </div>
      ) : (
        <StatsRow items={stats} columns={4} className="mb-8" />
      )}

      {/* Provider Earnings Stats */}
      {!loading && earnings && (
        <StatsRow
          items={[
            {
              label: t("dash.overview.todayEarnings"),
              value: `${earnings.today.credits}`,
              description: `${earnings.today.tasks} ${t("dash.earnings.tasks")}`,
              color: "warning" as const,
              icon: <Coins size={16} className="text-warning" />,
            },
            {
              label: t("dash.overview.totalCredits"),
              value: `${earnings.total.credits}`,
              description: t("dash.overview.allTime"),
              color: "success" as const,
              icon: <Coins size={16} className="text-success" />,
            },
            {
              label: t("dash.overview.providerRank"),
              value: leaderboard?.my_rank ? `#${leaderboard.my_rank}` : "—",
              description: leaderboard?.my_rank
                ? `${t("dash.leaderboard.successRate")} ${leaderboard.my_stats?.success_rate ?? 0}%`
                : t("dash.leaderboard.notRanked"),
              color: "default" as const,
              icon: <Trophy size={16} className="text-[#FFD700]" />,
            },
          ]}
          columns={3}
          className="mb-8"
        />
      )}

      {/* My Agents */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] font-bold text-text">{t("dash.overview.myAgents")}</h2>
          <Link
            href="/dashboard/agents"
            className="text-[13px] text-text-dim hover:text-text transition-[color] duration-[--motion-base] ease-[--ease-standard]"
          >
            {t("dash.overview.viewAll")}
          </Link>
        </div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <Card key={i} className="h-24">
                <Skeleton variant="text" width={120} height={18} className="mb-2" />
                <Skeleton variant="text" width={200} height={14} />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {agents.map((agent) => (
              <Link key={agent.node_id} href={`/dashboard/agents/${agent.node_id}`}>
                <Card className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-md bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                    <Bot size={18} className="text-text-dim" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold text-text">
                        {agent.name}
                      </span>
                      <Badge status={agent.status} />
                    </div>
                    <p className="text-[12px] text-text-muted mb-2">
                      {agent.skills.length} {t("dash.overview.skills")} &middot; {t("dash.overview.up")}{" "}
                      {formatUptime(agent.uptime_seconds)}
                    </p>
                    <div className="flex gap-4 text-[12px] text-text-dim">
                      <span>{agent.calls_handled} {t("dash.overview.callsHandled")}</span>
                      <span>{agent.calls_made} {t("dash.agents.callsMade")}</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
            {agents.length === 0 && (
              <Card hoverable={false} className="py-10 text-center col-span-2">
                <Bot size={28} className="text-text-muted mx-auto mb-3" />
                <p className="text-[14px] text-text-dim mb-4">{t("dash.overview.noAgents")}</p>
                <Link
                  href="/dashboard/agents"
                  className="inline-flex items-center gap-2 text-[13px] font-medium text-text border border-border rounded-md px-4 py-2 hover:border-border-hover transition-[border-color] duration-[--motion-base]"
                >
                  <Link2 size={14} />
                  {t("dash.settings.bindAgent")}
                </Link>
              </Card>
            )}
          </div>
        )}
      </section>

      {/* Recent Calls */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] font-bold text-text">{t("dash.overview.recentCalls")}</h2>
          <Link
            href="/dashboard/calls"
            className="text-[13px] text-text-dim hover:text-text transition-[color] duration-[--motion-base] ease-[--ease-standard]"
          >
            {t("dash.overview.viewAll")}
          </Link>
        </div>
        {loading ? (
          <Card className="py-8">
            <Skeleton variant="text" width="100%" height={16} className="mb-2" />
            <Skeleton variant="text" width="80%" height={16} className="mb-2" />
            <Skeleton variant="text" width="90%" height={16} />
          </Card>
        ) : recentCalls.length > 0 ? (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>{t("dash.table.time")}</th>
                  <th className={thClass}>{t("dash.table.direction")}</th>
                  <th className={thClass}>{t("dash.table.skill")}</th>
                  <th className={thClass}>{t("dash.table.remote")}</th>
                  <th className={thClass}>{t("dash.table.latency")}</th>
                  <th className={thClass}>{t("dash.table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {recentCalls.map((call) => (
                  <tr key={call.id} className={trHoverClass}>
                    <td className={cn(tdBaseClass, "text-text-dim")}>
                      {relativeTime(call.timestamp)}
                    </td>
                    <td className={cn(tdBaseClass, "text-text")}>
                      <span className="inline-flex items-center gap-1">
                        {call.direction === "inbound" ? (
                          <ArrowDownLeft size={14} className="text-success" />
                        ) : (
                          <ArrowUpRight size={14} className="text-warning" />
                        )}
                        {call.direction === "inbound" ? t("dash.table.inbound") : t("dash.table.outbound")}
                      </span>
                    </td>
                    <td className={cn(tdBaseClass, "text-text font-mono")}>
                      {call.skill}
                    </td>
                    <td className={cn(tdBaseClass, "text-text-dim")}>
                      {call.remote_node}
                    </td>
                    <td className={cn(tdBaseClass, "text-text-dim")}>
                      {call.latency_ms}ms
                    </td>
                    <td className={tdBaseClass}>
                      <Badge
                        status={
                          call.status === "success"
                            ? "online"
                            : call.status === "error"
                              ? "error"
                              : "offline"
                        }
                        label={call.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card hoverable={false} className="py-8 text-center">
            <p className="text-[13px] text-text-dim">{t("dash.overview.noCalls")}</p>
          </Card>
        )}
      </section>
    </PageTransition>
  );
}
