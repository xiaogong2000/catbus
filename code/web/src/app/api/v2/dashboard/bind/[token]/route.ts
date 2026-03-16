import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getBindToken } from "@/lib/db";

/**
 * GET /api/v2/dashboard/bind/:token
 * Auth required. Polls the status of a bind token.
 * Returns whether it has been claimed, expired, or is still pending.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { token } = await params;
  const bt = getBindToken(token);

  if (!bt || bt.user_id !== auth.userId) {
    return Response.json(
      { error: "NOT_FOUND", message: "Token not found" },
      { status: 404 }
    );
  }

  if (bt.used && bt.bound_node_id) {
    return Response.json({
      status: "bound",
      bound: true,
      node_id: bt.bound_node_id,
      expires_at: bt.expires_at,
    });
  }

  if (new Date(bt.expires_at) < new Date()) {
    return Response.json({
      status: "expired",
      bound: false,
      expired: true,
      expires_at: bt.expires_at,
    });
  }

  return Response.json({
    status: "pending",
    bound: false,
    expired: false,
    expires_at: bt.expires_at,
  });
}
