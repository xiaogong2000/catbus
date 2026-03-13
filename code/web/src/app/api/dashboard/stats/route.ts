import { requireAuth } from "@/lib/auth-guard";
import { getUserAgents } from "@/lib/db";
import {
  fetchRelayNode,
  fetchRelayNodeCallsSummary,
} from "@/lib/relay-api";

// GET /api/dashboard/stats — aggregated dashboard statistics
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const bindings = getUserAgents(auth.userId);

  if (bindings.length === 0) {
    return Response.json({
      my_agents: 0,
      my_skills: 0,
      calls_received: 0,
      calls_made: 0,
      avg_latency_ms: 0,
      success_rate: 0,
    });
  }

  const results = await Promise.allSettled(
    bindings.map(async (b) => {
      const [node, summary] = await Promise.all([
        fetchRelayNode(b.node_id),
        fetchRelayNodeCallsSummary(b.node_id),
      ]);
      return { nodeId: b.node_id, node, summary };
    })
  );

  const settled = results
    .filter((r): r is PromiseFulfilledResult<{ nodeId: string; node: Awaited<ReturnType<typeof fetchRelayNode>>; summary: Awaited<ReturnType<typeof fetchRelayNodeCallsSummary>> }> => r.status === "fulfilled")
    .map((r) => r.value);

  // Aggregate skills (deduplicated)
  const allSkills = new Set<string>();
  for (const s of settled) {
    if (s.node?.skills) {
      for (const skill of s.node.skills) {
        allSkills.add(skill);
      }
    }
  }

  // Aggregate call stats
  let totalHandled = 0;
  let totalMade = 0;
  let totalLatencyWeighted = 0;
  let totalCallsForLatency = 0;
  let totalSuccess = 0;
  let totalCalls = 0;

  for (const s of settled) {
    totalHandled += s.summary.total_handled;
    totalMade += s.summary.total_made;
    const nodeTotalCalls = s.summary.total_handled + s.summary.total_made;
    totalLatencyWeighted += s.summary.avg_latency * nodeTotalCalls;
    totalCallsForLatency += nodeTotalCalls;
    totalSuccess += (s.summary.success_rate / 100) * nodeTotalCalls;
    totalCalls += nodeTotalCalls;
  }

  return Response.json({
    my_agents: bindings.length,
    my_skills: allSkills.size,
    calls_received: totalHandled,
    calls_made: totalMade,
    avg_latency_ms: totalCallsForLatency > 0
      ? Math.round((totalLatencyWeighted / totalCallsForLatency) * 100) / 100
      : 0,
    success_rate: totalCalls > 0
      ? Math.round((totalSuccess / totalCalls) * 10000) / 100
      : 0,
  });
}
