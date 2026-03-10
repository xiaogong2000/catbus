"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { callHistory, relativeTime } from "@/lib/mock-data-dashboard";
import { cn } from "@/lib/utils";
import { thClass, tdBaseClass, trHoverClass } from "@/lib/table-styles";
import { ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";

const DIRECTIONS = ["all", "inbound", "outbound"] as const;
const STATUSES = ["all", "success", "error", "timeout"] as const;
const PAGE_SIZE = 8;

export default function CallsPage() {
  const [direction, setDirection] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = callHistory;
    if (direction !== "all") {
      result = result.filter((c) => c.direction === direction);
    }
    if (status !== "all") {
      result = result.filter((c) => c.status === status);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.skill.toLowerCase().includes(q) ||
          c.remote_node.toLowerCase().includes(q) ||
          c.agent_name.toLowerCase().includes(q),
      );
    }
    return result;
  }, [direction, status, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Call History"
        description="View and filter all inbound and outbound calls."
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          icon={<Search size={16} />}
          placeholder="Search by skill, node, agent..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-64"
        />

        <div className="flex gap-1">
          {DIRECTIONS.map((d) => (
            <Button
              key={d}
              variant="tag"
              size="sm"
              active={direction === d}
              onClick={() => {
                setDirection(d);
                setPage(1);
              }}
            >
              {d === "all" ? "All" : d === "inbound" ? "Inbound" : "Outbound"}
            </Button>
          ))}
        </div>

        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <Button
              key={s}
              variant="tag"
              size="sm"
              active={status === s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {paged.length > 0 ? (
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>Time</th>
                <th className={thClass}>Direction</th>
                <th className={thClass}>Skill</th>
                <th className={thClass}>Remote</th>
                <th className={thClass}>Agent</th>
                <th className={thClass}>Latency</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((call) => (
                <tr
                  key={call.id}
                  className={trHoverClass}
                >
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
                    {call.agent_name}
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
        <Card hoverable={false} className="py-12 text-center mb-4">
          <p className="text-[14px] text-text-dim">
            No calls match your filters.
          </p>
        </Card>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-text-muted">
          Showing {paged.length} / {filtered.length}
        </p>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
