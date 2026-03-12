import type {
  ParsedModel,
  ShareableSkill,
  FilteredSkill,
  ProviderConfig,
  BindStatusResponse,
  EarningsOverview,
  EarningsHistoryResponse,
  LeaderboardResponse,
} from "./provider-types";

// ─── Mock Models ───

export const mockModels: ParsedModel[] = [
  {
    id: "claude-sonnet-4",
    raw: "amazon-bedrock/global.anthropic.claude-sonnet-4-6",
    provider: "Anthropic",
    context_window: 200000,
    strengths: ["coding", "analysis", "reasoning"],
  },
  {
    id: "claude-opus-4",
    raw: "amazon-bedrock/global.anthropic.claude-opus-4-6",
    provider: "Anthropic",
    context_window: 200000,
    strengths: ["complex reasoning", "research", "writing"],
  },
  {
    id: "gpt-5.4",
    raw: "openai/gpt-5.4",
    provider: "OpenAI",
    context_window: 128000,
    strengths: ["general purpose", "instruction following"],
  },
  {
    id: "gpt-4.1-mini",
    raw: "openai/gpt-4.1-mini",
    provider: "OpenAI",
    context_window: 128000,
    strengths: ["fast", "cost-effective", "coding"],
  },
];

// ─── Mock Skills ───

export const mockShareableSkills: ShareableSkill[] = [
  { name: "web_search", category: "Information", cost_level: "low", display: "Web Search" },
  { name: "code_review", category: "Development", cost_level: "free", display: "Code Review" },
  { name: "image_generation", category: "Creative", cost_level: "high", display: "Image Generation" },
  { name: "data_analysis", category: "Analytics", cost_level: "medium", display: "Data Analysis" },
  { name: "translation", category: "Language", cost_level: "low", display: "Translation" },
];

export const mockFilteredSkills: FilteredSkill[] = [
  { name: "file_system_access", reason: "Security risk: filesystem access" },
  { name: "shell_exec", reason: "Security risk: arbitrary command execution" },
  { name: "private_api_key", reason: "Contains sensitive credentials" },
  { name: "internal_db_query", reason: "Internal-only database access" },
];

// ─── Mock Provider Config ───

export const mockProviderConfig: ProviderConfig = {
  models: mockModels,
  skills: {
    shareable: mockShareableSkills,
    filtered: mockFilteredSkills,
  },
  hire_config: {
    hireable: true,
    allowed_skills: mockShareableSkills.map((s) => s.name),
    rate_limit: 20,
    price_per_call: 0,
    description: "",
  },
};

// ─── Mock Bind Status with Provider ───

export const mockBindStatusWithProvider: BindStatusResponse = {
  bound: true,
  agent: {
    node_id: "node-abc123",
    name: "My Agent",
    status: "online",
    skills: [
      { name: "web_search", status: "online" as const, calls_handled: 42, success_rate: 98.5 },
      { name: "code_review", status: "online" as const, calls_handled: 18, success_rate: 100 },
    ],
    uptime_seconds: 3600,
    calls_handled: 60,
    calls_made: 15,
    server: "us-east-1",
    registered_at: new Date().toISOString(),
  },
  provider_config: {
    models: mockModels,
    skills: {
      shareable: mockShareableSkills,
      filtered: mockFilteredSkills,
    },
  },
};

// ─── Bind Prompt Template ───

export function mockBindPromptTemplate(token: string): string {
  return `Please bind this agent to the CatBus network.

Run the following command in your agent's terminal:

catbus bind ${token}

This token will expire in 5 minutes. After binding, your agent will be visible on the network and can start receiving calls.`;
}

// ─── Mock Earnings ───

export const mockEarningsOverview: EarningsOverview = {
  today: { credits: 12.5, tasks: 8 },
  this_week: { credits: 87.3, tasks: 52 },
  this_month: { credits: 342.1, tasks: 198 },
  total: { credits: 1250.8, tasks: 743 },
};

export const mockEarningsHistory: EarningsHistoryResponse = {
  data: [
    {
      id: "earn-001",
      created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      task_type: "model",
      task_detail: "Code generation with Claude Sonnet 4",
      model_used: "claude-sonnet-4",
      tokens_consumed: 2400,
      credits_earned: 1.2,
      caller_name: "agent-xyz",
    },
    {
      id: "earn-002",
      created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      task_type: "skill",
      task_detail: "Web search query",
      skill_used: "web_search",
      tokens_consumed: 800,
      credits_earned: 0.4,
      caller_name: "agent-beta",
    },
    {
      id: "earn-003",
      created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      task_type: "model",
      task_detail: "Data analysis with GPT-5.4",
      model_used: "gpt-5.4",
      tokens_consumed: 5600,
      credits_earned: 2.8,
      caller_name: "agent-gamma",
    },
    {
      id: "earn-004",
      created_at: new Date(Date.now() - 1000 * 60 * 150).toISOString(),
      task_type: "skill",
      task_detail: "Code review analysis",
      skill_used: "code_review",
      tokens_consumed: 3200,
      credits_earned: 0.8,
      caller_name: "agent-delta",
    },
    {
      id: "earn-005",
      created_at: new Date(Date.now() - 1000 * 60 * 220).toISOString(),
      task_type: "model",
      task_detail: "Translation task with Claude Opus 4",
      model_used: "claude-opus-4",
      tokens_consumed: 4800,
      credits_earned: 3.6,
      caller_name: "agent-epsilon",
    },
    {
      id: "earn-006",
      created_at: new Date(Date.now() - 1000 * 60 * 310).toISOString(),
      task_type: "skill",
      task_detail: "Data analysis pipeline",
      skill_used: "data_analysis",
      tokens_consumed: 6200,
      credits_earned: 1.5,
      caller_name: "agent-zeta",
    },
    {
      id: "earn-007",
      created_at: new Date(Date.now() - 1000 * 60 * 400).toISOString(),
      task_type: "model",
      task_detail: "Multi-step reasoning with GPT-4.1 Mini",
      model_used: "gpt-4.1-mini",
      tokens_consumed: 1600,
      credits_earned: 0.3,
      caller_name: "agent-eta",
    },
    {
      id: "earn-008",
      created_at: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
      task_type: "skill",
      task_detail: "Image generation request",
      skill_used: "image_generation",
      tokens_consumed: 0,
      credits_earned: 4.0,
      caller_name: "agent-theta",
    },
  ],
  total: 8,
  page: 1,
  limit: 20,
};

// ─── Mock Leaderboard ───

export const mockLeaderboard: LeaderboardResponse = {
  providers: [
    { rank: 1, node_id: "node-top1", name: "Alpha Provider", top_model: "claude-opus-4", total_tasks: 1520, success_rate: 99.2, total_credits: 4580.5 },
    { rank: 2, node_id: "node-top2", name: "Beta Services", top_model: "gpt-5.4", total_tasks: 1340, success_rate: 98.8, total_credits: 3920.1 },
    { rank: 3, node_id: "node-top3", name: "Gamma AI", top_model: "claude-sonnet-4", total_tasks: 980, success_rate: 97.5, total_credits: 2850.3 },
    { rank: 4, node_id: "node-top4", name: "Delta Cloud", top_model: "gpt-5.4", total_tasks: 870, success_rate: 96.9, total_credits: 2410.0 },
    { rank: 5, node_id: "node-top5", name: "Epsilon Labs", top_model: "claude-sonnet-4", total_tasks: 760, success_rate: 97.1, total_credits: 2180.6 },
    { rank: 6, node_id: "node-top6", name: "Zeta Systems", top_model: "claude-opus-4", total_tasks: 650, success_rate: 95.8, total_credits: 1920.3 },
    { rank: 7, node_id: "node-top7", name: "Eta Research", top_model: "gpt-4.1-mini", total_tasks: 580, success_rate: 98.0, total_credits: 1640.7 },
    { rank: 8, node_id: "node-top8", name: "Theta Net", top_model: "claude-sonnet-4", total_tasks: 510, success_rate: 94.5, total_credits: 1380.2 },
    { rank: 9, node_id: "node-top9", name: "Iota Agent", top_model: "gpt-5.4", total_tasks: 440, success_rate: 96.2, total_credits: 1150.8 },
    { rank: 10, node_id: "node-top10", name: "Kappa Hub", top_model: "claude-opus-4", total_tasks: 380, success_rate: 93.7, total_credits: 960.4 },
  ],
  my_rank: 12,
  my_stats: {
    total_tasks: 198,
    success_rate: 96.4,
    total_credits: 342.1,
  },
};
