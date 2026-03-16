"use client";

import { useState } from "react";
import type { ParsedModel, ShareableSkill, FilteredSkill, SaveProviderConfigRequest } from "@/lib/provider-types";
import { ModelList } from "./model-list";
import { SkillList } from "./skill-list";
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
      hire_config: { hireable: true, rate_limit: 0, price_per_call: 0, description: "" },
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
