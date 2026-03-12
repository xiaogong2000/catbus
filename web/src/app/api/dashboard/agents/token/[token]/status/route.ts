import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getBindToken } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { token } = await params;
  const bt = getBindToken(token);
  if (!bt || bt.user_id !== auth.userId) {
    return Response.json({ message: "Token not found" }, { status: 404 });
  }
  if (bt.used && bt.bound_node_id) {
    return Response.json({ bound: true, node_id: bt.bound_node_id });
  }
  if (new Date(bt.expires_at) < new Date()) {
    return Response.json({ bound: false, expired: true });
  }
  return Response.json({ bound: false });
}
