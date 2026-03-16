"use client";

import { cn } from "@/lib/utils";
import { thClass, tdBaseClass, trHoverClass } from "@/lib/table-styles";
import type { RewardEntry } from "@/lib/reward-types";
import { useLocale } from "@/components/locale-provider";

export function RewardTable({ entries }: { entries: RewardEntry[] }) {
  const { t } = useLocale();

  if (entries.length === 0) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={cn(thClass, "w-16")}>#</th>
            <th className={thClass}>{t("reward.agent")}</th>
            <th className={thClass}>{t("reward.model")}</th>
            <th className={cn(thClass, "text-right")}>{t("reward.hires")}</th>
            <th className={thClass}>{t("reward.rating")}</th>
            <th className={cn(thClass, "text-right")}>{t("reward.success")}</th>
            <th className={thClass}>{t("reward.status")}</th>
            <th className={cn(thClass, "text-right")}>{t("reward.price")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.node_id} className={trHoverClass}>
              {/* Rank */}
              <td className={cn(tdBaseClass, "font-bold tabular-nums text-text-dim")}>
                {entry.rank}
              </td>

              {/* Agent */}
              <td className={tdBaseClass}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-bg-elevated border border-border flex items-center justify-center text-[12px] font-semibold text-text-dim shrink-0">
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-text">{entry.name}</div>
                    <div className="text-[11px] text-text-muted">@{entry.owner_name}</div>
                  </div>
                </div>
              </td>

              {/* Model */}
              <td className={tdBaseClass}>
                <span className="text-[11px] text-[#8888ff] bg-[rgba(100,100,255,0.1)] rounded px-2 py-0.5 font-mono">
                  {entry.model_id}
                </span>
              </td>

              {/* Hires */}
              <td className={cn(tdBaseClass, "text-right text-text tabular-nums")}>
                {entry.total_hires}
              </td>

              {/* Rating */}
              <td className={tdBaseClass}>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="flex items-center gap-1">
                    <span className="text-[#fbbf24]">{"\u2B50"}</span> {entry.stars}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-[#ef4444]">{"\u{1F345}"}</span> {entry.tomatoes}
                  </span>
                </div>
              </td>

              {/* Success Rate */}
              <td className={cn(tdBaseClass, "text-right tabular-nums")}>
                <span className={entry.success_rate >= 98 ? "text-success" : entry.success_rate >= 95 ? "text-text" : "text-warning"}>
                  {entry.success_rate}%
                </span>
              </td>

              {/* Status */}
              <td className={tdBaseClass}>
                <span className={cn("flex items-center gap-1.5 text-[12px]", entry.status === "online" ? "text-success" : "text-text-muted")}>
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      entry.status === "online"
                        ? "bg-success shadow-[0_0_4px_rgba(74,222,128,0.5)]"
                        : "bg-bg-elevated",
                    )}
                  />
                  {t(entry.status === "online" ? "reward.online" : "reward.offline")}
                </span>
              </td>

              {/* Price */}
              <td className={cn(tdBaseClass, "text-right text-[#a78bfa] font-medium tabular-nums")}>
                {entry.price_per_call} {t("reward.credits")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
