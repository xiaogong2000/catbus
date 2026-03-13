import { NextRequest } from "next/server";
import { fetchRelayNodeCalls } from "@/lib/relay-api";

/**
 * GET /api/v2/network/nodes/:nodeId/calls
 * Public. Returns paginated call history for a node.
 * Data source: relay-api.ts (fetchRelayNodeCalls, with mock fallback)
 * Query params: page, limit, direction (inbound|outbound), status (success|error|timeout), skill
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { nodeId } = await params;
  const url = new URL(req.url);

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const direction = url.searchParams.get("direction") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const skill = url.searchParams.get("skill") || undefined;

  try {
    const result = await fetchRelayNodeCalls(nodeId, { page, limit, direction, status, skill });

    return Response.json({
      data: result.data.map((c) => ({
        id: c.id,
        timestamp: c.timestamp,
        direction: c.direction,
        skill: c.skill,
        remote_node: c.remote_node,
        latency_ms: c.latency_ms ?? 0, // TODO: may be 0 if relay doesn't provide latency
        status: c.status,
        relay: c.relay,
      })),
      total: result.total,
      page,
      limit,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404")) {
      return Response.json(
        { error: "NOT_FOUND", message: "Node not found" },
        { status: 404 }
      );
    }
    console.error("[v2/network/nodes/:nodeId/calls] relay error:", err);
    return Response.json(
      { error: "SERVICE_UNAVAILABLE", message: "Relay service unavailable" },
      { status: 503 }
    );
  }
}
