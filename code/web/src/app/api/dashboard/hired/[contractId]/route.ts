import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { terminateContract } from "@/lib/db";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { contractId } = await params;
  const ok = terminateContract(contractId, auth.userId);
  if (!ok) return Response.json({ message: "Contract not found or already terminated" }, { status: 404 });
  return Response.json({ success: true });
}
