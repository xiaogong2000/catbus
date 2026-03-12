"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PromptCopyBox } from "./prompt-copy-box";
import { ProviderConfigForm } from "./provider-config-form";
import {
  generateBindToken,
  checkBindTokenStatus,
  saveProviderConfig,
  type BindToken,
} from "@/lib/dashboard-api";
import type { BindStatusResponse, SaveProviderConfigRequest } from "@/lib/provider-types";
import type { Agent } from "@/lib/mock-data-dashboard";
import { mockBindPromptTemplate } from "@/lib/mock-data-provider";
import { Loader2, Terminal, CheckCircle } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

interface BindAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onAgentBound: (agent: Agent) => void;
}

type Phase = "prompt" | "config";

export function BindAgentDialog({ open, onClose, onAgentBound }: BindAgentDialogProps) {
  const { t } = useLocale();
  const [phase, setPhase] = useState<Phase>("prompt");
  const [token, setToken] = useState<BindToken | null>(null);
  const [generating, setGenerating] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [bindResult, setBindResult] = useState<BindStatusResponse | null>(null);
  const [saving, setSaving] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // Reset on open
  useEffect(() => {
    if (open) {
      setPhase("prompt");
      setToken(null);
      setBindResult(null);
      setSaving(false);
    } else {
      stopPolling();
    }
  }, [open, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  async function handleGenerate() {
    setGenerating(true);
    stopPolling();
    try {
      const tk = await generateBindToken();
      setToken(tk);

      // Countdown
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

      // Poll for binding
      pollRef.current = setInterval(async () => {
        try {
          const status = await checkBindTokenStatus(tk.token);
          if (status.bound && status.agent) {
            stopPolling();
            if (status.provider_config) {
              setBindResult(status);
              setPhase("config");
            } else {
              onAgentBound(status.agent);
              onClose();
            }
          }
        } catch {
          // ignore poll errors
        }
      }, 3000);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveConfig(config: SaveProviderConfigRequest) {
    if (!bindResult?.agent) return;
    setSaving(true);
    try {
      await saveProviderConfig(bindResult.agent.node_id, config);
      onAgentBound(bindResult.agent);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    if (bindResult?.agent) {
      onAgentBound(bindResult.agent);
    }
    onClose();
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  const title = phase === "prompt"
    ? t("dash.provider.bindTitle")
    : t("dash.provider.boundSuccess");

  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-2xl max-h-[85vh] overflow-y-auto">
      {phase === "prompt" && (
        <div className="space-y-5">
          <p className="text-[13px] text-text-dim">
            {t("dash.provider.bindSubtitle")}
          </p>

          {!token ? (
            <Button variant="primary" onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Terminal size={16} className="mr-2" />
              )}
              {t("dash.agents.generateToken")}
            </Button>
          ) : (
            <>
              <PromptCopyBox text={mockBindPromptTemplate(token.token)} />

              {/* Status row */}
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
                      {t("dash.provider.tokenExpires")} {minutes}:{seconds.toString().padStart(2, "0")}
                    </span>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating}>
                    {t("dash.provider.regenerate")}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {phase === "config" && bindResult?.agent && bindResult.provider_config && (
        <div className="space-y-6">
          {/* Success banner */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
            <CheckCircle size={20} className="text-success shrink-0" />
            <div>
              <p className="text-[14px] font-semibold text-text">
                {bindResult.agent.name}
              </p>
              <p className="text-[12px] text-text-muted">
                {t("dash.provider.nodeLabel")}: {bindResult.agent.node_id}
              </p>
            </div>
          </div>

          <ProviderConfigForm
            models={bindResult.provider_config.models}
            skills={bindResult.provider_config.skills}
            onSave={handleSaveConfig}
            onSkip={handleSkip}
            saving={saving}
          />
        </div>
      )}
    </Dialog>
  );
}
