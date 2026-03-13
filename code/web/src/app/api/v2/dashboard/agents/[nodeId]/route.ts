import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getUserAgents, removeUserAgent } from "@/lib/db";
import {
  fetchRelayNode,
  fetchRelayNodeCallsSummary,
  fetchRelayNodeDailyStats,
  fetchRelayNodeCalls,
} from "@/lib/relay-api";

/**
 * GET /api/v2/dashboard/agents/:nodeId
 * Auth required. Returns detailed info for one bound agent.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { nodeId } = await params;

  const bindings = getUserAgents(auth.userId);
  const binding = bindings.find((b) => b.node_id === nodeId);
  if (!binding) {
    return Response.json(
      { error: "FORBIDDEN", message: "Agent not bound to your account" },
      { status: 403 }
    );
  }

  const [relayNode, summary, weeklyStats, recentCalls] = await Promise.all([
    fetchRelayNode(nodeId),
    fetchRelayNodeCallsSummary(nodeId),
    fetchRelayNodeDailyStats(nodeId, 7),
    fetchRelayNodeCalls(nodeId, { limit: 20, page: 1 }),
  ]);

  return Response.json({
    agent: {
      node_id: binding.node_id,
      name: binding.name,
      status: relayNode?.status ?? "offline",
      skills: (relayNode?.skills ?? []).map((s) => ({
        name: s,
        status: relayNode?.status ?? "offline",
        calls_handled: 0, // TODO: per-skill breakdown not available from relay
        success_rate: summary.success_rate,
      })),
      uptime_seconds: relayNode?.uptime_seconds ?? 0,
      calls_handled: summary.total_handled,
      calls_made: summary.total_made,
      calls_today: 0, // TODO: not yet available from relay
      avg_latency_ms: summary.avg_latency,
      server: "relay.catbus.xyz",
      registered_at: binding.created_at,
    },
    weekly_stats: weeklyStats,
    recent_calls: recentCalls.data,
  });
}

/**
 * DELETE /api/v2/dashboard/agents/:nodeId
 * Auth required. Unbinds an agent from the user's account.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { nodeId } = await params;
  const changes = removeUserAgent(auth.userId, nodeId);

  if (changes === 0) {
    return Response.json(
      { error: "NOT_FOUND", message: "Agent not bound to your account" },
      { status: 404 }
    );
  }

  return Response.json({ success: true });
}
