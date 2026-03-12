"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PageTransition } from "@/components/motion/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/mock-data-dashboard";
import type { CallRecord } from "@/lib/mock-data-dashboard";
import { fetchCalls } from "@/lib/dashboard-api";
import { cn } from "@/lib/utils";
import { thClass, tdBaseClass, trHoverClass } from "@/lib/table-styles";
import { ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

const DIRECTIONS = ["all", "inbound", "outbound"] as const;
const STATUSES = ["all", "success", "error", "timeout"] as const;
const PAGE_SIZE = 20;

const directionKeys: Record<string, string> = {
  all: "dash.calls.all",
  inbound: "dash.calls.inbound",
  outbound: "dash.calls.outbound",
};

const statusKeys: Record<string, string> = {
  all: "dash.calls.all",
  success: "dash.calls.success",
  error: "dash.calls.error",
  timeout: "dash.calls.timeout",
};

export default function CallsPage() {
  const { t } = useLocale();
  const [direction, setDirection] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search input
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCalls({
        page,
        limit: PAGE_SIZE,
        direction: direction !== "all" ? direction : undefined,
        status: status !== "all" ? status : undefined,
        skill: debouncedSearch.trim() || undefined,
      });
      setCalls(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to fetch calls:", err);
    } finally {
      setLoading(false);
    }
  }, [page, direction, status, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageTransition>
      <PageHeader
        eyebrow={t("dash.eyebrow")}
        title={t("dash.calls.title")}
        description={t("dash.calls.desc")}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          icon={<Search size={16} />}
          placeholder={t("dash.calls.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
              {t(directionKeys[d])}
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
              {t(statusKeys[s])}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Card className="py-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="text" width="100%" height={16} className="mb-2" />
          ))}
        </Card>
      ) : calls.length > 0 ? (
        <div className="border border-border rounded-lg overflow-hidden mb-4">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thClass}>{t("dash.table.time")}</th>
                <th className={thClass}>{t("dash.table.direction")}</th>
                <th className={thClass}>{t("dash.table.skill")}</th>
                <th className={thClass}>{t("dash.table.remote")}</th>
                <th className={thClass}>{t("dash.table.agent")}</th>
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
            {t("dash.calls.noMatch")}
          </p>
        </Card>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-text-muted">
          {t("dash.calls.showing")} {calls.length} / {total}
        </p>
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("dash.calls.previous")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("dash.calls.next")}
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
