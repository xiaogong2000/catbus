import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getUserAgents } from "@/lib/db";
import { fetchRelayNodeCalls } from "@/lib/relay-api";

/**
 * GET /api/v2/dashboard/tasks
 * Auth required. Returns paginated call/task history across all bound agents.
 * Query params: page, limit, agent (nodeId filter), direction, status, skill
 *
 * TODO: When a dedicated tasks table exists, replace relay call fetch with DB query.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
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

  // Fetch calls from relay (used as tasks source until dedicated tasks table exists)
  const results = await Promise.allSettled(
    targetBindings.map(async (b) => {
      const res = await fetchRelayNodeCalls(b.node_id, {
        limit: 200,
        page: 1,
        direction: direction || undefined,
        status: status || undefined,
        skill: skill || undefined,
      });
      return res.data.map((r) => ({
        ...r,
        node_id: b.node_id,
        agent_name: b.name,
      }));
    })
  );

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
  for (const r of results) {
    if (r.status === "fulfilled") allTasks.push(...r.value);
  }

  allTasks.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const total = allTasks.length;
  const start = (page - 1) * limit;
  const data = allTasks.slice(start, start + limit);

  return Response.json({ data, total, page, limit });
}
