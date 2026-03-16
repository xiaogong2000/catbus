import { requireAuth } from "@/lib/auth-guard";
import { getUserAgents, getEarningsAggregated, getUserRank } from "@/lib/db";
import {
  fetchRelayNode,
  fetchRelayNodeCallsSummary,
  fetchRelayNodeCalls,
} from "@/lib/relay-api";

/**
 * GET /api/v2/dashboard
 * Auth required. Returns user's agents list + aggregated stats + recent_tasks + earnings + my_rank.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const bindings = getUserAgents(auth.userId);
  const earnings = getEarningsAggregated(auth.userId);

  // my_rank: stub returns null until leaderboard/earnings tables are populated
  // TODO: implement real ranking once earnings table tracks per-user totals
  const rankRow = getUserRank(auth.userId);
  const my_rank = rankRow
    ? { rank: rankRow.rank, total_tasks: rankRow.total_tasks, total_credits: rankRow.total_credits }
    : null;

  if (bindings.length === 0) {
    return Response.json({
      stats: {
        my_agents: 0,
        my_skills: 0,
        calls_received: 0,
        calls_made: 0,
        avg_latency_ms: 0, // TODO: aggregate from relay
        success_rate: 0,
      },
      agents: [],
      recent_tasks: [], // TODO: no tasks without bound agents
      earnings,
      my_rank,
    });
  }

  const results = await Promise.allSettled(
    bindings.map(async (b) => {
      const [node, summary, recentCalls] = await Promise.all([
        fetchRelayNode(b.node_id),
        fetchRelayNodeCallsSummary(b.node_id),
        fetchRelayNodeCalls(b.node_id, { limit: 10, page: 1 }),
      ]);
      return { binding: b, node, summary, recentCalls };
    })
  );

  type SettledItem = {
    binding: (typeof bindings)[0];
    node: Awaited<ReturnType<typeof fetchRelayNode>>;
    summary: Awaited<ReturnType<typeof fetchRelayNodeCallsSummary>>;
    recentCalls: Awaited<ReturnType<typeof fetchRelayNodeCalls>>;
  };

  const settled = results
    .filter((r): r is PromiseFulfilledResult<SettledItem> => r.status === "fulfilled")
    .map((r) => r.value);

  // Build agents list
  const agents = settled.map(({ binding, node, summary }) => ({
    node_id: binding.node_id,
    name: binding.name,
    status: node?.status ?? "offline",
    skills: (node?.skills ?? []).map((s) => ({
      name: s,
      status: node?.status ?? "offline",
      calls_handled: 0, // TODO: per-skill breakdown not yet available from relay
      success_rate: summary.success_rate,
    })),
    uptime_seconds: node?.uptime_seconds ?? 0,
    calls_handled: summary.total_handled,
    calls_made: summary.total_made,
    calls_today: 0, // TODO: not yet available from relay
    avg_latency_ms: summary.avg_latency,
    server: "relay.catbus.xyz",
    registered_at: binding.created_at,
  }));

  // Aggregate stats
  const allSkills = new Set<string>();
  let totalHandled = 0;
  let totalMade = 0;
  let totalLatencyWeighted = 0;
  let totalCallsForLatency = 0;
  let totalSuccess = 0;
  let totalCalls = 0;

  for (const { node, summary } of settled) {
    if (node?.skills) node.skills.forEach((s) => allSkills.add(s));
    totalHandled += summary.total_handled;
    totalMade += summary.total_made;
    const nodeCalls = summary.total_handled + summary.total_made;
    totalLatencyWeighted += summary.avg_latency * nodeCalls;
    totalCallsForLatency += nodeCalls;
    totalSuccess += (summary.success_rate / 100) * nodeCalls;
    totalCalls += nodeCalls;
  }

  // Collect recent_tasks: merge calls from all agents, sort by time, take top 10
  type TaskRecord = {
    id: string;
    timestamp: string;
    direction: string;
    skill: string;
    remote_node: string;
    latency_ms: number;
    status: string;
    relay: string;
    node_id: string;
    agent_name: string | null;
  };

  const allTasks: TaskRecord[] = [];
  for (const { binding, recentCalls } of settled) {
    for (const r of recentCalls.data) {
      allTasks.push({
        ...r,
        node_id: binding.node_id,
        agent_name: binding.name,
      });
    }
  }
  allTasks.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const recent_tasks = allTasks.slice(0, 10);

  return Response.json({
    stats: {
      my_agents: bindings.length,
      my_skills: allSkills.size,
      calls_received: totalHandled,
      calls_made: totalMade,
      avg_latency_ms:
        totalCallsForLatency > 0
          ? Math.round((totalLatencyWeighted / totalCallsForLatency) * 100) / 100
          : 0,
      success_rate:
        totalCalls > 0
          ? Math.round((totalSuccess / totalCalls) * 10000) / 100
          : 0,
    },
    agents,
    recent_tasks,
    earnings,
    my_rank,
  });
}
