import type {
  Agent,
  CallRecord,
  DashboardStats,
  DailyCallStat,
  UserSettings,
} from "./mock-data-dashboard";

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

// ─── Token Binding (stub — wire to real API when ready) ───

export interface BindToken {
  token: string;
  expires_at: string; // ISO 8601
}

// POST /api/dashboard/agents/token → generate a one-time bind token
export async function generateBindToken(): Promise<BindToken> {
  // TODO: replace with real API call
  // return dashFetch<BindToken>("/agents/token", { method: "POST" });
  const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  return { token, expires_at: expires };
}

// GET /api/dashboard/agents/token/:token/status → poll binding status
export async function checkBindTokenStatus(token: string): Promise<{ bound: boolean; agent?: Agent }> {
  // TODO: replace with real API call
  // return dashFetch<{ bound: boolean; agent?: Agent }>(`/agents/token/${token}/status`);
  return { bound: false };
}

// ─── Hired Agents (stub — wire to real API when ready) ───

export interface HiredAgent {
  node_id: string;
  name: string;
  skills: string[];
  status: "online" | "offline";
  hired_at: string; // ISO 8601
}

// GET /api/dashboard/hired → list hired agents
export async function fetchHiredAgents(): Promise<HiredAgent[]> {
  // TODO: replace with real API call
  // return dashFetch<{ agents: HiredAgent[] }>("/hired").then(r => r.agents);
  return [];
}

// POST /api/dashboard/hired → hire an agent
export async function hireAgent(nodeId: string): Promise<{ success: boolean; agent: HiredAgent }> {
  // TODO: replace with real API call
  // return dashFetch("/hired", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ node_id: nodeId }) });
  throw new Error("Hire API not yet available. Coming soon!");
}

// DELETE /api/dashboard/hired/:nodeId → release a hired agent
export async function releaseAgent(nodeId: string): Promise<void> {
  // TODO: replace with real API call
  // await dashFetch(`/hired/${nodeId}`, { method: "DELETE" });
  throw new Error("Release API not yet available. Coming soon!");
}
