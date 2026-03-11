"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUptime } from "@/lib/mock-data-dashboard";
import type { Agent } from "@/lib/mock-data-dashboard";
import {
  fetchAgents,
  generateBindToken,
  checkBindTokenStatus,
  type BindToken,
} from "@/lib/dashboard-api";
import { Bot, Plus, Copy, Check, Loader2, Terminal } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import Link from "next/link";

export default function AgentsPage() {
  const { t } = useLocale();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // Token binding state
  const [bindOpen, setBindOpen] = useState(false);
  const [token, setToken] = useState<BindToken | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchAgents()
      .then(setAgents)
      .catch((err) => console.error("Failed to fetch agents:", err))
      .finally(() => setLoading(false));
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    stopPolling();
    try {
      const tk = await generateBindToken();
      setToken(tk);
      setCopied(false);

      // Countdown timer
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

      // Poll for binding status every 3s
      pollRef.current = setInterval(async () => {
        try {
          const status = await checkBindTokenStatus(tk.token);
          if (status.bound && status.agent) {
            setAgents((prev) => [...prev, status.agent!]);
            setBindOpen(false);
            setToken(null);
            stopPolling();
          }
        } catch {
          // ignore poll errors
        }
      }, 3000);
    } finally {
      setGenerating(false);
    }
  }

  function closeBind() {
    setBindOpen(false);
    setToken(null);
    stopPolling();
  }

  async function copyCommand() {
    if (!token) return;
    await navigator.clipboard.writeText(`catbus bind ${token.token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <>
      <div className="flex items-start justify-between mb-8">
        <PageHeader
          eyebrow={t("dash.eyebrow")}
          title={t("dash.agents.title")}
          description={t("dash.agents.desc")}
          className="mb-0"
        />
        {!loading && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => (bindOpen ? closeBind() : setBindOpen(true))}
            className="shrink-0 mt-6"
          >
            <Plus size={14} className="mr-1.5" />
            {t("dash.settings.bindAgent")}
          </Button>
        )}
      </div>

      {/* Token Binding Panel */}
      {bindOpen && (
        <Card hoverable={false} className="mb-6">
          <h3 className="text-[16px] font-bold text-text mb-4">
            {t("dash.agents.tokenTitle")}
          </h3>

          {/* Steps guide */}
          <div className="space-y-3 mb-6">
            {[
              { num: 1, text: t("dash.agents.tokenStep1") },
              { num: 2, text: t("dash.agents.tokenStep2") },
              { num: 3, text: t("dash.agents.tokenStep3") },
            ].map((step) => (
              <div key={step.num} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-bg-elevated border border-border flex items-center justify-center shrink-0 text-[12px] font-bold text-text-dim">
                  {step.num}
                </div>
                <p className="text-[13px] text-text-dim pt-0.5">{step.text}</p>
              </div>
            ))}
          </div>

          {!token ? (
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Terminal size={16} className="mr-2" />
              )}
              {t("dash.agents.generateToken")}
            </Button>
          ) : (
            <div className="space-y-4">
              {/* Command box */}
              <div className="bg-[hsl(0_0%_4%)] border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] uppercase tracking-wider text-text-muted">Terminal</span>
                  <button
                    onClick={copyCommand}
                    className="flex items-center gap-1.5 text-[12px] text-text-dim hover:text-text transition-[color] duration-[--motion-base] cursor-pointer"
                  >
                    {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    {copied ? t("dash.agents.tokenCopied") : "Copy"}
                  </button>
                </div>
                <code className="text-[14px] font-mono text-success">
                  $ catbus bind {token.token}
                </code>
              </div>

              {/* Status row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {remaining > 0 ? (
                    <>
                      <Loader2 size={14} className="text-text-muted animate-spin" />
                      <span className="text-[13px] text-text-dim">
                        {t("dash.agents.tokenWaiting")}
                      </span>
                    </>
                  ) : (
                    <span className="text-[13px] text-danger">
                      {t("dash.agents.tokenExpired")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {remaining > 0 && (
                    <span className="text-[12px] text-text-muted font-mono tabular-nums">
                      {t("dash.agents.tokenExpires")} {minutes}:{seconds.toString().padStart(2, "0")}
                    </span>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating}>
                    {t("dash.agents.regenerate")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end mt-4">
            <Button variant="ghost" size="sm" onClick={closeBind}>
              {t("dash.settings.cancel")}
            </Button>
          </div>
        </Card>
      )}

      {/* Agent List */}
      {loading ? (
        <div className="grid gap-4">
          {[0, 1].map((i) => (
            <Card key={i} className="h-28">
              <Skeleton variant="text" width={140} height={20} className="mb-2" />
              <Skeleton variant="text" width={240} height={14} className="mb-2" />
              <Skeleton variant="text" width={180} height={14} />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {agents.map((agent) => (
            <Link key={agent.node_id} href={`/dashboard/agents/${agent.node_id}`}>
              <Card className="flex items-start gap-5">
                <div className="w-10 h-10 rounded-md bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                  <Bot size={20} className="text-text-dim" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[16px] font-semibold text-text">
                      {agent.name}
                    </span>
                    <Badge status={agent.status} />
                  </div>
                  <p className="text-[13px] text-text-muted mb-3">
                    Node ID: {agent.node_id} &middot; Server: {agent.server}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {agent.skills.map((skill) => (
                      <span
                        key={skill.name}
                        className="text-[12px] text-text-dim bg-bg-elevated border border-border rounded-full px-3 py-0.5"
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-6 text-[12px] text-text-dim">
                    <span>{t("dash.overview.up")} {formatUptime(agent.uptime_seconds)}</span>
                    <span>{agent.calls_handled} {t("dash.agents.callsHandled")}</span>
                    <span>{agent.calls_made} {t("dash.agents.callsMade")}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {agents.length === 0 && !bindOpen && (
            <Card hoverable={false} className="py-16 text-center">
              <Bot size={40} className="text-text-muted mx-auto mb-4" />
              <p className="text-[16px] font-semibold text-text mb-2">{t("dash.agents.noAgents")}</p>
              <p className="text-[13px] text-text-muted mb-6 max-w-sm mx-auto">
                {t("dash.agents.noAgentsDesc").replace("{cmd}", "catbus serve")}
              </p>
              <Button variant="primary" onClick={() => setBindOpen(true)}>
                <Terminal size={16} className="mr-2" />
                {t("dash.agents.tokenTitle")}
              </Button>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
