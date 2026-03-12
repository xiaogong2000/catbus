import { requireAuth } from "@/lib/auth-guard";
import { getHireRequestsByRequester } from "@/lib/db";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const requests = getHireRequestsByRequester(auth.userId);
  return Response.json({ requests });
}
