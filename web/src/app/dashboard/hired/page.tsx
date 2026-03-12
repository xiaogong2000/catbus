"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PageTransition } from "@/components/motion/page-transition";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getHireMarket,
  createHireRequest,
  getMyHireRequests,
  getHiredAgentsFull,
  terminateHire,
} from "@/lib/dashboard-api";
import type {
  HireMarketItem,
  MyHireRequest,
  HiredAgentFull,
} from "@/lib/provider-types";
import { relativeTime } from "@/lib/mock-data-dashboard";
import { Search, Users, Briefcase, FileText, Send, XCircle } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

type Tab = "market" | "requests" | "contracts";

const requestStatusColor: Record<string, string> = {
  pending: "text-warning bg-warning/10 border-warning/20",
  approved: "text-success bg-success/10 border-success/20",
  rejected: "text-danger bg-danger/10 border-danger/20",
  expired: "text-text-muted bg-bg-elevated border-border",
};

export default function HiredAgentsPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("market");
  const [loading, setLoading] = useState(true);

  // Market state
  const [marketItems, setMarketItems] = useState<HireMarketItem[]>([]);
  const [search, setSearch] = useState("");
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  // Requests state
  const [requests, setRequests] = useState<MyHireRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Contracts state
  const [contracts, setContracts] = useState<HiredAgentFull[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [terminating, setTerminating] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Load market on mount
  useEffect(() => {
    loadMarket();
  }, []);

  async function loadMarket() {
    setLoading(true);
    try {
      const res = await getHireMarket({ page: 1, limit: 50 });
      // Normalize backend response (may have different field names)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: HireMarketItem[] = (res.data || []).map((raw: any) => ({
        node_id: (raw.node_id as string) || "",
        name: (raw.name as string) || (raw.node_id as string) || "Unknown",
        owner_name: (raw.owner_name as string) || "",
        status: raw.available === true || raw.available === 1 ? "online" as const : (raw.status as "online" | "offline") || "online" as const,
        allowed_skills: (raw.allowed_skills as string[]) || (raw.skills as string[]) || [],
        rate_limit: (raw.rate_limit as number) || (raw.max_concurrent as number) || 0,
        price_per_call: (raw.price_per_call as number) || 0,
        description: (raw.description as string) || "",
        total_hirers: (raw.total_hirers as number) || 0,
      }));
      setMarketItems(items);
    } catch {
      setMarketItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadRequests() {
    setRequestsLoading(true);
    try {
      const res = await getMyHireRequests();
      setRequests(res.requests);
    } catch {
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }

  async function loadContracts() {
    setContractsLoading(true);
    try {
      const res = await getHiredAgentsFull();
      setContracts(res.agents);
    } catch {
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  }

  function switchTab(t: Tab) {
    setTab(t);
    setError(null);
    if (t === "requests") loadRequests();
    if (t === "contracts") loadContracts();
  }

  async function handleSendRequest(nodeId: string) {
    setSendingTo(nodeId);
    setError(null);
    try {
      await createHireRequest(nodeId);
      setSentIds((prev) => new Set(prev).add(nodeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setSendingTo(null);
    }
  }

  async function handleTerminate(contractId: string) {
    if (!confirm(t("dash.hired.confirmTerminate"))) return;
    setTerminating(contractId);
    try {
      await terminateHire(contractId);
      setContracts((prev) => prev.filter((c) => c.contract_id !== contractId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to terminate");
    } finally {
      setTerminating(null);
    }
  }

  const filteredMarket = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return marketItems;
    type Scored = { item: HireMarketItem; score: number };
    const scored: Scored[] = [];
    for (const item of marketItems) {
      const name = (item.name || item.node_id || "").toLowerCase();
      const skills = (item.allowed_skills || []).map((s) => s.toLowerCase());
      const desc = (item.description || "").toLowerCase();
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (skills.some((s) => s.includes(q))) score = 50;
      else if (desc.includes(q)) score = 30;
      if (score > 0) scored.push({ item, score });
    }
    return scored.sort((a, b) => b.score - a.score).map((s) => s.item);
  })();

  const tabs: { key: Tab; label: string; icon: typeof Search }[] = [
    { key: "market", label: t("dash.hired.tabMarket"), icon: Search },
    { key: "requests", label: t("dash.hired.tabRequests"), icon: FileText },
    { key: "contracts", label: t("dash.hired.tabContracts"), icon: Briefcase },
  ];

  return (
    <PageTransition>
      <PageHeader
        eyebrow={t("dash.eyebrow")}
        title={t("dash.hired.title")}
        description={t("dash.hired.desc")}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map((tb) => {
          const Icon = tb.icon;
          return (
            <button
              key={tb.key}
              onClick={() => switchTab(tb.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-[color,border-color] duration-[--motion-base] cursor-pointer",
                tab === tb.key
                  ? "text-text border-text"
                  : "text-text-dim border-transparent hover:text-text hover:border-border",
              )}
            >
              <Icon size={14} />
              {tb.label}
            </button>
          );
        })}
      </div>

      {error && (
        <Card hoverable={false} className="mb-4 py-3 px-4">
          <p className="text-[13px] text-danger">{error}</p>
        </Card>
      )}

      {/* Market Tab */}
      {tab === "market" && (
        <>
          <Input
            icon={<Search size={16} />}
            placeholder={t("dash.calls.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2"
          />

          {search.trim() ? (
            <p className="text-[13px] text-text-muted mb-4">
              {filteredMarket.length} {filteredMarket.length === 1 ? "result" : "results"}
            </p>
          ) : <div className="mb-2" />}

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Card key={i} className="h-24">
                  <Skeleton variant="text" width={160} height={18} className="mb-2" />
                  <Skeleton variant="text" width={240} height={14} />
                </Card>
              ))}
            </div>
          ) : filteredMarket.length > 0 ? (
            <div className="space-y-3">
              {filteredMarket.map((item) => {
                const isSent = sentIds.has(item.node_id);
                const isSending = sendingTo === item.node_id;
                return (
                  <Card key={item.node_id} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-md bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                      <Users size={18} className="text-text-dim" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-semibold text-text">{item.name}</span>
                        <Badge status={item.status} />
                        <span className="text-[11px] text-text-muted">
                          by {item.owner_name}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-[12px] text-text-dim mb-2">{item.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(item.allowed_skills || []).map((s) => (
                          <span
                            key={s}
                            className="text-[11px] text-text-dim bg-bg-elevated border border-border rounded-full px-2.5 py-0.5"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-4 text-[12px] text-text-muted">
                        <span>{item.rate_limit} {t("dash.hired.rateLimit")}</span>
                        <span>
                          {item.price_per_call > 0
                            ? `${item.price_per_call} ${t("dash.hired.pricePerCall")}`
                            : t("dash.hired.free")}
                        </span>
                        <span>{item.total_hirers} {t("dash.hired.hirers")}</span>
                      </div>
                    </div>
                    <div className="shrink-0 pt-1">
                      {isSent ? (
                        <span className="text-[12px] text-success flex items-center gap-1">
                          <Send size={14} />
                          {t("dash.hired.requestSent")}
                        </span>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSendRequest(item.node_id)}
                          disabled={isSending}
                        >
                          {isSending ? t("dash.hired.sending") : t("dash.hired.sendRequest")}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card hoverable={false} className="py-16 text-center">
              <Users size={40} className="text-text-muted mx-auto mb-4" />
              <p className="text-[14px] text-text-dim">{t("dash.hired.noMarket")}</p>
            </Card>
          )}
        </>
      )}

      {/* Requests Tab */}
      {tab === "requests" && (
        <>
          {requestsLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <Card key={i} className="h-20">
                  <Skeleton variant="text" width={160} height={18} className="mb-2" />
                  <Skeleton variant="text" width={200} height={14} />
                </Card>
              ))}
            </div>
          ) : requests.length > 0 ? (
            <div className="space-y-3">
              {requests.map((req) => (
                <Card key={req.id} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-md bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-text-dim" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold text-text">
                        {req.target_name}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase border rounded-full px-2 py-0.5",
                          requestStatusColor[req.status] || "",
                        )}
                      >
                        {t(`dash.hired.${req.status}`)}
                      </span>
                    </div>
                    <p className="text-[12px] text-text-muted">
                      by {req.target_owner_name} &middot; {relativeTime(req.requested_at)}
                    </p>
                    {req.message && (
                      <p className="text-[12px] text-text-dim mt-1">{req.message}</p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card hoverable={false} className="py-16 text-center">
              <FileText size={40} className="text-text-muted mx-auto mb-4" />
              <p className="text-[14px] text-text-dim">{t("dash.hired.noRequests")}</p>
            </Card>
          )}
        </>
      )}

      {/* Contracts Tab */}
      {tab === "contracts" && (
        <>
          {contractsLoading ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <Card key={i} className="h-24">
                  <Skeleton variant="text" width={160} height={18} className="mb-2" />
                  <Skeleton variant="text" width={240} height={14} />
                </Card>
              ))}
            </div>
          ) : contracts.length > 0 ? (
            <div className="space-y-3">
              {contracts.map((contract) => (
                <Card key={contract.contract_id} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-md bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                    <Briefcase size={18} className="text-text-dim" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold text-text">
                        {contract.name}
                      </span>
                      <Badge status={contract.status === "online" ? "online" : "offline"} />
                    </div>
                    <p className="text-[12px] text-text-muted mb-2">
                      by {contract.owner_name} &middot; {relativeTime(contract.hired_at)}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {contract.skills.map((s) => (
                        <span
                          key={s}
                          className="text-[11px] text-text-dim bg-bg-elevated border border-border rounded-full px-2.5 py-0.5"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-4 text-[12px] text-text-muted">
                      <span>{contract.rate_limit} {t("dash.hired.rateLimit")}</span>
                      <span>
                        {contract.price_per_call > 0
                          ? `${contract.price_per_call} ${t("dash.hired.pricePerCall")}`
                          : t("dash.hired.free")}
                      </span>
                      <span>{contract.total_calls} {t("dash.hired.totalCalls")}</span>
                    </div>
                  </div>
                  <div className="shrink-0 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTerminate(contract.contract_id)}
                      disabled={terminating === contract.contract_id}
                      className="text-text-muted hover:text-danger"
                    >
                      <XCircle size={14} className="mr-1" />
                      {terminating === contract.contract_id
                        ? t("dash.hired.terminating")
                        : t("dash.hired.terminate")}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card hoverable={false} className="py-16 text-center">
              <Briefcase size={40} className="text-text-muted mx-auto mb-4" />
              <p className="text-[14px] text-text-dim">{t("dash.hired.noContracts")}</p>
            </Card>
          )}
        </>
      )}
    </PageTransition>
  );
}
