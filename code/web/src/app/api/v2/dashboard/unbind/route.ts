import { NextRequest } from "next/server";
import { removeUserAgentByNodeId } from "@/lib/db";

/**
 * POST /api/v2/dashboard/unbind
 * PUBLIC — no auth needed.
 * Called by the daemon uninstall script (curl from the node itself).
 * The node_id is only known to the node owner (not publicly listed with bind info).
 *
 * NOTE: This endpoint is intentionally unauthenticated because the daemon
 * calls it during `--uninstall` without a user session/JWT. The node_id
 * acts as a shared secret between the node and the web app. If stronger
 * auth is needed later, the daemon should send a signed token.
 *
 * Body: { node_id: string }
 */
export async function POST(req: NextRequest) {
  let body: { node_id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "INVALID_BODY", message: "Request body must be JSON with node_id" },
      { status: 400 }
    );
  }

  const { node_id } = body;
  if (!node_id || typeof node_id !== "string" || node_id.length < 6 || node_id.length > 64) {
    return Response.json(
      { error: "INVALID_NODE_ID", message: "node_id must be a string (6-64 chars)" },
      { status: 400 }
    );
  }

  const changes = removeUserAgentByNodeId(node_id);

  if (changes === 0) {
    return Response.json(
      { error: "NOT_FOUND", message: "Node not found in any account" },
      { status: 404 }
    );
  }

  return Response.json({ success: true, message: `Node ${node_id} unbound successfully.` });
}
