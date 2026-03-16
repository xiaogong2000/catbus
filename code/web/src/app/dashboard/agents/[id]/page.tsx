"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PageTransition } from "@/components/motion/page-transition";
import { StatsRow } from "@/components/data-display/stats-row";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUptime, relativeTime } from "@/lib/mock-data-dashboard";
import type { Agent, CallRecord, DailyCallStat } from "@/lib/mock-data-dashboard";
import { fetchAgentDetail } from "@/lib/dashboard-api";
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

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useLocale();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [chartData, setChartData] = useState<DailyCallStat[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
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
    fetchAgentDetail(params.id)
      .then((res) => {
        setAgent(res.agent);
        setChartData(res.weekly_stats);
        setCalls(res.recent_calls);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <>
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
      </>
    );
  }

  if (error || !agent) {
    return (
      <div className="py-20 text-center">
        <p className="text-[16px] text-text-dim mb-2">{error || t("dash.agentDetail.notFound")}</p>
        <Link
          href="/dashboard/agents"
          className="text-[13px] text-text-muted hover:text-text transition-[color] duration-[--motion-base]"
        >
          {t("dash.agentDetail.backToAgents")}
        </Link>
      </div>
    );
  }

  const totalCalls = agent.skills.reduce((s, sk) => s + sk.calls_handled, 0);
  const avgSuccessRate =
    agent.skills.length > 0
      ? agent.skills.reduce((s, sk) => s + sk.success_rate, 0) /
        agent.skills.length
      : 0;

  const stats = [
    {
      label: t("dash.agentDetail.status"),
      value: agent.status === "online" ? t("dash.agentDetail.online") : t("dash.agentDetail.offline"),
      description: `${t("dash.overview.up")} ${formatUptime(agent.uptime_seconds)}`,
      color: (agent.status === "online" ? "success" : "danger") as "success" | "danger",
    },
    {
      label: t("dash.agentDetail.callsHandled"),
      value: String(totalCalls),
      description: t("dash.agentDetail.acrossAllSkills"),
      color: "default" as const,
    },
    {
      label: t("dash.agentDetail.callsMade"),
      value: String(agent.calls_made),
      description: t("dash.agentDetail.outboundToOther"),
      color: "warning" as const,
    },
    {
      label: t("dash.agentDetail.successRate"),
      value: `${avgSuccessRate.toFixed(1)}%`,
      description: t("dash.agentDetail.avgAcrossSkills"),
      color: "success" as const,
    },
  ];

  return (
    <PageTransition>
      <Link
        href="/dashboard/agents"
        className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text transition-[color] duration-[--motion-base] mb-4"
      >
        <ArrowLeft size={14} />
        {t("dash.agentDetail.backToAgents")}
      </Link>

      <PageHeader
        eyebrow={t("dash.agentDetail.eyebrow")}
        title={agent.name}
        description={`Node ID: ${agent.node_id} \u00b7 Server: ${agent.server}`}
      />

      <StatsRow items={stats} columns={4} className="mb-8" />

      {/* 7-Day Call Chart */}
      <section className="mb-8">
        <h2 className="text-[18px] font-bold text-text mb-4">
          {t("dash.agentDetail.chartTitle")}
        </h2>
        <Card hoverable={false} className="p-6">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
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
              <Legend
                wrapperStyle={{ fontSize: 12, color: chartDim }}
              />
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

      {/* Skills */}
      <section className="mb-8">
        <h2 className="text-[18px] font-bold text-text mb-4">{t("dash.agentDetail.skills")}</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>{t("dash.table.skill")}</th>
                <th className={thClass}>{t("dash.table.status")}</th>
                <th className={thClass}>{t("dash.table.calls")}</th>
                <th className={thClass}>{t("dash.table.successRate")}</th>
              </tr>
            </thead>
            <tbody>
              {agent.skills.map((skill) => (
                <tr key={skill.name} className={trHoverClass}>
                  <td className={cn(tdBaseClass, "text-[14px] text-text font-mono")}>
                    {skill.name}
                  </td>
                  <td className={tdBaseClass}>
                    <Badge status={skill.status} />
                  </td>
                  <td className={cn(tdBaseClass, "text-[14px] text-text-dim")}>
                    {skill.calls_handled}
                  </td>
                  <td className={cn(tdBaseClass, "text-[14px] text-text-dim")}>
                    {skill.success_rate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent Calls for this Agent */}
      <section>
        <h2 className="text-[18px] font-bold text-text mb-4">
          {t("dash.agentDetail.recentCalls")}
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
                </tr>
              </thead>
              <tbody>
                {calls.slice(0, 10).map((call) => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Card hoverable={false} className="py-8 text-center">
            <p className="text-[14px] text-text-dim">{t("dash.agentDetail.noCalls")}</p>
          </Card>
        )}
      </section>
    </PageTransition>
  );
}
