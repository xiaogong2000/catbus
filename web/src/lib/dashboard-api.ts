import type {
  Agent,
  CallRecord,
  DashboardStats,
  DailyCallStat,
  UserSettings,
} from "./mock-data-dashboard";
import type {
  BindStatusResponse,
  ProviderConfig,
  SaveProviderConfigRequest,
  HireConfig,
  HireMarketResponse,
  MyHireRequest,
  HiredAgentFull,
  IncomingHireRequest,
  HireContract,
  EarningsOverview,
  EarningsHistoryResponse,
  LeaderboardResponse,
} from "./provider-types";
import {
  mockProviderConfig,
  mockEarningsOverview,
  mockEarningsHistory,
  mockLeaderboard,
} from "./mock-data-provider";

const BASE = "/api/dashboard";

async function dashFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
  });
  if (res.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API error: ${res.status}`);
  }
  return res.json();
}

// GET /api/dashboard/stats
export async function fetchDashboardStats(): Promise<DashboardStats> {
  return dashFetch<DashboardStats>("/stats");
}

// GET /api/dashboard/agents
export async function fetchAgents(): Promise<Agent[]> {
  const res = await dashFetch<{ agents: Agent[] }>("/agents");
  return res.agents;
}

// GET /api/dashboard/agents/:nodeId
export async function fetchAgentDetail(nodeId: string): Promise<{
  agent: Agent;
  weekly_stats: DailyCallStat[];
  recent_calls: CallRecord[];
}> {
  return dashFetch(`/agents/${nodeId}`);
}

// POST /api/dashboard/agents
export async function bindAgent(
  nodeId: string,
  name?: string,
): Promise<{ success: boolean; agent: Agent }> {
  return dashFetch("/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_id: nodeId, name }),
  });
}

// DELETE /api/dashboard/agents/:nodeId
export async function unbindAgent(nodeId: string): Promise<void> {
  await dashFetch(`/agents/${nodeId}`, { method: "DELETE" });
}

// GET /api/dashboard/calls
export async function fetchCalls(params: {
  page?: number;
  limit?: number;
  agent?: string;
  direction?: string;
  status?: string;
  skill?: string;
}): Promise<{ data: CallRecord[]; total: number; page: number; limit: number }> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.agent) qs.set("agent", params.agent);
  if (params.direction && params.direction !== "all") qs.set("direction", params.direction);
  if (params.status && params.status !== "all") qs.set("status", params.status);
  if (params.skill) qs.set("skill", params.skill);
  return dashFetch(`/calls?${qs.toString()}`);
}

// GET /api/dashboard/settings
export async function fetchSettings(): Promise<UserSettings> {
  return dashFetch<UserSettings>("/settings");
}

// PATCH /api/dashboard/settings
export async function updateSettings(
  body: Partial<{
    github_username: string;
    name: string;
    notifications: Partial<{
      agent_offline_email: boolean;
      daily_report: boolean;
      weekly_report: boolean;
    }>;
  }>,
): Promise<void> {
  await dashFetch("/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── Token Binding ───

export interface BindToken {
  token: string;
  expires_at: string; // ISO 8601
}

// POST /api/dashboard/agents/token
export async function generateBindToken(): Promise<BindToken> {
  try {
    return await dashFetch<BindToken>("/agents/token", { method: "POST" });
  } catch {
    // Fallback to mock for development
    const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    return { token, expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() };
  }
}

// GET /api/dashboard/agents/token/:token/status
export async function checkBindTokenStatus(token: string): Promise<BindStatusResponse> {
  try {
    return await dashFetch<BindStatusResponse>(`/agents/token/${token}/status`);
  } catch {
    return { bound: false };
  }
}

// ─── Provider Config ───

// GET /api/dashboard/agents/:nodeId/provider-config
export async function getProviderConfig(nodeId: string): Promise<ProviderConfig> {
  try {
    return await dashFetch<ProviderConfig>(`/agents/${nodeId}/provider-config`);
  } catch {
    return mockProviderConfig;
  }
}

// POST /api/dashboard/agents/:nodeId/provider-config
export async function saveProviderConfig(
  nodeId: string,
  config: SaveProviderConfigRequest,
): Promise<{ success: boolean }> {
  try {
    return await dashFetch<{ success: boolean }>(`/agents/${nodeId}/provider-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  } catch {
    return { success: true };
  }
}

// ─── Hire Market ───

// GET /api/dashboard/hire-market
export async function getHireMarket(params?: {
  page?: number;
  limit?: number;
  skill?: string;
  search?: string;
}): Promise<HireMarketResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.skill) qs.set("skill", params.skill);
  if (params?.search) qs.set("search", params.search);
  return dashFetch(`/hire-market?${qs.toString()}`);
}

// POST /api/dashboard/hired/request
export async function createHireRequest(
  nodeId: string,
  message?: string,
): Promise<{ request: { id: string; target_node_id: string; status: "pending"; requested_at: string } }> {
  return dashFetch("/hired/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_id: nodeId, message }),
  });
}

// GET /api/dashboard/hired/requests
export async function getMyHireRequests(status?: string): Promise<{ requests: MyHireRequest[] }> {
  const qs = status ? `?status=${status}` : "";
  return dashFetch(`/hired/requests${qs}`);
}

// GET /api/dashboard/hired
export async function getHiredAgentsFull(): Promise<{ agents: HiredAgentFull[] }> {
  // Backend returns { contracts: [...] }, normalize to { agents: [...] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await dashFetch("/hired");
  return { agents: res.agents || res.contracts || [] };
}

// DELETE /api/dashboard/hired/:contractId
export async function terminateHire(contractId: string): Promise<{ success: boolean }> {
  return dashFetch(`/hired/${contractId}`, { method: "DELETE" });
}

// ─── Hired Agents (legacy simple type) ───

export interface HiredAgent {
  node_id: string;
  name: string;
  skills: string[];
  status: "online" | "offline";
  hired_at: string; // ISO 8601
}

// GET /api/dashboard/hired → list hired agents (simple)
export async function fetchHiredAgents(): Promise<HiredAgent[]> {
  try {
    const res = await dashFetch<{ agents: HiredAgent[] }>("/hired");
    return res.agents;
  } catch {
    return [];
  }
}

// POST /api/dashboard/hired → hire an agent (legacy)
export async function hireAgent(nodeId: string): Promise<{ success: boolean; agent: HiredAgent }> {
  return dashFetch("/hired", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_id: nodeId }),
  });
}

// DELETE /api/dashboard/hired/:nodeId → release a hired agent (legacy)
export async function releaseAgent(nodeId: string): Promise<void> {
  await dashFetch(`/hired/${nodeId}`, { method: "DELETE" });
}

// ─── Agent Owner (hire management) ───

// GET /api/dashboard/hire-config/:nodeId
export async function getHireConfig(nodeId: string): Promise<HireConfig> {
  return dashFetch(`/hire-config/${nodeId}`);
}

// PATCH /api/dashboard/hire-config/:nodeId
export async function updateHireConfig(
  nodeId: string,
  config: Partial<HireConfig>,
): Promise<{ success: boolean }> {
  return dashFetch(`/hire-config/${nodeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}

// GET /api/dashboard/hire-requests
export async function getIncomingHireRequests(
  status?: string,
  nodeId?: string,
): Promise<{ requests: IncomingHireRequest[]; pending_count: number }> {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (nodeId) qs.set("node_id", nodeId);
  return dashFetch(`/hire-requests?${qs.toString()}`);
}

// PATCH /api/dashboard/hire-requests/:requestId
export async function respondToHireRequest(
  requestId: string,
  action: "approve" | "reject",
  options?: { allowed_skills?: string[]; rate_limit?: number; expires_at?: string | null },
): Promise<{ success: boolean }> {
  return dashFetch(`/hire-requests/${requestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...options }),
  });
}

// GET /api/dashboard/hire-contracts
export async function getHireContracts(nodeId?: string): Promise<{ contracts: HireContract[] }> {
  const qs = nodeId ? `?node_id=${nodeId}` : "";
  return dashFetch(`/hire-contracts${qs}`);
}

// DELETE /api/dashboard/hire-contracts/:contractId
export async function terminateContract(contractId: string): Promise<{ success: boolean }> {
  return dashFetch(`/hire-contracts/${contractId}`, { method: "DELETE" });
}

// ─── Earnings + Leaderboard (mock for now) ───

export async function getEarnings(): Promise<EarningsOverview> {
  try {
    return await dashFetch<EarningsOverview>("/earnings");
  } catch {
    return mockEarningsOverview;
  }
}

export async function getEarningsHistory(params?: {
  page?: number;
  limit?: number;
}): Promise<EarningsHistoryResponse> {
  try {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return await dashFetch<EarningsHistoryResponse>(`/earnings/history?${qs.toString()}`);
  } catch {
    return mockEarningsHistory;
  }
}

export async function getLeaderboard(limit?: number): Promise<LeaderboardResponse> {
  try {
    const qs = limit ? `?limit=${limit}` : "";
    return await dashFetch<LeaderboardResponse>(`/leaderboard${qs}`);
  } catch {
    return mockLeaderboard;
  }
}
