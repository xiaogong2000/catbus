# Network Globe Visualization Design

**Date:** 2026-03-12
**Status:** Approved
**Goal:** Replace the current table-based Network Overview page with an immersive 3D globe visualization showing real-time agent nodes, communication arcs, and live activity.

---

## Architecture Overview

The Network page (`/network`) will render a full-screen 3D globe using `react-globe.gl` (Three.js-based). Agent nodes appear as pulsing orange dots. Communication between agents is visualized as animated arc lines. Floating glass panels overlay the globe with stats, skills, and activity data.

### Component Tree

```
NetworkPage
├── GlobeContainer (full viewport, react-globe.gl)
│   ├── pointsData → Agent nodes (orange dots, sized by skills count)
│   ├── arcsData → Active call connections (orange→green gradient)
│   ├── ringsData → Online pulse ripples
│   └── pointLabel → Hover tooltip (HTML)
├── FloatingHeader (top-left: title + description)
├── FloatingStats (top-right: Online / Skills / Calls / Latency)
├── FloatingTopSkills (bottom-left: glass panel)
├── FloatingActivity (bottom-right: glass panel, live event feed)
└── Node positioning layer (deterministic hash → lat/lng)
```

### Data Flow

```
1. Initial load:
   API: getStats() + getNodes() + getSkills()
        ↓
   Position nodes: hashNodePosition(node_id) → {lat, lng}
        ↓
   Transform to globe layers:
     - pointsData: [{lat, lng, size, color, label, nodeId, status, skills}]
     - ringsData: [{lat, lng}] (online agents)

2. Polling (every 10s):
   For each online node: getNodeCalls(nodeId, {limit: 5})
        ↓
   Diff with previous call set → detect new calls
        ↓
   New calls → add to arcsData (auto-expire after 10s)
   Status changes → update activity feed

3. User interaction:
   Hover → HTML tooltip (name, status, skills count)
   Click → router.push('/network/nodes/{id}')
   Drag → control rotation
```

---

## Node Positioning

### Dual Strategy: GeoIP (preferred) + Hash Fallback

The `ApiNode` interface is being extended with a `connected_from` IP field (request sent to backend team — see `workspace/shared/relay-api-request-geoip-2026-03-12.md`).

**Primary: GeoIP Resolution** (when `connected_from` is available)

```typescript
// 1. Collect IPs from nodes that have connected_from
const ipsToResolve = nodes
  .filter(n => n.connected_from)
  .map(n => n.connected_from);

// 2. Check sessionStorage cache
const cached = JSON.parse(sessionStorage.getItem("catbus-geoip-cache") || "{}");
const uncached = ipsToResolve.filter(ip => !cached[ip]);

// 3. Batch query ip-api.com (free tier: 45 req/min, 100 IPs/batch)
if (uncached.length > 0) {
  const res = await fetch("http://ip-api.com/batch", {
    method: "POST",
    body: JSON.stringify(uncached.map(ip => ({ query: ip }))),
  });
  const results = await res.json();
  // Merge into cache: { "203.104.52.17": { lat: 35.67, lng: 139.65, city: "Tokyo" } }
  for (const r of results) {
    if (r.status === "success") {
      cached[r.query] = { lat: r.lat, lng: r.lon, city: r.city, country: r.country };
    }
  }
  sessionStorage.setItem("catbus-geoip-cache", JSON.stringify(cached));
}

// 4. Return position for each node
return cached[node.connected_from] ?? hashNodePosition(node.node_id);
```

**Fallback: Deterministic Hash** (when `connected_from` is null or GeoIP fails)

```typescript
function hashNodePosition(nodeId: string): { lat: number; lng: number } {
  let h1 = 0, h2 = 0;
  for (let i = 0; i < nodeId.length; i++) {
    h1 = (h1 * 31 + nodeId.charCodeAt(i)) & 0x7fffffff;
    h2 = (h2 * 37 + nodeId.charCodeAt(i)) & 0x7fffffff;
  }
  const lat = (h1 / 0x7fffffff) * 110 - 50;  // -50° to 60°
  const lng = (h2 / 0x7fffffff) * 360 - 180;  // -180° to 180°
  return { lat, lng };
}
```

**Priority order**: `connected_from` GeoIP → sessionStorage cache → hash fallback. The positioning logic is encapsulated in `globe-data.ts` — switching between strategies requires no component changes.

---

## Globe Configuration

### Visual Style

| Property | Value |
|----------|-------|
| Globe texture | NASA night Earth (`earth-night.jpg` from jsdelivr CDN) |
| Background | Starfield image (`night-sky.png` from jsdelivr CDN) |
| Atmosphere | Enabled, `color: "rgba(60, 140, 255, 0.15)"` |
| Background color | `#050510` (near-black with blue tint) |
| Auto-rotate | `true`, speed `0.3` |
| Initial POV | `{ lat: 20, lng: 10, altitude: 2.5 }` |

### Node Points Layer

```typescript
pointsData={agentNodes}
pointLat="lat"
pointLng="lng"
pointAltitude={d => d.status === "online" ? 0.01 : 0.005}
pointRadius={d => Math.max(0.15, Math.sqrt(d.skills.length) * 0.2)}
pointColor={d => d.status === "online"
  ? "rgba(255, 165, 0, 0.85)"
  : "rgba(100, 100, 100, 0.4)"}
pointLabel={d => tooltipHTML(d)}
onPointClick={d => router.push(`/network/nodes/${d.nodeId}`)}
```

- **Online agents**: bright orange, with pulsing ring animation
- **Offline agents**: gray, smaller, no animation
- **Size**: scales with `skills.length` (min 0.15°, max ~0.6°)
- **Label**: agent name displayed next to node (via `pointLabel`)

### Arc Lines Layer (Communication)

```typescript
arcsData={recentArcs}
arcStartLat="srcLat"
arcStartLng="srcLng"
arcEndLat="dstLat"
arcEndLng="dstLng"
arcColor={d => ["rgba(255, 165, 0, 0.6)", "rgba(74, 222, 128, 0.6)"]}
arcDashLength={0.4}
arcDashGap={0.2}
arcDashAnimateTime={1500}
arcStroke={0.5}
arcsTransitionDuration={500}
```

- Arcs appear when a new call is detected via polling
- Color gradient: orange (source) → green (destination)
- Dashed animated line flowing from source to destination
- Auto-expire: arcs removed from `arcsData` after 10 seconds via `setTimeout`
- **Data source**: For each online node, poll `getNodeCalls(nodeId, { limit: 5 })` every 10s. Diff with previous results to detect new calls. Map `remote_node` to its position via the same hash function.

### Ring Ripples Layer (Online Events)

```typescript
ringsData={recentlyOnline}
ringLat="lat"
ringLng="lng"
ringColor={() => t => `rgba(255, 165, 0, ${1 - t})`}
ringMaxRadius={3}
ringPropagationSpeed={2}
ringRepeatPeriod={2000}
```

- All online agents get rings on initial load (visual splash effect)
- On subsequent polls, only newly online agents get rings
- Rings auto-removed after 30 seconds

---

## Floating UI Panels

All floating panels use glass morphism: `background: rgba(0,0,0,0.55)`, `backdrop-filter: blur(16px)`, `border: 1px solid rgba(255,255,255,0.06)`, `border-radius: 10px`.

### Top-Left: Title

```
NETWORK (eyebrow, uppercase tracking)
Network Overview (h1, bold)
Real-time agent network activity (subtitle, muted)
```

Uses existing i18n keys: `network.eyebrow`, `network.title`, `network.desc`.

### Top-Right: Stats Row

Four stat numbers displayed inline, from `getStats()`:
- **Online**: green (`#4ade80`), `stats.online_nodes`
- **Skills**: white, `stats.total_skills`
- **Calls**: amber (`#f59e0b`), `stats.calls_today`
- **Avg Latency**: green, `stats.avg_latency_ms` + `ms`

### Bottom-Left: Top Skills Panel

Glass card showing top 5 skills from `getSkills()`:
- Skill name (monospace)
- Provider count (`skill.providers`)
- "View all →" link to `/network/skills`

### Bottom-Right: Live Activity Panel

Glass card showing last ~5 events:
- Green dot + text: agent came online (detected by status change between polls)
- Red dot + text: agent went offline
- Orange dot + text: skill call detected (`skill_name → remote_node`)
- Relative timestamp (`2s`, `15s`, `1m`)

**Event detection logic:**
```typescript
// Compare previous nodeMap with current
for (const node of currentNodes) {
  const prev = prevNodeMap.get(node.node_id);
  if (!prev && node.status === "online") addEvent("online", node);
  if (prev?.status === "offline" && node.status === "online") addEvent("online", node);
  if (prev?.status === "online" && node.status === "offline") addEvent("offline", node);
}
// New calls from polling
for (const call of newCalls) {
  addEvent("call", { skill: call.skill, remote: call.remote_node });
}
```

Events are kept in a ring buffer of max 20 items, displayed as last 5.

---

## File Structure

```
src/
  components/network/
    network-globe.tsx        # NEW — Globe wrapper (react-globe.gl + all data layers)
    floating-stats.tsx       # NEW — Top-right stats overlay
    floating-activity.tsx    # NEW — Bottom-right live activity panel
    floating-skills.tsx      # NEW — Bottom-left top skills panel
  lib/
    globe-data.ts            # NEW — hashNodePosition, transformNodesForGlobe, buildArcsFromCalls
  app/network/
    page.tsx                 # MODIFY — Replace current content with globe layout
```

---

## i18n Keys

New keys needed (4 languages: en, zh-CN, zh-TW, ja):

```
network.globe.liveActivity    — "Live Activity" / "实时动态" / "即時動態" / "ライブ活動"
network.globe.topSkills       — "Top Skills" / "热门技能" / "熱門技能" / "トップスキル"
network.globe.providers       — "providers" / "提供者" / "提供者" / "プロバイダー"
network.globe.cameOnline      — "came online" / "上线" / "上線" / "オンライン"
network.globe.wentOffline     — "went offline" / "离线" / "離線" / "オフライン"
network.globe.callTo          — "→" (no translation needed)
network.globe.clickToView     — "Click to view details" / "点击查看详情" / "點擊查看詳情" / "詳細を表示"
network.globe.viewAll         — "View all →" / "查看全部 →" / "查看全部 →" / "すべて表示 →"
```

---

## Performance Considerations

1. **Dynamic import**: `react-globe.gl` loaded via `next/dynamic` with `ssr: false` (WebGL requires browser)
2. **Loading state**: Show a centered spinner + "Loading globe..." text while WebGL initializes
3. **Mobile** (`< md` / 768px): Reduce globe altitude to 3.5, hide bottom panels, show only stats overlay
4. **Polling**: Activity feed and arcs poll `getNodeCalls` every 10s. Only poll online nodes (skip offline). Max 10 concurrent requests.
5. **Arc cleanup**: Each arc has a `createdAt` timestamp. A `setInterval(1000)` removes arcs older than 10s to prevent memory leaks.
6. **Node limit**: react-globe.gl handles hundreds of points efficiently; no concern at current scale

---

## Existing Pages Impact

- `/network` (this page): **Replaced** with globe visualization
- `/network/nodes`: **Unchanged** — list view of all nodes
- `/network/nodes/[id]`: **Unchanged** — node detail page (globe click navigates here)
- `/network/skills`: **Unchanged** — skills list page
- `/network/skills/[name]`: **Unchanged** — skill detail page

---

## Dependencies

```json
{
  "react-globe.gl": "^2.27",
  "three": ">=0.154"
}
```

`three` is a peer dependency of react-globe.gl. Both are production-grade, well-maintained. Bundle impact: ~150KB gzipped for three.js (loaded only on `/network` page via dynamic import).
