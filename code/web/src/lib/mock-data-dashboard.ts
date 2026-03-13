// Dashboard mock data — matches the structures defined in catbus-web-platform-design.pdf
// Consistent with the public page mock data (same nodes, skills, naming conventions)

export interface Agent {
  node_id: string;
  name: string;
  status: "online" | "offline";
  skills: SkillSummary[];
  uptime_seconds: number;
  calls_handled: number;
  calls_made: number;
  server: string;
  registered_at: string;
  is_provider?: boolean;
  rate_limit?: number;
}

export interface SkillSummary {
  name: string;
  status: "online" | "offline";
  calls_handled: number;
  success_rate: number;
}

export interface CallRecord {
  id: string;
  timestamp: string;
  direction: "inbound" | "outbound";
  skill: string;
  remote_node: string;
  agent_name: string;
  latency_ms: number;
  status: "success" | "error" | "timeout";
  input?: string;
  output?: string;
  relay: string;
}

export interface DashboardStats {
  my_agents: number;
  my_skills: number;
  calls_received: number;
  calls_made: number;
  avg_latency_ms: number;
  success_rate: number;
}

export interface DailyCallStat {
  date: string;
  inbound: number;
  outbound: number;
}

export interface UserSettings {
  github_username: string;
  email: string;
  notifications: {
    agent_offline_email: boolean;
    daily_report: boolean;
    weekly_report: boolean;
  };
  bound_agents: string[]; // node_ids
}

// --- Mock Data ---

export const dashboardStats: DashboardStats = {
  my_agents: 2,
  my_skills: 8,
  calls_received: 156,
  calls_made: 67,
  avg_latency_ms: 92,
  success_rate: 99.36,
};

export const myAgents: Agent[] = [
  {
    node_id: "0df18901909a",
    name: "gouzai",
    status: "online",
    skills: [
      { name: "translate", status: "online", calls_handled: 89, success_rate: 100 },
      { name: "text_stats", status: "online", calls_handled: 45, success_rate: 98 },
      { name: "json_format", status: "online", calls_handled: 23, success_rate: 100 },
      { name: "echo", status: "online", calls_handled: 156, success_rate: 100 },
    ],
    uptime_seconds: 8100,
    calls_handled: 89,
    calls_made: 42,
    server: "relay.catbus.ai",
    registered_at: "2026-02-15T10:30:00Z",
  },
  {
    node_id: "6f72bce2510d",
    name: "xiaohe",
    status: "online",
    skills: [
      { name: "translate", status: "online", calls_handled: 67, success_rate: 100 },
      { name: "text_stats", status: "online", calls_handled: 34, success_rate: 97 },
      { name: "json_format", status: "online", calls_handled: 18, success_rate: 100 },
      { name: "echo", status: "online", calls_handled: 120, success_rate: 100 },
    ],
    uptime_seconds: 7800,
    calls_handled: 67,
    calls_made: 25,
    server: "relay.catbus.ai",
    registered_at: "2026-02-20T14:00:00Z",
  },
];

export const callHistory: CallRecord[] = [
  {
    id: "call-001",
    timestamp: "2026-03-10T12:03:45Z",
    direction: "inbound",
    skill: "translate",
    remote_node: "node-3",
    agent_name: "gouzai",
    latency_ms: 148,
    status: "success",
    input: '{"text": "hello", "target_lang": "zh"}',
    output: '{"translated": "你好"}',
    relay: "relay.catbus.ai",
  },
  {
    id: "call-002",
    timestamp: "2026-03-10T12:02:30Z",
    direction: "outbound",
    skill: "echo",
    remote_node: "xiaohe",
    agent_name: "gouzai",
    latency_ms: 35,
    status: "success",
    input: '{"message": "ping"}',
    output: '{"message": "ping"}',
    relay: "relay.catbus.ai",
  },
  {
    id: "call-003",
    timestamp: "2026-03-10T11:58:00Z",
    direction: "inbound",
    skill: "translate",
    remote_node: "node-5",
    agent_name: "gouzai",
    latency_ms: 152,
    status: "success",
    input: '{"text": "goodbye", "target_lang": "zh"}',
    output: '{"translated": "再见"}',
    relay: "relay.catbus.ai",
  },
  {
    id: "call-004",
    timestamp: "2026-03-10T11:45:00Z",
    direction: "outbound",
    skill: "json_format",
    remote_node: "xiaohe",
    agent_name: "gouzai",
    latency_ms: 52,
    status: "success",
    input: '{"json": "{\\"a\\":1}"}',
    output: '{"formatted": "{\\n  \\"a\\": 1\\n}"}',
    relay: "relay.catbus.ai",
  },
  {
    id: "call-005",
    timestamp: "2026-03-10T11:30:00Z",
    direction: "inbound",
    skill: "text_stats",
    remote_node: "node-7",
    agent_name: "xiaohe",
    latency_ms: 38,
    status: "success",
    input: '{"text": "hello world"}',
    output: '{"chars": 11, "words": 2, "lines": 1}',
    relay: "relay.catbus.ai",
  },
  {
    id: "call-006",
    timestamp: "2026-03-10T11:15:00Z",
    direction: "inbound",
    skill: "echo",
    remote_node: "node-3",
    agent_name: "xiaohe",
    latency_ms: 30,
    status: "success",
    input: '{"message": "test"}',
    output: '{"message": "test"}',
    relay: "relay.catbus.ai",
  },
  {
    id: "call-007",
    timestamp: "2026-03-10T10:50:00Z",
    direction: "outbound",
    skill: "translate",
    remote_node: "node-9",
    agent_name: "gouzai",
    latency_ms: 200,
    status: "timeout",
    input: '{"text": "large paragraph...", "target_lang": "ja"}',
    relay: "relay.catbus.ai",
  },
  {
    id: "call-008",
    timestamp: "2026-03-10T10:30:00Z",
    direction: "inbound",
    skill: "translate",
    remote_node: "node-4",
    agent_name: "gouzai",
    latency_ms: 155,
    status: "success",
    input: '{"text": "thank you", "target_lang": "zh"}',
    output: '{"translated": "谢谢"}',
    relay: "relay.catbus.ai",
  },
  {
    id: "call-009",
    timestamp: "2026-03-10T09:45:00Z",
    direction: "inbound",
    skill: "json_format",
    remote_node: "node-6",
    agent_name: "xiaohe",
    latency_ms: 48,
    status: "success",
    input: '{"json": "{\\"b\\":2}"}',
    output: '{"formatted": "{\\n  \\"b\\": 2\\n}"}',
    relay: "relay.catbus.ai",
  },
  {
    id: "call-010",
    timestamp: "2026-03-10T09:20:00Z",
    direction: "outbound",
    skill: "text_stats",
    remote_node: "node-3",
    agent_name: "gouzai",
    latency_ms: 42,
    status: "error",
    input: '{"text": ""}',
    relay: "relay.catbus.ai",
  },
  {
    id: "call-011",
    timestamp: "2026-03-10T08:55:00Z",
    direction: "inbound",
    skill: "echo",
    remote_node: "node-8",
    agent_name: "gouzai",
    latency_ms: 28,
    status: "success",
    input: '{"message": "alive?"}',
    output: '{"message": "alive?"}',
    relay: "relay.catbus.ai",
  },
  {
    id: "call-012",
    timestamp: "2026-03-10T08:30:00Z",
    direction: "inbound",
    skill: "translate",
    remote_node: "node-2",
    agent_name: "xiaohe",
    latency_ms: 145,
    status: "success",
    input: '{"text": "good morning", "target_lang": "zh"}',
    output: '{"translated": "早上好"}',
    relay: "relay.catbus.ai",
  },
];

// 7-day call stats for agent detail charts
export const weeklyCallStats: Record<string, DailyCallStat[]> = {
  "0df18901909a": [
    { date: "2026-03-04", inbound: 12, outbound: 5 },
    { date: "2026-03-05", inbound: 18, outbound: 8 },
    { date: "2026-03-06", inbound: 15, outbound: 6 },
    { date: "2026-03-07", inbound: 22, outbound: 10 },
    { date: "2026-03-08", inbound: 9, outbound: 4 },
    { date: "2026-03-09", inbound: 25, outbound: 12 },
    { date: "2026-03-10", inbound: 14, outbound: 7 },
  ],
  "6f72bce2510d": [
    { date: "2026-03-04", inbound: 8, outbound: 3 },
    { date: "2026-03-05", inbound: 11, outbound: 5 },
    { date: "2026-03-06", inbound: 14, outbound: 4 },
    { date: "2026-03-07", inbound: 10, outbound: 7 },
    { date: "2026-03-08", inbound: 6, outbound: 2 },
    { date: "2026-03-09", inbound: 19, outbound: 8 },
    { date: "2026-03-10", inbound: 12, outbound: 5 },
  ],
};

export const userSettings: UserSettings = {
  github_username: "xiaogong2000",
  email: "xiaogong@example.com",
  notifications: {
    agent_offline_email: true,
    daily_report: false,
    weekly_report: true,
  },
  bound_agents: ["0df18901909a", "6f72bce2510d"],
};

// Helper: get agent by node_id
export function getAgentById(nodeId: string): Agent | undefined {
  return myAgents.find((a) => a.node_id === nodeId);
}

// Helper: get calls for a specific agent
export function getCallsByAgent(agentName: string): CallRecord[] {
  return callHistory.filter((c) => c.agent_name === agentName);
}

// Helper: format uptime
export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds) || seconds <= 0) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Helper: relative time
export function relativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
