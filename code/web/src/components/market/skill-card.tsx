"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import type { CapabilityType } from "@/lib/api";
import { Bot, Zap, HardDrive, Database } from "lucide-react";

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

const TYPE_CONFIG: Record<CapabilityType, { icon: typeof Bot; color: string; border: string }> = {
  model: { icon: Bot, color: "text-[#a78bfa]", border: "border-[rgba(167,139,250,0.25)]" },
  skill: { icon: Zap, color: "text-[#fbbf24]", border: "border-[rgba(251,191,36,0.25)]" },
  compute: { icon: HardDrive, color: "text-[#34d399]", border: "border-[rgba(52,211,153,0.25)]" },
  storage: { icon: Database, color: "text-[#60a5fa]", border: "border-[rgba(96,165,250,0.25)]" },
};

interface SkillCardProps {
  name: string;
  description: string;
  providers: number;
  callsToday: number;
  avgLatency: number;
  category?: string;
  capabilityType?: CapabilityType;
  costTier?: string;
  modelProvider?: string;
  strengths?: string[];
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
  capabilityType = "skill",
  costTier,
  modelProvider,
  strengths,
  status = "online",
  searchQuery,
}: SkillCardProps) {
  const { t } = useLocale();
  const cfg = TYPE_CONFIG[capabilityType] || TYPE_CONFIG.skill;
  const Icon = cfg.icon;

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-md bg-bg-elevated border ${cfg.border} flex items-center justify-center shrink-0`}>
            <Icon size={14} className={cfg.color} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-text truncate">
              <Highlight text={name} query={searchQuery} />
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {costTier && (
            <span className={`text-[10px] font-medium border rounded-full px-1.5 py-0.5 ${
              costTier === "low" ? "text-success border-success/30" :
              costTier === "high" ? "text-warning border-warning/30" :
              "text-text-muted border-border"
            }`}>
              {costTier}
            </span>
          )}
          {category && (
            <span className="text-[10px] text-text-muted border border-border rounded-full px-1.5 py-0.5">
              {category}
            </span>
          )}
          <Badge status={status} label={t(`status.${status}`)} />
        </div>
      </div>

      <p className="text-[13px] text-text-dim mb-3 line-clamp-2">
        <Highlight text={description} query={searchQuery} />
      </p>

      {/* Model-specific: provider + strengths */}
      {capabilityType === "model" && (modelProvider || (strengths && strengths.length > 0)) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {modelProvider && (
            <span className="text-[10px] font-medium text-[#a78bfa] bg-[rgba(167,139,250,0.1)] border border-[rgba(167,139,250,0.2)] rounded-full px-2 py-0.5">
              {modelProvider}
            </span>
          )}
          {strengths?.map((s) => (
            <span key={s} className="text-[10px] text-text-muted bg-bg-elevated border border-border rounded-full px-2 py-0.5">
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-[12px] text-text-muted">
        <span>
          {t("skills.card.providers")} <span className="text-text">{providers}</span>
        </span>
        {callsToday > 0 && (
          <span>
            {t("skills.card.calls")} <span className="text-text">{formatNumber(callsToday)}</span>
          </span>
        )}
        {avgLatency > 0 && (
          <span>
            {t("skills.card.latency")} <span className="text-warning">{avgLatency}ms</span>
          </span>
        )}
      </div>
    </Card>
  );
}
