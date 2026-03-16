# Reward Leaderboard & Rating System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public Reward leaderboard page with podium-style top 3 and sortable table, plus a rating system (stars/rotten tomatoes) triggered on contract termination in Dashboard.

**Architecture:** New `/reward` page in top nav (public, no auth required). Rating data stored via API with mock fallback. Rating dialog appears when user terminates a contract in Dashboard Hired page. Past ratings editable from a new "My Ratings" section in Dashboard Hired. Types, mock data, and API layer added following existing patterns.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind CSS v4, Lucide icons, existing i18n system (4 languages), existing Card/Badge/Button/Skeleton components.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/reward-types.ts` | Types for reward leaderboard + rating |
| Create | `src/lib/mock-data-reward.ts` | Mock data for reward rankings |
| Modify | `src/lib/dashboard-api.ts` | Add reward + rating API functions |
| Create | `src/app/reward/page.tsx` | Public reward leaderboard page |
| Create | `src/components/reward/podium.tsx` | Top 3 podium component |
| Create | `src/components/reward/reward-table.tsx` | Ranking table for #4+ |
| Create | `src/components/reward/rating-dialog.tsx` | Star/tomato rating modal |
| Modify | `src/app/dashboard/hired/page.tsx` | Add rating on terminate + My Ratings tab |
| Modify | `src/components/layout/nav-bar.tsx` | Add "Reward" to top nav |
| Modify | `src/lib/i18n.ts` | Add i18n keys for all 4 languages |

---

## Chunk 1: Types, Mock Data & API Layer

### Task 1: Define reward & rating types

**Files:**
- Create: `src/lib/reward-types.ts`

- [ ] **Step 1: Create reward types file**

```typescript
// src/lib/reward-types.ts

export interface RewardEntry {
  rank: number;
  node_id: string;
  name: string;
  owner_name: string;
  model_id: string;           // primary model
  status: "online" | "offline";
  total_hires: number;
  stars: number;              // good ratings count
  tomatoes: number;           // bad ratings count
  success_rate: number;
  price_per_call: number;
}

export interface RewardLeaderboardResponse {
  entries: RewardEntry[];
  total: number;
  sort_by: "hires" | "stars";
}

export type RatingType = "star" | "tomato";

export interface Rating {
  id: string;
  contract_id: string;
  target_node_id: string;
  target_name: string;
  rating: RatingType;
  comment: string;
  created_at: string;
  updated_at: string;
}

export interface MyRatingsResponse {
  ratings: Rating[];
}
```

- [ ] **Step 2: Verify file created with no TS errors**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npx tsc --noEmit src/lib/reward-types.ts 2>&1 | head -20`

### Task 2: Create mock data for reward leaderboard

**Files:**
- Create: `src/lib/mock-data-reward.ts`

- [ ] **Step 1: Create mock data file**

```typescript
// src/lib/mock-data-reward.ts
import type { RewardLeaderboardResponse, MyRatingsResponse } from "./reward-types";

export const mockRewardLeaderboard: RewardLeaderboardResponse = {
  entries: [
    { rank: 1, node_id: "node-sakura", name: "sakura-agent", owner_name: "yuki_dev", model_id: "claude-sonnet-4", status: "online", total_hires: 142, stars: 128, tomatoes: 3, success_rate: 99.1, price_per_call: 2 },
    { rank: 2, node_id: "node-baker", name: "baker-street", owner_name: "sherlock", model_id: "gpt-5.4", status: "online", total_hires: 87, stars: 72, tomatoes: 5, success_rate: 98.2, price_per_call: 3 },
    { rank: 3, node_id: "node-verde", name: "verde-ai", owner_name: "green_labs", model_id: "gpt-4.1-mini", status: "offline", total_hires: 63, stars: 51, tomatoes: 8, success_rate: 95.7, price_per_call: 1 },
    { rank: 4, node_id: "node-bay", name: "bay-coder", owner_name: "sf_tech", model_id: "claude-opus-4", status: "online", total_hires: 58, stars: 45, tomatoes: 6, success_rate: 96.4, price_per_call: 3 },
    { rank: 5, node_id: "node-gateway", name: "gateway-india", owner_name: "mumbai_ai", model_id: "gemini-2.5-pro", status: "online", total_hires: 45, stars: 38, tomatoes: 2, success_rate: 97.8, price_per_call: 2 },
    { rank: 6, node_id: "node-manhattan", name: "manhattan-node", owner_name: "nyc_dev", model_id: "gpt-5.4", status: "offline", total_hires: 39, stars: 30, tomatoes: 4, success_rate: 94.2, price_per_call: 5 },
    { rank: 7, node_id: "node-euro", name: "euro-relay", owner_name: "berlin_ops", model_id: "claude-haiku-4", status: "online", total_hires: 31, stars: 25, tomatoes: 3, success_rate: 92.6, price_per_call: 1 },
    { rank: 8, node_id: "node-tokyo", name: "tokyo-bridge", owner_name: "jp_cloud", model_id: "deepseek-v3", status: "online", total_hires: 28, stars: 22, tomatoes: 1, success_rate: 98.9, price_per_call: 4 },
    { rank: 9, node_id: "node-sydney", name: "sydney-hub", owner_name: "au_labs", model_id: "claude-sonnet-4", status: "online", total_hires: 22, stars: 18, tomatoes: 2, success_rate: 96.1, price_per_call: 2 },
    { rank: 10, node_id: "node-nordic", name: "nordic-frost", owner_name: "oslo_tech", model_id: "gpt-5.4", status: "offline", total_hires: 18, stars: 14, tomatoes: 0, success_rate: 97.3, price_per_call: 3 },
  ],
  total: 10,
  sort_by: "hires",
};

export const mockMyRatings: MyRatingsResponse = {
  ratings: [
    {
      id: "rating-001",
      contract_id: "contract-abc",
      target_node_id: "node-sakura",
      target_name: "sakura-agent",
      rating: "star",
      comment: "Excellent service, very fast responses",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
    {
      id: "rating-002",
      contract_id: "contract-def",
      target_node_id: "node-manhattan",
      target_name: "manhattan-node",
      rating: "tomato",
      comment: "Frequent timeouts",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    },
  ],
};
```

### Task 3: Add API functions for reward & rating

**Files:**
- Modify: `src/lib/dashboard-api.ts`

- [ ] **Step 1: Add imports at top of dashboard-api.ts**

Add to imports:
```typescript
import type {
  RewardLeaderboardResponse,
  Rating,
  RatingType,
  MyRatingsResponse,
} from "./reward-types";
import {
  mockRewardLeaderboard,
  mockMyRatings,
} from "./mock-data-reward";
```

- [ ] **Step 2: Add reward & rating API functions at end of file**

```typescript
// ─── Reward Leaderboard (public) ───

export async function getRewardLeaderboard(params?: {
  sort_by?: "hires" | "stars";
  limit?: number;
}): Promise<RewardLeaderboardResponse> {
  try {
    const qs = new URLSearchParams();
    if (params?.sort_by) qs.set("sort_by", params.sort_by);
    if (params?.limit) qs.set("limit", String(params.limit));
    return await dashFetch<RewardLeaderboardResponse>(`/reward?${qs.toString()}`);
  } catch {
    // Return mock sorted by requested field
    const sorted = [...mockRewardLeaderboard.entries].sort((a, b) =>
      params?.sort_by === "stars" ? b.stars - a.stars : b.total_hires - a.total_hires
    );
    return {
      entries: sorted.map((e, i) => ({ ...e, rank: i + 1 })),
      total: sorted.length,
      sort_by: params?.sort_by || "hires",
    };
  }
}

// ─── Ratings ───

export async function submitRating(
  contractId: string,
  rating: RatingType,
  comment?: string,
): Promise<{ success: boolean; rating: Rating }> {
  try {
    return await dashFetch(`/ratings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contract_id: contractId, rating, comment }),
    });
  } catch {
    const now = new Date().toISOString();
    return {
      success: true,
      rating: {
        id: `rating-${Date.now()}`,
        contract_id: contractId,
        target_node_id: "",
        target_name: "",
        rating,
        comment: comment || "",
        created_at: now,
        updated_at: now,
      },
    };
  }
}

export async function updateRating(
  ratingId: string,
  rating: RatingType,
  comment?: string,
): Promise<{ success: boolean }> {
  try {
    return await dashFetch(`/ratings/${ratingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    });
  } catch {
    return { success: true };
  }
}

export async function getMyRatings(): Promise<MyRatingsResponse> {
  try {
    return await dashFetch<MyRatingsResponse>("/ratings");
  } catch {
    return mockMyRatings;
  }
}
```

- [ ] **Step 3: Verify build passes**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npx next build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/reward-types.ts src/lib/mock-data-reward.ts src/lib/dashboard-api.ts
git commit -m "feat: add reward leaderboard & rating types, mock data, and API layer"
```

---

## Chunk 2: Reward Page Components

### Task 4: Create podium component for top 3

**Files:**
- Create: `src/components/reward/podium.tsx`

- [ ] **Step 1: Create podium component**

Build the `Podium` component that renders three cards (gold center, silver left, bronze right). Each card shows:
- Trophy icon with glow
- Rank label (#1 CHAMPION, #2, #3)
- Avatar circle with initial
- Agent name + owner
- Stats: Hires count, Stars count
- Rating display: star icon + count, tomato icon + count
- Meta: model ID, online status dot, success rate

Props: `entries: RewardEntry[]` (first 3 items). Use existing CSS variable colors. Gold card tallest, silver medium, bronze shortest.

Key styling patterns (match existing codebase):
- `bg-bg-elevated`, `border-border`, `text-text`, `text-text-dim`, `text-text-muted`
- Glass effect: `glass-subtle` class or manual `backdrop-filter: blur()`
- Status dot: green with `bg-success` + glow for online, `bg-bg-elevated` for offline
- Use `useLocale()` for i18n strings

- [ ] **Step 2: Verify component compiles**

### Task 5: Create reward table component for #4+

**Files:**
- Create: `src/components/reward/reward-table.tsx`

- [ ] **Step 1: Create reward table component**

Build `RewardTable` component using existing table patterns from `src/lib/table-styles.ts` (import `thClass`, `tdBaseClass`, `trHoverClass`).

Props: `entries: RewardEntry[]` (entries with rank >= 4)

Columns: Rank | Agent (avatar + name + owner) | Model (styled tag) | Hires | Rating (star + tomato inline) | Success | Status | Price

Follow exact patterns from `src/app/dashboard/leaderboard/page.tsx` for table structure.

- [ ] **Step 2: Verify component compiles**

### Task 6: Create rating dialog component

**Files:**
- Create: `src/components/reward/rating-dialog.tsx`

- [ ] **Step 1: Create rating dialog component**

Build `RatingDialog` modal component for rating an agent on contract termination.

Props:
```typescript
interface RatingDialogProps {
  open: boolean;
  agentName: string;
  contractId: string;
  onClose: () => void;
  onSubmit: (contractId: string, rating: RatingType, comment: string) => Promise<void>;
  // For editing existing ratings
  existingRating?: RatingType;
  existingComment?: string;
  ratingId?: string;
  onUpdate?: (ratingId: string, rating: RatingType, comment: string) => Promise<void>;
}
```

UI:
- Modal overlay with glass background
- Title: "Rate {agentName}"
- Two large clickable buttons: Star (gold, with star emoji) and Tomato (red, with tomato emoji)
- Selected state: highlighted border + filled background
- Optional comment textarea (3 rows)
- Submit / Cancel buttons
- Loading state while submitting

- [ ] **Step 2: Verify component compiles**

- [ ] **Step 3: Commit**

```bash
git add src/components/reward/
git commit -m "feat: add podium, reward table, and rating dialog components"
```

---

## Chunk 3: Reward Page + Nav Integration

### Task 7: Create the /reward page

**Files:**
- Create: `src/app/reward/page.tsx`

- [ ] **Step 1: Create reward page**

Build the public `/reward` page that:
1. Fetches reward leaderboard data via `getRewardLeaderboard()`
2. Has sort toggle buttons: "Hire Count" / "Star Rating" (re-fetches with sort_by param)
3. Renders `Podium` with top 3 entries
4. Renders `RewardTable` with entries 4+
5. Shows loading skeletons while fetching
6. Shows empty state if no data

Layout pattern — follow existing public pages (e.g., `/network/page.tsx`):
- `PageHeader` with eyebrow "REWARD", title, description
- Full-width content area (no sidebar, not under dashboard layout)

- [ ] **Step 2: Verify page renders at /reward**

### Task 8: Add "Reward" to top navigation

**Files:**
- Modify: `src/components/layout/nav-bar.tsx`

- [ ] **Step 1: Add Reward nav link**

In `navKeys` array, add between "Nodes" and "Docs":
```typescript
{ key: "nav.reward", href: "/reward" },
```

Result:
```typescript
const navKeys = [
  { key: "nav.network", href: "/network" },
  { key: "nav.skills", href: "/network/skills" },
  { key: "nav.nodes", href: "/network/nodes" },
  { key: "nav.reward", href: "/reward" },
  { key: "nav.docs", href: "/docs" },
];
```

- [ ] **Step 2: Verify nav shows Reward link**

- [ ] **Step 3: Commit**

```bash
git add src/app/reward/page.tsx src/components/layout/nav-bar.tsx
git commit -m "feat: add public Reward leaderboard page with top nav link"
```

---

## Chunk 4: Rating in Dashboard + i18n

### Task 9: Integrate rating into contract termination flow

**Files:**
- Modify: `src/app/dashboard/hired/page.tsx`

- [ ] **Step 1: Add rating dialog to hired page**

Modify `handleTerminate` in hired page:
1. Instead of directly terminating, first show `RatingDialog`
2. On dialog submit: call `submitRating()` then `terminateHire()`
3. On dialog close (skip): just `terminateHire()` without rating

Add state:
```typescript
const [ratingTarget, setRatingTarget] = useState<{ contractId: string; agentName: string } | null>(null);
```

Change terminate button to open rating dialog:
```typescript
function handleTerminateClick(contractId: string, agentName: string) {
  setRatingTarget({ contractId, agentName });
}
```

Add the RatingDialog component at the end of the JSX.

### Task 10: Add "My Ratings" tab to hired page

- [ ] **Step 1: Add 4th tab "Ratings" to hired page**

Add new tab type: `type Tab = "market" | "requests" | "contracts" | "ratings";`

Add tab entry:
```typescript
{ key: "ratings", label: t("dash.hired.tabRatings"), icon: Star }
```

Add ratings state and load function:
```typescript
const [ratings, setRatings] = useState<Rating[]>([]);
const [ratingsLoading, setRatingsLoading] = useState(false);
```

Render ratings list showing:
- Agent name
- Star or Tomato icon with label
- Comment
- Date
- Edit button that opens RatingDialog in edit mode (calls `updateRating`)

- [ ] **Step 2: Verify all 4 tabs work**

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/hired/page.tsx
git commit -m "feat: add rating on terminate and My Ratings tab in dashboard"
```

### Task 11: Add i18n keys for all 4 languages

**Files:**
- Modify: `src/lib/i18n.ts`

- [ ] **Step 1: Add English keys**

```
"nav.reward": "Reward",
"reward.eyebrow": "REWARD",
"reward.title": "Agent Leaderboard",
"reward.desc": "Top agents ranked by hires and community ratings.",
"reward.sortHires": "Hire Count",
"reward.sortStars": "Star Rating",
"reward.hires": "Hires",
"reward.stars": "Stars",
"reward.champion": "CHAMPION",
"reward.online": "Online",
"reward.offline": "Offline",
"reward.agent": "Agent",
"reward.model": "Model",
"reward.rating": "Rating",
"reward.success": "Success",
"reward.status": "Status",
"reward.price": "Price",
"reward.credits": "Cr",
"reward.empty": "No agents on the leaderboard yet.",
"reward.footer": "Rankings update in real-time based on community hires and ratings",
"dash.hired.tabRatings": "My Ratings",
"dash.hired.rateAgent": "Rate Agent",
"dash.hired.rateStar": "Star",
"dash.hired.rateTomato": "Rotten Tomato",
"dash.hired.rateComment": "Comment (optional)",
"dash.hired.rateSubmit": "Submit Rating",
"dash.hired.rateSkip": "Skip",
"dash.hired.rateUpdate": "Update Rating",
"dash.hired.rateTitle": "Rate",
"dash.hired.noRatings": "No ratings yet. Rate agents after terminating contracts.",
"dash.hired.editRating": "Edit",
```

- [ ] **Step 2: Add zh-CN keys**

```
"nav.reward": "Reward",
"reward.eyebrow": "REWARD",
"reward.title": "Agent 排行榜",
"reward.desc": "按雇佣次数和社区评价排名的顶级 Agent。",
"reward.sortHires": "雇佣次数",
"reward.sortStars": "星星评分",
"reward.hires": "雇佣",
"reward.stars": "星星",
"reward.champion": "冠军",
"reward.online": "在线",
"reward.offline": "离线",
"reward.agent": "Agent",
"reward.model": "模型",
"reward.rating": "评价",
"reward.success": "成功率",
"reward.status": "状态",
"reward.price": "价格",
"reward.credits": "Cr",
"reward.empty": "排行榜暂无 Agent。",
"reward.footer": "排名根据社区雇佣和评价实时更新",
"dash.hired.tabRatings": "我的评价",
"dash.hired.rateAgent": "评价 Agent",
"dash.hired.rateStar": "星星",
"dash.hired.rateTomato": "烂番茄",
"dash.hired.rateComment": "评论（可选）",
"dash.hired.rateSubmit": "提交评价",
"dash.hired.rateSkip": "跳过",
"dash.hired.rateUpdate": "更新评价",
"dash.hired.rateTitle": "评价",
"dash.hired.noRatings": "暂无评价。终止合约后可评价 Agent。",
"dash.hired.editRating": "编辑",
```

- [ ] **Step 3: Add zh-TW keys** (Traditional Chinese)

- [ ] **Step 4: Add ja keys** (Japanese)

- [ ] **Step 5: Verify build passes**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npm run build 2>&1 | tail -20`

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n.ts
git commit -m "feat: add i18n keys for reward leaderboard and rating system (4 languages)"
```

### Task 12: Final integration test

- [ ] **Step 1: Run full build**

Run: `cd /Users/yangpeng/data/Claude/catbus/web && npm run build`

- [ ] **Step 2: Start dev server and verify**

Check:
1. `/reward` page loads with podium + table
2. Sort toggle switches between hire count and star rating
3. Dashboard > Hired > Contracts > Terminate shows rating dialog
4. Dashboard > Hired > Ratings tab shows past ratings
5. Edit button opens rating dialog in edit mode
6. All 4 languages render correctly

- [ ] **Step 3: Final commit if any fixes needed**

### Task 13: Deploy to production

- [ ] **Step 1: Deploy using established flow**

```bash
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.env' --exclude '.env.local' --exclude 'data' \
  /Users/yangpeng/data/Claude/catbus/web/ \
  -e "ssh -i '/Users/yangpeng/data/Claude/catbus/id_rsa (1).pem'" \
  debian@51.75.146.33:/home/debian/catbus-web/
```

Then on server:
```bash
ssh -i '/Users/yangpeng/data/Claude/catbus/id_rsa (1).pem' debian@51.75.146.33 \
  "cd /home/debian/catbus-web && npm run build && pm2 restart all"
```
