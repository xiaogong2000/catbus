import type {
  Agent,
  CallRecord,
  DashboardStats,
  DailyCallStat,
  UserSettings,
} from "./mock-data-dashboard";
import type {
  BindStatusResponse,
  EarningsOverview,
  EarningsHistoryResponse,
  LeaderboardResponse,
} from "./provider-types";
import type {
  RewardLeaderboardResponse,
} from "./reward-types";

const BASE = "/api/v2/dashboard";

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

// ─── Dashboard Overview (v2: single call) ───

export interface DashboardOverview {
  stats: DashboardStats;
  agents: Agent[];
  recent_tasks: CallRecord[];
  earnings: EarningsOverview;
  my_rank: {
    rank: number;
    total_tasks: number;
    success_rate: number;
    total_credits: number;
  } | null;
}

/** GET /api/v2/dashboard — one call for entire overview page */
export async function fetchDashboard(): Promise<DashboardOverview> {
  return dashFetch<DashboardOverview>("");
}

// Backward-compatible wrappers (used by individual components if needed)
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const data = await fetchDashboard();
  return data.stats;
}

export async function fetchAgents(): Promise<Agent[]> {
  const data = await fetchDashboard();
  return data.agents;
}

// ─── Agent Detail ───

/** GET /api/v2/dashboard/agents/:nodeId */
export async function fetchAgentDetail(nodeId: string): Promise<{
  agent: Agent;
  weekly_stats: DailyCallStat[];
  recent_calls: CallRecord[];
}> {
  return dashFetch(`/agents/${nodeId}`);
}

// ─── Agent Bind / Unbind ───

/** POST /api/v2/dashboard/unbind */
export async function unbindAgent(nodeId: string): Promise<void> {
  await dashFetch("/unbind", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ node_id: nodeId }),
  });
}

export interface BindToken {
  token: string;
  expires_at: string;
}

/** POST /api/v2/dashboard/bind */
export async function generateBindToken(): Promise<BindToken> {
  return dashFetch<BindToken>("/bind", { method: "POST" });
}

/** GET /api/v2/dashboard/bind/:token */
export async function checkBindTokenStatus(token: string): Promise<BindStatusResponse> {
  return dashFetch<BindStatusResponse>(`/bind/${token}`);
}

// ─── Tasks (was "calls" in v1) ───

/** GET /api/v2/dashboard/tasks */
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
  return dashFetch(`/tasks?${qs.toString()}`);
}

// ─── Settings ───

/** GET /api/v2/dashboard/settings */
export async function fetchSettings(): Promise<UserSettings> {
  return dashFetch<UserSettings>("/settings");
}

/** PATCH /api/v2/dashboard/settings */
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

// ─── Earnings ───

/** GET /api/v2/dashboard/earnings/history */
export async function getEarningsHistory(params?: {
  page?: number;
  limit?: number;
}): Promise<EarningsHistoryResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  return dashFetch<EarningsHistoryResponse>(`/earnings/history?${qs.toString()}`);
}

// ─── Leaderboard (from dashboard overview) ───

export async function getEarnings(): Promise<EarningsOverview> {
  const data = await fetchDashboard();
  return data.earnings;
}

export async function getLeaderboard(_limit?: number): Promise<LeaderboardResponse> {
  const data = await fetchDashboard();
  return {
    providers: [],
    my_rank: data.my_rank?.rank ?? null,
    my_stats: data.my_rank
      ? {
          total_tasks: data.my_rank.total_tasks,
          success_rate: data.my_rank.success_rate,
          total_credits: data.my_rank.total_credits,
        }
      : null,
  };
}

// ─── Reward Leaderboard (public, no auth) ───

/** GET /api/v2/reward */
export async function getRewardLeaderboard(params?: {
  sort_by?: "hires" | "stars";
  limit?: number;
}): Promise<RewardLeaderboardResponse> {
  const qs = new URLSearchParams();
  if (params?.sort_by) qs.set("sort_by", params.sort_by);
  if (params?.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`/api/v2/reward?${qs.toString()}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
