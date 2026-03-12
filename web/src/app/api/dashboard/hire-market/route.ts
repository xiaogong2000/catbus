import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getAvailableHireConfigs } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const skill = searchParams.get("skill") ?? undefined;
  const { data, total } = getAvailableHireConfigs(page, limit, skill);
  return Response.json({
    data: data.map(c => ({
      node_id: c.node_id,
      available: c.available === 1,
      price_per_call: c.price_per_call,
      max_concurrent: c.max_concurrent,
      skills: JSON.parse(c.skills),
      description: c.description,
      updated_at: c.updated_at,
    })),
    total, page, limit,
  });
}
