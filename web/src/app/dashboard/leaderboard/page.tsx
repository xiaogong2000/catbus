"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PageTransition } from "@/components/motion/page-transition";
import { StatsRow } from "@/components/data-display/stats-row";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { thClass, tdBaseClass, trHoverClass } from "@/lib/table-styles";
import { getLeaderboard } from "@/lib/dashboard-api";
import type { LeaderboardResponse } from "@/lib/provider-types";
import { Trophy, Medal } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

const rankColors: Record<number, string> = {
  1: "text-[#FFD700]", // gold
  2: "text-[#C0C0C0]", // silver
  3: "text-[#CD7F32]", // bronze
};

export default function LeaderboardPage() {
  const { t } = useLocale();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard(20)
      .then(setData)
      .catch((err) => console.error("Failed to load leaderboard:", err))
      .finally(() => setLoading(false));
  }, []);

  const myStats =
    data?.my_stats && data.my_rank
      ? [
          {
            label: t("dash.leaderboard.myRank"),
            value: `#${data.my_rank}`,
            description: `${t("dash.leaderboard.successRate")} ${data.my_stats.success_rate}%`,
            color: "success" as const,
          },
          {
            label: t("dash.leaderboard.myTasks"),
            value: String(data.my_stats.total_tasks),
            description: `${t("dash.leaderboard.successRate")} ${data.my_stats.success_rate}%`,
            color: "warning" as const,
          },
          {
            label: t("dash.leaderboard.myCredits"),
            value: data.my_stats.total_credits.toFixed(1),
            description: `#${data.my_rank} ${t("dash.leaderboard.rank").toLowerCase()}`,
            color: "default" as const,
          },
        ]
      : [];

  return (
    <PageTransition>
      <PageHeader
        eyebrow={t("dash.eyebrow")}
        title={t("dash.leaderboard.title")}
        description={t("dash.leaderboard.desc")}
      />

      {/* My Stats */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="py-4 px-3">
              <Skeleton variant="text" width={60} height={28} className="mb-1" />
              <Skeleton variant="text" width={100} height={14} />
            </div>
          ))}
        </div>
      ) : myStats.length > 0 ? (
        <StatsRow items={myStats} columns={3} className="mb-8" />
      ) : (
        <Card hoverable={false} className="mb-8 py-4 text-center">
          <p className="text-[13px] text-text-muted">{t("dash.leaderboard.notRanked")}</p>
        </Card>
      )}

      {/* Leaderboard Table */}
      <section>
        {loading ? (
          <Card className="py-8">
            <Skeleton variant="text" width="100%" height={16} className="mb-2" />
            <Skeleton variant="text" width="80%" height={16} className="mb-2" />
            <Skeleton variant="text" width="90%" height={16} />
          </Card>
        ) : data && data.providers.length > 0 ? (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={cn(thClass, "w-16")}>{t("dash.leaderboard.rank")}</th>
                  <th className={thClass}>{t("dash.leaderboard.provider")}</th>
                  <th className={thClass}>{t("dash.leaderboard.topModel")}</th>
                  <th className={cn(thClass, "text-right")}>{t("dash.leaderboard.tasks")}</th>
                  <th className={cn(thClass, "text-right")}>{t("dash.leaderboard.successRate")}</th>
                  <th className={cn(thClass, "text-right")}>{t("dash.leaderboard.credits")}</th>
                </tr>
              </thead>
              <tbody>
                {data.providers.map((entry) => {
                  const isMe = data.my_rank === entry.rank;
                  return (
                    <tr key={entry.node_id} className={cn(trHoverClass, isMe && "bg-primary/5 border-l-2 border-l-primary")}>
                      <td className={cn(tdBaseClass, "font-bold tabular-nums")}>
                        {entry.rank <= 3 ? (
                          <span className={cn("inline-flex items-center gap-1", rankColors[entry.rank])}>
                            <Medal size={16} />
                            {entry.rank}
                          </span>
                        ) : (
                          <span className="text-text-dim">{entry.rank}</span>
                        )}
                      </td>
                      <td className={cn(tdBaseClass, "text-text font-semibold")}>
                        {entry.name}
                        {isMe && <span className="ml-1.5 text-[#FFD700]">★</span>}
                      </td>
                      <td className={tdBaseClass}>
                        <span className="text-[12px] text-text-dim bg-bg-elevated border border-border rounded px-2 py-0.5 font-mono">
                          {entry.top_model}
                        </span>
                      </td>
                      <td className={cn(tdBaseClass, "text-right text-text tabular-nums")}>
                        {entry.total_tasks.toLocaleString()}
                      </td>
                      <td className={cn(tdBaseClass, "text-right tabular-nums")}>
                        <span className={entry.success_rate >= 98 ? "text-success" : entry.success_rate >= 95 ? "text-text" : "text-warning"}>
                          {entry.success_rate}%
                        </span>
                      </td>
                      <td className={cn(tdBaseClass, "text-right text-success font-semibold tabular-nums")}>
                        {entry.total_credits.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Card hoverable={false} className="py-16 text-center">
            <Trophy size={40} className="text-text-muted mx-auto mb-4" />
            <p className="text-[14px] text-text-dim">
              {t("dash.leaderboard.empty")}
            </p>
          </Card>
        )}
      </section>
    </PageTransition>
  );
}
