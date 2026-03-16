# Network Globe Visualization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Network Overview page with an immersive 3D globe showing agent nodes, communication arcs, and live activity via floating glass panels.

**Architecture:** `react-globe.gl` renders a night-Earth globe in a full-viewport container loaded via `next/dynamic` (SSR disabled). Four floating glass panels overlay stats, skills, and activity data. Node positions resolved via GeoIP (with hash fallback). Polling every 10s detects new calls (arcs) and status changes (activity feed).

**Tech Stack:** Next.js 16, React 19, react-globe.gl, Three.js, Tailwind v4, TypeScript.

**Spec:** `docs/superpowers/specs/2026-03-12-network-globe-design.md`

---

## File Structure

```
src/
  lib/
    globe-data.ts              # NEW — Node positioning (GeoIP + hash), data transforms, arc builder
  components/network/
    network-globe.tsx           # NEW — Globe wrapper (react-globe.gl, points/arcs/rings layers)
    floating-stats.tsx          # NEW — Top-right stats overlay (4 numbers)
    floating-skills.tsx         # NEW — Bottom-left top skills glass panel
    floating-activity.tsx       # NEW — Bottom-right live activity glass panel
  lib/
    i18n.ts                     # MODIFY — Add network.globe.* keys (4 languages)
  app/network/
    page.tsx                    # MODIFY — Replace current page with globe layout
```

---

## Chunk 1: Dependencies + Data Layer

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install react-globe.gl and three**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npm install react-globe.gl three`

- [ ] **Step 2: Verify installation**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && node -e "require('react-globe.gl'); require('three'); console.log('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-globe.gl and three.js dependencies"
```

---

### Task 2: Globe Data Layer

**Files:**
- Create: `src/lib/globe-data.ts`

- [ ] **Step 1: Create globe-data.ts with types, positioning, and transforms**

```typescript
import type { ApiNode, ApiNodeCall } from "@/lib/api";

// --- Types ---

export interface GeoLocation {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

export interface GlobeNode {
  nodeId: string;
  name: string;
  lat: number;
  lng: number;
  status: "online" | "offline";
  skills: string[];
}

export interface GlobeArc {
  id: string;
  srcLat: number;
  srcLng: number;
  dstLat: number;
  dstLng: number;
  skill: string;
  createdAt: number;
}

export interface ActivityEvent {
  id: string;
  type: "online" | "offline" | "call";
  text: string;
  detail?: string;
  createdAt: number;
}

// --- Node Positioning ---

const GEO_CACHE_KEY = "catbus-geoip-cache";

function getGeoCache(): Record<string, GeoLocation> {
  try {
    return JSON.parse(sessionStorage.getItem(GEO_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setGeoCache(cache: Record<string, GeoLocation>) {
  try {
    sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // sessionStorage full or unavailable
  }
}

export function hashNodePosition(nodeId: string): GeoLocation {
  let h1 = 0;
  let h2 = 0;
  for (let i = 0; i < nodeId.length; i++) {
    h1 = (h1 * 31 + nodeId.charCodeAt(i)) & 0x7fffffff;
    h2 = (h2 * 37 + nodeId.charCodeAt(i)) & 0x7fffffff;
  }
  return {
    lat: (h1 / 0x7fffffff) * 110 - 50,
    lng: (h2 / 0x7fffffff) * 360 - 180,
  };
}

export async function resolveNodePositions(
  nodes: Array<{ node_id: string; connected_from?: string | null }>,
): Promise<Map<string, GeoLocation>> {
  const result = new Map<string, GeoLocation>();
  const cache = getGeoCache();

  // Separate nodes with IPs that need GeoIP lookup
  const needLookup: string[] = [];
  for (const node of nodes) {
    const ip = node.connected_from;
    if (ip && cache[ip]) {
      result.set(node.node_id, cache[ip]);
    } else if (ip) {
      needLookup.push(ip);
    }
  }

  // Batch GeoIP query
  if (needLookup.length > 0) {
    try {
      const unique = [...new Set(needLookup)];
      const res = await fetch("http://ip-api.com/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(unique.map((ip) => ({ query: ip }))),
      });
      if (res.ok) {
        const data = await res.json();
        for (const r of data) {
          if (r.status === "success") {
            cache[r.query] = { lat: r.lat, lng: r.lon, city: r.city, country: r.country };
          }
        }
        setGeoCache(cache);
      }
    } catch {
      // GeoIP failed, will fallback to hash
    }
  }

  // Assign positions: GeoIP → cache → hash fallback
  for (const node of nodes) {
    if (!result.has(node.node_id)) {
      const ip = node.connected_from;
      result.set(node.node_id, (ip && cache[ip]) || hashNodePosition(node.node_id));
    }
  }

  return result;
}

// --- Data Transforms ---

export function transformNodesToGlobe(
  nodes: ApiNode[],
  positions: Map<string, GeoLocation>,
): GlobeNode[] {
  return nodes.map((n) => {
    const pos = positions.get(n.node_id) || hashNodePosition(n.node_id);
    return {
      nodeId: n.node_id,
      name: n.name,
      lat: pos.lat,
      lng: pos.lng,
      status: n.status,
      skills: n.skills,
    };
  });
}

export function buildArcsFromCalls(
  calls: ApiNodeCall[],
  sourceNodeId: string,
  positions: Map<string, GeoLocation>,
): GlobeArc[] {
  const srcPos = positions.get(sourceNodeId);
  if (!srcPos) return [];

  return calls.map((call) => {
    const dstPos = positions.get(call.remote_node) || hashNodePosition(call.remote_node);
    return {
      id: call.id,
      srcLat: call.direction === "outbound" ? srcPos.lat : dstPos.lat,
      srcLng: call.direction === "outbound" ? srcPos.lng : dstPos.lng,
      dstLat: call.direction === "outbound" ? dstPos.lat : srcPos.lat,
      dstLng: call.direction === "outbound" ? dstPos.lng : srcPos.lng,
      skill: call.skill,
      createdAt: Date.now(),
    };
  });
}

// --- Activity Events ---

let eventCounter = 0;

export function diffNodeStatus(
  prev: Map<string, ApiNode>,
  current: ApiNode[],
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const node of current) {
    const p = prev.get(node.node_id);
    if ((!p || p.status === "offline") && node.status === "online") {
      events.push({
        id: `evt-${++eventCounter}`,
        type: "online",
        text: node.name,
        createdAt: Date.now(),
      });
    }
    if (p?.status === "online" && node.status === "offline") {
      events.push({
        id: `evt-${++eventCounter}`,
        type: "offline",
        text: node.name,
        createdAt: Date.now(),
      });
    }
  }
  return events;
}

export function callsToEvents(calls: ApiNodeCall[]): ActivityEvent[] {
  return calls.map((c) => ({
    id: `evt-${++eventCounter}`,
    type: "call" as const,
    text: c.skill,
    detail: c.remote_node,
    createdAt: Date.now(),
  }));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npx tsc --noEmit src/lib/globe-data.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/globe-data.ts
git commit -m "feat: add globe data layer with GeoIP positioning and transforms"
```

---

## Chunk 2: Globe Component

### Task 3: Network Globe Component

**Files:**
- Create: `src/components/network/network-globe.tsx`

This is the core component — renders the `react-globe.gl` Globe with all three data layers (points, arcs, rings). Loaded via `next/dynamic` in the page.

- [ ] **Step 1: Create network-globe.tsx**

```typescript
"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import GlobeGL from "react-globe.gl";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import type { GlobeNode, GlobeArc } from "@/lib/globe-data";

const GLOBE_IMAGE = "//unpkg.com/three-globe/example/img/earth-night.jpg";
const NIGHT_SKY = "//unpkg.com/three-globe/example/img/night-sky.png";

interface Props {
  nodes: GlobeNode[];
  arcs: GlobeArc[];
  onlineNodeIds: Set<string>;
  width: number;
  height: number;
}

export default function NetworkGlobe({ nodes, arcs, onlineNodeIds, width, height }: Props) {
  const globeRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const router = useRouter();
  const { t } = useLocale();

  // Auto-rotate
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    if (controls) {
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.3;
      controls.enableZoom = true;
    }
  }, []);

  // Initial POV
  useEffect(() => {
    globeRef.current?.pointOfView({ lat: 20, lng: 10, altitude: 2.5 }, 0);
  }, []);

  // Rings: online nodes get pulse ripples
  const ringsData = useMemo(
    () => nodes.filter((n) => onlineNodeIds.has(n.nodeId)).map((n) => ({ lat: n.lat, lng: n.lng })),
    [nodes, onlineNodeIds],
  );

  // Tooltip HTML
  const tooltipHTML = useCallback(
    (d: GlobeNode) => `
      <div style="background:rgba(0,0,0,0.8);backdrop-filter:blur(12px);border:1px solid rgba(255,149,0,0.25);border-radius:8px;padding:10px 14px;font-family:system-ui;min-width:140px;">
        <div style="font-size:12px;font-weight:700;color:#ff9500;margin-bottom:4px;">${d.name}</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.55);margin-bottom:2px;">
          Status: <span style="color:${d.status === "online" ? "#4ade80" : "#ef4444"};">${d.status}</span>
          · ${d.skills.length} ${t("network.globe.skills")}
        </div>
        <div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:6px;">${t("network.globe.clickToView")}</div>
      </div>
    `,
    [t],
  );

  const handlePointClick = useCallback(
    (point: object) => {
      const d = point as GlobeNode;
      router.push(`/network/nodes/${d.nodeId}`);
    },
    [router],
  );

  return (
    <GlobeGL
      ref={globeRef}
      width={width}
      height={height}
      globeImageUrl={GLOBE_IMAGE}
      backgroundImageUrl={NIGHT_SKY}
      backgroundColor="#050510"
      atmosphereColor="rgba(60, 140, 255, 0.15)"
      atmosphereAltitude={0.2}
      // Points layer
      pointsData={nodes}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={(d: object) => ((d as GlobeNode).status === "online" ? 0.01 : 0.005)}
      pointRadius={(d: object) => Math.max(0.15, Math.sqrt((d as GlobeNode).skills.length) * 0.2)}
      pointColor={(d: object) =>
        (d as GlobeNode).status === "online"
          ? "rgba(255, 165, 0, 0.85)"
          : "rgba(100, 100, 100, 0.4)"
      }
      pointLabel={(d: object) => tooltipHTML(d as GlobeNode)}
      onPointClick={handlePointClick}
      // Arcs layer
      arcsData={arcs}
      arcStartLat="srcLat"
      arcStartLng="srcLng"
      arcEndLat="dstLat"
      arcEndLng="dstLng"
      arcColor={() => ["rgba(255, 165, 0, 0.6)", "rgba(74, 222, 128, 0.6)"]}
      arcDashLength={0.4}
      arcDashGap={0.2}
      arcDashAnimateTime={1500}
      arcStroke={0.5}
      arcsTransitionDuration={500}
      // Rings layer
      ringsData={ringsData}
      ringLat="lat"
      ringLng="lng"
      ringColor={() => (t: number) => `rgba(255, 165, 0, ${1 - t})`}
      ringMaxRadius={3}
      ringPropagationSpeed={2}
      ringRepeatPeriod={2000}
    />
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npx tsc --noEmit src/components/network/network-globe.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/network/network-globe.tsx
git commit -m "feat: add NetworkGlobe component with points, arcs, and rings layers"
```

---

## Chunk 3: Floating UI Panels

### Task 4: Floating Stats Component

**Files:**
- Create: `src/components/network/floating-stats.tsx`

- [ ] **Step 1: Create floating-stats.tsx**

```typescript
"use client";

import type { NetworkStats } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";

interface Props {
  stats: NetworkStats | null;
}

const glassPanel = "bg-black/55 backdrop-blur-[16px] border border-white/[0.06] rounded-[10px]";

export function FloatingStats({ stats }: Props) {
  const { t } = useLocale();

  const items = [
    { label: t("network.stat.nodesOnline"), value: String(stats?.online_nodes ?? 0), color: "text-[#4ade80]" },
    { label: t("network.stat.skillsAvailable"), value: String(stats?.total_skills ?? 0), color: "text-white/90" },
    { label: t("network.stat.callsToday"), value: stats ? formatNumber(stats.calls_today) : "0", color: "text-[#f59e0b]" },
    { label: t("network.stat.avgResponse"), value: stats ? `${Math.round(stats.avg_latency_ms)}ms` : "0ms", color: "text-[#4ade80]" },
  ];

  return (
    <div className={`absolute top-5 right-6 z-10 flex gap-5 px-5 py-3 ${glassPanel}`}>
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <div className={`text-[28px] font-extrabold leading-none ${item.color}`}>
            {item.value}
          </div>
          <div className="text-[9px] uppercase tracking-[1.5px] text-white/35 mt-1">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/network/floating-stats.tsx
git commit -m "feat: add FloatingStats overlay for globe page"
```

---

### Task 5: Floating Skills Component

**Files:**
- Create: `src/components/network/floating-skills.tsx`

- [ ] **Step 1: Create floating-skills.tsx**

```typescript
"use client";

import Link from "next/link";
import type { ApiSkill } from "@/lib/api";
import { useLocale } from "@/components/locale-provider";

interface Props {
  skills: ApiSkill[];
}

const glassPanel = "bg-black/55 backdrop-blur-[16px] border border-white/[0.06] rounded-[10px]";

export function FloatingSkills({ skills }: Props) {
  const { t } = useLocale();

  return (
    <div className={`absolute bottom-5 left-6 z-10 w-[220px] p-3.5 hidden md:block ${glassPanel}`}>
      <div className="text-[9px] uppercase tracking-[1.5px] text-white/35 font-semibold mb-2.5">
        {t("network.globe.topSkills")}
      </div>
      <div className="flex flex-col gap-1.5">
        {skills.slice(0, 5).map((skill) => (
          <div key={skill.name} className="flex items-center justify-between">
            <span className="text-[11px] text-white/65 font-mono truncate mr-2">
              {skill.name}
            </span>
            <span className="text-[10px] text-white/35 shrink-0">
              {skill.providers} {t("network.globe.providers")}
            </span>
          </div>
        ))}
      </div>
      <Link
        href="/network/skills"
        className="block text-[10px] text-white/35 hover:text-white/60 transition-colors mt-3 pt-2 border-t border-white/[0.06]"
      >
        {t("network.globe.viewAll")}
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/network/floating-skills.tsx
git commit -m "feat: add FloatingSkills panel for globe page"
```

---

### Task 6: Floating Activity Component

**Files:**
- Create: `src/components/network/floating-activity.tsx`

- [ ] **Step 1: Create floating-activity.tsx**

```typescript
"use client";

import type { ActivityEvent } from "@/lib/globe-data";
import { useLocale } from "@/components/locale-provider";

interface Props {
  events: ActivityEvent[];
}

const glassPanel = "bg-black/55 backdrop-blur-[16px] border border-white/[0.06] rounded-[10px]";

function relativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

const dotColors: Record<string, string> = {
  online: "bg-[#4ade80] shadow-[0_0_4px_#4ade80]",
  offline: "bg-[#ef4444] shadow-[0_0_4px_#ef4444]",
  call: "bg-[#ff9500] shadow-[0_0_4px_#ff9500]",
};

export function FloatingActivity({ events }: Props) {
  const { t } = useLocale();

  return (
    <div className={`absolute bottom-5 right-6 z-10 w-[220px] p-3.5 hidden md:block ${glassPanel}`}>
      <div className="text-[9px] uppercase tracking-[1.5px] text-white/35 font-semibold mb-2.5">
        {t("network.globe.liveActivity")}
      </div>
      <div className="flex flex-col gap-2">
        {events.length === 0 && (
          <p className="text-[10px] text-white/25 italic">No recent activity</p>
        )}
        {events.slice(0, 5).map((evt) => (
          <div key={evt.id} className="flex items-center gap-1.5">
            <div className={`w-[5px] h-[5px] rounded-full shrink-0 ${dotColors[evt.type]}`} />
            <span className="text-[10px] text-white/60 truncate flex-1">
              {evt.type === "call"
                ? `${evt.text} → ${evt.detail}`
                : `${evt.text} ${evt.type === "online" ? t("network.globe.cameOnline") : t("network.globe.wentOffline")}`}
            </span>
            <span className="text-[9px] text-white/25 shrink-0 ml-auto">
              {relativeTime(evt.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/network/floating-activity.tsx
git commit -m "feat: add FloatingActivity panel for globe page"
```

---

## Chunk 4: Page Integration + i18n

### Task 7: Add i18n Keys

**Files:**
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add English keys**

After the existing `"network.table.avgLatency"` line in the `en` dict, add:

```typescript
  // Globe
  "network.globe.liveActivity": "Live Activity",
  "network.globe.topSkills": "Top Skills",
  "network.globe.providers": "providers",
  "network.globe.cameOnline": "came online",
  "network.globe.wentOffline": "went offline",
  "network.globe.clickToView": "Click to view details",
  "network.globe.skills": "skills",
  "network.globe.viewAll": "View all →",
  "network.globe.loading": "Initializing globe...",
```

- [ ] **Step 2: Add zh-CN keys**

```typescript
  "network.globe.liveActivity": "实时动态",
  "network.globe.topSkills": "热门技能",
  "network.globe.providers": "提供者",
  "network.globe.cameOnline": "上线",
  "network.globe.wentOffline": "离线",
  "network.globe.clickToView": "点击查看详情",
  "network.globe.skills": "技能",
  "network.globe.viewAll": "查看全部 →",
  "network.globe.loading": "正在加载地球...",
```

- [ ] **Step 3: Add zh-TW keys**

```typescript
  "network.globe.liveActivity": "即時動態",
  "network.globe.topSkills": "熱門技能",
  "network.globe.providers": "提供者",
  "network.globe.cameOnline": "上線",
  "network.globe.wentOffline": "離線",
  "network.globe.clickToView": "點擊查看詳情",
  "network.globe.skills": "技能",
  "network.globe.viewAll": "查看全部 →",
  "network.globe.loading": "正在載入地球...",
```

- [ ] **Step 4: Add ja keys**

```typescript
  "network.globe.liveActivity": "ライブ活動",
  "network.globe.topSkills": "トップスキル",
  "network.globe.providers": "プロバイダー",
  "network.globe.cameOnline": "オンライン",
  "network.globe.wentOffline": "オフライン",
  "network.globe.clickToView": "詳細を表示",
  "network.globe.skills": "スキル",
  "network.globe.viewAll": "すべて表示 →",
  "network.globe.loading": "グローブを読み込み中...",
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat: add i18n keys for network globe (4 languages)"
```

---

### Task 8: Rewrite Network Page

**Files:**
- Modify: `src/app/network/page.tsx`

This is the main integration — replaces the current stats + table page with the immersive globe layout. Uses `next/dynamic` to load the WebGL globe client-side only.

- [ ] **Step 1: Rewrite page.tsx**

```typescript
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
} from "@/lib/globe-data";
import { FloatingStats } from "@/components/network/floating-stats";
import { FloatingSkills } from "@/components/network/floating-skills";
import { FloatingActivity } from "@/components/network/floating-activity";
import { useLocale } from "@/components/locale-provider";

const NetworkGlobe = dynamic(() => import("@/components/network/network-globe"), {
  ssr: false,
  loading: () => null, // handled by our own loading state
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

        // Resolve positions
        const positions = await resolveNodePositions(nodesRes.data as Array<ApiNode & { connected_from?: string }>);
        positionsRef.current = positions;

        // Transform to globe nodes
        const gNodes = transformNodesToGlobe(nodesRes.data, positions);
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

        // Update nodes
        const positions = positionsRef.current;
        const gNodes = transformNodesToGlobe(nodesRes.data, positions);
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
```

- [ ] **Step 2: Run full build**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npm run build`

Fix any TypeScript or build errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/network/page.tsx
git commit -m "feat: replace Network page with immersive 3D globe visualization"
```

---

### Task 9: Visual Verification + Deploy

- [ ] **Step 1: Start dev server and verify**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npm run dev`

Check at `http://localhost:3000/network`:
1. Globe renders with night Earth texture + starfield background
2. Agent nodes appear as orange dots (gray if offline)
3. Online nodes have pulsing ring ripples
4. Hover shows tooltip with name, status, skills count
5. Click on node navigates to `/network/nodes/{id}`
6. Globe auto-rotates slowly, draggable
7. Top-left shows title, top-right shows stats
8. Bottom-left shows top skills, bottom-right shows activity
9. Mobile: bottom panels hidden, stats still visible

- [ ] **Step 2: Fix any visual issues**

Adjust sizes, colors, positions as needed. Common fixes:
- Globe might need `altitude` adjustment for viewport
- Stats panel might overlap on smaller screens
- `--nav-height` CSS variable might need to match actual navbar height

- [ ] **Step 3: Final build check**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npm run build`

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: adjust globe layout and visual polish"
```

- [ ] **Step 5: Deploy to production**

Follow existing deploy flow (rsync → build → pm2 restart).

---

## Summary

| Task | Component | Files |
|------|-----------|-------|
| 1 | Dependencies | `package.json` |
| 2 | Data layer | `src/lib/globe-data.ts` |
| 3 | Globe component | `src/components/network/network-globe.tsx` |
| 4 | Stats overlay | `src/components/network/floating-stats.tsx` |
| 5 | Skills panel | `src/components/network/floating-skills.tsx` |
| 6 | Activity panel | `src/components/network/floating-activity.tsx` |
| 7 | i18n (4 langs) | `src/lib/i18n.ts` |
| 8 | Page integration | `src/app/network/page.tsx` |
| 9 | Verify + deploy | — |

**Total: 9 tasks across 4 chunks.**
