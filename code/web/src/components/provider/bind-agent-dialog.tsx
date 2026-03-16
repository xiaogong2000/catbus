"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PromptCopyBox } from "./prompt-copy-box";
import {
  generateBindToken,
  checkBindTokenStatus,
  type BindToken,
} from "@/lib/dashboard-api";
import type { Agent } from "@/lib/mock-data-dashboard";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

interface BindAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onAgentBound: (agent: Agent) => void;
}

export function BindAgentDialog({ open, onClose, onAgentBound }: BindAgentDialogProps) {
  const { t } = useLocale();
  const [token, setToken] = useState<BindToken | null>(null);
  const [generating, setGenerating] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [bound, setBound] = useState(false);
  const [boundAgent, setBoundAgent] = useState<Agent | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (open) {
      setBound(false);
      setBoundAgent(null);
      generate();
    } else {
      stopPolling();
      setToken(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  async function generate() {
    setGenerating(true);
    stopPolling();
    try {
      const tk = await generateBindToken();
      setToken(tk);

      const expiresMs = new Date(tk.expires_at).getTime();
      setRemaining(Math.max(0, Math.floor((expiresMs - Date.now()) / 1000)));
      timerRef.current = setInterval(() => {
        const left = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
        setRemaining(left);
        if (left <= 0 && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }, 1000);

      pollRef.current = setInterval(async () => {
        try {
          const status = await checkBindTokenStatus(tk.token);
          if (status.bound && status.agent) {
            stopPolling();
            setBound(true);
            setBoundAgent(status.agent);
            onAgentBound(status.agent);
          }
        } catch {
          // ignore
        }
      }, 3000);
    } finally {
      setGenerating(false);
    }
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const chatMessage = token
    ? t("dash.bind.agentMessage").replace(/\{token\}/g, token.token)
    : "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={bound ? t("dash.bind.successTitle") : t("dash.provider.bindTitle")}
      className="max-w-2xl"
    >
      <div className="space-y-5">
        {bound && boundAgent ? (
          <div className="text-center py-4 space-y-4">
            <CheckCircle2 size={48} className="text-success mx-auto" />
            <div>
              <p className="text-[16px] font-semibold text-text mb-1">
                {boundAgent.name}
              </p>
              <p className="text-[13px] text-text-dim">
                {t("dash.bind.successDesc")}
              </p>
            </div>
            <Button variant="primary" onClick={onClose}>
              {t("dash.bind.done")}
            </Button>
          </div>
        ) : generating ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-text-muted" />
          </div>
        ) : token ? (
          <>
            <div className="space-y-2">
              <p className="text-[13px] text-text-dim">
                {t("dash.bind.desc")}
              </p>
              <PromptCopyBox text={chatMessage} />
            </div>

            {/* Waiting status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {remaining > 0 ? (
                  <>
                    <Loader2 size={14} className="text-text-muted animate-spin" />
                    <span className="text-[13px] text-text-dim">
                      {t("dash.provider.waiting")}
                    </span>
                  </>
                ) : (
                  <span className="text-[13px] text-danger">
                    {t("dash.provider.tokenExpired")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {remaining > 0 && (
                  <span className="text-[12px] text-text-muted font-mono tabular-nums">
                    {minutes}:{seconds.toString().padStart(2, "0")}
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={generate} disabled={generating}>
                  {t("dash.provider.regenerate")}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
