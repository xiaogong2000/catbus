import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getEarningsHistory, getEarningsAggregated } from "@/lib/db";

/**
 * GET /api/v2/dashboard/earnings/history
 * Auth required. Returns paginated earnings history + aggregated totals.
 * Query params: page, limit
 *
 * TODO: Earnings history is stubbed (returns empty data).
 *       Populate once the earnings/tasks tracking table is implemented.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));

  const result = getEarningsHistory(auth.userId, page, limit);
  const aggregated = getEarningsAggregated(auth.userId);

  return Response.json({
    data: result.data,
    total: result.total,
    page,
    limit,
    aggregated,
  });
}
