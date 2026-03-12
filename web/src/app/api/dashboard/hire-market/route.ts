import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getAvailableHireConfigs, findUserById } from "@/lib/db";
import { getNodes } from "@/lib/api";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const skill = searchParams.get("skill") ?? undefined;
  const { data, total } = getAvailableHireConfigs(page, limit, skill);

  // Fetch node names from relay API
  let nodeNameMap = new Map<string, string>();
  try {
    const nodesRes = await getNodes(1, 100);
    for (const n of nodesRes.data) {
      nodeNameMap.set(n.node_id, n.name);
    }
  } catch {
    // If relay is down, fall back to node_id as name
  }

  return Response.json({
    data: data.map(c => {
      const owner = findUserById(c.user_id);
      return {
        node_id: c.node_id,
        name: nodeNameMap.get(c.node_id) || c.node_id,
        owner_name: owner?.name || owner?.email?.split("@")[0] || "Unknown",
        available: c.available === 1,
        price_per_call: c.price_per_call,
        max_concurrent: c.max_concurrent,
        skills: JSON.parse(c.skills),
        description: c.description,
        updated_at: c.updated_at,
      };
    }),
    total, page, limit,
  });
}
