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

// ─── Mock Data ──────────────────────────────────────────────
// TODO: Remove when real inter-agent calls flow through the relay
// Set to false to disable all mock data
export const MOCK_ENABLED = true;

interface MockAgent {
  id: string;
  name: string;
  lat: number;
  lng: number;
  skills: string[];
  status: "online" | "offline";
}

const MOCK_AGENTS: MockAgent[] = [
  { id: "mock-tokyo-01", name: "sakura-agent", lat: 35.68, lng: 139.69, skills: ["translate", "summarize", "web_search"], status: "online" },
  { id: "mock-london-01", name: "baker-street", lat: 51.51, lng: -0.13, skills: ["code_review", "debug", "explain"], status: "online" },
  { id: "mock-sf-01", name: "bay-coder", lat: 37.77, lng: -122.42, skills: ["code_gen", "test_gen", "refactor", "deploy"], status: "online" },
  { id: "mock-berlin-01", name: "europa-bot", lat: 52.52, lng: 13.41, skills: ["translate", "sentiment", "classify"], status: "online" },
  { id: "mock-sydney-01", name: "outback-ai", lat: -33.87, lng: 151.21, skills: ["data_analysis", "chart_gen"], status: "online" },
  { id: "mock-dubai-01", name: "oasis-node", lat: 25.20, lng: 55.27, skills: ["web_search", "news_feed", "summarize"], status: "online" },
  { id: "mock-seoul-01", name: "hallyu-agent", lat: 37.57, lng: 126.98, skills: ["translate", "image_gen", "ocr"], status: "online" },
  { id: "mock-saopaulo-01", name: "verde-ai", lat: -23.55, lng: -46.63, skills: ["translate", "text_stats"], status: "online" },
  { id: "mock-singapore-01", name: "merlion-hub", lat: 1.35, lng: 103.82, skills: ["routing", "load_balance", "health_check", "find_skills"], status: "online" },
  { id: "mock-ny-01", name: "manhattan-ops", lat: 40.71, lng: -74.01, skills: ["code_review", "security_scan", "deploy"], status: "online" },
  { id: "mock-beijing-01", name: "dragon-node", lat: 39.90, lng: 116.40, skills: ["translate", "code_gen", "web_search", "summarize"], status: "online" },
  { id: "mock-paris-01", name: "lumière-ai", lat: 48.86, lng: 2.35, skills: ["image_gen", "style_transfer"], status: "offline" },
  { id: "mock-moscow-01", name: "ural-compute", lat: 55.76, lng: 37.62, skills: ["data_analysis", "ml_train"], status: "offline" },
  { id: "mock-mumbai-01", name: "gateway-india", lat: 19.08, lng: 72.88, skills: ["translate", "ocr", "classify", "summarize"], status: "online" },
  { id: "mock-cairo-01", name: "sphinx-bot", lat: 30.04, lng: 31.24, skills: ["translate", "web_search"], status: "offline" },
];

// Predefined call routes for realistic arcs
const MOCK_ROUTES: [number, number, string][] = [
  [0, 6, "translate"],    // Tokyo → Seoul
  [2, 9, "code_review"],  // SF → NY
  [1, 3, "translate"],    // London → Berlin
  [10, 0, "summarize"],   // Beijing → Tokyo
  [8, 5, "routing"],      // Singapore → Dubai
  [7, 9, "text_stats"],   // São Paulo → NY
  [3, 1, "classify"],     // Berlin → London
  [6, 10, "image_gen"],   // Seoul → Beijing
  [5, 13, "web_search"],  // Dubai → Mumbai
  [4, 8, "data_analysis"], // Sydney → Singapore
  [9, 2, "deploy"],       // NY → SF
  [13, 0, "translate"],   // Mumbai → Tokyo
  [2, 1, "code_gen"],     // SF → London
  [10, 8, "web_search"],  // Beijing → Singapore
];

export function getMockNodes(): GlobeNode[] {
  if (!MOCK_ENABLED) return [];
  return MOCK_AGENTS.map((a) => ({
    nodeId: a.id,
    name: a.name,
    lat: a.lat,
    lng: a.lng,
    status: a.status,
    skills: a.skills,
  }));
}

export function getMockPositions(): Map<string, GeoLocation> {
  const map = new Map<string, GeoLocation>();
  if (!MOCK_ENABLED) return map;
  for (const a of MOCK_AGENTS) {
    map.set(a.id, { lat: a.lat, lng: a.lng });
  }
  return map;
}

let mockArcCounter = 0;

/** Returns a random subset of mock arcs (simulates live traffic) */
export function generateMockArcs(count: number = 3): GlobeArc[] {
  if (!MOCK_ENABLED) return [];
  const arcs: GlobeArc[] = [];
  const now = Date.now();
  const onlineAgents = MOCK_AGENTS.filter((a) => a.status === "online");
  // Pick random routes from predefined list
  const shuffled = [...MOCK_ROUTES].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    const [srcIdx, dstIdx, skill] = shuffled[i];
    const src = MOCK_AGENTS[srcIdx];
    const dst = MOCK_AGENTS[dstIdx];
    if (src.status !== "online" || dst.status !== "online") continue;
    arcs.push({
      id: `mock-arc-${++mockArcCounter}`,
      srcLat: src.lat,
      srcLng: src.lng,
      dstLat: dst.lat,
      dstLng: dst.lng,
      skill,
      createdAt: now,
    });
  }
  return arcs;
}

let mockEvtCounter = 0;

/** Returns mock activity events matching the generated arcs */
export function generateMockEvents(arcs: GlobeArc[]): ActivityEvent[] {
  if (!MOCK_ENABLED) return [];
  return arcs.map((arc) => {
    // Find source agent name
    const src = MOCK_AGENTS.find(
      (a) => Math.abs(a.lat - arc.srcLat) < 0.01 && Math.abs(a.lng - arc.srcLng) < 0.01,
    );
    const dst = MOCK_AGENTS.find(
      (a) => Math.abs(a.lat - arc.dstLat) < 0.01 && Math.abs(a.lng - arc.dstLng) < 0.01,
    );
    return {
      id: `mock-evt-${++mockEvtCounter}`,
      type: "call" as const,
      text: arc.skill,
      detail: `${src?.name ?? "?"} → ${dst?.name ?? "?"}`,
      createdAt: arc.createdAt,
    };
  });
}
