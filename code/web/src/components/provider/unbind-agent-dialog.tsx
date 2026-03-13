"use client";

import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PromptCopyBox } from "./prompt-copy-box";
import { useLocale } from "@/components/locale-provider";

interface UnbindAgentDialogProps {
  open: boolean;
  onClose: () => void;
  agentName: string;
  nodeId: string;
}

export function UnbindAgentDialog({ open, onClose, agentName, nodeId }: UnbindAgentDialogProps) {
  const { t } = useLocale();

  const uninstallMessage = t("dash.unbind.agentMessage");
  const manualMessage = t("dash.unbind.manualMessage").replace(/\{nodeId\}/g, nodeId);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${t("dash.unbind.title")} — ${agentName}`}
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Option 1: Full uninstall */}
        <div className="space-y-2">
          <p className="text-[13px] text-text-dim">
            {t("dash.unbind.desc")}
          </p>
          <PromptCopyBox text={uninstallMessage} />
        </div>

        {/* Option 2: Unbind only */}
        <div className="space-y-2">
          <p className="text-[13px] text-text-muted">
            {t("dash.unbind.manualTitle")}
          </p>
          <PromptCopyBox text={manualMessage} className="opacity-70" />
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("dash.bind.done")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
