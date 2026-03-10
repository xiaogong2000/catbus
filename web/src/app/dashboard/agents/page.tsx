import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { myAgents, formatUptime } from "@/lib/mock-data-dashboard";
import { Bot } from "lucide-react";
import Link from "next/link";

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="My Agents"
        description="Manage your registered agents and their skills."
      />

      <div className="grid gap-4">
        {myAgents.map((agent) => (
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

                {/* Skills */}
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

                {/* Stats row */}
                <div className="flex gap-6 text-[12px] text-text-dim">
                  <span>
                    Up {formatUptime(agent.uptime_seconds)}
                  </span>
                  <span>{agent.calls_handled} calls handled</span>
                  <span>{agent.calls_made} calls made</span>
                </div>
              </div>
            </Card>
          </Link>
        ))}

        {myAgents.length === 0 && (
          <Card hoverable={false} className="py-12 text-center">
            <Bot size={32} className="text-text-muted mx-auto mb-3" />
            <p className="text-[14px] text-text-dim mb-1">No agents registered</p>
            <p className="text-[13px] text-text-muted">
              Run <code className="font-mono text-text bg-bg-elevated px-1.5 py-0.5 rounded">catbus serve</code> to connect your first agent.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
