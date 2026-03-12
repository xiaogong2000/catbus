# 缺失的后端 API 接口

> 以下接口前端已写好调用代码（dashboard-api.ts），但后端尚未实现，当前使用 mock 数据。

## 1. Provider Config（Provider 配置）

### GET /api/dashboard/agents/:nodeId/provider-config
- **用途**：获取 Agent 的 Provider 配置（可用模型、技能、雇佣设置）
- **返回**：
```json
{
  "models": [{ "id": "claude-sonnet-4", "raw": "...", "provider": "Anthropic", "context_window": 200000, "strengths": ["coding"] }],
  "skills": {
    "shareable": [{ "name": "web_search", "category": "Information", "cost_level": "low" }],
    "filtered": [{ "name": "file_system_access", "reason": "Security risk" }]
  },
  "hire_config": { "hireable": true, "allowed_skills": [...], "rate_limit": 20, "price_per_call": 0, "description": "" }
}
```
- **触发时机**：Agent 绑定成功后（bind status 返回 provider_config），以及 Agent 详情页编辑配置时

### POST /api/dashboard/agents/:nodeId/provider-config
- **用途**：保存 Provider 配置（用户选择的模型、技能、雇佣设置）
- **请求体**：
```json
{
  "models": ["claude-sonnet-4", "gpt-5.4"],
  "skills": ["web_search", "code_review"],
  "hire_config": { "hireable": true, "rate_limit": 20, "price_per_call": 0, "description": "..." }
}
```
- **返回**：`{ "success": true }`

---

## 2. Earnings（收益）

### GET /api/dashboard/earnings
- **用途**：获取收益概览
- **返回**：
```json
{
  "today": { "credits": 12.5, "tasks": 8 },
  "this_week": { "credits": 87.3, "tasks": 52 },
  "this_month": { "credits": 342.1, "tasks": 198 },
  "total": { "credits": 1250.8, "tasks": 743 }
}
```

### GET /api/dashboard/earnings/history?page=1&limit=20
- **用途**：获取收益明细记录
- **返回**：
```json
{
  "data": [{
    "id": "earn-001",
    "created_at": "2026-03-12T...",
    "task_type": "model" | "skill",
    "task_detail": "Code generation with Claude Sonnet 4",
    "model_used": "claude-sonnet-4",
    "skill_used": null,
    "tokens_consumed": 2400,
    "credits_earned": 1.2,
    "caller_name": "agent-xyz"
  }],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

## 3. Leaderboard（排行榜）

### GET /api/dashboard/leaderboard?limit=20
- **用途**：获取 Provider 排行榜
- **返回**：
```json
{
  "providers": [{
    "rank": 1,
    "node_id": "node-top1",
    "name": "Alpha Provider",
    "top_model": "claude-opus-4",
    "total_tasks": 1520,
    "success_rate": 99.2,
    "total_credits": 4580.5
  }],
  "my_rank": 12,
  "my_stats": { "total_tasks": 198, "success_rate": 96.4, "total_credits": 342.1 }
}
```

---

## 优先级

| 优先级 | 接口 | 原因 |
|--------|------|------|
| P1 | provider-config | 绑定流程核心，目前 Phase 2 配置无法真正保存 |
| P1 | earnings + history | 页面已上线但数据全是 mock |
| P2 | leaderboard | 页面即将上线，目前用 mock |
