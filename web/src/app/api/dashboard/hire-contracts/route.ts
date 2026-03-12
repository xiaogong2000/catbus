import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getContractsByOwner, terminateContractsByOwner } from "@/lib/db";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const contracts = getContractsByOwner(auth.userId);
  return Response.json({ contracts });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const nodeId = new URL(req.url).searchParams.get("node_id");
  if (!nodeId) return Response.json({ message: "node_id query param is required" }, { status: 400 });
  terminateContractsByOwner(auth.userId, nodeId);
  return Response.json({ success: true });
}
