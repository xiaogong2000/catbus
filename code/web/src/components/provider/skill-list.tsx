"use client";

import type { ShareableSkill, FilteredSkill } from "@/lib/provider-types";
import { useLocale } from "@/components/locale-provider";

interface SkillListProps {
  shareable: ShareableSkill[];
  filtered: FilteredSkill[];
  selected: Set<string>;
  onToggle: (name: string) => void;
}

const costColors: Record<string, string> = {
  free: "text-success bg-success/10 border-success/20",
  low: "text-success bg-success/10 border-success/20",
  medium: "text-warning bg-warning/10 border-warning/20",
  high: "text-danger bg-danger/10 border-danger/20",
};

export function SkillList({ shareable, filtered, selected, onToggle }: SkillListProps) {
  const { t } = useLocale();

  return (
    <div className="space-y-6">
      {/* Shareable Skills */}
      <div>
        <h4 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-3">
          {t("dash.provider.shareableSkills")}
        </h4>
        <div className="space-y-2">
          {shareable.map((skill) => (
            <label
              key={skill.name}
              className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-border-hover transition-[border-color] duration-[--motion-base] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(skill.name)}
                onChange={() => onToggle(skill.name)}
                className="w-4 h-4 rounded border-border accent-[hsl(var(--c-primary))]"
              />
              <span className="text-[14px] text-text flex-1">
                {skill.display || skill.name}
              </span>
              <span className="text-[11px] text-text-muted">{skill.category}</span>
              <span
                className={`text-[10px] font-semibold uppercase border rounded-full px-2 py-0.5 ${costColors[skill.cost_level] || ""}`}
              >
                {t(`dash.provider.cost${skill.cost_level.charAt(0).toUpperCase() + skill.cost_level.slice(1)}`)}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Filtered Skills */}
      {filtered.length > 0 && (
        <div>
          <h4 className="text-[11px] uppercase tracking-wider text-text-muted font-semibold mb-3">
            {t("dash.provider.filteredSkills")}
          </h4>
          <div className="space-y-2">
            {filtered.map((skill) => (
              <div
                key={skill.name}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border opacity-50"
              >
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  className="w-4 h-4 rounded border-border"
                  readOnly
                />
                <span className="text-[14px] text-text-dim">{skill.name}</span>
                <span className="text-[12px] text-text-muted ml-auto">{skill.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
