import { ApiNode } from "./api";
import {
  generateMockCalls,
  generateMockDailyStats,
  generateMockCallsSummary,
  type MockCallRecord,
  type MockDailyCallStat,
  type MockCallsSummary,
} from "./relay-mock";

const RELAY_URL = process.env.RELAY_API_URL || "https://relay.catbus.xyz/api";
const RELAY_TIMEOUT = 5000;

// Set to true when relay supports /calls, /stats/daily, /calls/summary endpoints
const RELAY_CALLS_READY = true;

async function relayFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${RELAY_URL}${path}`, {
    signal: AbortSignal.timeout(RELAY_TIMEOUT),
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`Relay ${res.status}`);
  }
  return res.json();
}

export async function fetchRelayNode(nodeId: string): Promise<ApiNode | null> {
  try {
    return await relayFetch<ApiNode>(`/nodes/${nodeId}`);
  } catch {
    return null;
  }
}

export async function fetchRelayNodeCalls(
  nodeId: string,
  params: { limit?: number; page?: number; direction?: string; status?: string; skill?: string }
): Promise<{ data: MockCallRecord[]; total: number }> {
  if (!RELAY_CALLS_READY) {
    return generateMockCalls(nodeId, params);
  }
  try {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    return await relayFetch(`/nodes/${nodeId}/calls?${qs.toString()}`);
  } catch {
    return generateMockCalls(nodeId, params);
  }
}

export async function fetchRelayNodeDailyStats(
  nodeId: string,
  days: number
): Promise<MockDailyCallStat[]> {
  if (!RELAY_CALLS_READY) {
    return generateMockDailyStats(nodeId, days);
  }
  try {
    return await relayFetch(`/nodes/${nodeId}/stats/daily?days=${days}`);
  } catch {
    return generateMockDailyStats(nodeId, days);
  }
}

export async function fetchRelayNodeCallsSummary(
  nodeId: string
): Promise<MockCallsSummary> {
  if (!RELAY_CALLS_READY) {
    return generateMockCallsSummary(nodeId);
  }
  try {
    return await relayFetch(`/nodes/${nodeId}/calls/summary`);
  } catch {
    return generateMockCallsSummary(nodeId);
  }
}
