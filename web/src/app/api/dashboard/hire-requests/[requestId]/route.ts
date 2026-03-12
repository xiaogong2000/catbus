import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { updateHireRequestStatus, createHireContract } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { requestId } = await params;
  let body: { action?: "approve" | "reject" };
  try { body = await req.json(); } catch { return Response.json({ message: "Invalid JSON" }, { status: 400 }); }
  if (!body.action || !["approve", "reject"].includes(body.action)) {
    return Response.json({ message: "action must be approve or reject" }, { status: 400 });
  }
  const status = body.action === "approve" ? "approved" as const : "rejected" as const;
  const updated = updateHireRequestStatus(requestId, auth.userId, status);
  if (!updated) return Response.json({ message: "Request not found or not authorized" }, { status: 404 });
  let contract = null;
  if (body.action === "approve") {
    contract = createHireContract(requestId, updated.requester_id, updated.node_id, auth.userId);
  }
  return Response.json({ request: updated, contract });
}
