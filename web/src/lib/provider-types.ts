// Provider config types (from catbus-provider-requirements-v3)
export interface ParsedModel {
  id: string;           // "claude-sonnet-4"
  raw: string;          // "amazon-bedrock/global.anthropic.claude-sonnet-4-6"
  provider: string;     // "Anthropic"
  context_window: number;
  strengths: string[];
}

export interface ShareableSkill {
  name: string;
  category: string;
  cost_level: "free" | "low" | "medium" | "high";
  display?: string;
}

export interface FilteredSkill {
  name: string;
  reason: string;
}

export interface ProviderConfig {
  models: ParsedModel[];
  skills: {
    shareable: ShareableSkill[];
    filtered: FilteredSkill[];
  };
  hire_config: HireConfig;
}

export interface HireConfig {
  hireable: boolean;
  allowed_skills: string[];
  rate_limit: number;
  price_per_call: number;
  description: string;
}

export interface SaveProviderConfigRequest {
  models: string[];        // selected model IDs
  skills: string[];        // selected skill names
  hire_config: {
    hireable: boolean;
    rate_limit: number;
    price_per_call: number;
    description: string;
  };
}

// Extended bind status response (with provider_config)
export interface BindStatusResponse {
  bound: boolean;
  agent?: import("@/lib/mock-data-dashboard").Agent;
  provider_config?: {
    models: ParsedModel[];
    skills: {
      shareable: ShareableSkill[];
      filtered: FilteredSkill[];
    };
  };
}

// Hire Market types
export interface HireMarketItem {
  node_id: string;
  name: string;
  owner_name: string;
  status: "online" | "offline";
  allowed_skills: string[];
  rate_limit: number;
  price_per_call: number;
  description: string;
  total_hirers: number;
}

export interface HireMarketResponse {
  data: HireMarketItem[];
  total: number;
  page: number;
  limit: number;
}

// Hire request types
export type RequestStatus = "pending" | "approved" | "rejected" | "expired";
export type ContractStatus = "active" | "terminated";

export interface MyHireRequest {
  id: string;
  target_node_id: string;
  target_name: string;
  target_owner_name: string;
  message: string;
  status: RequestStatus;
  requested_at: string;
  responded_at: string | null;
}

export interface IncomingHireRequest {
  id: string;
  requester_name: string;
  target_node_id: string;
  target_name: string;
  message: string;
  status: RequestStatus;
  requested_at: string;
}

export interface HiredAgentFull {
  contract_id: string;
  node_id: string;
  name: string;
  owner_name: string;
  skills: string[];
  status: "online" | "offline";
  rate_limit: number;
  price_per_call: number;
  hired_at: string;
  expires_at: string | null;
  total_calls: number;
}

export interface HireContract {
  id: string;
  hirer_name: string;
  node_id: string;
  allowed_skills: string[];
  rate_limit: number;
  price_per_call: number;
  status: ContractStatus;
  hired_at: string;
  expires_at: string | null;
  total_calls: number;
  total_cost: number;
}

// Earnings types
export interface EarningsOverview {
  today: { credits: number; tasks: number };
  this_week: { credits: number; tasks: number };
  this_month: { credits: number; tasks: number };
  total: { credits: number; tasks: number };
}

export interface EarningRecord {
  id: string;
  created_at: string;
  task_type: "model" | "skill";
  task_detail: string;
  model_used?: string;
  skill_used?: string;
  tokens_consumed: number;
  credits_earned: number;
  caller_name: string;
}

export interface EarningsHistoryResponse {
  data: EarningRecord[];
  total: number;
  page: number;
  limit: number;
}

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  node_id: string;
  name: string;
  top_model: string;
  total_tasks: number;
  success_rate: number;
  total_credits: number;
}

export interface LeaderboardResponse {
  providers: LeaderboardEntry[];
  my_rank: number | null;
  my_stats: {
    total_tasks: number;
    success_rate: number;
    total_credits: number;
  } | null;
}

// Extended DashboardStats (adds earnings fields)
export interface DashboardStatsExtended {
  my_agents: number;
  my_skills: number;
  calls_received: number;
  calls_made: number;
  avg_latency_ms: number;
  success_rate: number;
  today_earnings?: number;
  today_tasks?: number;
  total_credits?: number;
  provider_rank?: number | null;
}
