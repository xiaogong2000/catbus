import { NextRequest } from "next/server";
import {
  fetchRelayNode,
  fetchRelayNodeCallsSummary,
  fetchRelayNodeDailyStats,
  fetchRelayNodeCalls,
} from "@/lib/relay-api";

/**
 * GET /api/v2/network/nodes/:nodeId
 * Public. Returns a single node's details, summary, daily stats, and recent calls.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;

  const [node, summary, dailyStats, recentCallsResult] = await Promise.all([
    fetchRelayNode(nodeId),
    fetchRelayNodeCallsSummary(nodeId).catch(() => null),
    fetchRelayNodeDailyStats(nodeId, 7).catch(() => []),
    fetchRelayNodeCalls(nodeId, { limit: 10, page: 1 }).catch(() => ({ data: [], total: 0 })),
  ]);

  if (!node) {
    return Response.json(
      { error: "NOT_FOUND", message: "Node not found" },
      { status: 404 }
    );
  }

  return Response.json({
    node: {
      node_id: node.node_id,
      name: node.name,
      status: node.status,
      skills: node.skills,
      uptime_seconds: node.uptime_seconds ?? 0,
      connected_at: node.connected_at ?? null,
    },
    summary: summary
      ? {
          total_handled: summary.total_handled,
          total_made: summary.total_made,
          success_rate: summary.success_rate,
          avg_latency: summary.avg_latency ?? 0,
        }
      : {
          total_handled: 0,
          total_made: 0,
          success_rate: 0,
          avg_latency: 0,
        },
    daily_stats: (dailyStats ?? []).map((d) => ({
      date: d.date,
      inbound: d.inbound ?? 0,
      outbound: d.outbound ?? 0,
    })),
    recent_calls: (recentCallsResult.data ?? []).map((c) => ({
      id: c.id,
      timestamp: c.timestamp,
      direction: c.direction,
      skill: c.skill,
      remote_node: c.remote_node,
      latency_ms: c.latency_ms ?? 0,
      status: c.status,
      relay: c.relay,
    })),
  });
}
