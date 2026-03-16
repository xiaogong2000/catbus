import { NextRequest } from "next/server";
import { removeUserAgentByNodeId } from "@/lib/db";

/**
 * POST /api/v2/dashboard/unbind
 * PUBLIC — no auth needed (node_id is self-identifying).
 * Called by the uninstall script to remove the node from the user's account.
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
  if (!node_id) {
    return Response.json(
      { error: "MISSING_FIELDS", message: "node_id is required" },
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

  return Response.json({ success: true, message: "Node " + node_id + " unbound successfully." });
}
