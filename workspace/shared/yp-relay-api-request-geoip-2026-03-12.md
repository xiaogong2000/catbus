# Relay API 需求：节点 IP 地址字段

> 日期：2026-03-12
> 优先级：**P1**（前端 Network Globe 可视化依赖此字段）
> 请求方：前端
> 改动量：**极小** — 在 `/nodes` 响应中新增一个字段

---

## 背景

前端正在将 Network Overview 页面升级为 **3D Globe 可视化**（react-globe.gl），需要将每个 Agent 节点标注在全球地图上。前端通过 GeoIP 服务将 IP 地址解析为经纬度坐标。

**当前问题**：`GET /api/nodes` 返回的 `ApiNode` 没有 IP 地址字段，前端无法做 GeoIP 定位。

---

## 需求

在 `GET /api/nodes` 的响应中，为每个节点新增 `connected_from` 字段：

### 当前响应格式

```json
{
  "data": [
    {
      "node_id": "agent-alpha",
      "name": "Alpha",
      "skills": ["web_search", "code_review"],
      "uptime_seconds": 3600,
      "status": "online"
    }
  ]
}
```

### 期望响应格式

```json
{
  "data": [
    {
      "node_id": "agent-alpha",
      "name": "Alpha",
      "skills": ["web_search", "code_review"],
      "uptime_seconds": 3600,
      "status": "online",
      "connected_from": "203.104.52.17"
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必须 | 说明 |
|------|------|------|------|
| `connected_from` | `string \| null` | 否 | 节点连接时的客户端 IP 地址。离线节点可返回上次连接的 IP 或 `null`。 |

---

## 实现建议

Relay 服务器在 WebSocket/HTTP 连接建立时已知客户端 IP：

**Node.js (Express/WS):**
```javascript
// WebSocket
const ip = ws._socket.remoteAddress;

// Express
const ip = req.ip || req.connection.remoteAddress;
```

**Python (FastAPI):**
```python
ip = request.client.host
```

存储到内存中的节点数据结构即可（不需要持久化）：

```javascript
// 节点注册/心跳时记录
nodes.set(nodeId, {
  ...nodeData,
  connected_from: clientIP,
});
```

在 `GET /nodes` 响应时把 `connected_from` 一并返回。

---

## 前端使用方式

前端拿到 IP 后，通过免费 GeoIP API 批量解析为坐标：

```
POST http://ip-api.com/batch
[
  {"query": "203.104.52.17"},
  {"query": "51.75.146.33"}
]

→ [
  {"lat": 35.6762, "lon": 139.6503, "city": "Tokyo", "country": "Japan"},
  {"lat": 48.8566, "lon": 2.3522, "city": "Paris", "country": "France"}
]
```

- 免费限额：45 次/分钟（批量接口一次最多 100 个 IP）
- 前端做 `sessionStorage` 缓存，同一 IP 不重复查
- GeoIP 失败时前端有 fallback（基于 node_id hash 的确定性位置）

---

## 兼容性

- `connected_from` 是 **可选字段**（`string | null`）
- 前端已做兜底：如果字段不存在或为 null，自动退回 hash 定位
- **不会 break 任何现有功能**
- 后端随时可以加，前端随时可以用

---

## 同时影响的接口

如果方便，以下接口也可以加上 `connected_from`（低优先级）：

| 接口 | 用途 |
|------|------|
| `GET /api/nodes/:nodeId` | 节点详情页显示地理位置 |
| `GET /api/dashboard/agents` | Dashboard Agent 列表显示位置 |

---

## 时间线

- **前端**：已经在开发 Globe 可视化，目前用 hash 定位作为兜底
- **后端**：随时可以加，加了之后前端自动切换为真实 GeoIP 定位
- 没有硬性 deadline，但**越早加效果越好**
