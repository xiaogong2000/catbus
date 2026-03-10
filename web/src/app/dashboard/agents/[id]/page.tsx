"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { StatsRow } from "@/components/data-display/stats-row";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getAgentById,
  getCallsByAgent,
  weeklyCallStats,
  formatUptime,
  relativeTime,
} from "@/lib/mock-data-dashboard";
import { cn } from "@/lib/utils";
import { thClass, tdBaseClass, trHoverClass } from "@/lib/table-styles";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";
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
  const agent = getAgentById(params.id);

  const chartText = useCssVar("--c-text-muted", "hsl(0 0% 50%)");
  const chartBg = useCssVar("--c-bg-elevated", "hsl(0 0% 6%)");
  const chartBorder = useCssVar("--c-border", "hsl(0 0% 12%)");
  const chartFg = useCssVar("--c-text", "hsl(0 0% 93%)");
  const chartDim = useCssVar("--c-text-dim", "hsl(0 0% 60%)");
  const chartSuccess = useCssVar("--c-success", "hsl(150 100% 35%)");
  const chartWarning = useCssVar("--c-warning", "hsl(35 100% 50%)");

  if (!agent) {
    return (
      <div className="py-20 text-center">
        <p className="text-[16px] text-text-dim mb-2">Agent not found</p>
        <Link
          href="/dashboard/agents"
          className="text-[13px] text-text-muted hover:text-text transition-[color] duration-[--motion-base]"
        >
          Back to agents
        </Link>
      </div>
    );
  }

  const calls = getCallsByAgent(agent.name);
  const chartData = weeklyCallStats[agent.node_id] ?? [];

  const totalCalls = agent.skills.reduce((s, sk) => s + sk.calls_handled, 0);
  const avgSuccessRate =
    agent.skills.length > 0
      ? agent.skills.reduce((s, sk) => s + sk.success_rate, 0) /
        agent.skills.length
      : 0;

  const stats = [
    {
      label: "Status",
      value: agent.status === "online" ? "Online" : "Offline",
      description: `Up ${formatUptime(agent.uptime_seconds)}`,
      color: (agent.status === "online" ? "success" : "danger") as "success" | "danger",
    },
    {
      label: "Calls Handled",
      value: String(totalCalls),
      description: "Across all skills",
      color: "default" as const,
    },
    {
      label: "Calls Made",
      value: String(agent.calls_made),
      description: "Outbound to other nodes",
      color: "warning" as const,
    },
    {
      label: "Success Rate",
      value: `${avgSuccessRate.toFixed(1)}%`,
      description: "Average across skills",
      color: "success" as const,
    },
  ];

  return (
    <>
      <Link
        href="/dashboard/agents"
        className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text transition-[color] duration-[--motion-base] mb-4"
      >
        <ArrowLeft size={14} />
        Back to agents
      </Link>

      <PageHeader
        eyebrow="Agent Detail"
        title={agent.name}
        description={`Node ID: ${agent.node_id} \u00b7 Server: ${agent.server}`}
      />

      <StatsRow items={stats} columns={4} className="mb-8" />

      {/* 7-Day Call Chart */}
      <section className="mb-8">
        <h2 className="text-[18px] font-bold text-text mb-4">
          7-Day Call Volume
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
                name="Inbound"
                stroke={chartSuccess}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="outbound"
                name="Outbound"
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
        <h2 className="text-[18px] font-bold text-text mb-4">Skills</h2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Skill</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Calls</th>
                <th className={thClass}>Success Rate</th>
              </tr>
            </thead>
            <tbody>
              {agent.skills.map((skill) => (
                <tr
                  key={skill.name}
                  className={trHoverClass}
                >
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
          Recent Calls
        </h2>
        {calls.length > 0 ? (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>Time</th>
                  <th className={thClass}>Direction</th>
                  <th className={thClass}>Skill</th>
                  <th className={thClass}>Remote</th>
                  <th className={thClass}>Latency</th>
                </tr>
              </thead>
              <tbody>
                {calls.slice(0, 10).map((call) => (
                  <tr
                    key={call.id}
                    className={trHoverClass}
                  >
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
                        {call.direction === "inbound" ? "In" : "Out"}
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
            <p className="text-[14px] text-text-dim">No calls recorded yet.</p>
          </Card>
        )}
      </section>
    </>
  );
}
