"use client";

import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchHiredAgents,
  hireAgent,
  releaseAgent,
  type HiredAgent,
} from "@/lib/dashboard-api";
import { type ApiNode, getNodes } from "@/lib/api";
import { Server, Users, Briefcase, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/components/locale-provider";

export default function HiredAgentsPage() {
  const { t } = useLocale();
  const [hired, setHired] = useState<HiredAgent[]>([]);
  const [loading, setLoading] = useState(true);

  // Browse panel
  const [browseOpen, setBrowseOpen] = useState(false);
  const [networkNodes, setNetworkNodes] = useState<ApiNode[]>([]);
  const [nodesLoading, setNodesLoading] = useState(false);
  const [hiring, setHiring] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const hiredIds = useMemo(() => new Set(hired.map((h) => h.node_id)), [hired]);

  useEffect(() => {
    fetchHiredAgents()
      .then(setHired)
      .catch((err) => console.error("Failed to fetch hired agents:", err))
      .finally(() => setLoading(false));
  }, []);

  function openBrowse() {
    setBrowseOpen(true);
    setNodesLoading(true);
    setError(null);
    getNodes(1, 100)
      .then((res) => setNetworkNodes(res.data))
      .catch(() => setNetworkNodes([]))
      .finally(() => setNodesLoading(false));
  }

  async function handleHire(node: ApiNode) {
    setHiring(node.node_id);
    setError(null);
    try {
      const res = await hireAgent(node.node_id);
      setHired((prev) => [...prev, res.agent]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to hire");
    } finally {
      setHiring(null);
    }
  }

  async function handleRelease(nodeId: string) {
    if (!confirm(t("dash.hired.confirmRelease"))) return;
    setReleasing(nodeId);
    try {
      await releaseAgent(nodeId);
      setHired((prev) => prev.filter((h) => h.node_id !== nodeId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release");
    } finally {
      setReleasing(null);
    }
  }

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return networkNodes;
    const q = search.toLowerCase();
    return networkNodes.filter(
      (n) => n.name.toLowerCase().includes(q) || n.skills.some((s) => s.toLowerCase().includes(q)),
    );
  }, [networkNodes, search]);

  return (
    <>
      <div className="flex items-start justify-between mb-8">
        <PageHeader
          eyebrow={t("dash.eyebrow")}
          title={t("dash.hired.title")}
          description={t("dash.hired.desc")}
          className="mb-0"
        />
        {!loading && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => (browseOpen ? setBrowseOpen(false) : openBrowse())}
            className="shrink-0 mt-6"
          >
            <Search size={14} className="mr-1.5" />
            {t("dash.hired.browse")}
          </Button>
        )}
      </div>

      {error && (
        <Card hoverable={false} className="mb-4 py-3 px-4">
          <p className="text-[13px] text-danger">{error}</p>
        </Card>
      )}

      {/* Browse Network Panel */}
      {browseOpen && (
        <Card hoverable={false} className="mb-6">
          <h3 className="text-[16px] font-bold text-text mb-4">
            {t("dash.hired.available")}
          </h3>

          <Input
            icon={<Search size={16} />}
            placeholder={t("dash.calls.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4"
          />

          {nodesLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={60} />
              ))}
            </div>
          ) : filteredNodes.length > 0 ? (
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {filteredNodes.map((node) => {
                const isHired = hiredIds.has(node.node_id);
                const isHiring = hiring === node.node_id;
                return (
                  <div
                    key={node.node_id}
                    className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border hover:border-border-hover transition-[border-color] duration-[--motion-base]"
                  >
                    <div className="w-9 h-9 rounded-md bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                      <Server size={16} className="text-text-dim" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-text">{node.name}</span>
                        <Badge status={node.status} />
                      </div>
                      <p className="text-[12px] text-text-muted">
                        {node.skills.length} {t("dash.hired.skills")}
                        {node.skills.length > 0 && (
                          <span className="text-text-dim"> — {node.skills.join(", ")}</span>
                        )}
                      </p>
                    </div>
                    {isHired ? (
                      <span className="text-[12px] text-success flex items-center gap-1">
                        <Briefcase size={14} />
                        {t("dash.agents.bindAlreadyBound")}
                      </span>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleHire(node)}
                        disabled={isHiring}
                      >
                        {isHiring ? t("dash.hired.hiring") : t("dash.hired.hire")}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[13px] text-text-muted py-4 text-center">
              {t("dash.agents.bindNoNodes")}
            </p>
          )}
        </Card>
      )}

      {/* My Hired Agents */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="h-28">
              <Skeleton variant="text" width={140} height={20} className="mb-2" />
              <Skeleton variant="text" width={200} height={14} />
            </Card>
          ))}
        </div>
      ) : hired.length > 0 ? (
        <>
          <h3 className="text-[14px] font-semibold text-text-dim uppercase tracking-wider mb-4">
            {t("dash.hired.myHired")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {hired.map((agent) => (
              <Card key={agent.node_id} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-md bg-bg-elevated border border-border flex items-center justify-center shrink-0">
                  <Briefcase size={18} className="text-text-dim" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-semibold text-text">{agent.name}</span>
                    <Badge status={agent.status} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {agent.skills.map((s) => (
                      <span key={s} className="text-[11px] text-text-dim bg-bg-elevated border border-border rounded-full px-2.5 py-0.5">
                        {s}
                      </span>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRelease(agent.node_id)}
                    disabled={releasing === agent.node_id}
                    className="text-text-muted hover:text-danger"
                  >
                    {releasing === agent.node_id ? t("dash.hired.releasing") : t("dash.hired.release")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : !browseOpen ? (
        <Card hoverable={false} className="py-16 text-center">
          <Users size={40} className="text-text-muted mx-auto mb-4" />
          <p className="text-[16px] font-semibold text-text mb-2">{t("dash.hired.noHired")}</p>
          <p className="text-[13px] text-text-muted mb-6 max-w-sm mx-auto">
            {t("dash.hired.noHiredDesc")}
          </p>
          <Button variant="primary" onClick={openBrowse}>
            <Search size={16} className="mr-2" />
            {t("dash.hired.browse")}
          </Button>
        </Card>
      ) : null}
    </>
  );
}
