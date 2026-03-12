import { requireAuth } from "@/lib/auth-guard";
import { getHireConfig, createHireRequest } from "@/lib/db";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  let body: { node_id?: string; message?: string };
  try { body = await req.json(); } catch { return Response.json({ message: "Invalid JSON" }, { status: 400 }); }
  if (!body.node_id) return Response.json({ message: "node_id is required" }, { status: 400 });
  const config = getHireConfig(body.node_id);
  if (!config || config.available !== 1) return Response.json({ message: "Agent is not available for hire" }, { status: 404 });
  const request = createHireRequest(auth.userId, body.node_id, config.user_id, body.message);
  return Response.json(request, { status: 201 });
}
