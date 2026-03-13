const API_BASE = "/api/v2";

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
  connected_at?: number;
  last_heartbeat?: number;
  connected_from?: string | null;
  geo?: { lat: number; lng: number; city?: string; country?: string } | null;
  status: "online" | "offline";
}

export interface ApiSkill {
  name: string;
  description: string;
  providers: number;
}

export type CapabilityType = "skill" | "model" | "compute" | "storage";

export interface ApiCapability {
  type: CapabilityType;
  name: string;
  providers: number;
  meta: {
    description?: string;
    category?: string;
    cost_tier?: string;
    provider?: string;
    context_window?: number;
    strengths?: string[];
  };
}

export interface CapabilitySummary {
  total: number;
  models: number;
  skills: number;
}

export interface CapabilitiesResponse {
  data: ApiCapability[];
  total: number;
  summary: CapabilitySummary;
}

export interface ApiSkillDetail {
  name: string;
  description: string;
  input_schema: Record<string, string>;
  providers: { node_id: string; name: string; status: "online" | "offline" }[];
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

// ─── Combined response types ───

export interface NetworkOverview {
  stats: NetworkStats;
  nodes: ApiNode[];
  skills: ApiSkill[];
}

export interface CapabilityDetail {
  name: string;
  type: CapabilityType;
  description: string;
  input_schema: Record<string, string>;
  providers: { node_id: string; name: string; status: "online" | "offline" }[];
  calls_total: number;
  avg_latency_ms: number;
  meta: ApiCapability["meta"];
}

export interface NodeDetail {
  node: ApiNode;
  summary: ApiNodeCallsSummary;
  daily_stats: ApiNodeDailyStat[];
  recent_calls: ApiNodeCall[];
}

// ─── Fetch helpers ───

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Primary v2 functions ───

/** GET /api/v2/network — combined stats + nodes + skills */
export async function getNetworkOverview(opts?: {
  nodes_limit?: number;
  skills_limit?: number;
}): Promise<NetworkOverview> {
  const qs = new URLSearchParams();
  if (opts?.nodes_limit) qs.set("nodes_limit", String(opts.nodes_limit));
  if (opts?.skills_limit) qs.set("skills_limit", String(opts.skills_limit));
  const query = qs.toString();
  const raw = await fetchApi<NetworkOverview>(`/network${query ? `?${query}` : ""}`);
  // Compute uptime_seconds from connected_at if not provided
  const now = Date.now() / 1000;
  raw.nodes = raw.nodes.map((node) => ({
    ...node,
    uptime_seconds: node.uptime_seconds || (node.connected_at ? Math.floor(now - node.connected_at) : 0),
  }));
  return raw;
}

/** GET /api/v2/network/nodes/:nodeId — node + summary + daily_stats + recent_calls */
export async function getNodeDetail(nodeId: string): Promise<NodeDetail> {
  return fetchApi<NodeDetail>(`/network/nodes/${nodeId}`);
}

/** GET /api/v2/network/nodes/:nodeId/calls — paginated calls */
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
  return fetchApi<Paginated<ApiNodeCall>>(`/network/nodes/${nodeId}/calls?${qs.toString()}`);
}

/** GET /api/v2/network/skills/:name — skill detail */
export async function getSkillByName(name: string): Promise<ApiSkillDetail> {
  return fetchApi<ApiSkillDetail>(`/network/skills/${encodeURIComponent(name)}`);
}

// ─── Backward-compatible wrappers (used by nodes list, skills list pages) ───

export async function getStats(): Promise<NetworkStats> {
  const overview = await getNetworkOverview();
  return overview.stats;
}

export async function getNodes(page = 1, limit = 50): Promise<Paginated<ApiNode>> {
  const overview = await getNetworkOverview({ nodes_limit: limit });
  return { data: overview.nodes, total: overview.nodes.length, page, limit };
}

export async function getSkills(page = 1, limit = 50): Promise<Paginated<ApiSkill>> {
  const overview = await getNetworkOverview({ skills_limit: limit });
  return { data: overview.skills, total: overview.skills.length, page, limit };
}

export async function getNodeById(nodeId: string): Promise<ApiNode> {
  const detail = await getNodeDetail(nodeId);
  return detail.node;
}

export async function getNodeCallsSummary(nodeId: string): Promise<ApiNodeCallsSummary> {
  const detail = await getNodeDetail(nodeId);
  return detail.summary;
}

export async function getNodeDailyStats(nodeId: string, _days = 7): Promise<ApiNodeDailyStat[]> {
  const detail = await getNodeDetail(nodeId);
  return detail.daily_stats;
}

// ─── Capabilities (skills + models) ───

/** GET /api/v2/network/skills?type=all|skill|model&limit=200 */
export async function getCapabilities(opts?: {
  type?: "all" | "skill" | "model";
  limit?: number;
}): Promise<CapabilitiesResponse> {
  const qs = new URLSearchParams();
  if (opts?.type && opts.type !== "all") qs.set("type", opts.type);
  if (opts?.limit) qs.set("limit", String(opts.limit));
  const query = qs.toString();
  return fetchApi<CapabilitiesResponse>(`/network/skills${query ? `?${query}` : ""}`);
}

/** GET /api/v2/network/skills/:name — capability detail */
export async function getCapabilityByName(name: string): Promise<CapabilityDetail> {
  return fetchApi<CapabilityDetail>(`/network/skills/${encodeURIComponent(name)}`);
}
