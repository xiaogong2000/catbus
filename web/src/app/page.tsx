"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimateIn, StaggerContainer, StaggerItem } from "@/components/motion/animate-in";
import { PageTransition } from "@/components/motion/page-transition";
import { type NetworkStats, getStats } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import { ArrowRight, Shield, Star, ClipboardList } from "lucide-react";
import Link from "next/link";


const agentLogos = [
  { name: "OpenClaw", logo: "/logos/openclaw.svg" },
  { name: "Manus", logo: "/logos/manus.svg" },
  { name: "OpenAI", logo: "/logos/openai.svg" },
  { name: "Gemini", logo: "/logos/gemini.svg" },
  { name: "Claude", logo: "/logos/claude.svg" },
  { name: "Antigravity", logo: "/logos/antigravity.svg" },
  { name: "LangChain", logo: "/logos/langchain.svg" },
  { name: "HuggingFace", logo: "/logos/huggingface.svg" },
];

function StatNumber({ value, color = "text-text" }: { value: string; color?: string }) {
  return <p className={`text-[30px] font-bold ${color}`}>{value}</p>;
}

function StatSkeleton() {
  return (
    <div className="text-center py-3">
      <Skeleton variant="text" width={60} height={36} className="mx-auto mb-1" />
      <Skeleton variant="text" width={90} height={16} className="mx-auto" />
    </div>
  );
}

export default function Home() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLocale();

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch((err) => console.error("Failed to fetch stats:", err))
      .finally(() => setLoading(false));
  }, []);

  const gettingStartedCards = [
    { titleKey: "home.card.connect", descKey: "home.card.connectDesc", icon: "🔗", accent: "hsl(220 100% 60%)", href: "/dashboard/agents" },
    { titleKey: "home.card.guides", descKey: "home.card.guidesDesc", icon: "📖", accent: "hsl(260 80% 60%)", href: "/docs" },
    { titleKey: "home.card.community", descKey: "home.card.communityDesc", icon: "💬", accent: "hsl(150 100% 35%)", href: "https://github.com/xiaogong2000/catbus", external: true },
    { titleKey: "home.card.marketplace", descKey: "home.card.marketplaceDesc", icon: "🏪", accent: "hsl(35 100% 50%)", href: "/network/skills" },
  ];

  const trustCards = [
    { step: "01", titleKey: "home.trust.schema", descKey: "home.trust.schemaDesc", accent: "hsl(220 100% 60%)", Icon: Shield },
    { step: "02", titleKey: "home.trust.reputation", descKey: "home.trust.reputationDesc", accent: "hsl(260 80% 60%)", Icon: Star },
    { step: "03", titleKey: "home.trust.audit", descKey: "home.trust.auditDesc", accent: "hsl(150 100% 35%)", Icon: ClipboardList },
  ];

  const bioCards = [
    { titleKey: "home.bio.symbiosis", descKey: "home.bio.symbiosisDesc", tag: "🧬 Symbiosis", accent: "hsl(220 100% 60%)" },
    { titleKey: "home.bio.evolution", descKey: "home.bio.evolutionDesc", tag: "🧪 Evolution", accent: "hsl(150 100% 35%)" },
    { titleKey: "home.bio.resilience", descKey: "home.bio.resilienceDesc", tag: "🔄 Resilience", accent: "hsl(35 100% 50%)" },
  ];

  return (
    <PageTransition>
      <div className="py-10">
        {/* Hero Section */}
        <section className="relative flex flex-col lg:flex-row gap-12 mb-20 pt-6">
          <div className="hero-spotlight" />
          <div className="relative z-10 lg:w-2/3">
            <AnimateIn>
              <h1 className="hero-gradient-text text-[64px] font-bold leading-[1.05] tracking-[-2px] mb-8">
                {t("home.hero.title")}
              </h1>
            </AnimateIn>
            <AnimateIn delay={0.1}>
              <p className="text-[17px] text-text-dim max-w-[520px] mb-10 leading-[1.65]">
                {t("home.hero.desc")}
              </p>
            </AnimateIn>
            <AnimateIn delay={0.2}>
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/docs">
                  <button className="btn-glow inline-flex items-center justify-center h-12 px-8 rounded-lg text-[15px] font-semibold cursor-pointer">
                    {t("home.hero.askCatBus")}
                  </button>
                </Link>
                <Link href="/network/skills">
                  <Button variant="primary" size="lg">{t("home.hero.browseMarket")}</Button>
                </Link>
                <a
                  href="https://github.com/xiaogong2000/catbus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] text-text-muted hover:text-text transition-colors duration-200"
                >
                  {t("home.hero.githubStar")} &rarr;
                </a>
              </div>
            </AnimateIn>
          </div>

          <AnimateIn delay={0.15} className="relative z-10 lg:w-1/3">
            <div className="glass rounded-xl p-5 font-mono text-[13px]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] text-text-muted uppercase tracking-[0.6px]">
                  {t("home.quickStart")}
                </span>
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
                </div>
              </div>
              <pre className="text-text-dim leading-[1.7] overflow-x-auto">
                <code>
{`$ pip install catbus
$ catbus init
$ catbus serve`}
                </code>
              </pre>
              <div className="mt-4 pt-4 border-t border-[hsl(var(--glass-border))] space-y-2.5 text-[13px]">
                <p className="text-text-dim">
                  <span className="text-success font-semibold">1.</span> {t("home.step1")}
                </p>
                <p className="text-text-dim">
                  <span className="text-success font-semibold">2.</span> {t("home.step2")}
                </p>
                <p className="text-text-dim">
                  <span className="text-success font-semibold">3.</span> {t("home.step3")}{" "}
                  <span className="text-text">catbus call translate</span>
                </p>
              </div>
            </div>
          </AnimateIn>
        </section>

        {/* Live Stats Bar */}
        <AnimateIn>
          <section className="mb-16">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {loading ? (
                <>
                  <StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton />
                </>
              ) : (
                <>
                  <div className="text-center py-3">
                    <StatNumber value={String(stats?.online_nodes ?? 0)} color="text-success" />
                    <p className="text-[13px] text-text-muted">{t("home.stat.nodesOnline")}</p>
                  </div>
                  <div className="text-center py-3">
                    <StatNumber value={String(stats?.total_skills ?? 0)} />
                    <p className="text-[13px] text-text-muted">{t("home.stat.skillsAvailable")}</p>
                  </div>
                  <div className="text-center py-3">
                    <StatNumber value={stats ? formatNumber(stats.calls_today) : "0"} color="text-warning" />
                    <p className="text-[13px] text-text-muted">{t("home.stat.callsToday")}</p>
                  </div>
                  <div className="text-center py-3">
                    <StatNumber value={stats ? `${Math.round(stats.avg_latency_ms)}ms` : "0ms"} />
                    <p className="text-[13px] text-text-muted">{t("home.stat.avgResponse")}</p>
                  </div>
                </>
              )}
            </div>
          </section>
        </AnimateIn>

        {/* Getting Started */}
        <section className="mb-16">
          <AnimateIn>
            <h2 className="text-[24px] font-bold tracking-[-0.6px] text-text mb-2">
              {t("home.gettingStarted.title")}
            </h2>
            <p className="text-[16px] text-text-dim mb-8 max-w-[640px]">
              {t("home.gettingStarted.desc")}
            </p>
          </AnimateIn>
          <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {gettingStartedCards.map((item) => (
              <StaggerItem key={item.titleKey}>
                <Link
                  href={item.href}
                  {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="block h-full"
                >
                  <div
                    className="relative h-full rounded-xl bg-bg-elevated border border-border p-6 pb-10 transition-all duration-300 hover:-translate-y-0.5 hover:border-border-hover group"
                    style={{ borderTopColor: item.accent, borderTopWidth: 2 }}
                  >
                    <div
                      className="w-11 h-11 rounded-[10px] flex items-center justify-center text-[22px] mb-4"
                      style={{ background: `${item.accent.replace(")", " / 0.15)")}` }}
                    >
                      {item.icon}
                    </div>
                    <h3 className="text-[16px] font-semibold text-text mb-2">{t(item.titleKey)}</h3>
                    <p className="text-[13px] text-text-dim leading-[1.55]">{t(item.descKey)}</p>
                    <ArrowRight size={16} className="absolute bottom-5 right-5 text-text-muted group-hover:text-text group-hover:translate-x-0.5 transition-all duration-200" />
                  </div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>

        {/* Protocol Section */}
        <section className="mb-16">
          <AnimateIn>
            <p className="uppercase text-[12px] font-semibold tracking-[2.4px] text-text-muted mb-3">
              {t("home.protocol.eyebrow")}
            </p>
            <h2 className="text-[30px] font-bold tracking-[-0.75px] text-text mb-4">
              {t("home.protocol.title")}
            </h2>
            <p className="text-[16px] text-text-dim mb-8 max-w-[640px]">
              {t("home.protocol.desc")}
            </p>
          </AnimateIn>
          <AnimateIn delay={0.15}>
            <div className="glass rounded-xl p-6">
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-6">
                {agentLogos.map((item) => (
                  <div key={item.name} className="flex flex-col items-center gap-2.5 group">
                    <div className="w-14 h-14 rounded-xl bg-bg-elevated border border-border flex items-center justify-center transition-all duration-300 group-hover:border-border-hover group-hover:-translate-y-0.5 group-hover:shadow-[0_4px_16px_-4px_hsl(var(--c-primary)/0.2)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.logo}
                        alt={item.name}
                        width={28}
                        height={28}
                      />
                    </div>
                    <span className="text-[12px] text-text-dim group-hover:text-text transition-colors duration-300">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </AnimateIn>
        </section>

        {/* Trust & Verification */}
        <section className="mb-16">
          <AnimateIn>
            <p className="uppercase text-[12px] font-semibold tracking-[2.4px] text-text-muted mb-3">
              {t("home.trust.eyebrow")}
            </p>
            <h2 className="text-[30px] font-bold tracking-[-0.75px] text-text mb-8">
              {t("home.trust.title")}
            </h2>
          </AnimateIn>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trustCards.map((item) => (
              <StaggerItem key={item.step}>
                <div
                  className="rounded-xl bg-bg-elevated border border-border p-6 flex items-start gap-4 transition-all duration-300 hover:-translate-y-0.5 h-full"
                  style={{ borderLeftColor: item.accent, borderLeftWidth: 3 }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: `${item.accent.replace(")", " / 0.08)")}`,
                      border: `1px solid ${item.accent.replace(")", " / 0.2)")}`,
                    }}
                  >
                    <item.Icon size={18} style={{ color: item.accent }} />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold font-mono tracking-[1px] mb-1.5 block" style={{ color: item.accent }}>
                      STEP {item.step}
                    </span>
                    <h3 className="text-[16px] font-semibold text-text mb-2">{t(item.titleKey)}</h3>
                    <p className="text-[13px] text-text-dim leading-[1.55]">{t(item.descKey)}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>

        {/* Philosophy Section */}
        <section className="mb-12">
          <AnimateIn>
            <p className="uppercase text-[12px] font-semibold tracking-[2.4px] text-text-muted mb-3">
              {t("home.bio.eyebrow")}
            </p>
            <h2 className="text-[30px] font-bold tracking-[-0.75px] text-text mb-4">
              {t("home.bio.title")}
            </h2>
            <p className="text-[16px] text-text-dim mb-8 max-w-[640px]">
              {t("home.bio.desc")}
            </p>
          </AnimateIn>
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bioCards.map((item) => (
              <StaggerItem key={item.titleKey}>
                <div className="relative rounded-xl bg-bg-elevated border border-border p-7 pt-5 transition-all duration-300 hover:-translate-y-0.5 h-full overflow-hidden">
                  <div
                    className="absolute top-0 left-6 w-10 h-[3px] rounded-b-sm"
                    style={{ background: item.accent }}
                  />
                  <h3
                    className="text-[22px] font-bold mt-2 mb-2"
                    style={{
                      background: `linear-gradient(135deg, #fff, ${item.accent})`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {t(item.titleKey)}
                  </h3>
                  <p className="text-[13px] text-text-dim leading-[1.6]">{t(item.descKey)}</p>
                  <span className="inline-block mt-4 text-[11px] text-text-muted bg-bg-elevated border border-border rounded-full px-2.5 py-0.5">
                    {item.tag}
                  </span>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
      </div>
    </PageTransition>
  );
}
