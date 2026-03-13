"use client";

import type { NetworkStats } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";

interface Props {
  stats: NetworkStats | null;
}

const glassPanel = "bg-black/55 backdrop-blur-[16px] border border-white/[0.06] rounded-[10px]";

export function FloatingStats({ stats }: Props) {
  const { t } = useLocale();

  const items = [
    { label: t("network.stat.nodesOnline"), value: String(stats?.online_nodes ?? 0), color: "text-[#4ade80]" },
    { label: t("network.stat.skillsAvailable"), value: String(stats?.total_skills ?? 0), color: "text-white/90" },
    { label: t("network.stat.callsToday"), value: stats ? formatNumber(stats.calls_today) : "0", color: "text-[#f59e0b]" },
    { label: t("network.stat.avgResponse"), value: stats ? `${Math.round(stats.avg_latency_ms)}ms` : "0ms", color: "text-[#4ade80]" },
  ];

  return (
    <div className={`absolute top-5 right-6 z-10 flex gap-5 px-5 py-3 ${glassPanel}`}>
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className={`text-[28px] font-extrabold leading-none ${item.color}`}>
            {item.value}
          </div>
          <div className="text-[9px] uppercase tracking-[1.5px] text-white/35 mt-1">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
