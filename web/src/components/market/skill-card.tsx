"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";

interface SkillCardProps {
  name: string;
  description: string;
  providers: number;
  callsToday: number;
  avgLatency: number;
  category?: string;
  status?: "online" | "offline";
}

export function SkillCard({
  name,
  description,
  providers,
  callsToday,
  avgLatency,
  category,
  status = "online",
}: SkillCardProps) {
  const { t } = useLocale();

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[16px] font-semibold text-text">{name}</h3>
          {category && (
            <span className="text-[11px] text-text-muted border border-border rounded-full px-2 py-0.5">
              {category}
            </span>
          )}
        </div>
        <Badge status={status} label={t(`status.${status}`)} />
      </div>
      <p className="text-[14px] text-text-dim mb-4 line-clamp-2">
        {description}
      </p>
      <div className="flex items-center gap-4 text-[13px] text-text-muted">
        <span>
          {t("skills.card.providers")} <span className="text-text">{providers}</span>
        </span>
        <span>
          {t("skills.card.calls")} <span className="text-text">{formatNumber(callsToday)}</span>
        </span>
        {avgLatency > 0 && (
          <span>
            {t("skills.card.latency")} <span className="text-warning">{avgLatency}ms</span>
          </span>
        )}
      </div>
    </Card>
  );
}
