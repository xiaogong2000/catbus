# Provider Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Provider functionality to the CatBus dashboard — upgraded bind flow with prompt copy mode, Provider config confirmation, and My Agents list extension with Provider badges.

**Architecture:** Extend existing dashboard with new TypeScript types for Provider entities (models, skills, hire config, earnings). Upgrade the bind-agent inline panel to a Dialog with two phases: prompt-copy + polling, then Provider config confirmation. Add provider-config API functions and mock data for development.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, TypeScript, Lucide React icons, existing design tokens.

---

## File Structure

```
src/lib/
  provider-types.ts          # NEW — All Provider-related TypeScript interfaces
  dashboard-api.ts           # MODIFY — Add Provider/Hire Market/Earnings API functions, wire token binding to real endpoints
  mock-data-provider.ts      # NEW — Mock data for Provider features (models, skills, earnings, leaderboard)

src/components/provider/
  bind-agent-dialog.tsx       # NEW — Full-screen Dialog: Step 1 prompt copy → Step 2 Provider config confirm
  prompt-copy-box.tsx         # NEW — Reusable prompt display + copy button component
  model-list.tsx              # NEW — Checkbox list of parsed models
  skill-list.tsx              # NEW — Checkbox list of shareable/filtered skills with categories
  provider-config-form.tsx    # NEW — Combines model-list + skill-list + hire settings

src/app/dashboard/
  agents/page.tsx             # MODIFY — Use new Dialog, add Provider badge to agent cards
  layout.tsx                  # MODIFY — Add Earnings sidebar link

src/lib/i18n.ts               # MODIFY — Add new translation keys for Provider features
```

---

## Chunk 1: Types + API Layer + Mock Data

### Task 1: Provider TypeScript Types

**Files:**
- Create: `src/lib/provider-types.ts`

- [ ] **Step 1: Create provider-types.ts with all Provider interfaces**

```typescript
// Provider config types (from catbus-provider-requirements-v3)
export interface ParsedModel {
  id: string;           // "claude-sonnet-4"
  raw: string;          // "amazon-bedrock/global.anthropic.claude-sonnet-4-6"
  provider: string;     // "Anthropic"
  context_window: number;
  strengths: string[];
}

export interface ShareableSkill {
  name: string;
  category: string;
  cost_level: "free" | "low" | "medium" | "high";
  display?: string;
}

export interface FilteredSkill {
  name: string;
  reason: string;
}

export interface ProviderConfig {
  models: ParsedModel[];
  skills: {
    shareable: ShareableSkill[];
    filtered: FilteredSkill[];
  };
  hire_config: HireConfig;
}

export interface HireConfig {
  hireable: boolean;
  allowed_skills: string[];
  rate_limit: number;
  price_per_call: number;
  description: string;
}

export interface SaveProviderConfigRequest {
  models: string[];        // selected model IDs
  skills: string[];        // selected skill names
  hire_config: {
    hireable: boolean;
    rate_limit: number;
    price_per_call: number;
    description: string;
  };
}

// Extended bind status response (with provider_config)
export interface BindStatusResponse {
  bound: boolean;
  agent?: import("@/lib/mock-data-dashboard").Agent;
  provider_config?: {
    models: ParsedModel[];
    skills: {
      shareable: ShareableSkill[];
      filtered: FilteredSkill[];
    };
  };
}

// Hire Market types
export interface HireMarketItem {
  node_id: string;
  name: string;
  owner_name: string;
  status: "online" | "offline";
  allowed_skills: string[];
  rate_limit: number;
  price_per_call: number;
  description: string;
  total_hirers: number;
}

export interface HireMarketResponse {
  data: HireMarketItem[];
  total: number;
  page: number;
  limit: number;
}

// Hire request types
export type RequestStatus = "pending" | "approved" | "rejected" | "expired";
export type ContractStatus = "active" | "terminated";

export interface MyHireRequest {
  id: string;
  target_node_id: string;
  target_name: string;
  target_owner_name: string;
  message: string;
  status: RequestStatus;
  requested_at: string;
  responded_at: string | null;
}

export interface IncomingHireRequest {
  id: string;
  requester_name: string;
  target_node_id: string;
  target_name: string;
  message: string;
  status: RequestStatus;
  requested_at: string;
}

export interface HiredAgentFull {
  contract_id: string;
  node_id: string;
  name: string;
  owner_name: string;
  skills: string[];
  status: "online" | "offline";
  rate_limit: number;
  price_per_call: number;
  hired_at: string;
  expires_at: string | null;
  total_calls: number;
}

export interface HireContract {
  id: string;
  hirer_name: string;
  node_id: string;
  allowed_skills: string[];
  rate_limit: number;
  price_per_call: number;
  status: ContractStatus;
  hired_at: string;
  expires_at: string | null;
  total_calls: number;
  total_cost: number;
}

// Earnings types
export interface EarningsOverview {
  today: { credits: number; tasks: number };
  this_week: { credits: number; tasks: number };
  this_month: { credits: number; tasks: number };
  total: { credits: number; tasks: number };
}

export interface EarningRecord {
  id: string;
  created_at: string;
  task_type: "model" | "skill";
  task_detail: string;
  model_used?: string;
  skill_used?: string;
  tokens_consumed: number;
  credits_earned: number;
  caller_name: string;
}

export interface EarningsHistoryResponse {
  data: EarningRecord[];
  total: number;
  page: number;
  limit: number;
}

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  node_id: string;
  name: string;
  top_model: string;
  total_tasks: number;
  success_rate: number;
  total_credits: number;
}

export interface LeaderboardResponse {
  providers: LeaderboardEntry[];
  my_rank: number | null;
  my_stats: {
    total_tasks: number;
    success_rate: number;
    total_credits: number;
  } | null;
}

// Extended DashboardStats (adds earnings fields)
export interface DashboardStatsExtended {
  my_agents: number;
  my_skills: number;
  calls_received: number;
  calls_made: number;
  avg_latency_ms: number;
  success_rate: number;
  today_earnings?: number;
  today_tasks?: number;
  total_credits?: number;
  provider_rank?: number | null;
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npx tsc --noEmit src/lib/provider-types.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/provider-types.ts
git commit -m "feat: add Provider TypeScript type definitions"
```

---

### Task 2: Mock Data for Provider Features

**Files:**
- Create: `src/lib/mock-data-provider.ts`

- [ ] **Step 1: Create mock-data-provider.ts**

Mock data for:
- `mockProviderConfig` — 4 models (Claude Sonnet 4, Opus 4, GPT 5.4, GPT 4.1 Mini) + 5 shareable skills + 4 filtered skills
- `mockBindStatusWithProvider` — Simulates the extended bind response
- `mockBindPromptTemplate(token)` — Returns the prompt text for the bind dialog

Use realistic data matching the spec examples. Models should have proper provider names, context windows, and strengths. Skills should have categories and cost levels from the SKILL_DB in the requirements doc.

- [ ] **Step 2: Commit**

```bash
git add src/lib/mock-data-provider.ts
git commit -m "feat: add Provider mock data for development"
```

---

### Task 3: Extend dashboard-api.ts

**Files:**
- Modify: `src/lib/dashboard-api.ts`

- [ ] **Step 1: Wire token binding to real API endpoints (replace stubs)**

Replace the `generateBindToken()` stub with:
```typescript
export async function generateBindToken(): Promise<BindToken> {
  return dashFetch<BindToken>("/agents/token", { method: "POST" });
}
```

Replace the `checkBindTokenStatus()` stub with:
```typescript
export async function checkBindTokenStatus(token: string): Promise<BindStatusResponse> {
  return dashFetch<BindStatusResponse>(`/agents/token/${token}/status`);
}
```

Import `BindStatusResponse` from `provider-types.ts`.

For now, the real API may not be deployed yet. Add a fallback: if the fetch fails with a network error, fall back to mock data so the UI can still be developed. Use a pattern like:

```typescript
export async function generateBindToken(): Promise<BindToken> {
  try {
    return await dashFetch<BindToken>("/agents/token", { method: "POST" });
  } catch {
    // Fallback to mock for development
    const token = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    return { token, expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() };
  }
}
```

- [ ] **Step 2: Add Provider Config API functions**

```typescript
// GET /api/dashboard/agents/:nodeId/provider-config
export async function getProviderConfig(nodeId: string): Promise<ProviderConfig> { ... }

// POST /api/dashboard/agents/:nodeId/provider-config
export async function saveProviderConfig(nodeId: string, config: SaveProviderConfigRequest): Promise<{ success: boolean }> { ... }
```

With mock fallbacks for development.

- [ ] **Step 3: Add Hire Market API functions**

```typescript
// GET /api/dashboard/hire-market
export async function getHireMarket(params?: { page?: number; limit?: number; skill?: string; search?: string }): Promise<HireMarketResponse> { ... }

// POST /api/dashboard/hired/request
export async function createHireRequest(nodeId: string, message?: string): Promise<{ request: { id: string; target_node_id: string; status: "pending"; requested_at: string } }> { ... }

// GET /api/dashboard/hired/requests
export async function getMyHireRequests(status?: string): Promise<{ requests: MyHireRequest[] }> { ... }

// GET /api/dashboard/hired (full version)
export async function getHiredAgentsFull(): Promise<{ agents: HiredAgentFull[] }> { ... }

// DELETE /api/dashboard/hired/:contractId
export async function terminateHire(contractId: string): Promise<{ success: boolean }> { ... }
```

- [ ] **Step 4: Add Agent Owner (hire management) API functions**

```typescript
// GET /api/dashboard/hire-config/:nodeId
export async function getHireConfig(nodeId: string): Promise<HireConfig> { ... }

// PATCH /api/dashboard/hire-config/:nodeId
export async function updateHireConfig(nodeId: string, config: Partial<HireConfig>): Promise<{ success: boolean }> { ... }

// GET /api/dashboard/hire-requests
export async function getIncomingHireRequests(status?: string, nodeId?: string): Promise<{ requests: IncomingHireRequest[]; pending_count: number }> { ... }

// PATCH /api/dashboard/hire-requests/:requestId
export async function respondToHireRequest(requestId: string, action: "approve" | "reject", options?: { allowed_skills?: string[]; rate_limit?: number; expires_at?: string | null }): Promise<{ success: boolean }> { ... }

// GET /api/dashboard/hire-contracts
export async function getHireContracts(nodeId?: string): Promise<{ contracts: HireContract[] }> { ... }

// DELETE /api/dashboard/hire-contracts/:contractId
export async function terminateContract(contractId: string): Promise<{ success: boolean }> { ... }
```

- [ ] **Step 5: Add Earnings + Leaderboard API functions (stub for Phase 2/3)**

```typescript
export async function getEarnings(): Promise<EarningsOverview> { ... }
export async function getEarningsHistory(params?: { page?: number; limit?: number }): Promise<EarningsHistoryResponse> { ... }
export async function getLeaderboard(limit?: number): Promise<LeaderboardResponse> { ... }
```

These return mock data for now.

- [ ] **Step 6: Verify build passes**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npm run build`

- [ ] **Step 7: Commit**

```bash
git add src/lib/dashboard-api.ts
git commit -m "feat: add Provider/Hire/Earnings API functions with mock fallbacks"
```

---

## Chunk 2: Provider UI Components

### Task 4: prompt-copy-box Component

**Files:**
- Create: `src/components/provider/prompt-copy-box.tsx`

- [ ] **Step 1: Create prompt-copy-box.tsx**

A reusable component that displays a block of text (the prompt to copy to Agent) with a copy button.

Props:
```typescript
interface PromptCopyBoxProps {
  text: string;
  className?: string;
}
```

UI:
- Dark background (`bg-[hsl(0_0%_4%)]`), border, rounded-lg
- `font-mono` text, `text-[13px]`, `whitespace-pre-wrap`
- Top-right "Copy" button that changes to "Copied!" for 2s (reuse pattern from agents/page.tsx)
- Use `navigator.clipboard.writeText(text)`

- [ ] **Step 2: Commit**

```bash
git add src/components/provider/prompt-copy-box.tsx
git commit -m "feat: add PromptCopyBox component"
```

---

### Task 5: model-list Component

**Files:**
- Create: `src/components/provider/model-list.tsx`

- [ ] **Step 1: Create model-list.tsx**

Displays a list of parsed models with checkboxes.

Props:
```typescript
interface ModelListProps {
  models: ParsedModel[];
  selected: Set<string>;       // model IDs
  onToggle: (id: string) => void;
}
```

UI per row:
- Checkbox (custom styled) + Model name (`text-[14px] font-semibold`) + Provider name + Context window (e.g. "200K ctx")
- Use existing design token colors
- Checkbox: `w-4 h-4 rounded border border-border` + checked state with `bg-primary`

- [ ] **Step 2: Commit**

```bash
git add src/components/provider/model-list.tsx
git commit -m "feat: add ModelList component with checkboxes"
```

---

### Task 6: skill-list Component

**Files:**
- Create: `src/components/provider/skill-list.tsx`

- [ ] **Step 1: Create skill-list.tsx**

Displays shareable and filtered skills in two sections.

Props:
```typescript
interface SkillListProps {
  shareable: ShareableSkill[];
  filtered: FilteredSkill[];
  selected: Set<string>;
  onToggle: (name: string) => void;
}
```

UI:
- **Shareable section**: header "SHAREABLE SKILLS", each row: checkbox + skill name + category badge + cost level badge
- **Filtered section**: header "FILTERED (not suitable for sharing)", each row: unchecked/disabled checkbox + skill name + reason text in text-muted
- Cost level badges: `low` = success color, `medium` = warning color, `high` = danger color
- Category as small text-dim label

- [ ] **Step 2: Commit**

```bash
git add src/components/provider/skill-list.tsx
git commit -m "feat: add SkillList component with categories and cost badges"
```

---

### Task 7: provider-config-form Component

**Files:**
- Create: `src/components/provider/provider-config-form.tsx`

- [ ] **Step 1: Create provider-config-form.tsx**

Combines ModelList + SkillList + Hire Settings form. Used both in the bind dialog confirmation step and the standalone Provider config page (future).

Props:
```typescript
interface ProviderConfigFormProps {
  models: ParsedModel[];
  skills: { shareable: ShareableSkill[]; filtered: FilteredSkill[] };
  onSave: (config: SaveProviderConfigRequest) => void;
  onSkip?: () => void;          // "Skip for now" button (optional)
  saving?: boolean;
}
```

Internal state:
- `selectedModels: Set<string>` — initialized with all model IDs
- `selectedSkills: Set<string>` — initialized with all shareable skill names
- `hireable: boolean` — default true
- `rateLimit: number` — default 20
- `pricePerCall: number` — default 0
- `description: string` — default ""

UI sections:
1. **MODELS** — `<ModelList>`
2. **SKILLS** — `<SkillList>`
3. **HIRE SETTINGS** — Toggle for hireable, Input for rate limit, Input for price, Input for description
4. **Actions** — "Save & Start Earning" (primary) + "Skip for now" (ghost, if onSkip provided)

Hire settings inputs use existing `<Input>` component with type="number" where appropriate.

- [ ] **Step 2: Commit**

```bash
git add src/components/provider/provider-config-form.tsx
git commit -m "feat: add ProviderConfigForm combining models, skills, and hire settings"
```

---

### Task 8: bind-agent-dialog Component

**Files:**
- Create: `src/components/provider/bind-agent-dialog.tsx`

- [ ] **Step 1: Create bind-agent-dialog.tsx**

A Dialog with two phases:
- **Phase 1 (Prompt + Polling)**: Generate token → show prompt with PromptCopyBox → countdown timer → poll status
- **Phase 2 (Provider Config)**: Show bound agent info + ProviderConfigForm → save or skip

Props:
```typescript
interface BindAgentDialogProps {
  open: boolean;
  onClose: () => void;
  onAgentBound: (agent: Agent) => void;  // callback when binding complete (to refresh agent list)
}
```

Phase 1 UI (reuse logic from current agents/page.tsx binding panel):
- Title: "Bind Your Agent"
- Subtitle: "Copy & paste to your OpenClaw Agent"
- PromptCopyBox with the full prompt text (from `mockBindPromptTemplate(token)`)
- Below: countdown timer + "Waiting for agent..." spinner
- Token expired state with "Regenerate" button
- Cancel button

Phase 2 UI (shown after `bound: true`):
- Title changes to "Agent Bound Successfully!"
- Show agent name + node_id
- ProviderConfigForm with data from `provider_config` in the bind status response
- "Save & Start Earning" calls `saveProviderConfig` API
- "Skip for now" closes dialog

Key logic:
- Use `generateBindToken()` on open
- Poll `checkBindTokenStatus(token)` every 3s
- When `bound: true` + has `provider_config`: transition to Phase 2
- When `bound: true` + no `provider_config`: close dialog, call `onAgentBound`

**Important**: The Dialog component needs `max-w-2xl` (wider than default `max-w-lg`) since the Provider config form has tables.

- [ ] **Step 2: Commit**

```bash
git add src/components/provider/bind-agent-dialog.tsx
git commit -m "feat: add BindAgentDialog with prompt-copy and Provider config phases"
```

---

## Chunk 3: Page Integration + i18n

### Task 9: Update Agents Page

**Files:**
- Modify: `src/app/dashboard/agents/page.tsx`

- [ ] **Step 1: Replace inline binding panel with BindAgentDialog**

Remove the entire inline binding panel (lines ~27-222 in current code — all the token/bind state, handleGenerate, copyCommand, the Card-based panel JSX).

Replace with:
```typescript
import { BindAgentDialog } from "@/components/provider/bind-agent-dialog";

// In component:
const [bindOpen, setBindOpen] = useState(false);

function handleAgentBound(agent: Agent) {
  setAgents((prev) => [...prev, agent]);
  setBindOpen(false);
}

// In JSX:
<BindAgentDialog open={bindOpen} onClose={() => setBindOpen(false)} onAgentBound={handleAgentBound} />
```

- [ ] **Step 2: Add Provider badge to agent cards**

In the agent card rendering (the `agents.map(...)` section), add a Provider badge after the skills row. For now, show it on all agents (since we don't have real provider status yet — can be refined later when API returns this info):

```tsx
{/* Provider badge placeholder — will be conditional when API returns provider status */}
<div className="flex items-center gap-2 mt-2">
  <span className="text-[11px] font-semibold uppercase tracking-wider text-success bg-success/10 border border-success/20 rounded-full px-2.5 py-0.5">
    Provider
  </span>
  <span className="text-[12px] text-text-muted">20 calls/hr · Free</span>
</div>
```

- [ ] **Step 3: Verify build**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/agents/page.tsx
git commit -m "feat: upgrade agent binding to Dialog with Provider config flow"
```

---

### Task 10: Add Earnings Sidebar Link

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Add Earnings link to sidebar navigation**

Import `Coins` from lucide-react. Add entry to `sidebarLinks` array after "Hired":

```typescript
{ key: "dash.sidebar.earnings", href: "/dashboard/earnings", icon: Coins },
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat: add Earnings link to dashboard sidebar"
```

---

### Task 11: Add i18n Translation Keys

**Files:**
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add English translation keys**

Add to the `en` translations object:
```typescript
// Provider / Bind Dialog
"dash.provider.bindTitle": "Bind Your Agent",
"dash.provider.bindSubtitle": "Copy & paste the prompt below to your OpenClaw Agent",
"dash.provider.copyPrompt": "Copy to Clipboard",
"dash.provider.waiting": "Waiting for agent to complete binding...",
"dash.provider.tokenExpires": "Token expires in",
"dash.provider.tokenExpired": "Token expired. Please regenerate.",
"dash.provider.regenerate": "Regenerate",
"dash.provider.boundSuccess": "Agent Bound Successfully!",
"dash.provider.nodeLabel": "Node",
"dash.provider.idLabel": "ID",

// Provider Config
"dash.provider.models": "Models",
"dash.provider.shareableSkills": "Shareable Skills",
"dash.provider.filteredSkills": "Filtered (not suitable for sharing)",
"dash.provider.hireSettings": "Hire Settings",
"dash.provider.acceptHiring": "Accept hiring",
"dash.provider.rateLimit": "Rate limit (calls/hour)",
"dash.provider.pricePerCall": "Price per call (Credits)",
"dash.provider.description": "Service description",
"dash.provider.saveAndStart": "Save & Start Earning",
"dash.provider.skipForNow": "Skip for now",

// Cost levels
"dash.provider.costFree": "Free",
"dash.provider.costLow": "Low cost",
"dash.provider.costMedium": "Medium cost",
"dash.provider.costHigh": "High cost",

// Sidebar
"dash.sidebar.earnings": "Earnings",
```

- [ ] **Step 2: Add zh-CN translations**

```typescript
"dash.provider.bindTitle": "绑定你的智能体",
"dash.provider.bindSubtitle": "将下面的提示词复制发给你的 OpenClaw Agent",
"dash.provider.copyPrompt": "复制到剪贴板",
"dash.provider.waiting": "等待智能体完成绑定...",
"dash.provider.tokenExpires": "令牌过期倒计时",
"dash.provider.tokenExpired": "令牌已过期，请重新生成。",
"dash.provider.regenerate": "重新生成",
"dash.provider.boundSuccess": "智能体绑定成功！",
"dash.provider.nodeLabel": "节点",
"dash.provider.idLabel": "ID",
"dash.provider.models": "模型",
"dash.provider.shareableSkills": "可共享技能",
"dash.provider.filteredSkills": "已过滤（不适合共享）",
"dash.provider.hireSettings": "雇佣设置",
"dash.provider.acceptHiring": "接受雇佣",
"dash.provider.rateLimit": "调用上限（次/小时）",
"dash.provider.pricePerCall": "每次价格（Credits）",
"dash.provider.description": "服务说明",
"dash.provider.saveAndStart": "保存并开始接单",
"dash.provider.skipForNow": "稍后设置",
"dash.provider.costFree": "免费",
"dash.provider.costLow": "低成本",
"dash.provider.costMedium": "中成本",
"dash.provider.costHigh": "高成本",
"dash.sidebar.earnings": "收益",
```

- [ ] **Step 3: Add zh-TW and ja translations**

Follow the same pattern, translating to Traditional Chinese and Japanese.

- [ ] **Step 4: Verify build**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat: add i18n translations for Provider features (4 languages)"
```

---

## Chunk 4: Verification + Placeholder Pages

### Task 12: Create Earnings Placeholder Page

**Files:**
- Create: `src/app/dashboard/earnings/page.tsx`

- [ ] **Step 1: Create minimal earnings page**

A placeholder page with PageHeader and "Coming soon" message, so the sidebar link doesn't 404:

```tsx
export default function EarningsPage() {
  return (
    <>
      <PageHeader eyebrow="Dashboard" title="Earnings" description="Track your Provider earnings and Credits." />
      <Card hoverable={false} className="py-16 text-center">
        <Coins size={40} className="text-text-muted mx-auto mb-4" />
        <p className="text-[16px] font-semibold text-text mb-2">Coming Soon</p>
        <p className="text-[13px] text-text-muted">Provider earnings tracking will be available shortly.</p>
      </Card>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/earnings/page.tsx
git commit -m "feat: add Earnings placeholder page"
```

---

### Task 13: Full Build + Visual Verification

- [ ] **Step 1: Run full build**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npm run build`

Fix any TypeScript or build errors.

- [ ] **Step 2: Run dev server and verify**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npm run dev`

Check:
1. `/dashboard/agents` — "Bind Agent" button opens the new Dialog
2. Dialog shows prompt copy box with token
3. Agent cards display correctly (Provider badge visible)
4. Sidebar shows "Earnings" link
5. `/dashboard/earnings` — Shows placeholder page

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve build issues from Provider Phase 1"
```

---

## Summary

| Task | Component | Est. Complexity |
|------|-----------|-----------------|
| 1 | provider-types.ts | Low |
| 2 | mock-data-provider.ts | Low |
| 3 | dashboard-api.ts extensions | Medium |
| 4 | prompt-copy-box.tsx | Low |
| 5 | model-list.tsx | Low |
| 6 | skill-list.tsx | Low-Medium |
| 7 | provider-config-form.tsx | Medium |
| 8 | bind-agent-dialog.tsx | Medium-High |
| 9 | agents/page.tsx update | Medium |
| 10 | layout.tsx sidebar | Low |
| 11 | i18n translations | Medium (volume) |
| 12 | earnings placeholder | Low |
| 13 | Build verification | Low |

**Total: 13 tasks across 4 chunks.**
