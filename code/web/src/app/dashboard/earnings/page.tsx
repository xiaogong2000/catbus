"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PageTransition } from "@/components/motion/page-transition";
import { StatsRow } from "@/components/data-display/stats-row";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { thClass, tdBaseClass, trHoverClass } from "@/lib/table-styles";
import { getEarnings, getEarningsHistory } from "@/lib/dashboard-api";
import type { EarningsOverview, EarningRecord } from "@/lib/provider-types";
import { Coins, Cpu, Wrench } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { relativeTime } from "@/lib/mock-data-dashboard";

export default function EarningsPage() {
  const { t } = useLocale();
  const [overview, setOverview] = useState<EarningsOverview | null>(null);
  const [history, setHistory] = useState<EarningRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [o, h] = await Promise.all([
          getEarnings(),
          getEarningsHistory({ page: 1, limit }),
        ]);
        setOverview(o);
        setHistory(h.data);
        setTotal(h.total);
      } catch (err) {
        console.error("Failed to load earnings:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function goToPage(p: number) {
    setTableLoading(true);
    try {
      const h = await getEarningsHistory({ page: p, limit });
      setHistory(h.data);
      setTotal(h.total);
      setPage(p);
    } catch (err) {
      console.error("Failed to load page:", err);
    } finally {
      setTableLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const stats = overview
    ? [
        {
          label: t("dash.earnings.today"),
          value: `${overview.today.credits}`,
          description: `${overview.today.tasks} ${t("dash.earnings.tasks")}`,
          color: "success" as const,
        },
        {
          label: t("dash.earnings.thisWeek"),
          value: `${overview.this_week.credits}`,
          description: `${overview.this_week.tasks} ${t("dash.earnings.tasks")}`,
          color: "success" as const,
        },
        {
          label: t("dash.earnings.thisMonth"),
          value: `${overview.this_month.credits}`,
          description: `${overview.this_month.tasks} ${t("dash.earnings.tasks")}`,
          color: "warning" as const,
        },
        {
          label: t("dash.earnings.total"),
          value: `${overview.total.credits}`,
          description: `${overview.total.tasks} ${t("dash.earnings.tasks")}`,
          color: "default" as const,
        },
      ]
    : [];

  return (
    <PageTransition>
      <PageHeader
        eyebrow={t("dash.eyebrow")}
        title={t("dash.earnings.title")}
        description={t("dash.earnings.desc")}
      />

      {/* Stats Overview */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="py-4 px-3">
              <Skeleton variant="text" width={60} height={28} className="mb-1" />
              <Skeleton variant="text" width={100} height={14} />
            </div>
          ))}
        </div>
      ) : (
        <StatsRow items={stats} columns={4} className="mb-8" />
      )}

      {/* History Table */}
      <section>
        <h2 className="text-[20px] font-bold text-text mb-4">
          {t("dash.earnings.history")}
        </h2>

        {loading ? (
          <Card className="py-8">
            <Skeleton variant="text" width="100%" height={16} className="mb-2" />
            <Skeleton variant="text" width="80%" height={16} className="mb-2" />
            <Skeleton variant="text" width="90%" height={16} />
          </Card>
        ) : history.length > 0 ? (
          <div className={cn("border border-border rounded-lg overflow-hidden", tableLoading && "opacity-60 pointer-events-none")}>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thClass}>{t("dash.earnings.time")}</th>
                  <th className={thClass}>{t("dash.earnings.type")}</th>
                  <th className={thClass}>{t("dash.earnings.detail")}</th>
                  <th className={thClass}>{t("dash.earnings.tokens")}</th>
                  <th className={thClass}>{t("dash.earnings.earned")}</th>
                  <th className={thClass}>{t("dash.earnings.caller")}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id} className={trHoverClass}>
                    <td className={cn(tdBaseClass, "text-text-dim whitespace-nowrap")}>
                      {relativeTime(record.created_at)}
                    </td>
                    <td className={tdBaseClass}>
                      <span className="inline-flex items-center gap-1.5">
                        {record.task_type === "model" ? (
                          <Cpu size={14} className="text-primary" />
                        ) : (
                          <Wrench size={14} className="text-warning" />
                        )}
                        <span className="text-text text-[13px]">
                          {record.task_type === "model"
                            ? t("dash.earnings.model")
                            : t("dash.earnings.skill")}
                        </span>
                      </span>
                    </td>
                    <td className={cn(tdBaseClass, "text-text max-w-[240px] truncate")}>
                      {record.task_detail}
                    </td>
                    <td className={cn(tdBaseClass, "text-text-dim font-mono tabular-nums")}>
                      {record.tokens_consumed > 0
                        ? record.tokens_consumed.toLocaleString()
                        : "—"}
                    </td>
                    <td className={cn(tdBaseClass, "text-success font-semibold tabular-nums")}>
                      +{record.credits_earned.toFixed(1)}
                    </td>
                    <td className={cn(tdBaseClass, "text-text-dim font-mono")}>
                      {record.caller_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-bg-elevated/50">
                <span className="text-[12px] text-text-dim">
                  {t("dash.earnings.showing")} {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                    className="text-[12px] text-text-dim hover:text-text border border-border rounded px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ← {t("dash.earnings.prev")}
                  </button>
                  <span className="text-[12px] text-text-dim tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={page >= totalPages}
                    className="text-[12px] text-text-dim hover:text-text border border-border rounded px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t("dash.earnings.next")} →
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card hoverable={false} className="py-16 text-center">
            <Coins size={40} className="text-text-muted mx-auto mb-4" />
            <p className="text-[14px] text-text-dim">
              {t("dash.earnings.noHistory")}
            </p>
          </Card>
        )}
      </section>
    </PageTransition>
  );
}
