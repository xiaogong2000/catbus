import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getUserAgents, removeUserAgent, renameUserAgent } from "@/lib/db";
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

// PATCH /api/dashboard/agents/[nodeId] — rename agent
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { nodeId } = await params;
  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json(
      { error: "BAD_REQUEST", message: "name is required" },
      { status: 400 }
    );
  }

  const bindings = getUserAgents(auth.userId);
  if (!bindings.some((b) => b.node_id === nodeId)) {
    return Response.json(
      { error: "FORBIDDEN", message: "Agent not bound to your account" },
      { status: 403 }
    );
  }

  const changes = renameUserAgent(auth.userId, nodeId, name.trim());
  if (changes === 0) {
    return Response.json(
      { error: "NOT_FOUND", message: "Agent not found" },
      { status: 404 }
    );
  }

  return Response.json({ success: true });
}

// DELETE /api/dashboard/agents/[nodeId] — unbind agent
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { nodeId } = await params;

  // Best-effort: notify relay to remove the node
  const RELAY_API = process.env.RELAY_API_URL || 'https://relay.catbus.xyz/api';
  try { await fetch(`${RELAY_API}/nodes/${nodeId}`, { method: 'DELETE' }); } catch {}

  const changes = removeUserAgent(auth.userId, nodeId);

  if (changes === 0) {
    return Response.json(
      { error: "NOT_FOUND", message: "Agent not bound" },
      { status: 404 }
    );
  }

  return Response.json({ success: true });
}
