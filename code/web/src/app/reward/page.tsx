"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PageTransition } from "@/components/motion/page-transition";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Podium } from "@/components/reward/podium";
import { RewardTable } from "@/components/reward/reward-table";
import { getRewardLeaderboard } from "@/lib/dashboard-api";
import type { RewardEntry } from "@/lib/reward-types";
import { Trophy } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { cn } from "@/lib/utils";

type SortBy = "hires" | "stars";

export default function RewardPage() {
  const { t } = useLocale();
  const [entries, setEntries] = useState<RewardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>("hires");

  useEffect(() => {
    loadData(sortBy);
  }, [sortBy]);

  async function loadData(sort: SortBy) {
    setLoading(true);
    try {
      const res = await getRewardLeaderboard({ sort_by: sort, limit: 50 });
      setEntries(res.entries);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <PageTransition>
      <div className="max-w-[1100px] mx-auto px-6 py-10">
        <PageHeader
          eyebrow={t("reward.eyebrow")}
          title={t("reward.title")}
          description={t("reward.desc")}
        />

        {/* Sort toggle */}
        <div className="flex gap-2 mb-8">
          {(["hires", "stars"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[13px] font-medium border transition-all duration-200 cursor-pointer",
                sortBy === key
                  ? "bg-[rgba(251,191,36,0.1)] border-[rgba(251,191,36,0.3)] text-[#fbbf24]"
                  : "bg-bg-subtle border-border text-text-muted hover:bg-bg-elevated hover:text-text-dim",
              )}
            >
              {t(key === "hires" ? "reward.sortHires" : "reward.sortStars")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="flex gap-4 justify-center">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex-1 max-w-[280px] rounded-2xl border border-border p-6">
                  <Skeleton variant="text" width={40} height={40} className="mx-auto mb-4" />
                  <Skeleton variant="text" width={120} height={18} className="mx-auto mb-2" />
                  <Skeleton variant="text" width={80} height={14} className="mx-auto" />
                </div>
              ))}
            </div>
            <Card className="py-8">
              <Skeleton variant="text" width="100%" height={16} className="mb-2" />
              <Skeleton variant="text" width="80%" height={16} className="mb-2" />
              <Skeleton variant="text" width="90%" height={16} />
            </Card>
          </div>
        ) : entries.length > 0 ? (
          <>
            <Podium entries={top3} />
            <RewardTable entries={rest} />
            <p className="text-center text-[12px] text-text-muted mt-6">
              {t("reward.footer")}
            </p>
          </>
        ) : (
          <Card hoverable={false} className="py-16 text-center">
            <Trophy size={40} className="text-text-muted mx-auto mb-4" />
            <p className="text-[14px] text-text-dim">{t("reward.empty")}</p>
          </Card>
        )}
      </div>
    </PageTransition>
  );
}
