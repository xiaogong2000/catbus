"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUptime } from "@/lib/mock-data-dashboard";
import type { Agent } from "@/lib/mock-data-dashboard";
import {
  fetchSettings,
  fetchAgents,
  updateSettings,
  bindAgent,
  unbindAgent,
} from "@/lib/dashboard-api";
import { Github, Bot, Bell, Link2, Unlink } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

export default function SettingsPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [notifications, setNotifications] = useState({
    agent_offline_email: true,
    daily_report: false,
    weekly_report: false,
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const [bindStep, setBindStep] = useState<"idle" | "input">("idle");
  const [nodeIdInput, setNodeIdInput] = useState("");
  const [bindError, setBindError] = useState<string | null>(null);
  const [binding, setBinding] = useState(false);
  const [unbinding, setUnbinding] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [settings, agentList] = await Promise.all([
          fetchSettings(),
          fetchAgents(),
        ]);
        setEmail(settings.email);
        setGithubUsername(settings.github_username ?? "");
        setNotifications(settings.notifications);
        setAgents(agentList);
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleToggle(key: keyof typeof notifications) {
    const newVal = !notifications[key];
    setNotifications((prev) => ({ ...prev, [key]: newVal }));
    updateSettings({ notifications: { [key]: newVal } }).catch(() => {
      // Backend not ready yet — keep frontend state as-is
    });
  }

  async function handleBind() {
    const nodeId = nodeIdInput.trim();
    if (!nodeId) return;
    setBinding(true);
    setBindError(null);
    try {
      const res = await bindAgent(nodeId);
      setAgents((prev) => [...prev, res.agent]);
      setBindStep("idle");
      setNodeIdInput("");
    } catch (err) {
      setBindError(err instanceof Error ? err.message : "Failed to bind agent");
    } finally {
      setBinding(false);
    }
  }

  async function handleUnbind(nodeId: string) {
    if (!confirm(t("dash.settings.confirmUnbind"))) return;
    setUnbinding(nodeId);
    try {
      await unbindAgent(nodeId);
      setAgents((prev) => prev.filter((a) => a.node_id !== nodeId));
    } catch (err) {
      console.error("Failed to unbind:", err);
    } finally {
      setUnbinding(null);
    }
  }

  const notificationItems = [
    {
      key: "agent_offline_email" as const,
      label: t("dash.settings.agentOffline"),
      desc: t("dash.settings.agentOfflineDesc"),
    },
    {
      key: "daily_report" as const,
      label: t("dash.settings.dailyReport"),
      desc: t("dash.settings.dailyReportDesc"),
    },
    {
      key: "weekly_report" as const,
      label: t("dash.settings.weeklyReport"),
      desc: t("dash.settings.weeklyReportDesc"),
    },
  ];

  if (loading) {
    return (
      <>
        <PageHeader eyebrow={t("dash.eyebrow")} title={t("dash.settings.title")} description={t("dash.settings.desc")} />
        <Card className="mb-8">
          <Skeleton variant="text" width={200} height={20} className="mb-2" />
          <Skeleton variant="text" width={160} height={14} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={t("dash.eyebrow")}
        title={t("dash.settings.title")}
        description={t("dash.settings.desc")}
      />

      {/* Account Info */}
      <section className="mb-8">
        <h2 className="text-[18px] font-bold text-text mb-4">{t("dash.settings.account")}</h2>
        <Card hoverable={false}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center">
              <Github size={20} className="text-text-dim" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-text">
                {githubUsername || "—"}
              </p>
              <p className="text-[13px] text-text-muted">
                {email}
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Bound Agents */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-bold text-text">{t("dash.settings.boundAgents")}</h2>
          {bindStep === "idle" && (
            <Button variant="primary" size="sm" onClick={() => setBindStep("input")}>
              <Link2 size={14} className="mr-1.5" />
              {t("dash.settings.bindAgent")}
            </Button>
          )}
        </div>

        {/* Agent binding flow */}
        {bindStep === "input" && (
          <Card hoverable={false} className="mb-4">
            <p className="text-[13px] text-text-dim mb-3">
              {t("dash.settings.enterNodeId")} <code className="font-mono text-text bg-bg-elevated px-1.5 py-0.5 rounded text-[12px]">catbus status</code>:
            </p>
            <Input
              placeholder={t("dash.settings.nodeIdPlaceholder")}
              value={nodeIdInput}
              onChange={(e) => setNodeIdInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleBind(); }}
              className="mb-3"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBindStep("idle");
                  setNodeIdInput("");
                  setBindError(null);
                }}
              >
                {t("dash.settings.cancel")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleBind}
                disabled={binding}
              >
                {binding ? t("dash.settings.binding") : t("dash.settings.bind")}
              </Button>
            </div>
            {bindError && (
              <p className="text-[12px] text-danger mt-2">{bindError}</p>
            )}
          </Card>
        )}

        {/* Existing bound agents */}
        <div className="grid gap-3">
          {agents.map((agent) => (
            <Card key={agent.node_id} hoverable={false} className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-md bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                <Bot size={18} className="text-text-dim" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-text">
                    {agent.name}
                  </span>
                  <Badge status={agent.status} />
                </div>
                <p className="text-[12px] text-text-muted">
                  {agent.node_id} &middot; {t("dash.overview.up")} {formatUptime(agent.uptime_seconds)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleUnbind(agent.node_id)}
                disabled={unbinding === agent.node_id}
                className="shrink-0 text-text-muted hover:text-danger"
              >
                <Unlink size={14} className="mr-1" />
                {unbinding === agent.node_id ? t("dash.settings.unbinding") : t("dash.settings.unbind")}
              </Button>
            </Card>
          ))}
          {agents.length === 0 && (
            <Card hoverable={false} className="py-8 text-center">
              <Bot size={24} className="text-text-muted mx-auto mb-2" />
              <p className="text-[13px] text-text-dim">{t("dash.settings.noAgents")}</p>
            </Card>
          )}
        </div>
      </section>

      {/* Notification Settings */}
      <section>
        <h2 className="text-[18px] font-bold text-text mb-4">
          <Bell size={18} className="inline mr-2 -mt-0.5" />
          {t("dash.settings.notifications")}
        </h2>
        <Card hoverable={false}>
          <div className="space-y-4">
            {notificationItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => handleToggle(item.key)}
              >
                <div>
                  <p className="text-[14px] text-text group-hover:text-white transition-[color] duration-[--motion-base]">
                    {item.label}
                  </p>
                  <p className="text-[12px] text-text-muted">{item.desc}</p>
                </div>
                <span
                  role="switch"
                  aria-checked={notifications[item.key]}
                  aria-label={item.label}
                  className={`relative w-10 h-5 rounded-full transition-[background] duration-[--motion-base] ease-[--ease-standard] cursor-pointer ${
                    notifications[item.key]
                      ? "bg-success"
                      : "bg-bg-elevated border border-border"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-text transition-[left] duration-[--motion-base] ease-[--ease-standard] ${
                      notifications[item.key] ? "left-5" : "left-0.5"
                    }`}
                  />
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </>
  );
}
