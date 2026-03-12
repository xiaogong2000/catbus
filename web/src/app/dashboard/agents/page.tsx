"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PageTransition } from "@/components/motion/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BindAgentDialog } from "@/components/provider/bind-agent-dialog";
import { formatUptime } from "@/lib/mock-data-dashboard";
import type { Agent } from "@/lib/mock-data-dashboard";
import { fetchAgents } from "@/lib/dashboard-api";
import { Bot, Plus, Terminal } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import Link from "next/link";

export default function AgentsPage() {
  const { t } = useLocale();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [bindOpen, setBindOpen] = useState(false);

  useEffect(() => {
    fetchAgents()
      .then(setAgents)
      .catch((err) => console.error("Failed to fetch agents:", err))
      .finally(() => setLoading(false));
  }, []);

  function handleAgentBound(agent: Agent) {
    setAgents((prev) => [...prev, agent]);
    setBindOpen(false);
  }

  return (
    <PageTransition>
      <div className="flex items-start justify-between mb-8">
        <PageHeader
          eyebrow={t("dash.eyebrow")}
          title={t("dash.agents.title")}
          description={t("dash.agents.desc")}
          className="mb-0"
        />
        {!loading && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setBindOpen(true)}
            className="shrink-0 mt-6"
          >
            <Plus size={14} className="mr-1.5" />
            {t("dash.settings.bindAgent")}
          </Button>
        )}
      </div>

      <BindAgentDialog
        open={bindOpen}
        onClose={() => setBindOpen(false)}
        onAgentBound={handleAgentBound}
      />

      {/* Agent List */}
      {loading ? (
        <div className="grid gap-4">
          {[0, 1].map((i) => (
            <Card key={i} className="h-28">
              <Skeleton variant="text" width={140} height={20} className="mb-2" />
              <Skeleton variant="text" width={240} height={14} className="mb-2" />
              <Skeleton variant="text" width={180} height={14} />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {agents.map((agent) => (
            <Link key={agent.node_id} href={`/dashboard/agents/${agent.node_id}`}>
              <Card className="flex items-start gap-5">
                <div className="w-10 h-10 rounded-md bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                  <Bot size={20} className="text-text-dim" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[16px] font-semibold text-text">
                      {agent.name}
                    </span>
                    <Badge status={agent.status} />
                  </div>
                  <p className="text-[13px] text-text-muted mb-3">
                    Node ID: {agent.node_id} &middot; Server: {agent.server}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {agent.skills.map((skill) => (
                      <span
                        key={skill.name}
                        className="text-[12px] text-text-dim bg-bg-elevated border border-border rounded-full px-3 py-0.5"
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                  {/* Provider badge — only show if agent has provider config */}
                  {agent.is_provider && (
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-success bg-success/10 border border-success/20 rounded-full px-2.5 py-0.5">
                        Provider
                      </span>
                      {agent.rate_limit ? (
                        <span className="text-[12px] text-text-muted">{agent.rate_limit} calls/hr</span>
                      ) : null}
                    </div>
                  )}
                  <div className="flex gap-6 text-[12px] text-text-dim">
                    <span>{t("dash.overview.up")} {formatUptime(agent.uptime_seconds)}</span>
                    <span>{agent.calls_handled} {t("dash.agents.callsHandled")}</span>
                    <span>{agent.calls_made} {t("dash.agents.callsMade")}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {agents.length === 0 && (
            <Card hoverable={false} className="py-16 text-center">
              <Bot size={40} className="text-text-muted mx-auto mb-4" />
              <p className="text-[16px] font-semibold text-text mb-2">{t("dash.agents.noAgents")}</p>
              <p className="text-[13px] text-text-muted mb-6 max-w-sm mx-auto">
                {t("dash.agents.noAgentsDesc").replace("{cmd}", "catbus serve")}
              </p>
              <Button variant="primary" onClick={() => setBindOpen(true)}>
                <Terminal size={16} className="mr-2" />
                {t("dash.agents.tokenTitle")}
              </Button>
            </Card>
          )}
        </div>
      )}
    </PageTransition>
  );
}
