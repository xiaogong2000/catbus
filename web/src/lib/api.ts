const API_BASE = "https://relay.catbus.xyz/api";

export interface NetworkStats {
  online_nodes: number;
  total_skills: number;
  total_capabilities: number;
  calls_today: number;
  calls_total: number;
  avg_latency_ms: number;
  uptime_seconds: number;
}

export interface ApiNode {
  node_id: string;
  name: string;
  skills: string[];
  uptime_seconds: number;
  status: "online" | "offline";
}

export interface ApiSkill {
  name: string;
  description: string;
  providers: number;
}

export interface ApiSkillDetail {
  name: string;
  description: string;
  input_schema: Record<string, string>;
  providers: { node_id: string; name: string }[];
  calls_total: number;
  avg_latency_ms: number;
}

export interface ApiNodeCall {
  id: string;
  timestamp: string;
  direction: "inbound" | "outbound";
  skill: string;
  remote_node: string;
  latency_ms: number;
  status: "success" | "error" | "timeout";
  relay: string;
}

export interface ApiNodeCallsSummary {
  total_handled: number;
  total_made: number;
  success_rate: number;
  avg_latency: number;
}

export interface ApiNodeDailyStat {
  date: string;
  inbound: number;
  outbound: number;
}

interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function getStats(): Promise<NetworkStats> {
  return fetchApi<NetworkStats>("/stats");
}

export async function getNodes(page = 1, limit = 50): Promise<Paginated<ApiNode>> {
  return fetchApi<Paginated<ApiNode>>(`/nodes?page=${page}&limit=${limit}`);
}

export async function getSkills(page = 1, limit = 50): Promise<Paginated<ApiSkill>> {
  return fetchApi<Paginated<ApiSkill>>(`/skills?page=${page}&limit=${limit}`);
}

export async function getNodeById(nodeId: string): Promise<ApiNode> {
  return fetchApi<ApiNode>(`/nodes/${nodeId}`);
}

export async function getSkillByName(name: string): Promise<ApiSkillDetail> {
  return fetchApi<ApiSkillDetail>(`/skills/${name}`);
}

export async function getNodeCalls(
  nodeId: string,
  params: { page?: number; limit?: number; direction?: string; status?: string; skill?: string } = {},
): Promise<Paginated<ApiNodeCall>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.direction) qs.set("direction", params.direction);
  if (params.status) qs.set("status", params.status);
  if (params.skill) qs.set("skill", params.skill);
  return fetchApi<Paginated<ApiNodeCall>>(`/nodes/${nodeId}/calls?${qs.toString()}`);
}

export async function getNodeCallsSummary(nodeId: string): Promise<ApiNodeCallsSummary> {
  return fetchApi<ApiNodeCallsSummary>(`/nodes/${nodeId}/calls/summary`);
}

export async function getNodeDailyStats(nodeId: string, days = 7): Promise<ApiNodeDailyStat[]> {
  return fetchApi<ApiNodeDailyStat[]>(`/nodes/${nodeId}/stats/daily?days=${days}`);
}

export async function getHealthCheck(): Promise<{ ok: boolean; version: string; uptime_seconds: number }> {
  return fetchApi("/health");
}
