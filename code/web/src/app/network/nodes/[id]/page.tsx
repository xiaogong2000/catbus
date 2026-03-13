"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatsRow } from "@/components/data-display/stats-row";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/motion/page-transition";
import { formatUptime } from "@/lib/mock-data-dashboard";
import {
  type ApiNode,
  type ApiNodeCall,
  type ApiNodeCallsSummary,
  type ApiNodeDailyStat,
  getNodeDetail,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { thClass, tdBaseClass, trHoverClass } from "@/lib/table-styles";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function useCssVar(name: string, fallback: string): string {
  const [val, setVal] = useState(fallback);
  useEffect(() => {
    const read = () => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
      setVal(raw ? `hsl(${raw})` : fallback);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [name, fallback]);
  return val;
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NodeDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useLocale();
  const [node, setNode] = useState<ApiNode | null>(null);
  const [summary, setSummary] = useState<ApiNodeCallsSummary | null>(null);
  const [dailyStats, setDailyStats] = useState<ApiNodeDailyStat[]>([]);
  const [calls, setCalls] = useState<ApiNodeCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chartText = useCssVar("--c-text-muted", "hsl(0 0% 50%)");
  const chartBg = useCssVar("--c-bg-elevated", "hsl(0 0% 6%)");
  const chartBorder = useCssVar("--c-border", "hsl(0 0% 12%)");
  const chartFg = useCssVar("--c-text", "hsl(0 0% 93%)");
  const chartDim = useCssVar("--c-text-dim", "hsl(0 0% 60%)");
  const chartSuccess = useCssVar("--c-success", "hsl(150 100% 35%)");
  const chartWarning = useCssVar("--c-warning", "hsl(35 100% 50%)");

  useEffect(() => {
    async function load() {
      try {
        const detail = await getNodeDetail(params.id);
        setNode(detail.node);
        setSummary(detail.summary);
        setDailyStats(detail.daily_stats);
        setCalls(detail.recent_calls);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="py-10">
        <Skeleton variant="text" width={100} height={16} className="mb-4" />
        <Skeleton variant="text" width={200} height={32} className="mb-2" />
        <Skeleton variant="text" width={300} height={16} className="mb-8" />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="py-4">
              <Skeleton variant="text" width={60} height={28} className="mb-1" />
              <Skeleton variant="text" width={100} height={14} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !node) {
    return (
      <div className="py-20 text-center">
        <p className="text-[16px] text-text-dim mb-2">{error || t("nodeDetail.notFound")}</p>
        <Link
          href="/network/nodes"
          className="text-[13px] text-text-muted hover:text-text transition-[color] duration-[--motion-base]"
        >
          {t("nodeDetail.backToNodes")}
        </Link>
      </div>
    );
  }

  const stats = summary
    ? [
        {
          label: t("nodeDetail.status"),
          value: t(`status.${node.status}`),
          description: `${t("dash.overview.up")} ${formatUptime(node.uptime_seconds)}`,
          color: (node.status === "online" ? "success" : "danger") as "success" | "danger",
        },
        {
          label: t("nodeDetail.callsHandled"),
          value: String(summary.total_handled),
          description: t("nodeDetail.inboundTotal"),
          color: "success" as const,
        },
        {
          label: t("nodeDetail.callsMade"),
          value: String(summary.total_made),
          description: t("nodeDetail.outboundTotal"),
          color: "warning" as const,
        },
        {
          label: t("nodeDetail.successRate"),
          value: `${summary.success_rate.toFixed(1)}%`,
          description: t("nodeDetail.overallRate"),
          color: "success" as const,
        },
      ]
    : [];

  return (
    <PageTransition>
      <div className="py-10">
        <Link
          href="/network/nodes"
          className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text transition-[color] duration-[--motion-base] mb-4"
        >
          <ArrowLeft size={14} />
          {t("nodeDetail.backToNodes")}
        </Link>

        <PageHeader
          eyebrow={t("nodeDetail.eyebrow")}
          title={node.name}
          description={`Node ID: ${node.node_id}`}
        />

        {summary && <StatsRow items={stats} columns={4} className="mb-8" />}

        {/* Skills */}
        <section className="mb-8">
          <h2 className="text-[18px] font-bold text-text mb-4">{t("nodeDetail.skills")}</h2>
          <div className="flex flex-wrap gap-2">
            {node.skills.map((s) => (
              <Link
                key={s}
                href={`/network/skills/${encodeURIComponent(s)}`}
                className="bg-bg-elevated border border-border rounded-full px-4 py-1.5 text-[13px] text-text-dim hover:text-text hover:border-text-dim transition-[color,border-color] duration-[--motion-base]"
              >
                {s}
              </Link>
            ))}
          </div>
        </section>

        {/* 7-Day Chart */}
        {dailyStats.length > 0 && (
          <section className="mb-8">
            <h2 className="text-[18px] font-bold text-text mb-4">
              {t("nodeDetail.chartTitle")}
            </h2>
            <Card hoverable={false} className="p-6">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={dailyStats}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => d.slice(5)}
                    stroke={chartText}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke={chartText}
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: chartBg,
                      border: `1px solid ${chartBorder}`,
                      borderRadius: 6,
                      fontSize: 13,
                      color: chartFg,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: chartDim }} />
                  <Line
                    type="monotone"
                    dataKey="inbound"
                    name={t("dash.table.inbound")}
                    stroke={chartSuccess}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="outbound"
                    name={t("dash.table.outbound")}
                    stroke={chartWarning}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </section>
        )}

        {/* Recent Calls */}
        <section>
          <h2 className="text-[18px] font-bold text-text mb-4">
            {t("nodeDetail.recentCalls")}
          </h2>
          {calls.length > 0 ? (
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
                  {calls.map((call) => (
                    <tr key={call.id} className={trHoverClass}>
                      <td className={cn(tdBaseClass, "text-text-dim whitespace-nowrap")}>
                        {relativeTime(call.timestamp)}
                      </td>
                      <td className={cn(tdBaseClass, "text-text")}>
                        <span className="inline-flex items-center gap-1">
                          {call.direction === "inbound" ? (
                            <ArrowDownLeft size={14} className="text-success" />
                          ) : (
                            <ArrowUpRight size={14} className="text-warning" />
                          )}
                          {call.direction === "inbound" ? t("dash.table.in") : t("dash.table.out")}
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
              <p className="text-[14px] text-text-dim">{t("nodeDetail.noCalls")}</p>
            </Card>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
