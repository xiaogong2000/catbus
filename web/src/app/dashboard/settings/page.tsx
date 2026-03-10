"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { userSettings, myAgents, formatUptime } from "@/lib/mock-data-dashboard";
import { Github, Bot, Bell, Link2, Copy, Check } from "lucide-react";

export default function SettingsPage() {
  const [notifications, setNotifications] = useState(
    userSettings.notifications,
  );
  const [bindStep, setBindStep] = useState<"idle" | "input" | "verify">("idle");
  const [nodeIdInput, setNodeIdInput] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [copied, setCopied] = useState(false);

  function handleStartBind() {
    setBindStep("input");
  }

  function handleGenerateToken() {
    if (!nodeIdInput.trim()) return;
    // Mock: generate a fake verification token
    setVerifyToken(`catbus_verify_${Math.random().toString(36).slice(2, 10)}`);
    setBindStep("verify");
  }

  function handleCopyToken() {
    navigator.clipboard.writeText(`catbus verify ${verifyToken}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleToggle(key: keyof typeof notifications) {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Settings"
        description="Manage your account, agents, and notification preferences."
      />

      {/* Account Info */}
      <section className="mb-8">
        <h2 className="text-[18px] font-bold text-text mb-4">Account</h2>
        <Card hoverable={false}>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-bg-elevated border border-border flex items-center justify-center">
              <Github size={20} className="text-text-dim" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-text">
                {userSettings.github_username}
              </p>
              <p className="text-[13px] text-text-muted">
                {userSettings.email}
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Bound Agents */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-bold text-text">Bound Agents</h2>
          {bindStep === "idle" && (
            <Button variant="primary" size="sm" onClick={handleStartBind}>
              <Link2 size={14} className="mr-1.5" />
              Bind Agent
            </Button>
          )}
        </div>

        {/* Agent binding flow */}
        {bindStep === "input" && (
          <Card hoverable={false} className="mb-4">
            <p className="text-[13px] text-text-dim mb-3">
              Step 1: Run <code className="font-mono text-text bg-bg-elevated px-1.5 py-0.5 rounded text-[12px]">catbus status</code> on your machine to get the Node ID.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Enter Node ID (e.g. 0df18901909a)"
                value={nodeIdInput}
                onChange={(e) => setNodeIdInput(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={handleGenerateToken}
              >
                Generate Token
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBindStep("idle")}
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {bindStep === "verify" && (
          <Card hoverable={false} className="mb-4">
            <p className="text-[13px] text-text-dim mb-3">
              Step 2: Run this command on your machine to complete binding:
            </p>
            <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-md px-4 py-2.5 font-mono text-[13px] text-text">
              <span className="flex-1 overflow-x-auto">
                catbus verify {verifyToken}
              </span>
              <button
                onClick={handleCopyToken}
                className="text-text-muted hover:text-text transition-[color] duration-[--motion-base] shrink-0 cursor-pointer"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setBindStep("idle");
                  setNodeIdInput("");
                  setVerifyToken("");
                }}
              >
                Done
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBindStep("idle");
                  setNodeIdInput("");
                  setVerifyToken("");
                }}
              >
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {/* Existing bound agents */}
        <div className="grid gap-3">
          {myAgents.map((agent) => (
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
                  {agent.node_id} &middot; Up {formatUptime(agent.uptime_seconds)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Notification Settings */}
      <section>
        <h2 className="text-[18px] font-bold text-text mb-4">
          <Bell size={18} className="inline mr-2 -mt-0.5" />
          Notifications
        </h2>
        <Card hoverable={false}>
          <div className="space-y-4">
            {([
              {
                key: "agent_offline_email" as const,
                label: "Agent offline alert",
                desc: "Get an email when any of your agents goes offline.",
              },
              {
                key: "daily_report" as const,
                label: "Daily report",
                desc: "Daily summary of call statistics.",
              },
              {
                key: "weekly_report" as const,
                label: "Weekly report",
                desc: "Weekly network and agent performance report.",
              },
            ]).map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <p className="text-[14px] text-text group-hover:text-white transition-[color] duration-[--motion-base]">
                    {item.label}
                  </p>
                  <p className="text-[12px] text-text-muted">{item.desc}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={notifications[item.key]}
                  aria-label={item.label}
                  onClick={() => handleToggle(item.key)}
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
                </button>
              </label>
            ))}
          </div>
        </Card>
      </section>
    </>
  );
}
