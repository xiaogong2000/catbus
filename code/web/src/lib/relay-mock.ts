// Deterministic mock data generator based on nodeId hash
// Used when relay API endpoints for calls/stats/summary are not yet available

function hashCode(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

const SKILL_NAMES = [
  "text-summarize", "code-review", "translate", "sentiment-analysis",
  "image-classify", "data-extract", "spell-check", "chat-completion",
  "embeddings", "search", "qa-retrieve", "text-to-speech",
];

const RELAY_SERVERS = [
  "relay-eu-1.catbus.xyz", "relay-us-1.catbus.xyz", "relay-ap-1.catbus.xyz",
];

const STATUSES: ("success" | "error" | "timeout")[] = ["success", "success", "success", "success", "success", "error", "timeout"];

export interface MockCallRecord {
  id: string;
  timestamp: string;
  direction: "inbound" | "outbound";
  skill: string;
  remote_node: string;
  agent_name: string;
  latency_ms: number;
  status: "success" | "error" | "timeout";
  relay: string;
}

export interface MockDailyCallStat {
  date: string;
  inbound: number;
  outbound: number;
}

export interface MockCallsSummary {
  total_handled: number;
  total_made: number;
  success_rate: number;
  avg_latency: number;
}

export function generateMockCalls(
  nodeId: string,
  params: { limit?: number; page?: number; direction?: string; status?: string; skill?: string }
): { data: MockCallRecord[]; total: number } {
  const seed = hashCode(nodeId);
  const rand = seededRandom(seed);
  const totalRecords = 50 + Math.floor(rand() * 150);
  const records: MockCallRecord[] = [];

  const now = Date.now();
  for (let i = 0; i < totalRecords; i++) {
    const r = seededRandom(seed + i * 7);
    const timestamp = new Date(now - Math.floor(r() * 7 * 24 * 60 * 60 * 1000)).toISOString();
    const direction = r() > 0.5 ? "inbound" as const : "outbound" as const;
    const skill = SKILL_NAMES[Math.floor(r() * SKILL_NAMES.length)];
    const status = STATUSES[Math.floor(r() * STATUSES.length)];
    const latency = Math.floor(50 + r() * 450);

    records.push({
      id: `call-${nodeId.slice(0, 8)}-${i}`,
      timestamp,
      direction,
      skill,
      remote_node: `node-${String(Math.floor(r() * 9000 + 1000))}`,
      agent_name: `agent-${nodeId.slice(0, 6)}`,
      latency_ms: latency,
      status,
      relay: RELAY_SERVERS[Math.floor(r() * RELAY_SERVERS.length)],
    });
  }

  // Sort by timestamp descending
  records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply filters
  let filtered = records;
  if (params.direction) {
    filtered = filtered.filter((r) => r.direction === params.direction);
  }
  if (params.status) {
    filtered = filtered.filter((r) => r.status === params.status);
  }
  if (params.skill) {
    filtered = filtered.filter((r) => r.skill === params.skill);
  }

  const total = filtered.length;
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return { data, total };
}

export function generateMockDailyStats(nodeId: string, days: number): MockDailyCallStat[] {
  const seed = hashCode(nodeId + "-daily");
  const rand = seededRandom(seed);
  const stats: MockDailyCallStat[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split("T")[0];
    const r = seededRandom(seed + i * 13);
    stats.push({
      date: dateStr,
      inbound: Math.floor(r() * 80 + 10),
      outbound: Math.floor(r() * 60 + 5),
    });
  }

  return stats;
}

export function generateMockCallsSummary(nodeId: string): MockCallsSummary {
  const seed = hashCode(nodeId + "-summary");
  const rand = seededRandom(seed);
  const totalHandled = Math.floor(rand() * 5000 + 500);
  const totalMade = Math.floor(rand() * 3000 + 200);
  const successRate = Math.round((85 + rand() * 15) * 100) / 100;
  const avgLatency = Math.round((80 + rand() * 300) * 100) / 100;

  return {
    total_handled: totalHandled,
    total_made: totalMade,
    success_rate: successRate,
    avg_latency: avgLatency,
  };
}
