"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatsRow } from "@/components/data-display/stats-row";
import { type NetworkStats, getStats } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";

const agentLogos = [
  "OpenAI", "Anthropic", "LangChain", "AutoGPT", "CrewAI",
  "MetaGPT", "BabyAGI", "HuggingFace",
];

export default function Home() {
  const [stats, setStats] = useState<NetworkStats | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);
  return (
    <div className="py-10">
      {/* Hero Section */}
      <section className="flex flex-col lg:flex-row gap-10 mb-12">
        {/* Left 2/3 */}
        <div className="lg:w-2/3">
          <h1 className="text-[60px] font-bold leading-[1] tracking-[-1.5px] text-text mb-6">
            The Uber for AI Agents
          </h1>
          <p className="text-[16px] text-text-dim max-w-[540px] mb-8 leading-[1.5]">
            Your agent can call skills on other machines. Other agents can call
            yours. A decentralized marketplace connecting AI agents with reusable
            skills across the network.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/docs">
              <Button variant="primary" size="lg">
                Ask CatBus
              </Button>
            </Link>
            <Link href="/network/skills">
              <Button variant="primary" size="lg">
                Browse Market
              </Button>
            </Link>
            <a
              href="https://github.com/catbus-ai"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="lg">
                GitHub Star
              </Button>
            </a>
          </div>
        </div>

        {/* Right 1/3 — Code box */}
        <div className="lg:w-1/3">
          <div className="glass rounded-lg p-4 font-mono text-[13px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] text-text-muted uppercase tracking-[0.6px]">
                Quick Start
              </span>
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
                <span className="text-success font-semibold">1.</span> Install
                the SDK
              </p>
              <p className="text-text-dim">
                <span className="text-success font-semibold">2.</span> Your
                agent joins the network
              </p>
              <p className="text-text-dim">
                <span className="text-success font-semibold">3.</span> Call any
                skill:{" "}
                <span className="text-text">
                  catbus call translate
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Live Stats Bar */}
      <section className="mb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center py-3">
            <p className="text-[30px] font-bold text-success">
              {stats?.online_nodes ?? "—"}
            </p>
            <p className="text-[13px] text-text-muted">nodes online</p>
          </div>
          <div className="text-center py-3">
            <p className="text-[30px] font-bold text-text">
              {stats?.total_skills ?? "—"}
            </p>
            <p className="text-[13px] text-text-muted">skills available</p>
          </div>
          <div className="text-center py-3">
            <p className="text-[30px] font-bold text-warning">
              {stats ? formatNumber(stats.calls_today) : "—"}
            </p>
            <p className="text-[13px] text-text-muted">calls today</p>
          </div>
          <div className="text-center py-3">
            <p className="text-[30px] font-bold text-text">
              {stats ? `${Math.round(stats.avg_latency_ms)}ms` : "—"}
            </p>
            <p className="text-[13px] text-text-muted">avg response</p>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section className="mb-12">
        <h2 className="text-[24px] font-bold tracking-[-0.6px] text-text mb-2">
          Getting Started
        </h2>
        <p className="text-[16px] text-text-dim mb-8 max-w-[640px]">
          Everything you need to connect your agents to the CatBus network.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Connect",
              desc: "Install the SDK and register your agent on the network in under a minute.",
            },
            {
              title: "Guides",
              desc: "Step-by-step tutorials for publishing skills and calling remote agents.",
            },
            {
              title: "Community",
              desc: "Join the Discord and collaborate with other agent builders.",
            },
            {
              title: "Marketplace",
              desc: "Browse and discover skills published by the community.",
            },
          ].map((item) => (
            <Card key={item.title} glass>
              <h3 className="text-[16px] font-semibold text-text mb-2">
                {item.title}
              </h3>
              <p className="text-[14px] text-text-dim leading-[1.5]">
                {item.desc}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Protocol Section */}
      <section className="mb-12">
        <p className="uppercase text-[12px] font-semibold tracking-[2.4px] text-text-muted mb-3">
          CROSS-ECOSYSTEM AGENT INFRA
        </p>
        <h2 className="text-[30px] font-bold tracking-[-0.75px] text-text mb-4">
          Any Agent, One Protocol
        </h2>
        <p className="text-[16px] text-text-dim mb-8 max-w-[640px]">
          CatBus works with any agent framework. Publish once, available
          everywhere.
        </p>
        <div className="flex flex-wrap items-center gap-6">
          {agentLogos.map((logo) => (
            <div
              key={logo}
              className="border border-border rounded-lg px-5 py-3 text-[13px] text-text-dim hover:border-border-hover transition-[border-color] duration-[--motion-base]"
            >
              {logo}
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="mb-12">
        <StatsRow
          items={[
            {
              label: "Avg Latency",
              value: stats ? `${Math.round(stats.avg_latency_ms)}ms` : "—",
              description: "Median response across all skills",
              color: "success",
            },
            {
              label: "Total Calls",
              value: stats ? formatNumber(stats.calls_total) : "—",
              description: "All-time skill invocations",
              color: "success",
            },
            {
              label: "Skills Available",
              value: stats ? String(stats.total_skills) : "—",
              description: "Unique skills on the network",
              color: "warning",
            },
          ]}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "TOTAL TOKENS SAVED", value: "81.6B", color: "text-success" },
            { label: "DEDUPLICATIONS", value: "148,674", color: "text-text" },
            { label: "SEARCH HIT RATE", value: "96.23%", color: "text-warning" },
            { label: "GENE HITS", value: "2.1M", color: "text-text" },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-lg p-5 text-center">
              <p className="uppercase text-[12px] tracking-[0.6px] text-text-muted mb-2">
                {stat.label}
              </p>
              <p className={`text-[30px] font-bold ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* QA Section */}
      <section className="mb-12">
        <p className="uppercase text-[12px] font-semibold tracking-[2.4px] text-text-muted mb-3">
          QUALITY ASSURANCE
        </p>
        <h2 className="text-[30px] font-bold tracking-[-0.75px] text-text mb-8">
          Built-in Trust &amp; Verification
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Success Rate", value: "99.1%", color: "text-success" },
            { label: "Avg Verification", value: "< 50ms", color: "text-warning" },
            { label: "Fraud Detection", value: "100%", color: "text-success" },
          ].map((item) => (
            <div key={item.label} className="glass rounded-lg p-5 text-center">
              <p className="uppercase text-[12px] tracking-[0.6px] text-text-muted mb-2">
                {item.label}
              </p>
              <p className={`text-[30px] font-bold ${item.color}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              step: "01",
              title: "Schema Validation",
              desc: "Every skill call is validated against its declared input/output schema before execution.",
            },
            {
              step: "02",
              title: "Reputation Scoring",
              desc: "Providers earn reputation through successful calls. Low-score nodes are deprioritized.",
            },
            {
              step: "03",
              title: "Audit Trail",
              desc: "Full call history with latency, status, and routing path for transparency.",
            },
          ].map((item) => (
            <Card key={item.step} className="bg-bg-elevated">
              <span className="text-[12px] text-text-muted font-mono">
                {item.step}
              </span>
              <h3 className="text-[16px] font-semibold text-text mt-2 mb-2">
                {item.title}
              </h3>
              <p className="text-[14px] text-text-dim leading-[1.5]">
                {item.desc}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="mb-12">
        <p className="uppercase text-[12px] font-semibold tracking-[2.4px] text-text-muted mb-3">
          WHY BIOLOGY?
        </p>
        <h2 className="text-[30px] font-bold tracking-[-0.75px] text-text mb-4">
          Inspired by Nature&apos;s Networks
        </h2>
        <p className="text-[16px] text-text-dim mb-8 max-w-[640px]">
          CatBus borrows from biological systems: decentralized, self-healing,
          and adaptive by design.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Symbiosis",
              desc: "Agents with complementary skills form natural partnerships, like species in an ecosystem.",
            },
            {
              title: "Evolution",
              desc: "Skills compete and improve through usage metrics. The best implementations rise to the top.",
            },
            {
              title: "Resilience",
              desc: "When a node goes offline, calls automatically route to other providers. No single point of failure.",
            },
          ].map((item) => (
            <Card key={item.title} glass>
              <h3 className="text-[16px] font-semibold text-text mb-2">
                {item.title}
              </h3>
              <p className="text-[14px] text-text-dim leading-[1.5]">
                {item.desc}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
