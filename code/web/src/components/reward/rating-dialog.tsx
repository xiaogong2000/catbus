"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";
import type { RatingType } from "@/lib/reward-types";

interface RatingDialogProps {
  open: boolean;
  agentName: string;
  contractId: string;
  onClose: () => void;
  onSubmit: (contractId: string, rating: RatingType, comment: string) => Promise<void>;
  existingRating?: RatingType;
  existingComment?: string;
  ratingId?: string;
  onUpdate?: (ratingId: string, rating: RatingType, comment: string) => Promise<void>;
}

export function RatingDialog({
  open,
  agentName,
  contractId,
  onClose,
  onSubmit,
  existingRating,
  existingComment,
  ratingId,
  onUpdate,
}: RatingDialogProps) {
  const { t } = useLocale();
  const [selected, setSelected] = useState<RatingType | null>(existingRating || null);
  const [comment, setComment] = useState(existingComment || "");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const isEdit = !!ratingId && !!onUpdate;

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      if (isEdit && ratingId && onUpdate) {
        await onUpdate(ratingId, selected, comment);
      } else {
        await onSubmit(contractId, selected, comment);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-border bg-bg-elevated p-6 shadow-xl">
        <h2 className="text-[18px] font-bold text-text mb-1">
          {t("dash.hired.rateTitle")} {agentName}
        </h2>
        <p className="text-[13px] text-text-muted mb-6">
          {t("dash.hired.rateAgent")}
        </p>

        {/* Rating buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setSelected("star")}
            className={cn(
              "flex-1 flex flex-col items-center gap-2 py-5 rounded-xl border-2 transition-all duration-200 cursor-pointer",
              selected === "star"
                ? "border-[#fbbf24] bg-[rgba(251,191,36,0.1)]"
                : "border-border bg-bg-subtle hover:border-border-hover",
            )}
          >
            <span className="text-[36px]">{"\u2B50"}</span>
            <span className={cn("text-[14px] font-semibold", selected === "star" ? "text-[#fbbf24]" : "text-text-dim")}>
              {t("dash.hired.rateStar")}
            </span>
          </button>

          <button
            onClick={() => setSelected("tomato")}
            className={cn(
              "flex-1 flex flex-col items-center gap-2 py-5 rounded-xl border-2 transition-all duration-200 cursor-pointer",
              selected === "tomato"
                ? "border-[#ef4444] bg-[rgba(239,68,68,0.1)]"
                : "border-border bg-bg-subtle hover:border-border-hover",
            )}
          >
            <span className="text-[36px]">{"\u{1F345}"}</span>
            <span className={cn("text-[14px] font-semibold", selected === "tomato" ? "text-[#ef4444]" : "text-text-dim")}>
              {t("dash.hired.rateTomato")}
            </span>
          </button>
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("dash.hired.rateComment")}
          rows={3}
          className="w-full rounded-lg border border-border bg-bg-subtle px-3 py-2 text-[13px] text-text placeholder:text-text-muted focus:outline-none focus:border-border-hover resize-none mb-6"
        />

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {isEdit ? t("dash.hired.rateSkip") : t("dash.hired.rateSkip")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!selected || submitting}
          >
            {submitting
              ? "..."
              : isEdit
                ? t("dash.hired.rateUpdate")
                : t("dash.hired.rateSubmit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
