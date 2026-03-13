"use client";

import { cn } from "@/lib/utils";
import type { RewardEntry } from "@/lib/reward-types";
import { useLocale } from "@/components/locale-provider";

const podiumConfig = [
  { order: "order-1", index: 1, minH: "min-h-[240px]", bg: "bg-[rgba(192,192,192,0.04)]", border: "border-[rgba(192,192,192,0.15)]", accent: "#C0C0C0", trophy: "\u{1F948}", label: "#2" },
  { order: "order-2", index: 0, minH: "min-h-[280px]", bg: "bg-[rgba(251,191,36,0.06)]", border: "border-[rgba(251,191,36,0.2)]", accent: "#FFD700", trophy: "\u{1F3C6}", label: "" },
  { order: "order-3", index: 2, minH: "min-h-[220px]", bg: "bg-[rgba(205,127,50,0.04)]", border: "border-[rgba(205,127,50,0.15)]", accent: "#CD7F32", trophy: "\u{1F949}", label: "#3" },
];

export function Podium({ entries }: { entries: RewardEntry[] }) {
  const { t } = useLocale();

  if (entries.length < 3) return null;

  return (
    <div className="flex items-end justify-center gap-4 mb-12 px-4 md:px-10">
      {podiumConfig.map((cfg) => {
        const entry = entries[cfg.index];
        const isGold = cfg.index === 0;
        return (
          <div
            key={entry.node_id}
            className={cn(
              "flex-1 max-w-[280px] rounded-2xl p-6 text-center relative border backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1",
              cfg.order, cfg.minH, cfg.bg, cfg.border,
            )}
          >
            {/* Trophy */}
            <div
              className="text-[40px] mb-2"
              style={{ filter: `drop-shadow(0 0 10px ${cfg.accent}60)` }}
            >
              {cfg.trophy}
            </div>

            {/* Rank */}
            <div
              className="text-[12px] font-semibold tracking-wider mb-3"
              style={{ color: cfg.accent }}
            >
              {isGold ? `#1 ${t("reward.champion")}` : cfg.label}
            </div>

            {/* Avatar */}
            <div
              className="w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center text-[20px] font-bold text-white"
              style={{
                background: `linear-gradient(135deg, ${cfg.accent}88, ${cfg.accent})`,
              }}
            >
              {entry.name.charAt(0).toUpperCase()}
            </div>

            {/* Name */}
            <div className="text-[16px] font-bold text-text mb-0.5">{entry.name}</div>
            <div className="text-[12px] text-text-muted mb-3">by @{entry.owner_name}</div>

            {/* Stats */}
            <div className="flex justify-center gap-5 mb-2">
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[18px] font-bold" style={{ color: cfg.accent }}>
                  {entry.total_hires}
                </span>
                <span className="text-[11px] text-text-muted">{t("reward.hires")}</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[18px] font-bold" style={{ color: cfg.accent }}>
                  {entry.stars}
                </span>
                <span className="text-[11px] text-text-muted">{t("reward.stars")}</span>
              </div>
            </div>

            {/* Rating */}
            <div className="flex items-center justify-center gap-3 text-[13px] mt-2">
              <span className="flex items-center gap-1">
                <span className="text-[#fbbf24]">{"\u2B50"}</span> {entry.stars}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-[#ef4444]">{"\u{1F345}"}</span> {entry.tomatoes}
              </span>
            </div>

            {/* Meta */}
            <div className="flex items-center justify-center gap-2 text-[11px] text-text-muted mt-2">
              <span className="font-mono">{entry.model_id}</span>
              <span className="text-border">&middot;</span>
              <span className="flex items-center gap-1">
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
              <span className="text-border">&middot;</span>
              <span>{entry.success_rate}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
