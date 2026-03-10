import { PageHeader } from "@/components/layout/page-header";
import { StatsRow } from "@/components/data-display/stats-row";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  dashboardStats,
  myAgents,
  callHistory,
  formatUptime,
  relativeTime,
} from "@/lib/mock-data-dashboard";
import { cn, formatNumber } from "@/lib/utils";
import { thClass, tdBaseClass, trHoverClass } from "@/lib/table-styles";
import { Bot, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const stats = [
    {
      label: "My Agents",
      value: String(dashboardStats.my_agents),
      description: `${dashboardStats.my_skills} skills registered`,
      color: "default" as const,
    },
    {
      label: "Calls Received",
      value: formatNumber(dashboardStats.calls_received),
      description: "Inbound calls today",
      color: "success" as const,
    },
    {
      label: "Calls Made",
      value: formatNumber(dashboardStats.calls_made),
      description: "Outbound calls today",
      color: "warning" as const,
    },
    {
      label: "Success Rate",
      value: `${dashboardStats.success_rate}%`,
      description: `Avg latency ${dashboardStats.avg_latency_ms}ms`,
      color: "success" as const,
    },
  ];

  const recentCalls = callHistory.slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Overview"
        description="Monitor your agents and network activity."
      />

      <StatsRow items={stats} columns={4} className="mb-8" />

      {/* My Agents */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] font-bold text-text">My Agents</h2>
          <Link
            href="/dashboard/agents"
            className="text-[13px] text-text-dim hover:text-text transition-[color] duration-[--motion-base] ease-[--ease-standard]"
          >
            View All
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {myAgents.map((agent) => (
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
                    {agent.skills.length} skills &middot; up{" "}
                    {formatUptime(agent.uptime_seconds)}
                  </p>
                  <div className="flex gap-4 text-[12px] text-text-dim">
                    <span>{agent.calls_handled} calls handled</span>
                    <span>{agent.calls_made} calls made</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Calls */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] font-bold text-text">Recent Calls</h2>
          <Link
            href="/dashboard/calls"
            className="text-[13px] text-text-dim hover:text-text transition-[color] duration-[--motion-base] ease-[--ease-standard]"
          >
            View All
          </Link>
        </div>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Time</th>
                <th className={thClass}>Direction</th>
                <th className={thClass}>Skill</th>
                <th className={thClass}>Remote</th>
                <th className={thClass}>Latency</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentCalls.map((call) => (
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
                      {call.direction === "inbound" ? "Inbound" : "Outbound"}
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
      </section>
    </>
  );
}
