"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { PageTransition } from "@/components/motion/page-transition";
import { StatsRow } from "@/components/data-display/stats-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUptime, relativeTime } from "@/lib/mock-data-dashboard";
import type { Agent, CallRecord, DailyCallStat } from "@/lib/mock-data-dashboard";
import { fetchAgentDetail, getProviderConfig, saveProviderConfig, getIncomingHireRequests, respondToHireRequest, getHireContracts } from "@/lib/dashboard-api";
import type { ProviderConfig, SaveProviderConfigRequest, IncomingHireRequest, HireContract } from "@/lib/provider-types";
import { ProviderConfigForm } from "@/components/provider/provider-config-form";
import { cn } from "@/lib/utils";
import { thClass, tdBaseClass, trHoverClass } from "@/lib/table-styles";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, Settings2, Inbox, CheckCircle, XCircle, Loader2 } from "lucide-react";
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
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  // Hire requests & contracts for this agent
  const [hireRequests, setHireRequests] = useState<IncomingHireRequest[]>([]);
  const [hireContracts, setHireContracts] = useState<HireContract[]>([]);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

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
        return getProviderConfig(params.id);
      })
      .then(setProviderConfig)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleSaveConfig(config: SaveProviderConfigRequest) {
    if (!agent) return;
    setConfigSaving(true);
    try {
      await saveProviderConfig(agent.node_id, config);
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } finally {
      setConfigSaving(false);
    }
  }

  async function loadHireData() {
    try {
      const [reqRes, conRes] = await Promise.all([
        getIncomingHireRequests(undefined, params.id).catch(() => ({ requests: [], pending_count: 0 })),
        getHireContracts(params.id).catch(() => ({ contracts: [] })),
      ]);
      // Normalize backend response — may have different field names
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setHireRequests((reqRes.requests || []).map((r: any) => ({
        id: r.id || "",
        requester_name: r.requester_name || `User ${r.requester_id || ""}`,
        target_node_id: r.target_node_id || r.node_id || "",
        target_name: r.target_name || r.node_id || "",
        message: r.message || "",
        status: (r.status || "pending") as "pending" | "approved" | "rejected" | "expired",
        requested_at: r.requested_at || r.created_at || new Date().toISOString(),
      })));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setHireContracts((conRes.contracts || []).map((c: any) => ({
        id: c.id || "",
        hirer_name: c.hirer_name || `User ${c.requester_id || ""}`,
        node_id: c.node_id || "",
        allowed_skills: c.allowed_skills || [],
        rate_limit: c.rate_limit || 0,
        price_per_call: c.price_per_call || 0,
        status: c.status === "active" ? "active" as const : "terminated" as const,
        hired_at: c.hired_at || new Date().toISOString(),
        expires_at: c.expires_at || null,
        total_calls: c.total_calls || 0,
        total_cost: c.total_cost || 0,
      })));
    } catch {
      setHireRequests([]);
      setHireContracts([]);
    }
  }

  async function handleRespond(requestId: string, action: "approve" | "reject") {
    setRespondingTo(requestId);
    try {
      await respondToHireRequest(requestId, action);
      setHireRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: action === "approve" ? "approved" : "rejected" } : r,
        ),
      );
    } finally {
      setRespondingTo(null);
    }
  }

  function toggleRequestsSection() {
    const next = !requestsOpen;
    setRequestsOpen(next);
    if (next) loadHireData();
  }

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

      {/* Provider Config */}
      {providerConfig && (
        <section className="mb-8">
          <button
            onClick={() => setConfigOpen((v) => !v)}
            className="flex items-center gap-2 w-full text-left mb-4 cursor-pointer"
          >
            <Settings2 size={18} className="text-text-dim" />
            <h2 className="text-[18px] font-bold text-text">
              {t("dash.agentDetail.providerConfig")}
            </h2>
            {configSaved && (
              <span className="text-[12px] text-success ml-2">{t("dash.agentDetail.configSaved")}</span>
            )}
            <span className="ml-auto text-text-muted">
              {configOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </button>
          {configOpen && (
            <Card hoverable={false}>
              <ProviderConfigForm
                models={providerConfig.models}
                skills={providerConfig.skills}
                onSave={handleSaveConfig}
                saving={configSaving}
              />
            </Card>
          )}
        </section>
      )}

      {/* Hire Requests & Contracts */}
      <section className="mb-8">
        <button
          onClick={toggleRequestsSection}
          className="flex items-center gap-2 w-full text-left mb-4 cursor-pointer"
        >
          <Inbox size={18} className="text-text-dim" />
          <h2 className="text-[18px] font-bold text-text">
            {t("dash.agentDetail.hireRequests")}
          </h2>
          <span className="ml-auto text-text-muted">
            {requestsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </span>
        </button>
        {requestsOpen && (
          <div className="space-y-6">
            {/* Pending Requests */}
            <div>
              <h3 className="text-[13px] uppercase tracking-wider text-text-muted font-semibold mb-3">
                {t("dash.agentDetail.pendingRequests")}
              </h3>
              {hireRequests.length > 0 ? (
                <div className="space-y-2">
                  {hireRequests.map((req) => (
                    <Card key={req.id} hoverable={false} className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[14px] font-semibold text-text">
                            {req.requester_name}
                          </span>
                          <span className={cn(
                            "text-[10px] font-semibold uppercase border rounded-full px-2 py-0.5",
                            req.status === "pending" ? "text-warning bg-warning/10 border-warning/20" :
                            req.status === "approved" ? "text-success bg-success/10 border-success/20" :
                            "text-danger bg-danger/10 border-danger/20"
                          )}>
                            {t(`dash.hired.${req.status}`)}
                          </span>
                        </div>
                        {req.message && (
                          <p className="text-[12px] text-text-dim">{req.message}</p>
                        )}
                        <p className="text-[11px] text-text-muted mt-1">
                          {relativeTime(req.requested_at)}
                        </p>
                      </div>
                      {req.status === "pending" && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleRespond(req.id, "approve")}
                            disabled={respondingTo === req.id}
                          >
                            {respondingTo === req.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle size={14} className="mr-1" />
                            )}
                            {t("dash.agentDetail.approve")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRespond(req.id, "reject")}
                            disabled={respondingTo === req.id}
                            className="text-text-muted hover:text-danger"
                          >
                            <XCircle size={14} className="mr-1" />
                            {t("dash.agentDetail.reject")}
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-text-muted py-4">{t("dash.agentDetail.noRequests")}</p>
              )}
            </div>

            {/* Active Contracts */}
            <div>
              <h3 className="text-[13px] uppercase tracking-wider text-text-muted font-semibold mb-3">
                {t("dash.agentDetail.activeContracts")}
              </h3>
              {hireContracts.length > 0 ? (
                <div className="space-y-2">
                  {hireContracts.map((c) => (
                    <Card key={c.id} hoverable={false} className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <span className="text-[14px] font-semibold text-text">{c.hirer_name}</span>
                        <div className="flex gap-4 text-[12px] text-text-muted mt-1">
                          <span>{c.rate_limit} {t("dash.hired.rateLimit")}</span>
                          <span>{c.total_calls} {t("dash.hired.totalCalls")}</span>
                          <span>{c.total_cost.toFixed(1)} {t("dash.hired.totalCost")}</span>
                        </div>
                      </div>
                      <Badge status={c.status === "active" ? "online" : "offline"} label={c.status} />
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-text-muted py-4">{t("dash.agentDetail.noContracts")}</p>
              )}
            </div>
          </div>
        )}
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
