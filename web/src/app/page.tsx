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
import Link from "next/link";


const agentLogos = [
  { name: "OpenAI", logo: "/logos/openai.svg" },
  { name: "Anthropic", logo: "/logos/anthropic.svg" },
  { name: "LangChain", logo: "/logos/langchain.svg" },
  { name: "AutoGPT", logo: "/logos/autogpt.svg" },
  { name: "CrewAI", logo: "/logos/crewai.svg" },
  { name: "MetaGPT", logo: "/logos/metagpt.svg" },
  { name: "BabyAGI", logo: "/logos/babyagi.svg" },
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
    { titleKey: "home.card.connect", descKey: "home.card.connectDesc", accent: "primary" as const },
    { titleKey: "home.card.guides", descKey: "home.card.guidesDesc", accent: undefined },
    { titleKey: "home.card.community", descKey: "home.card.communityDesc", accent: undefined },
    { titleKey: "home.card.marketplace", descKey: "home.card.marketplaceDesc", accent: "warning" as const },
  ];

  const trustCards = [
    { step: "01", titleKey: "home.trust.schema", descKey: "home.trust.schemaDesc", accent: "primary" as const },
    { step: "02", titleKey: "home.trust.reputation", descKey: "home.trust.reputationDesc", accent: undefined },
    { step: "03", titleKey: "home.trust.audit", descKey: "home.trust.auditDesc", accent: "success" as const },
  ];

  const bioCards = [
    { titleKey: "home.bio.symbiosis", descKey: "home.bio.symbiosisDesc", accent: undefined },
    { titleKey: "home.bio.evolution", descKey: "home.bio.evolutionDesc", accent: "success" as const },
    { titleKey: "home.bio.resilience", descKey: "home.bio.resilienceDesc", accent: undefined },
  ];

  return (
    <PageTransition>
      <div className="py-10">
        {/* Hero Section */}
        <section className="flex flex-col lg:flex-row gap-10 mb-16">
          <div className="lg:w-2/3">
            <AnimateIn>
              <h1 className="text-[60px] font-bold leading-[1] tracking-[-1.5px] text-text mb-6">
                {t("home.hero.title")}
              </h1>
            </AnimateIn>
            <AnimateIn delay={0.1}>
              <p className="text-[16px] text-text-dim max-w-[540px] mb-8 leading-[1.5]">
                {t("home.hero.desc")}
              </p>
            </AnimateIn>
            <AnimateIn delay={0.2}>
              <div className="flex flex-wrap gap-3">
                <Link href="/docs">
                  <Button variant="primary" size="lg">{t("home.hero.askCatBus")}</Button>
                </Link>
                <Link href="/network/skills">
                  <Button variant="primary" size="lg">{t("home.hero.browseMarket")}</Button>
                </Link>
                <a href="https://github.com/xiaogong2000/catbus" target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="lg">{t("home.hero.githubStar")}</Button>
                </a>
              </div>
            </AnimateIn>
          </div>

          <AnimateIn delay={0.15} className="lg:w-1/3">
            <div className="glass rounded-lg p-4 font-mono text-[13px]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-text-muted uppercase tracking-[0.6px]">
                  {t("home.quickStart")}
                </span>
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-success/60" />
                </div>
              </div>
              <pre className="text-text-dim leading-[1.6] overflow-x-auto">
                <code>
{`$ pip install catbus
$ catbus init
$ catbus serve`}
                </code>
              </pre>
              <div className="mt-4 space-y-2 text-[13px]">
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
                <Card glass accent={item.accent}>
                  <h3 className="text-[16px] font-semibold text-text mb-2">{t(item.titleKey)}</h3>
                  <p className="text-[14px] text-text-dim leading-[1.5]">{t(item.descKey)}</p>
                </Card>
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
          <StaggerContainer className="flex flex-wrap items-center gap-4">
            {agentLogos.map((item) => (
              <StaggerItem key={item.name}>
                <div className="border border-border rounded-lg px-5 py-3 flex items-center gap-2.5 text-[13px] text-text-dim hover:border-border-hover hover:text-text transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-2px_hsl(var(--c-primary)/0.1)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.logo}
                    alt={item.name}
                    width={18}
                    height={18}
                    className="invert opacity-60"
                  />
                  {item.name}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
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
                <Card className="bg-bg-elevated" accent={item.accent}>
                  <span className="text-[12px] text-text-muted font-mono">{item.step}</span>
                  <h3 className="text-[16px] font-semibold text-text mt-2 mb-2">{t(item.titleKey)}</h3>
                  <p className="text-[14px] text-text-dim leading-[1.5]">{t(item.descKey)}</p>
                </Card>
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
                <Card glass accent={item.accent}>
                  <h3 className="text-[16px] font-semibold text-text mb-2">{t(item.titleKey)}</h3>
                  <p className="text-[14px] text-text-dim leading-[1.5]">{t(item.descKey)}</p>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>
      </div>
    </PageTransition>
  );
}
