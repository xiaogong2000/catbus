import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getUserAgents } from "@/lib/db";
import { fetchRelayNodeCalls } from "@/lib/relay-api";

// GET /api/dashboard/calls — call history with filtering and pagination
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = request.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const agentFilter = url.searchParams.get("agent") || "";
  const direction = url.searchParams.get("direction") || "";
  const status = url.searchParams.get("status") || "";
  const skill = url.searchParams.get("skill") || "";

  const bindings = getUserAgents(auth.userId);

  if (bindings.length === 0) {
    return Response.json({ data: [], total: 0, page, limit });
  }

  // Determine which agents to query
  let targetBindings = bindings;
  if (agentFilter) {
    const found = bindings.find((b) => b.node_id === agentFilter);
    if (!found) {
      return Response.json(
        { error: "FORBIDDEN", message: "Agent not bound to your account" },
        { status: 403 }
      );
    }
    targetBindings = [found];
  }

  // Fetch calls from all target agents (get a large batch for merging)
  const results = await Promise.allSettled(
    targetBindings.map(async (b) => {
      const res = await fetchRelayNodeCalls(b.node_id, {
        limit: 200,
        page: 1,
        direction,
        status,
        skill,
      });
      // Tag each record with the agent name
      return res.data.map((r) => ({
        ...r,
        agent_name: b.name,
      }));
    })
  );

  // Merge all call records
  type CallWithAgent = { agent_name: string | null; id: string; timestamp: string; direction: string; skill: string; remote_node: string; latency_ms: number; status: string; relay: string };
  const allCalls: CallWithAgent[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      allCalls.push(...r.value);
    }
  }

  // Sort by timestamp descending
  allCalls.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const total = allCalls.length;
  const start = (page - 1) * limit;
  const data = allCalls.slice(start, start + limit);

  return Response.json({ data, total, page, limit });
}
