import { requireAuth } from "@/lib/auth-guard";
import { getHireRequestsByOwner } from "@/lib/db";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const requests = getHireRequestsByOwner(auth.userId);
  return Response.json({ requests });
}
