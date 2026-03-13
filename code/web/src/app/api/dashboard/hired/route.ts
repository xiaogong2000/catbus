import { requireAuth } from "@/lib/auth-guard";
import { getContractsByRequester } from "@/lib/db";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const contracts = getContractsByRequester(auth.userId);
  return Response.json({ contracts });
}
