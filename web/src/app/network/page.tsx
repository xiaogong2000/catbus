"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { type NetworkStats, type ApiNode, type ApiSkill, type ApiNodeCall, getStats, getNodes, getSkills, getNodeCalls } from "@/lib/api";
import {
  type GlobeNode,
  type GlobeArc,
  type ActivityEvent,
  resolveNodePositions,
  transformNodesToGlobe,
  buildArcsFromCalls,
  diffNodeStatus,
  callsToEvents,
  type GeoLocation,
  getMockNodes,
  getMockPositions,
  generateMockArcs,
  generateMockEvents,
  MOCK_ENABLED,
} from "@/lib/globe-data";
import { FloatingStats } from "@/components/network/floating-stats";
import { FloatingSkills } from "@/components/network/floating-skills";
import { FloatingActivity } from "@/components/network/floating-activity";
import { useLocale } from "@/components/locale-provider";

const NetworkGlobe = dynamic(() => import("@/components/network/network-globe"), {
  ssr: false,
  loading: () => null,
});

const POLL_INTERVAL = 10_000;
const ARC_LIFETIME = 10_000;
const MAX_EVENTS = 20;

export default function NetworkPage() {
  const { t } = useLocale();

  // Data state
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [globeNodes, setGlobeNodes] = useState<GlobeNode[]>([]);
  const [arcs, setArcs] = useState<GlobeArc[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Viewport
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Refs for polling closures
  const positionsRef = useRef<Map<string, GeoLocation>>(new Map());
  const prevNodesRef = useRef<Map<string, ApiNode>>(new Map());
  const prevCallIdsRef = useRef<Set<string>>(new Set());

  // Resize handler
  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Arc cleanup — remove expired arcs every second
  useEffect(() => {
    const timer = setInterval(() => {
      setArcs((prev) => prev.filter((a) => Date.now() - a.createdAt < ARC_LIFETIME));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Add events helper (ring buffer)
  const addEvents = useCallback((newEvents: ActivityEvent[]) => {
    if (newEvents.length === 0) return;
    setEvents((prev) => [...newEvents, ...prev].slice(0, MAX_EVENTS));
  }, []);

  // Initial load
  useEffect(() => {
    async function load() {
      try {
        const [statsRes, nodesRes, skillsRes] = await Promise.all([
          getStats(),
          getNodes(1, 100),
          getSkills(1, 10),
        ]);

        setStats(statsRes);
        setSkills(skillsRes.data);

        // Resolve positions (merge mock positions)
        const positions = await resolveNodePositions(nodesRes.data as Array<ApiNode & { connected_from?: string }>);
        const mockPositions = getMockPositions();
        for (const [k, v] of mockPositions) positions.set(k, v);
        positionsRef.current = positions;

        // Transform to globe nodes (merge mock nodes)
        const gNodes = [
          ...transformNodesToGlobe(nodesRes.data, positions),
          ...getMockNodes(),
        ];
        setGlobeNodes(gNodes);

        // Store for diffing
        const nodeMap = new Map<string, ApiNode>();
        nodesRes.data.forEach((n) => nodeMap.set(n.node_id, n));
        prevNodesRef.current = nodeMap;

        // Generate initial online events
        const onlineEvents: ActivityEvent[] = nodesRes.data
          .filter((n) => n.status === "online")
          .slice(0, 3)
          .map((n, i) => ({
            id: `init-${i}`,
            type: "online" as const,
            text: n.name,
            createdAt: Date.now() - i * 5000,
          }));
        // Add initial mock arcs + events
        if (MOCK_ENABLED) {
          const initialArcs = generateMockArcs(4);
          setArcs(initialArcs);
          const mockEvts = generateMockEvents(initialArcs);
          onlineEvents.push(...mockEvts);
        }
        setEvents(onlineEvents);
      } catch (err) {
        console.error("Failed to load network data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Polling: refresh nodes + fetch calls for online nodes
  useEffect(() => {
    if (loading) return;

    const timer = setInterval(async () => {
      try {
        // Refresh stats + nodes
        const [statsRes, nodesRes] = await Promise.all([
          getStats(),
          getNodes(1, 100),
        ]);
        setStats(statsRes);

        // Diff node statuses
        const statusEvents = diffNodeStatus(prevNodesRef.current, nodesRes.data);
        addEvents(statusEvents);

        // Update nodes (keep mock nodes merged)
        const positions = positionsRef.current;
        const gNodes = [
          ...transformNodesToGlobe(nodesRes.data, positions),
          ...getMockNodes(),
        ];
        setGlobeNodes(gNodes);

        // Update prev map
        const nodeMap = new Map<string, ApiNode>();
        nodesRes.data.forEach((n) => nodeMap.set(n.node_id, n));
        prevNodesRef.current = nodeMap;

        // Fetch recent calls for online nodes (max 10 concurrent)
        const onlineNodes = nodesRes.data.filter((n) => n.status === "online").slice(0, 10);
        const callResults = await Promise.allSettled(
          onlineNodes.map((n) => getNodeCalls(n.node_id, { limit: 5 })),
        );

        const newArcs: GlobeArc[] = [];
        const newCallEvents: ActivityEvent[] = [];

        for (let i = 0; i < callResults.length; i++) {
          const result = callResults[i];
          if (result.status !== "fulfilled") continue;
          const calls: ApiNodeCall[] = result.value.data;
          const nodeId = onlineNodes[i].node_id;

          // Filter to only new calls
          const fresh = calls.filter((c) => !prevCallIdsRef.current.has(c.id));
          if (fresh.length > 0) {
            newArcs.push(...buildArcsFromCalls(fresh, nodeId, positions));
            newCallEvents.push(...callsToEvents(fresh));
          }
        }

        // Update seen call IDs
        const allCallIds = new Set<string>();
        for (const r of callResults) {
          if (r.status === "fulfilled") {
            r.value.data.forEach((c: ApiNodeCall) => allCallIds.add(c.id));
          }
        }
        prevCallIdsRef.current = allCallIds;

        // Add mock arcs each poll cycle
        if (MOCK_ENABLED) {
          const mockArcs = generateMockArcs(2 + Math.floor(Math.random() * 3));
          newArcs.push(...mockArcs);
          newCallEvents.push(...generateMockEvents(mockArcs));
        }

        if (newArcs.length > 0) setArcs((prev) => [...prev, ...newArcs]);
        addEvents(newCallEvents);
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(timer);
  }, [loading, addEvents]);

  const onlineNodeIds = new Set(globeNodes.filter((n) => n.status === "online").map((n) => n.nodeId));

  return (
    <div ref={containerRef} className="fixed inset-0 bg-[#050510] overflow-hidden" style={{ top: "var(--nav-height, 56px)" }}>
      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#ff9500] rounded-full animate-spin mx-auto mb-3" />
            <p className="text-[13px] text-white/40">{t("network.globe.loading")}</p>
          </div>
        </div>
      )}

      {/* Globe */}
      {!loading && size.width > 0 && (
        <NetworkGlobe
          nodes={globeNodes}
          arcs={arcs}
          onlineNodeIds={onlineNodeIds}
          width={size.width}
          height={size.height}
        />
      )}

      {/* Floating: Title (top-left) */}
      <div className="absolute top-5 left-6 z-10">
        <div className="text-[10px] uppercase tracking-[3px] text-white/35 font-semibold mb-1">
          {t("network.eyebrow")}
        </div>
        <h1 className="text-[22px] font-extrabold text-white/95 tracking-[-0.5px]">
          {t("network.title")}
        </h1>
        <p className="text-[12px] text-white/40 mt-0.5">{t("network.desc")}</p>
      </div>

      {/* Floating: Stats (top-right) */}
      <FloatingStats stats={stats} />

      {/* Floating: Skills (bottom-left) */}
      <FloatingSkills skills={skills} />

      {/* Floating: Activity (bottom-right) */}
      <FloatingActivity events={events} />
    </div>
  );
}
