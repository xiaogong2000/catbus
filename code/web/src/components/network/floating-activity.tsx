"use client";

import type { ActivityEvent } from "@/lib/globe-data";
import { useLocale } from "@/components/locale-provider";

interface Props {
  events: ActivityEvent[];
}

const glassPanel = "bg-black/55 backdrop-blur-[16px] border border-white/[0.06] rounded-[10px]";

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

const dotColors: Record<string, string> = {
  online: "bg-[#4ade80] shadow-[0_0_4px_#4ade80]",
  offline: "bg-[#ef4444] shadow-[0_0_4px_#ef4444]",
  call: "bg-[#ff9500] shadow-[0_0_4px_#ff9500]",
};

export function FloatingActivity({ events }: Props) {
  const { t } = useLocale();

  return (
    <div className={`absolute bottom-5 right-6 z-10 w-[220px] p-3.5 hidden md:block ${glassPanel}`}>
      <div className="text-[9px] uppercase tracking-[1.5px] text-white/35 font-semibold mb-2.5">
        {t("network.globe.liveActivity")}
      </div>
      <div className="flex flex-col gap-2">
        {events.length === 0 && (
          <p className="text-[10px] text-white/25 italic">No recent activity</p>
        )}
        {events.slice(0, 5).map((evt) => (
          <div key={evt.id} className="flex items-center gap-1.5">
            <div className={`w-[5px] h-[5px] rounded-full shrink-0 ${dotColors[evt.type]}`} />
            <span className="text-[10px] text-white/60 truncate flex-1">
              {evt.type === "call"
                ? `${evt.text} → ${evt.detail}`
                : `${evt.text} ${evt.type === "online" ? t("network.globe.cameOnline") : t("network.globe.wentOffline")}`}
            </span>
            <span className="text-[9px] text-white/25 shrink-0 ml-auto">
              {relativeTime(evt.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
