"use client";

import { useState } from "react";
import type { ParsedModel, ShareableSkill, FilteredSkill, SaveProviderConfigRequest } from "@/lib/provider-types";
import { ModelList } from "./model-list";
import { SkillList } from "./skill-list";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";

interface ProviderConfigFormProps {
  models: ParsedModel[];
  skills: { shareable: ShareableSkill[]; filtered: FilteredSkill[] };
  onSave: (config: SaveProviderConfigRequest) => void;
  onSkip?: () => void;
  saving?: boolean;
}

export function ProviderConfigForm({ models, skills, onSave, onSkip, saving }: ProviderConfigFormProps) {
  const { t } = useLocale();
  const [selectedModels, setSelectedModels] = useState<Set<string>>(
    new Set(models.map((m) => m.id)),
  );
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(
    new Set(skills.shareable.map((s) => s.name)),
  );
  const [hireable, setHireable] = useState(true);
  const [rateLimit, setRateLimit] = useState(20);
  const [pricePerCall, setPricePerCall] = useState(0);
  const [description, setDescription] = useState("");

  function toggleModel(id: string) {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSkill(name: string) {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function handleSave() {
    onSave({
      models: Array.from(selectedModels),
      skills: Array.from(selectedSkills),
      hire_config: { hireable, rate_limit: rateLimit, price_per_call: pricePerCall, description },
    });
  }

  return (
    <div className="space-y-8">
      {/* Models */}
      <section>
        <h3 className="text-[13px] uppercase tracking-wider text-text-muted font-semibold mb-4">
          {t("dash.provider.models")}
        </h3>
        <ModelList models={models} selected={selectedModels} onToggle={toggleModel} />
      </section>

      {/* Skills */}
      <section>
        <SkillList
          shareable={skills.shareable}
          filtered={skills.filtered}
          selected={selectedSkills}
          onToggle={toggleSkill}
        />
      </section>

      {/* Hire Settings */}
      <section>
        <h3 className="text-[13px] uppercase tracking-wider text-text-muted font-semibold mb-4">
          {t("dash.provider.hireSettings")}
        </h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={hireable}
              onChange={(e) => setHireable(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-[hsl(var(--c-primary))]"
            />
            <span className="text-[14px] text-text">{t("dash.provider.acceptHiring")}</span>
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] text-text-dim mb-1.5 block">
                {t("dash.provider.rateLimit")}
              </label>
              <Input
                type="number"
                value={rateLimit}
                onChange={(e) => setRateLimit(Number(e.target.value))}
                min={1}
                max={1000}
              />
            </div>
            <div>
              <label className="text-[12px] text-text-dim mb-1.5 block">
                {t("dash.provider.pricePerCall")}
              </label>
              <Input
                type="number"
                value={pricePerCall}
                onChange={(e) => setPricePerCall(Number(e.target.value))}
                min={0}
                step={0.1}
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] text-text-dim mb-1.5 block">
              {t("dash.provider.description")}
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your agent services..."
            />
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {t("dash.provider.saveAndStart")}
        </Button>
        {onSkip && (
          <Button variant="ghost" onClick={onSkip}>
            {t("dash.provider.skipForNow")}
          </Button>
        )}
      </div>
    </div>
  );
}
