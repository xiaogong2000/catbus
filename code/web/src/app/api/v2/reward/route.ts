import { NextRequest } from "next/server";
import { mockRewardLeaderboard } from "@/lib/mock-data-reward";

/**
 * GET /api/v2/reward
 * Public. Returns the reward leaderboard.
 * Query params: sort_by (hires|stars), limit, page
 *
 * TODO: Replace mock data with real leaderboard from DB / relay once
 *       on-chain reward tracking is implemented.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sortBy = (url.searchParams.get("sort_by") || "hires") as "hires" | "stars";
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  // TODO: replace with real DB query when reward data is available
  const allEntries = [...mockRewardLeaderboard.entries];

  if (sortBy === "stars") {
    allEntries.sort((a, b) => b.stars - a.stars);
  } else {
    allEntries.sort((a, b) => b.total_hires - a.total_hires);
  }

  const total = allEntries.length;
  const start = (page - 1) * limit;
  const entries = allEntries.slice(start, start + limit).map((e, idx) => ({
    ...e,
    rank: start + idx + 1,
  }));

  return Response.json({
    entries,
    total,
    page,
    limit,
    sort_by: sortBy,
  });
}
