import { NextRequest } from "next/server";
import { getBindToken, useBindToken, addUserAgent } from "@/lib/db";
import { fetchRelayNode } from "@/lib/relay-api";

/**
 * POST /api/v2/dashboard/bind/claim
 * PUBLIC — no auth needed (the token IS the authentication).
 * Called by the agent (CLI or natural language) to claim a bind token.
 *
 * Body: { token: string, node_id: string }
 *
 * Flow:
 *   1. Validate token exists, not used, not expired
 *   2. Verify node_id exists on relay
 *   3. Mark token as used, link node_id to user
 *   4. Return success + node info
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; node_id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { error: "INVALID_BODY", message: "Request body must be JSON with token and node_id" },
      { status: 400 }
    );
  }

  const { token, node_id } = body;
  if (!token || !node_id) {
    return Response.json(
      { error: "MISSING_FIELDS", message: "Both token and node_id are required" },
      { status: 400 }
    );
  }

  // 1. Validate token
  const bt = getBindToken(token);
  if (!bt) {
    return Response.json(
      { error: "TOKEN_NOT_FOUND", message: "Bind token not found" },
      { status: 404 }
    );
  }
  if (bt.used) {
    return Response.json(
      { error: "TOKEN_USED", message: "This token has already been used" },
      { status: 409 }
    );
  }
  if (new Date(bt.expires_at) < new Date()) {
    return Response.json(
      { error: "TOKEN_EXPIRED", message: "This token has expired. Please generate a new one." },
      { status: 410 }
    );
  }

  // 2. Verify node exists on relay
  const node = await fetchRelayNode(node_id);
  if (!node) {
    return Response.json(
      { error: "NODE_NOT_FOUND", message: `Node ${node_id} not found on the relay. Make sure your agent is running.` },
      { status: 404 }
    );
  }

  // 3. Claim token + add agent to user
  const claimed = useBindToken(token, node_id);
  if (!claimed) {
    return Response.json(
      { error: "CLAIM_FAILED", message: "Failed to claim token. It may have expired or already been used." },
      { status: 409 }
    );
  }

  const agent = addUserAgent(bt.user_id, node_id, node.name);

  // 4. Return success
  return Response.json({
    success: true,
    message: `Agent "${node.name}" (${node_id}) has been bound to your account.`,
    agent: {
      node_id: agent.node_id,
      name: agent.name || node.name,
      status: node.status,
      skills: node.skills,
    },
  });
}
