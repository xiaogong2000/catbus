# CatBus 前端 Skills/Capabilities 接口文档

> 日期：2026-03-14
> 状态：已上线

## GET /api/v2/network/skills

列表接口，返回全网所有 capabilities（skill + model 合并）。

**Query 参数：**
- `type` — "skill" / "model" / "all"（默认 all）
- `limit` — 最大数量，默认 200，上限 500

**Response：**
```json
{
  "data": [
    { "type": "skill", "name": "skill/tavily", "providers": 1, "meta": { "category": "search", "cost_tier": "low" } },
    { "type": "model", "name": "model/claude-sonnet-4", "providers": 2, "meta": { "provider": "anthropic", "context_window": 200000, "cost_tier": "medium" } }
  ],
  "total": 6,
  "summary": { "total": 6, "models": 1, "skills": 5 }
}
```

## GET /api/v2/network/skills/:name

单个 capability 详情 + 提供节点列表。
name 需 encodeURIComponent（如 `model%2Fclaude-sonnet-4`）。

**Response：**
```json
{
  "name": "tavily",
  "description": "Web search via Tavily API",
  "input_schema": { "query": "string" },
  "providers": [{ "node_id": "a635df65", "name": "ge-ovh-test", "status": "online" }],
  "calls_total": 42,
  "avg_latency_ms": 1200
}
```

## TypeScript 类型建议

```typescript
// 当前（需扩展）
export interface ApiSkill {
  name: string;
  description: string;
  providers: number;
}

// 建议改成
export interface ApiCapability {
  type: "skill" | "model" | "compute" | "storage";
  name: string;
  providers: number;
  meta: {
    description?: string;
    category?: string;
    cost_tier?: string;
    provider?: string;
    context_window?: number;
    strengths?: string[];
  };
}
```

## 前端待改项

1. `ApiSkill` → `ApiCapability`（src/lib/api.ts）
2. `SkillCard` 组件支持 type=model（加图标、显示 cost_tier）
3. `/network/skills` 页面加 All / Models / Skills 筛选 Tab
4. floating-stats.tsx 已改用 `total_capabilities` ✅
