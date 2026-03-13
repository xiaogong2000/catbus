import { requireAuth } from "@/lib/auth-guard";
import { getHireRequestsByRequester, findUserById } from "@/lib/db";
import { getNodes } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const requests = getHireRequestsByRequester(auth.userId);

  // Fetch node names from relay
  let nodeNameMap = new Map<string, string>();
  try {
    const nodesRes = await getNodes(1, 100);
    for (const n of nodesRes.data) {
      nodeNameMap.set(n.node_id, n.name);
    }
  } catch {
    // fallback to node_id
  }

  return Response.json({
    requests: requests.map(r => {
      const owner = findUserById(r.owner_id);
      return {
        id: r.id,
        target_node_id: r.node_id,
        target_name: nodeNameMap.get(r.node_id) || r.node_id,
        target_owner_name: owner?.name || owner?.email?.split("@")[0] || "Unknown",
        message: r.message,
        status: r.status,
        requested_at: r.created_at,
        responded_at: r.updated_at !== r.created_at ? r.updated_at : null,
      };
    }),
  });
}
