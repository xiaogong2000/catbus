import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getHireConfig, upsertHireConfig, getUserAgents } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ nodeId: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { nodeId } = await params;
  const agents = getUserAgents(auth.userId);
  if (!agents.find(a => a.node_id === nodeId)) return Response.json({ message: "Agent not found" }, { status: 404 });
  const config = getHireConfig(nodeId);
  return Response.json({
    node_id: nodeId,
    available: config?.available === 1,
    price_per_call: config?.price_per_call ?? 0,
    max_concurrent: config?.max_concurrent ?? 1,
    skills: JSON.parse(config?.skills ?? "[]"),
    description: config?.description ?? null,
    updated_at: config?.updated_at ?? null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ nodeId: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { nodeId } = await params;
  const agents = getUserAgents(auth.userId);
  if (!agents.find(a => a.node_id === nodeId)) return Response.json({ message: "Agent not found" }, { status: 404 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({ message: "Invalid JSON" }, { status: 400 }); }
  const patch: Record<string, unknown> = {};
  if (body.available !== undefined) patch.available = body.available ? 1 : 0;
  if (body.price_per_call !== undefined) patch.price_per_call = Number(body.price_per_call);
  if (body.max_concurrent !== undefined) patch.max_concurrent = Number(body.max_concurrent);
  if (body.skills !== undefined) patch.skills = JSON.stringify(body.skills);
  if (body.description !== undefined) patch.description = body.description;
  const config = upsertHireConfig(auth.userId, nodeId, patch as Parameters<typeof upsertHireConfig>[2]);
  return Response.json({
    node_id: config.node_id,
    available: config.available === 1,
    price_per_call: config.price_per_call,
    max_concurrent: config.max_concurrent,
    skills: JSON.parse(config.skills),
    description: config.description,
    updated_at: config.updated_at,
  });
}
