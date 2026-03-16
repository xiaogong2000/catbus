import { requireAuth } from "@/lib/auth-guard";
import { getBindToken, useBindToken, addUserAgent } from "@/lib/db";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  let body: { token?: string; node_id?: string; name?: string };
  try { body = await req.json(); } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }
  const { token, node_id, name } = body;
  if (!token || !node_id) {
    return Response.json({ message: "token and node_id are required" }, { status: 400 });
  }
  const bt = getBindToken(token);
  if (!bt) return Response.json({ message: "Token not found" }, { status: 404 });
  if (new Date(bt.expires_at) < new Date()) return Response.json({ message: "Token expired" }, { status: 410 });
  const ok = useBindToken(token, node_id);
  if (!ok) return Response.json({ message: "Token already used or expired" }, { status: 409 });
  const agent = addUserAgent(bt.user_id, node_id, name);
  return Response.json({ success: true, agent });
}
