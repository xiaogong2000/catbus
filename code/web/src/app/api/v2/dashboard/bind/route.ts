import { requireAuth } from "@/lib/auth-guard";
import { createBindToken } from "@/lib/db";

/**
 * POST /api/v2/dashboard/bind
 * Auth required. Creates a one-time bind token (valid 5 minutes).
 * The CatBus node uses this token to link itself to the user's account.
 */
export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const token = createBindToken(auth.userId);

  return Response.json({
    token: token.id,
    expires_at: token.expires_at,
  });
}
