# Provider Failover Skill

自动检测 LLM Provider 健康状态，故障时自动切换并通知主人。

## 功能

1. **健康检查** — 定期探测各 provider endpoint
2. **自动切换** — 主 provider 连续失败时，自动切换到备用
3. **通知** — 每次切换后通过 Telegram 通知主人

## 使用方法

### 手动检查
```bash
# 检查所有 provider 状态
node skills/provider-failover/check-providers.js --status

# 强制切换到指定 provider
node skills/provider-failover/check-providers.js --switch azure-claude/claude-opus-4-5

# 标记 provider 失败（用于 500 错误等场景）
node skills/provider-failover/check-providers.js --mark-failed newcli/claude-opus-4-6

# 清除手动覆盖标记（允许自动切回）
node skills/provider-failover/check-providers.js --clear-override
```

### 自动检查（通过 OpenClaw cron）
已配置 cron job，每 30 分钟检查一次。

## Provider 列表

| Provider | Model | 线路组 | 优先级 |
|----------|-------|--------|--------|
| azure-claude | claude-opus-4-5 | azure | 1 (主) |
| newcli | claude-opus-4-6 | newcli | 2 |
| openai | gpt-5-mini | openai | 3 |
| newcli-aws | claude-opus-4-5 | newcli | 4 |
| newcli-codex | gpt-5.2 | newcli | 5 |
| newcli-gemini | gemini-2.5-pro | newcli | 6 |

**三条独立线路：**
- **azure** — Azure Claude（主力）
- **newcli** — newcli 全系列（Claude/GPT/Gemini 代理）
- **openai** — OpenAI 官方 API

切换时优先选不同线路组，避免同线路内切换。

## 配置

状态文件：`skills/provider-failover/state.json`
- 记录各 provider 的连续失败次数
- 记录上次检查时间
- 记录当前 primary
- `manualOverride` 标记（手动切换后设为 true，防止自动切回）

## 切换阈值

- 连续失败 2 次触发切换
- 切换后重置失败计数
- 手动切换后设置 `manualOverride=true`，禁止自动切回
- 清除覆盖：`node check-providers.js --clear-override`

## Cron Job

已配置每 30 分钟自动检查（通过 OpenClaw cron）：
- Job ID: `0b7fa3d4-060c-4e56-ab32-9ffb7be2200b`
- 名称: Provider 健康检查
- 间隔: 30 分钟

## Telegram 通知

切换时自动发送 Telegram 通知到 chat_id `1149648904`
需要设置环境变量 `TELEGRAM_BOT_TOKEN`
