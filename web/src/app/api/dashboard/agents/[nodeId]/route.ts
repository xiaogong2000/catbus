import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getUserAgents, removeUserAgent } from "@/lib/db";
import {
  fetchRelayNode,
  fetchRelayNodeCallsSummary,
  fetchRelayNodeDailyStats,
  fetchRelayNodeCalls,
} from "@/lib/relay-api";

// GET /api/dashboard/agents/[nodeId] — agent detail + charts
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { nodeId } = await params;

  // Permission check: user must own this agent
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
    fetchRelayNodeCalls(nodeId, { limit: 20 }),
  ]);

  const agent = {
    node_id: binding.node_id,
    name: binding.name,
    status: relayNode?.status ?? "offline",
    skills: (relayNode?.skills ?? []).map((s) => ({
      name: s,
      status: relayNode?.status ?? ("offline" as const),
      calls_handled: 0,
      success_rate: summary.success_rate,
    })),
    uptime_seconds: relayNode?.uptime_seconds ?? 0,
    calls_handled: summary.total_handled,
    calls_made: summary.total_made,
    server: "relay.catbus.xyz",
    registered_at: binding.created_at,
  };

  return Response.json({
    agent,
    weekly_stats: weeklyStats,
    recent_calls: recentCalls.data,
  });
}

// DELETE /api/dashboard/agents/[nodeId] — unbind agent
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { nodeId } = await params;
  const changes = removeUserAgent(auth.userId, nodeId);

  if (changes === 0) {
    return Response.json(
      { error: "NOT_FOUND", message: "Agent not bound" },
      { status: 404 }
    );
  }

  return Response.json({ success: true });
}
