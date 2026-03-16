// Demo route — copy this to route.ts on the demo server
import { DEMO_NODES, DEMO_SKILLS, DEMO_STATS } from "./mock-demo-data";

export async function GET() {
  return Response.json({
    stats: DEMO_STATS,
    nodes: DEMO_NODES.map((n) => ({
      node_id: n.node_id,
      name: n.name,
      skills: n.skills,
      status: n.status,
      uptime_seconds: n.uptime_seconds,
      connected_at: n.connected_at,
      last_heartbeat: n.last_heartbeat,
      connected_from: n.connected_from,
      geo: n.geo,
    })),
    skills: DEMO_SKILLS,
  });
}
