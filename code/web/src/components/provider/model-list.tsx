"use client";

import type { ParsedModel } from "@/lib/provider-types";

interface ModelListProps {
  models: ParsedModel[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export function ModelList({ models, selected, onToggle }: ModelListProps) {
  return (
    <div className="space-y-2">
      {models.map((model) => (
        <label
          key={model.id}
          className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-border-hover transition-[border-color] duration-[--motion-base] cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selected.has(model.id)}
            onChange={() => onToggle(model.id)}
            className="w-4 h-4 rounded border-border accent-[hsl(var(--c-primary))]"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-text">
                {model.id}
              </span>
              <span className="text-[11px] text-text-muted bg-bg-elevated px-2 py-0.5 rounded">
                {model.provider}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[12px] text-text-dim">
                {Math.round(model.context_window / 1000)}K ctx
              </span>
              <span className="text-[11px] text-text-muted">
                {model.strengths.join(", ")}
              </span>
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}
