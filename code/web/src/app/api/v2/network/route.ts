const RELAY_URL = process.env.RELAY_API_URL || "https://relay.catbus.xyz/api";
const RELAY_TIMEOUT = 5000;

async function relayFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${RELAY_URL}${path}`, {
    signal: AbortSignal.timeout(RELAY_TIMEOUT),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Relay ${res.status}`);
  return res.json();
}

// Server-side GeoIP cache (in-memory, survives across requests within same process)
const geoCache = new Map<string, { lat: number; lng: number; city?: string; country?: string }>();

async function resolveGeoIPs(ips: string[]): Promise<void> {
  const unknown = [...new Set(ips.filter((ip) => ip && !geoCache.has(ip)))];
  if (unknown.length === 0) return;

  try {
    const res = await fetch("http://ip-api.com/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(unknown.map((ip) => ({ query: ip }))),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      for (const r of data) {
        if (r.status === "success") {
          geoCache.set(r.query, { lat: r.lat, lng: r.lon, city: r.city, country: r.country });
        }
      }
    }
  } catch {
    // GeoIP service unavailable, nodes will have null geo
  }
}

/**
 * GET /api/v2/network
 * Public. Returns global network stats + online node list (with geo) + skills.
 * Query params: nodes_limit (default 100, max 200), skills_limit (default 200)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const nodesLimit = Math.min(200, Math.max(1, Number(url.searchParams.get("nodes_limit")) || 100));
  const skillsLimit = Math.min(200, Math.max(1, Number(url.searchParams.get("skills_limit")) || 200));

  try {
    const [stats, nodesPage, skillsPage] = await Promise.all([
      relayFetch<Record<string, unknown>>("/stats"),
      relayFetch<{ data: Array<Record<string, unknown>>; total: number }>(`/nodes?page=1&limit=${nodesLimit}`),
      relayFetch<{ data: Array<Record<string, unknown>>; total: number }>(`/skills?page=1&limit=${skillsLimit}`),
    ]);

    // Resolve GeoIP for all node IPs server-side
    const nodeIPs = nodesPage.data
      .map((n) => n.connected_from as string)
      .filter(Boolean);
    await resolveGeoIPs(nodeIPs);

    return Response.json({
      stats: {
        online_nodes: stats.online_nodes ?? 0,
        total_skills: stats.total_skills ?? 0,
        total_capabilities: stats.total_capabilities ?? 0,
        calls_today: stats.calls_today ?? 0,
        calls_total: stats.calls_total ?? 0,
        avg_latency_ms: stats.avg_latency_ms ?? 0,
        uptime_seconds: stats.uptime_seconds ?? 0,
      },
      nodes: nodesPage.data.map((n) => {
        const ip = n.connected_from as string | undefined;
        const geo = ip ? geoCache.get(ip) : undefined;
        return {
          node_id: n.node_id,
          name: n.name,
          skills: n.skills,
          status: n.status,
          uptime_seconds: n.uptime_seconds ?? 0,
          connected_at: n.connected_at ?? null,
          last_heartbeat: n.last_heartbeat ?? null,
          connected_from: n.connected_from ?? null,
          geo: geo ? { lat: geo.lat, lng: geo.lng, city: geo.city, country: geo.country } : null,
        };
      }),
      skills: skillsPage.data.map((s) => {
        const name = (s.name as string) || "";
        const inferredType = name.startsWith("model/") ? "model" : "skill";
        const meta = (s.meta as Record<string, unknown>) || {};
        return {
          type: (s.type as string) || inferredType,
          name,
          description: (s.description as string) || (meta.description as string) || "",
          providers: s.providers,
          meta: {
            description: (meta.description as string) || (s.description as string) || "",
            category: (meta.category as string) || undefined,
            cost_tier: (meta.cost_tier as string) || undefined,
            provider: (meta.provider as string) || undefined,
            context_window: (meta.context_window as number) || undefined,
            strengths: (meta.strengths as string[]) || undefined,
          },
        };
      }),
    });
  } catch (err) {
    console.error("[v2/network] relay error:", err);
    return Response.json(
      { error: "SERVICE_UNAVAILABLE", message: "Relay service unavailable" },
      { status: 503 }
    );
  }
}
