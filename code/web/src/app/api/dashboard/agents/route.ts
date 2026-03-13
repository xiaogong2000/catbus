import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getUserAgents, addUserAgent } from "@/lib/db";
import { fetchRelayNode, fetchRelayNodeCallsSummary } from "@/lib/relay-api";

// GET /api/dashboard/agents — list user's bound agents
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const bindings = getUserAgents(auth.userId);

  if (bindings.length === 0) {
    return Response.json({ agents: [] });
  }

  const results = await Promise.allSettled(
    bindings.map(async (b) => {
      const [node, summary] = await Promise.all([
        fetchRelayNode(b.node_id),
        fetchRelayNodeCallsSummary(b.node_id),
      ]);

      return {
        node_id: b.node_id,
        name: b.name,
        status: node?.status ?? "offline",
        skills: (node?.skills ?? []).map((s) => ({
          name: s,
          status: node?.status ?? ("offline" as const),
          calls_handled: 0,
          success_rate: summary.success_rate,
        })),
        uptime_seconds: node?.uptime_seconds ?? 0,
        calls_handled: summary.total_handled,
        calls_made: summary.total_made,
        server: "relay.catbus.xyz",
        registered_at: b.created_at,
      };
    })
  );

  const agents = results
    .filter((r): r is PromiseFulfilledResult<ReturnType<typeof Object>> => r.status === "fulfilled")
    .map((r) => r.value);

  return Response.json({ agents });
}

// POST /api/dashboard/agents — bind a new agent
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let body: { node_id?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "VALIDATION_ERROR", message: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const nodeId = body.node_id?.trim();
  if (!nodeId) {
    return Response.json(
      { error: "VALIDATION_ERROR", message: "node_id is required" },
      { status: 400 }
    );
  }

  // Verify node exists in relay network
  const relayNode = await fetchRelayNode(nodeId);
  if (!relayNode) {
    return Response.json(
      { error: "NOT_FOUND", message: "Node not found in network" },
      { status: 404 }
    );
  }

  // Check duplicate binding
  const existing = getUserAgents(auth.userId);
  if (existing.some((a) => a.node_id === nodeId)) {
    return Response.json(
      { error: "CONFLICT", message: "Agent already bound" },
      { status: 409 }
    );
  }

  const name = body.name?.trim() || relayNode.name || nodeId;
  const binding = addUserAgent(auth.userId, nodeId, name);

  const summary = await fetchRelayNodeCallsSummary(nodeId);

  const agent = {
    node_id: binding.node_id,
    name: binding.name,
    status: relayNode.status,
    skills: relayNode.skills.map((s) => ({
      name: s,
      status: relayNode.status,
      calls_handled: 0,
      success_rate: summary.success_rate,
    })),
    uptime_seconds: relayNode.uptime_seconds,
    calls_handled: summary.total_handled,
    calls_made: summary.total_made,
    server: "relay.catbus.xyz",
    registered_at: binding.created_at,
  };

  return Response.json({ success: true, agent }, { status: 201 });
}
