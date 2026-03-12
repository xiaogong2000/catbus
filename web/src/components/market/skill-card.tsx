"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";

function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) return <>{text}</>;
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-warning/25 text-inherit rounded-sm px-px">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

interface SkillCardProps {
  name: string;
  description: string;
  providers: number;
  callsToday: number;
  avgLatency: number;
  category?: string;
  status?: "online" | "offline";
  searchQuery?: string;
}

export function SkillCard({
  name,
  description,
  providers,
  callsToday,
  avgLatency,
  category,
  status = "online",
  searchQuery,
}: SkillCardProps) {
  const { t } = useLocale();

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[16px] font-semibold text-text"><Highlight text={name} query={searchQuery} /></h3>
          {category && (
            <span className="text-[11px] text-text-muted border border-border rounded-full px-2 py-0.5">
              {category}
            </span>
          )}
        </div>
        <Badge status={status} label={t(`status.${status}`)} />
      </div>
      <p className="text-[14px] text-text-dim mb-4 line-clamp-2">
        <Highlight text={description} query={searchQuery} />
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
