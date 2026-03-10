"use client";

import { Fragment, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { thClass, tdBaseClass } from "@/lib/table-styles";
import { type ApiNode, getNodes } from "@/lib/api";
import { formatUptime } from "@/lib/mock-data-dashboard";

export default function NodesPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [nodes, setNodes] = useState<ApiNode[]>([]);

  useEffect(() => {
    getNodes(1, 50).then((res) => setNodes(res.data)).catch(() => {});
  }, []);

  return (
    <div className="py-10">
      <PageHeader
        eyebrow="NODES"
        title="Online Nodes"
        description="All nodes currently connected to the CatBus network."
      />

      {nodes.length === 0 ? (
        <p className="text-[14px] text-text-muted py-8 text-center">
          No nodes are currently online. Connect an agent to see it here.
        </p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Node Name", "Node ID", "Skills", "Uptime", "Status"].map(
                  (h) => (
                    <th key={h} className={thClass}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <Fragment key={node.node_id}>
                  <tr
                    onClick={() =>
                      setExpanded(
                        expanded === node.node_id ? null : node.node_id,
                      )
                    }
                    className="cursor-pointer hover:bg-bg-subtle transition-[background] duration-[--motion-base]"
                  >
                    <td className={cn(tdBaseClass, "text-[14px] text-text font-medium")}>
                      {node.name}
                    </td>
                    <td className={cn(tdBaseClass, "text-[14px] text-text-dim font-mono")}>
                      {node.node_id.slice(0, 12)}
                    </td>
                    <td className={cn(tdBaseClass, "text-[14px] text-text")}>
                      {node.skills.length}
                    </td>
                    <td className={cn(tdBaseClass, "text-[14px] text-text-dim")}>
                      {formatUptime(node.uptime_seconds)}
                    </td>
                    <td className={cn(tdBaseClass, "text-[14px]")}>
                      <span className="inline-flex items-center gap-1.5 text-success text-[13px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        {node.status}
                      </span>
                    </td>
                  </tr>
                  {expanded === node.node_id && (
                    <tr key={`${node.node_id}-detail`}>
                      <td
                        colSpan={5}
                        className="px-4 py-4 border-b border-border bg-bg-subtle"
                      >
                        <p className="text-[12px] uppercase tracking-[0.6px] text-text-muted mb-2">
                          Skills provided
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {node.skills.map((s) => (
                            <span
                              key={s}
                              className="bg-bg-elevated border border-border rounded-full px-3 py-1 text-[12px] text-text-dim"
                            >
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
      )}
    </div>
  );
}
