"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PageTransition } from "@/components/motion/page-transition";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchSettings,
  updateSettings,
} from "@/lib/dashboard-api";
import { Github, Bell } from "lucide-react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const settings = await fetchSettings();
        setEmail(settings.email);
        setGithubUsername(settings.github_username ?? "");
        setNotifications(settings.notifications);
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
    <PageTransition>
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
    </PageTransition>
  );
}
