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
  calls_today: number;
  avg_latency_ms: number;
  category: string;
  status: "online" | "offline";
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

export async function getSkillByName(name: string): Promise<ApiSkill> {
  return fetchApi<ApiSkill>(`/skills/${name}`);
}
