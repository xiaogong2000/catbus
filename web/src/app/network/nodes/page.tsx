"use client";

import { Fragment, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AnimateIn } from "@/components/motion/animate-in";
import { PageTransition } from "@/components/motion/page-transition";
import { cn } from "@/lib/utils";
import { thClass, tdBaseClass } from "@/lib/table-styles";
import { type ApiNode, getNodes } from "@/lib/api";
import { formatUptime } from "@/lib/mock-data-dashboard";
import { Server } from "lucide-react";

export default function NodesPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ApiNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNodes(1, 50)
      .then((res) => setNodes(res.data))
      .catch((err) => console.error("Failed to fetch nodes:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageTransition>
      <div className="py-10">
        <PageHeader
          eyebrow="NODES"
          title="Online Nodes"
          description="All nodes currently connected to the CatBus network."
        />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={52} />
            ))}
          </div>
        ) : nodes.length === 0 ? (
          <EmptyState
            icon={<Server size={24} className="text-text-dim" />}
            title="No nodes online"
            description="No agents are currently connected to the network. Be the first to join!"
            steps={[
              { label: "Install CatBus SDK: pip install catbus" },
              { label: "Initialize your agent: catbus init" },
              { label: "Start serving: catbus serve" },
            ]}
          />
        ) : (
          <AnimateIn>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Node Name", "Node ID", "Skills", "Uptime", "Status"].map((h) => (
                      <th key={h} className={thClass}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((node) => (
                    <Fragment key={node.node_id}>
                      <tr
                        onClick={() => setExpanded(expanded === node.node_id ? null : node.node_id)}
                        className="cursor-pointer hover:bg-bg-subtle transition-[background] duration-[--motion-base]"
                      >
                        <td className={cn(tdBaseClass, "text-[14px] text-text font-medium")}>{node.name}</td>
                        <td className={cn(tdBaseClass, "text-[14px] text-text-dim font-mono")}>{node.node_id.slice(0, 12)}</td>
                        <td className={cn(tdBaseClass, "text-[14px] text-text")}>{node.skills.length}</td>
                        <td className={cn(tdBaseClass, "text-[14px] text-text-dim")}>{formatUptime(node.uptime_seconds)}</td>
                        <td className={cn(tdBaseClass, "text-[14px]")}>
                          <span className="inline-flex items-center gap-1.5 text-success text-[13px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-success" />
                            {node.status}
                          </span>
                        </td>
                      </tr>
                      {expanded === node.node_id && (
                        <tr>
                          <td colSpan={5} className="px-4 py-4 border-b border-border bg-bg-subtle">
                            <p className="text-[12px] uppercase tracking-[0.6px] text-text-muted mb-2">Skills provided</p>
                            <div className="flex flex-wrap gap-2">
                              {node.skills.map((s) => (
                                <span key={s} className="bg-bg-elevated border border-border rounded-full px-3 py-1 text-[12px] text-text-dim">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </AnimateIn>
        )}
      </div>
    </PageTransition>
  );
}
