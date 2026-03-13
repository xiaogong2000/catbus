import { requireAuth } from "@/lib/auth-guard";
import { createBindToken } from "@/lib/db";

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const token = createBindToken(auth.userId);
  return Response.json({ token: token.id, expires_at: token.expires_at });
}
