# CatBus Capability 设计文档

> 版本：v1.0
> 日期：2026-03-13
> 状态：方案定稿

---

## 一、核心概念

CatBus 网络上共享的不是"Skill"，而是**能力（Capability）**。

模型是一种能力，工具是一种能力，未来 GPU 算力、存储空间也是能力。用统一的 `type/name` 体系注册、发现、路由、计费。

```
capability = type/name

model/claude-sonnet-4      ← 大模型推理
skill/tavily               ← 工具调用
compute/gpu-4090           ← 算力（未来）
storage/vector-db          ← 存储（未来）
```

---

## 二、Capability 类型定义

### 2.1 model/ — 大模型推理

Provider 的大模型对外提供推理服务。Caller 发一段 prompt，Provider 的模型处理后返回结果。

```yaml
- type: model
  name: model/claude-sonnet-4
  handler: "gateway:default"
  meta:
    provider: anthropic         # 模型供应商
    context_window: 200000      # 上下文窗口
    strengths:                  # 擅长领域
      - code
      - analysis
      - writing
      - general
    cost_tier: medium           # 成本等级
```

**handler 统一为 `gateway:default`** — 把 prompt 转给本机 OpenClaw Agent，Agent 用自己配置的模型处理。

**已知模型列表：**

| name | provider | ctx | strengths | cost_tier |
|------|----------|-----|-----------|-----------|
| model/claude-opus-4 | Anthropic | 200K | code, analysis, writing, reasoning, general | premium |
| model/claude-sonnet-4 | Anthropic | 200K | code, analysis, writing, general | medium |
| model/claude-sonnet-4-5 | Anthropic | 200K | code, analysis, writing, general | medium |
| model/gpt-4o | OpenAI | 128K | vision, code, general | medium |
| model/gpt-4.1-mini | OpenAI | 128K | fast, general | low |
| model/gpt-5.4 | OpenAI | 128K | general | medium |
| model/deepseek-v3 | DeepSeek | 64K | code, chinese, general | low |
| model/deepseek-r1 | DeepSeek | 64K | reasoning, math | low |
| model/llama-3.3-70b | Meta | 128K | general | free |
| model/llama-3.1-8b | Meta | 128K | fast, general | free |
| model/gemini-2.5-pro | Google | 1M | long-context, general | medium |
| model/qwen-2.5 | Alibaba | 32K | chinese, general | low |

### 2.2 skill/ — 工具调用

现有的 Skill 体系，保持不变，加上 `skill/` 前缀。

```yaml
- type: skill
  name: skill/tavily
  handler: "shell:~/.openclaw/skills/tavily/search.sh"
  meta:
    category: search            # 所属分类
    description: "Web search via Tavily API"
    cost_tier: low
```

**Skill 分类（对应 110 个 Call 类）：**

| category | 说明 | 典型 skill |
|----------|------|-----------|
| search | 搜索查询 | tavily, google-search, news-search, academic-search |
| query | 数据查询 | weather, stock-price, exchange-rate, flight-tracker |
| ai-generate | AI 内容生成 | image-gen, tts-generate, music-generate |
| ai-audio | AI 音频处理 | whisper-api, voice-clone, audio-separate |
| ai-code | AI 代码 | coding-agent, code-reviewer |
| ai-text | AI 文本 | text-rewrite, text-summarize, document-translate |
| scraping | 网页抓取 | web-scraper, firecrawl, url-to-screenshot |
| marketing | 营销 | seo-analyzer, keyword-research, ad-copy-generator |
| finance | 金融 | stock-analysis, crypto-price, sec-filings |
| utility | 通用工具 | json-format, text-stats, echo, translate |

### 2.3 compute/ — 算力资源（未来）

Provider 提供 GPU/CPU 算力给 Caller 跑任务。

```yaml
# 未来实现
- type: compute
  name: compute/gpu-4090
  handler: "shell:catbus-gpu-worker"
  meta:
    gpu: "NVIDIA RTX 4090"
    vram: "24GB"
    cuda: "12.4"
    availability: idle          # idle / busy / scheduled
    cost_tier: premium
```

应用场景：Stable Diffusion 本地推理、模型微调、数据处理等。

### 2.4 storage/ — 存储资源（未来）

```yaml
# 未来实现
- type: storage
  name: storage/vector-db
  handler: "shell:catbus-storage-worker"
  meta:
    engine: "chromadb"
    capacity: "10GB"
    cost_tier: medium
```

### 2.5 agent/ — 完整 Agent 服务（未来）

不是单次推理，而是一个完整的 Agent 帮你执行多步任务。

```yaml
# 未来实现
- type: agent
  name: agent/research-agent
  handler: "gateway:research"
  meta:
    description: "Deep research agent with multi-step search and analysis"
    models: ["claude-sonnet-4"]
    skills: ["tavily", "firecrawl"]
    cost_tier: premium
```

---

## 三、config.yaml 格式

### 新格式

```yaml
# ~/.catbus/config.yaml

server: wss://relay.catbus.xyz
name: my-macbook-pro
port: 9800

capabilities:
  # 模型
  - type: model
    name: model/claude-sonnet-4
    handler: "gateway:default"
    meta:
      provider: anthropic
      context_window: 200000
      strengths: [code, analysis, writing, general]
      cost_tier: medium

  - type: model
    name: model/deepseek-v3
    handler: "gateway:default"
    meta:
      provider: local
      context_window: 64000
      strengths: [code, chinese, general]
      cost_tier: low

  # 工具
  - type: skill
    name: skill/tavily
    handler: "shell:~/.openclaw/skills/tavily/search.sh"
    meta:
      category: search
      cost_tier: low

  - type: skill
    name: skill/image-gen
    handler: "gateway:default"
    meta:
      category: ai-generate
      cost_tier: high

  # 内置
  - type: skill
    name: skill/echo
    handler: "python:catbus.builtin_skills.echo"
    meta:
      category: utility
      cost_tier: free

limits:
  max_calls_per_hour: 20
  max_tokens_per_day: 100000
  max_concurrent: 3
```

### 向后兼容

老格式的 `skills:` 字段自动转换：

```yaml
# 老格式（继续支持）
skills:
  - name: echo
    handler: "python:catbus.builtin_skills.echo"
    description: "Echo back input"

# 内部自动转为
capabilities:
  - type: skill
    name: skill/echo
    handler: "python:catbus.builtin_skills.echo"
    meta:
      category: utility
      cost_tier: free
```

转换逻辑：

```python
def migrate_config(config):
    if "skills" in config and "capabilities" not in config:
        capabilities = []
        for skill in config["skills"]:
            capabilities.append({
                "type": "skill",
                "name": f"skill/{skill['name']}",
                "handler": skill.get("handler", ""),
                "meta": {
                    "category": SKILL_DB.get(skill["name"], {}).get("category", "utility"),
                    "description": skill.get("description", ""),
                    "cost_tier": SKILL_DB.get(skill["name"], {}).get("cost_tier", "free"),
                }
            })
        config["capabilities"] = capabilities
    return config
```

---

## 四、注册协议

### REGISTER 消息

```json
{
  "type": "register",
  "node_id": "a1b2c3d4e5f6",
  "data": {
    "name": "my-macbook-pro",
    "capabilities": [
      {
        "type": "model",
        "name": "model/claude-sonnet-4",
        "meta": {
          "provider": "anthropic",
          "context_window": 200000,
          "strengths": ["code", "analysis", "writing", "general"],
          "cost_tier": "medium"
        }
      },
      {
        "type": "model",
        "name": "model/deepseek-v3",
        "meta": {
          "provider": "local",
          "context_window": 64000,
          "strengths": ["code", "chinese", "general"],
          "cost_tier": "low"
        }
      },
      {
        "type": "skill",
        "name": "skill/tavily",
        "meta": {
          "category": "search",
          "cost_tier": "low"
        }
      },
      {
        "type": "skill",
        "name": "skill/image-gen",
        "meta": {
          "category": "ai-generate",
          "cost_tier": "high"
        }
      }
    ],
    "limits": {
      "max_calls_per_hour": 20,
      "max_tokens_per_day": 100000,
      "max_concurrent": 3
    }
  }
}
```

### 向后兼容

老节点发送的 `skills: ["echo", "translate"]` 在 relay 端自动转为：

```python
def normalize_registration(data):
    if "capabilities" not in data and "skills" in data:
        data["capabilities"] = []
        for skill in data["skills"]:
            if isinstance(skill, str):
                data["capabilities"].append({
                    "type": "skill",
                    "name": f"skill/{skill}",
                    "meta": {}
                })
            elif isinstance(skill, dict):
                data["capabilities"].append({
                    "type": "skill",
                    "name": f"skill/{skill['name']}",
                    "meta": {
                        "description": skill.get("description", ""),
                    }
                })
    return data
```

---

## 五、调用协议

### REQUEST 消息

```json
{
  "type": "request",
  "node_id": "caller-node-id",
  "data": {
    "request_id": "req_001",
    "capability": "model/claude-sonnet-4",
    "input": {
      "prompt": "写一个 Python 爬虫抓取豆瓣 Top250"
    },
    "timeout_seconds": 60
  }
}
```

### 模糊匹配支持

| 请求的 capability | 匹配规则 |
|------------------|---------|
| `model/claude-sonnet-4` | 精确匹配 |
| `model/claude` | 匹配所有 Claude 系列（relay 选最佳） |
| `model/best` | 匹配 cost_tier 最高的模型 |
| `model/cheapest` | 匹配 cost_tier 最低的模型 |
| `model/any` | 匹配任意模型 |
| `skill/tavily` | 精确匹配 |
| `skill/search` | 匹配 category=search 的任意 skill |

### relay 匹配逻辑

```python
def find_providers(requested_capability):
    cap_type, cap_name = requested_capability.split("/", 1)
    
    candidates = []
    for node in online_nodes.values():
        for cap in node.capabilities:
            if cap["type"] != cap_type:
                continue
            
            # 精确匹配
            if cap["name"] == requested_capability:
                candidates.append((node, cap))
                continue
            
            # 模糊匹配
            if cap_type == "model":
                if cap_name == "best":
                    candidates.append((node, cap))  # 后续按 cost_tier 排序
                elif cap_name == "cheapest":
                    candidates.append((node, cap))
                elif cap_name == "any":
                    candidates.append((node, cap))
                elif cap["name"].startswith(f"model/{cap_name}"):
                    candidates.append((node, cap))
            
            elif cap_type == "skill":
                if cap.get("meta", {}).get("category") == cap_name:
                    candidates.append((node, cap))
    
    # 排序
    if cap_name == "best":
        tier_order = {"premium": 0, "high": 1, "medium": 2, "low": 3, "free": 4}
        candidates.sort(key=lambda x: tier_order.get(x[1].get("meta", {}).get("cost_tier", "free"), 5))
    elif cap_name == "cheapest":
        tier_order = {"free": 0, "low": 1, "medium": 2, "high": 3, "premium": 4}
        candidates.sort(key=lambda x: tier_order.get(x[1].get("meta", {}).get("cost_tier", "free"), 5))
    
    return candidates
```

### CLI 调用示例

```bash
# 精确调用 Claude Sonnet 4
catbus call model/claude-sonnet-4 -i '{"prompt": "写一个Python爬虫"}'

# 调用最强的模型（不管是什么）
catbus call model/best -i '{"prompt": "深度分析这份合同的法律风险"}'

# 调用最便宜的模型
catbus call model/cheapest -i '{"prompt": "帮我翻译这段话"}'

# 调用任意模型
catbus call model/any -i '{"prompt": "简单总结一下这篇文章"}'

# 调用 Claude 系列（具体版本由 relay 选）
catbus call model/claude -i '{"prompt": "代码审查"}'

# 调用工具
catbus call skill/tavily -i '{"query": "latest AI news"}'

# 调用搜索类工具（不指定具体哪个）
catbus call skill/search -i '{"query": "latest AI news"}'
```

---

## 六、Relay REST API 扩展

### 现有接口改造

```
GET /api/nodes
```

响应扩展 capabilities 字段：

```json
{
  "data": [
    {
      "node_id": "a1b2c3d4e5f6",
      "name": "my-macbook-pro",
      "status": "online",
      "capabilities": [
        { "type": "model", "name": "model/claude-sonnet-4", "meta": {...} },
        { "type": "skill", "name": "skill/tavily", "meta": {...} }
      ],
      "skills": ["claude-sonnet-4", "tavily"]  // 向后兼容
    }
  ]
}
```

### 新增接口

```
GET /api/capabilities
```

全网能力汇总：

```json
{
  "data": [
    {
      "name": "model/claude-sonnet-4",
      "type": "model",
      "providers": 3,
      "meta": {
        "provider": "anthropic",
        "context_window": 200000,
        "strengths": ["code", "analysis", "writing"],
        "cost_tier": "medium"
      }
    },
    {
      "name": "skill/tavily",
      "type": "skill",
      "providers": 5,
      "meta": {
        "category": "search",
        "cost_tier": "low"
      }
    }
  ],
  "summary": {
    "total_capabilities": 24,
    "models": 8,
    "skills": 14,
    "compute": 0,
    "storage": 0
  }
}
```

```
GET /api/capabilities/:type
```

按类型查询：

```bash
GET /api/capabilities/model     # 所有模型
GET /api/capabilities/skill     # 所有工具
GET /api/capabilities/compute   # 所有算力（未来）
```

```
GET /api/capabilities/:type/:name
```

单个能力详情：

```bash
GET /api/capabilities/model/claude-sonnet-4
```

```json
{
  "name": "model/claude-sonnet-4",
  "type": "model",
  "providers": [
    {
      "node_id": "a1b2c3d4e5f6",
      "name": "my-macbook-pro",
      "status": "online",
      "cost_tier": "medium",
      "success_rate": 97.5,
      "avg_latency_ms": 2300
    },
    {
      "node_id": "x9y8z7w6v5u4",
      "name": "gpu-beast",
      "status": "online",
      "cost_tier": "medium",
      "success_rate": 99.1,
      "avg_latency_ms": 1800
    }
  ],
  "meta": {
    "provider": "anthropic",
    "context_window": 200000,
    "strengths": ["code", "analysis", "writing", "general"]
  }
}
```

---

## 七、计费体系

不同类型的 capability 用不同的计费方式：

| type | 计费维度 | 说明 |
|------|---------|------|
| model/ | 按 token | input_tokens × rate + output_tokens × rate |
| skill/ | 按次 | 每次调用固定 Credits |
| compute/ | 按时间 | 秒 × GPU 级别费率（未来） |
| storage/ | 按容量 | GB × 月费率（未来） |
| agent/ | 按任务 | 复合定价，包含模型+工具成本（未来） |

### model/ 的 token 定价

```
cost_tier: free     → 0 Credits/1K tokens（本地模型）
cost_tier: low      → 1 Credit/1K tokens（DeepSeek 等）
cost_tier: medium   → 3 Credits/1K tokens（Claude Sonnet, GPT-4o）
cost_tier: high     → 5 Credits/1K tokens
cost_tier: premium  → 10 Credits/1K tokens（Claude Opus）
```

### skill/ 的按次定价

```
cost_tier: free     → 0 Credits
cost_tier: low      → 1 Credit/次（搜索、天气）
cost_tier: medium   → 5 Credits/次（语音转文字）
cost_tier: high     → 20 Credits/次（图片生成）
cost_tier: premium  → 50 Credits/次（视频生成）
```

---

## 八、Daemon 改动

### config.py

新增 Capability 数据结构：

```python
@dataclass
class CapabilityConfig:
    type: str           # "model" / "skill" / "compute" / ...
    name: str           # "model/claude-sonnet-4" / "skill/tavily"
    handler: str        # "gateway:default" / "python:xxx" / "shell:xxx"
    meta: dict = field(default_factory=dict)

@dataclass
class Config:
    node_id: str = ""
    node_name: str = ""
    server: str = DEFAULT_SERVER
    port: int = DEFAULT_PORT
    capabilities: list[CapabilityConfig] = field(default_factory=list)
    # 向后兼容
    skills: list[SkillConfig] = field(default_factory=list)
```

### executor.py

根据 capability type 选择执行方式：

```python
async def execute(self, capability_name: str, input_data: dict) -> ExecutionResult:
    cap_type, cap_name = capability_name.split("/", 1)
    
    # 找到对应的 handler
    cap = self.capabilities.get(capability_name)
    if not cap:
        return ExecutionResult(status="error", error=f"Unknown capability: {capability_name}")
    
    handler = cap.handler
    
    if handler.startswith("gateway:"):
        # 转给本机 OpenClaw Agent
        return await self._run_gateway(handler, input_data)
    elif handler.startswith("python:"):
        return await self._run_python(handler[7:], input_data)
    elif handler.startswith("shell:"):
        return await self._run_shell(handler[6:], input_data)
```

### catbus scan 改动

`catbus scan` 现在同时扫描模型和 Skill：

```python
def cmd_scan(args):
    # 扫描 OpenClaw skills（现有）
    skills = scan_openclaw_skills()
    
    # 扫描不碰任何文件
    # 模型信息由用户通过 catbus bind --models 或 Dashboard 提交
    
    capabilities = []
    
    for skill in skills:
        cap = {
            "type": "skill",
            "name": f"skill/{skill['name']}",
            "handler": skill.get("handler", "gateway:default"),
            "meta": {
                "category": SKILL_DB.get(skill["name"], {}).get("category", "utility"),
                "cost_tier": SKILL_DB.get(skill["name"], {}).get("cost_tier", "free"),
            }
        }
        capabilities.append(cap)
    
    if args.add:
        # 写入 config.yaml
        update_config_capabilities(capabilities)
        print(f"✅ Added {len(capabilities)} capabilities to config")
```

### catbus bind 改动

绑定时上报 capabilities 而不是分开的 models + skills：

```bash
catbus bind <token> --models "claude-sonnet-4,deepseek-v3" --skills "tavily,image-gen"
```

内部转换：

```python
def cmd_bind(args):
    capabilities = []
    
    if args.models:
        for model in args.models.split(","):
            model = model.strip()
            base = extract_base_model(model)
            info = MODEL_DB.get(base, {})
            capabilities.append({
                "type": "model",
                "name": f"model/{base or model}",
                "meta": {
                    "raw_name": model,
                    "provider": info.get("provider", "unknown"),
                    "context_window": info.get("context_window", 0),
                    "strengths": info.get("strengths", []),
                    "cost_tier": info.get("cost_tier", "medium"),
                }
            })
    
    if args.skills:
        for skill in args.skills.split(","):
            skill = skill.strip()
            info = SKILL_DB.get(skill, {})
            capabilities.append({
                "type": "skill",
                "name": f"skill/{skill}",
                "meta": {
                    "category": info.get("category", "utility"),
                    "cost_tier": info.get("cost_tier", "free"),
                    "shareable": info.get("shareable", True),
                }
            })
    
    payload = {
        "token": args.token,
        "node_id": node_id,
        "name": config.node_name,
        "capabilities": capabilities,
    }
    
    http_post("https://catbus.xyz/api/dashboard/agents/bind", payload)
```

---

## 九、第一单验证

### 浣浣的 config.yaml

```yaml
server: wss://relay.catbus.xyz
name: ge-ovh-test
port: 9800

capabilities:
  - type: model
    name: model/claude-sonnet-4
    handler: "gateway:default"
    meta:
      provider: anthropic
      context_window: 200000
      strengths: [code, analysis, writing, general]
      cost_tier: medium

  - type: skill
    name: skill/tavily
    handler: "gateway:default"
    meta:
      category: search
      cost_tier: low

  - type: skill
    name: skill/echo
    handler: "python:catbus.builtin_skills.echo"
    meta:
      category: utility
      cost_tier: free
```

### 小黑执行

```bash
# 调用浣浣的 Claude
catbus call model/claude-sonnet-4 -i '{"prompt": "写一个Python爬虫抓取豆瓣Top250，要求用requests+beautifulsoup"}'

# 对比：调用最便宜的模型
catbus call model/cheapest -i '{"prompt": "写一个Python爬虫抓取豆瓣Top250"}'

# 调用浣浣的 Tavily
catbus call skill/tavily -i '{"query": "latest AI agent news 2026"}'
```

### 成功标准

小黑发起 `catbus call model/claude-sonnet-4`，浣浣的 Claude 执行并返回结果。小黑本地没有 Claude，但通过 CatBus 用上了 Claude 的能力。

---

## 十、开发优先级

### Phase 1：capability 注册 + 模型调用跑通

```
□ config.py 支持 capabilities 字段（向后兼容 skills）
□ daemon REGISTER 消息发送 capabilities
□ relay 接收并存储 capabilities
□ relay find_providers 支持 type/name 匹配
□ executor 处理 model/ 类型（gateway:default）
□ catbus call 支持 type/name 格式
□ 浣浣配置 model/claude-sonnet-4 → 小黑调用 → 验证
```

### Phase 2：模糊匹配 + REST API

```
□ relay 支持 model/best、model/cheapest、model/any
□ relay 支持 skill/search 按 category 匹配
□ GET /api/capabilities 接口
□ GET /api/capabilities/:type 接口
□ GET /api/capabilities/:type/:name 接口
```

### Phase 3：计费

```
□ model/ 调用记录 input_tokens + output_tokens
□ Credits 按 cost_tier 计算
□ earnings 表记录每单收益
```

### Phase 4：扩展类型

```
□ compute/ 类型支持
□ storage/ 类型支持
□ agent/ 类型支持
```
