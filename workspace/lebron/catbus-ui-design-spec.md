# CatBus Web Platform — UI 设计规范与 AI Agent 开发文档

> 本文档是 catbus.ai 前端开发的唯一设计真相来源。
> AI Agent（Claude / Cursor / Copilot）在生成任何前端代码时 **必须** 遵守本文档中的所有约束。

---

## 一、设计风格定义

### 风格关键词

**Deep Space Tech** — 深空科技风格

- 纯黑底色 + 低对比度灰白文字
- 几何粒子/星座连线动态背景（Canvas）
- 极简留白，信息密度适中
- 数据驱动的仪表盘美学
- 微妙的边框分割，无重色块

### 风格参考

参考 [evomap.ai](https://evomap.ai/) 的视觉语言，核心特征：

| 特征 | 说明 |
|------|------|
| 背景 | 纯黑 `#000000`，固定定位 Canvas 粒子动画（星座连线风格） |
| 文字 | 高亮白 `#ededed`，辅助灰 `#999999` / `#666666` |
| 强调色 | 绿色（成功/在线）、黄色（警告/数据）、蓝色（主操作） |
| 卡片 | 近乎透明的深灰底 + 1px 暗色边框，无阴影或极轻阴影 |
| 导航 | 透明背景，文字导航，无背景色 |
| 排版 | 大标题紧凑行高 + 负字间距，正文舒适间距 |
| 动效 | 克制、功能性的——渐入/渐出，无花哨转场 |

---

## 二、设计令牌（Design Tokens）

### 2.1 颜色系统

所有颜色使用 HSL 格式定义，通过 CSS 变量引用。

```css
:root {
  /* ── 背景层级 ── */
  --c-bg:           hsl(0 0% 0%);       /* #000000  纯黑底 */
  --c-bg-subtle:    hsl(0 0% 3%);       /* #080808  微灰底（区分层级） */
  --c-bg-elevated:  hsl(0 0% 6%);       /* #0f0f0f  卡片/浮层底色 */

  /* ── 边框 ── */
  --c-border:       hsl(0 0% 12%);      /* #1f1f1f  默认边框 */
  --c-border-hover: hsl(0 0% 20%);      /* #333333  hover 边框 */

  /* ── 文字 ── */
  --c-text:         hsl(0 0% 93%);      /* #ededed  主文字 */
  --c-text-dim:     hsl(0 0% 60%);      /* #999999  次要文字 */
  --c-text-muted:   hsl(0 0% 40%);      /* #666666  辅助/标签文字 */

  /* ── 语义色 ── */
  --c-primary:      hsl(220 100% 60%);  /* #3366ff  主操作蓝 */
  --c-primary-fg:   hsl(0 0% 100%);     /* #ffffff  主操作前景 */
  --c-success:      hsl(150 100% 35%);  /* #00b34a  成功/在线 绿 */
  --c-warning:      hsl(35 100% 50%);   /* #ff9500  警告/数据 黄 */
  --c-danger:       hsl(0 100% 60%);    /* #ff3333  错误/危险 红 */

  /* ── 覆盖层 ── */
  --c-overlay:      hsl(0 0% 0% / 0.8); /* 模态遮罩 */

  /* ── 图表色板（8色） ── */
  --c-chart-1: hsl(239 84% 67%);
  --c-chart-2: hsl(187 85% 53%);
  --c-chart-3: hsl(142 71% 45%);
  --c-chart-4: hsl(38 92% 50%);
  --c-chart-5: hsl(0 84% 60%);
  --c-chart-6: hsl(258 90% 66%);
  --c-chart-7: hsl(330 81% 60%);
  --c-chart-8: hsl(168 76% 42%);
}
```

### 2.2 字体系统

```css
:root {
  /* ── 字体族 ── */
  --font-ui:   Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;

  /* ── 字号阶梯 ── */
  --text-xs:   12px;  /* 标签、徽标 */
  --text-sm:   13px;  /* 导航、辅助 */
  --text-base: 14px;  /* 正文 */
  --text-md:   16px;  /* 按钮、卡片描述 */
  --text-lg:   18px;  /* 小标题 */
  --text-xl:   20px;  /* 区块标题 */
  --text-2xl:  24px;  /* 页面二级标题 */
  --text-3xl:  30px;  /* 大区块标题 */
  --text-hero: 60px;  /* Hero 标题（仅首屏） */
}
```

### 2.3 排版规则

| 元素 | 字号 | 字重 | 行高 | 字间距 | 其他 |
|------|------|------|------|--------|------|
| Hero H1 | 60px | 700 | 1.0 (60px) | -1.5px | 仅首屏使用 |
| 页面标题 H1 | 36-48px | 700 | 1.1 | -1.2px | 每页一个 |
| 区块标题 H2 | 24-30px | 700 | 1.33 | -0.6px ~ -0.75px | |
| 卡片标题 H3 | 14-18px | 600 | 1.43 | normal | |
| 正文 | 14-16px | 400 | 1.5 | normal | color: --c-text-dim |
| 标签/眉题 | 10-12px | 400-600 | 1.5 | 0.6px ~ 2.4px | `text-transform: uppercase` |
| 数据大数字 | 30px | 700 | 1.2 | normal | 成功色/警告色/默认白 |
| 代码 | 13-14px | 400 | 1.5 | normal | font-mono |

### 2.4 间距系统

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  24px;
  --space-6:  32px;
  --space-8:  48px;
  --space-10: 64px;
  --space-12: 96px;
}
```

**规则：** 组件内部用 `space-2` ~ `space-4`，组件间用 `space-6` ~ `space-8`，大区块间用 `space-10` ~ `space-12`。

### 2.5 圆角

```css
:root {
  --radius-sm:   4px;   /* 小按钮、标签 */
  --radius-md:   6px;   /* 按钮、输入框 */
  --radius-lg:   8px;   /* 卡片 */
  --radius-xl:   12px;  /* 大卡片、弹窗 */
  --radius-full: 9999px; /* 药丸形 pill */
}
```

### 2.6 阴影

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.4), 0 2px 4px -1px rgba(0,0,0,0.2);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.3);
}
```

**注意：** 深色主题下阴影效果微弱，主要靠 **边框** 和 **背景层级** 区分层次。

### 2.7 动效

```css
:root {
  --motion-base:   0.2s;
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring:   cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --ease-smooth:   cubic-bezier(0.4, 0, 0.2, 1);
}
```

**规则：** hover/focus 用 `--motion-base + --ease-standard`，弹窗/抽屉进入用 `--ease-spring`，所有动画 ≤ 0.3s。

---

## 三、组件规范

### 3.1 导航栏（Navbar）

```
┌─────────────────────────────────────────────────────────────────┐
│ ✦ CatBus   Market  Bounties  Wiki  Blog  Explore▾  ...  🔍 Sign In  Sign Up │
└─────────────────────────────────────────────────────────────────┘
```

- **位置：** `position: sticky; top: 0; z-index: 50;`
- **背景：** `transparent`，滚动后加 `backdrop-filter: blur(12px); background: rgba(0,0,0,0.6);`
- **高度：** 48-56px
- **Logo：** 左侧，图标 + "CatBus" 文字，`font-weight: 700; font-size: 16px;`
- **导航项：** `font-size: 13px; font-weight: 500; color: --c-text; padding: 4px 8px;`
- **hover：** 文字变亮 `--c-text`，无下划线
- **右侧：** 搜索图标 + "Sign In"（文字链接）+ "Sign Up"（带边框按钮）

### 3.2 按钮

#### Primary（主操作）

```css
.btn-primary {
  background: transparent;
  color: var(--c-text);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);   /* 6px */
  padding: 0 24px;
  height: 40px;
  font-size: 16px;
  font-weight: 500;
  transition: border-color var(--motion-base) var(--ease-standard);
}
.btn-primary:hover {
  border-color: var(--c-border-hover);
}
```

#### Ghost（幽灵按钮）

```css
.btn-ghost {
  background: transparent;
  color: var(--c-text);
  border: none;
  /* 其余同 primary */
}
```

#### Tag/Pill（标签按钮）

```css
.btn-tag {
  background: var(--c-bg-elevated);
  color: var(--c-text-dim);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-full);
  padding: 4px 12px;
  font-size: 12px;
}
.btn-tag.active {
  background: var(--c-text);
  color: var(--c-bg);
}
```

### 3.3 卡片

```css
.card {
  background: transparent;                  /* 或 var(--c-bg-elevated) */
  border: 1px solid var(--c-border);
  border-radius: var(--radius-xl);          /* 12px */
  padding: 20px;
  transition: border-color var(--motion-base) var(--ease-standard);
}
.card:hover {
  border-color: var(--c-border-hover);
}
```

**卡片层级：**
- **统计卡片：** 透明底 + 虚线/实线边框，大数字 + 小标签
- **功能卡片：** `--c-bg-elevated` 底色 + 实线边框，图标 + 标题 + 描述
- **列表项卡片：** 透明底，底部 1px 分割线

### 3.4 统计数字区

```
┌──────────────────────────────────────────────────────────────┐
│  TOTAL TOKENS SAVED      DEDUPLICATIONS       SEARCH HIT RATE │
│  ↗ 81.6B                 🛡 148,674           🔍 96.23%       │
│  描述文字...              描述文字...           描述文字...      │
└──────────────────────────────────────────────────────────────┘
```

- **标签：** `text-transform: uppercase; font-size: 12px; letter-spacing: 0.6px; color: --c-text-muted;`
- **数值：** `font-size: 30px; font-weight: 700;` 颜色按语义（绿=成功、黄=警告、白=中性）
- **描述：** `font-size: 13px; color: --c-text-dim;`
- **图标：** 数值前可选小图标，同色

### 3.5 搜索栏

```css
.search-input {
  background: transparent;
  border: 1px solid var(--c-border);
  border-radius: var(--radius-md);
  color: var(--c-text);
  padding: 8px 16px;
  font-size: 14px;
  width: 100%;
}
.search-input::placeholder {
  color: var(--c-text-muted);
}
.search-input:focus {
  border-color: var(--c-border-hover);
  outline: none;
}
```

### 3.6 标签/筛选器（Tag Filter Bar）

```
[ All ] [ Capsule ] [ Gene ] [ All Categories▾ ] [ Repair ] [ Optimize ] ...
```

- 横向排列，可滚动
- 默认：透明底 + 灰色边框 + 灰色文字
- 选中：白色底 + 黑色文字（反转）
- `border-radius: var(--radius-full);`

### 3.7 眉题（Eyebrow Label）

区块标题上方的小标签：

```css
.eyebrow {
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 2.4px;
  color: var(--c-text-muted);
  margin-bottom: var(--space-3);
}
```

### 3.8 代码块

```css
.code-block {
  background: var(--c-bg-elevated);
  border: 1px solid var(--c-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--c-text);
  overflow-x: auto;
}
```

带复制按钮（右上角），hover 时显示。

### 3.9 表格/列表

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table th {
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--c-text-muted);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--c-border);
  text-align: left;
}
.data-table td {
  font-size: 14px;
  color: var(--c-text);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--c-border);
}
.data-table tr:hover {
  background: var(--c-bg-subtle);
}
```

---

## 四、页面布局规范

### 4.1 全局布局

```
┌─ Navbar (sticky) ────────────────────────────────────────────┐
├─ Canvas 粒子背景 (fixed, z-index: -1) ───────────────────────┤
├─ Main Content ───────────────────────────────────────────────┤
│  max-width: 1200px; margin: 0 auto; padding: 0 24px;        │
├─ Footer ─────────────────────────────────────────────────────┤
└──────────────────────────────────────────────────────────────┘
```

- **内容区最大宽度：** 1200px，居中
- **侧边距：** 桌面 24px，移动端 16px
- **区块间距：** `--space-12`（96px）
- **响应式断点：** `sm: 640px, md: 768px, lg: 1024px, xl: 1280px`

### 4.2 Landing Page 布局

```
[Hero Section]
  左侧：大标题 + 描述 + CTA 按钮组（2/3 宽度）
  右侧：快速接入代码框（1/3 宽度）

[Getting Started Section]
  标题 + 描述
  4 列功能卡片网格（1×4 → 2×2 → 1×4 响应式）

[Protocol Section]
  眉题 + 标题 + 描述
  横向 Logo 展示行（Agent 生态图标）

[Stats Section]
  3 列小型指标卡片
  4 列大数字统计行

[Quality Section]
  眉题 + 大标题
  3 列百分比/数据卡片
  3 列 How It Works 说明

[Philosophy Section]
  眉题 + 大标题 + 描述
  3 列概念卡片（带图标）

[Hot List Section]
  标题 + "View All" 链接
  卡片列表/轮播
```

### 4.3 Market Page 布局

```
[页面头部]
  眉题 "MARKET" + 大标题
  4 列统计卡片行

[Tab 切换]
  Capsules | Recipes | Services | Work

[Daily Discovery]
  水平滚动卡片

[搜索 + 筛选]
  搜索栏
  标签筛选行（All, Capsule, Gene, All Categories, Repair...）
  Popular 标签行

[资产列表]
  左侧：筛选面板（可折叠）
  右侧：卡片列表（支持分页）
```

### 4.4 Dashboard Page 布局

```
[概览统计]
  3-4 列统计卡片

[Agent 列表]
  表格/卡片混合布局

[调用历史]
  筛选栏 + 数据表格 + 分页
```

---

## 五、动态背景（Canvas 粒子系统）

### 实现要求

- **技术：** `<canvas>` 元素，`position: fixed; top: 0; left: 0; z-index: -1; pointer-events: none;`
- **全屏覆盖：** 宽高跟随 viewport
- **粒子风格：** 星座连线图（Constellation）
  - 粒子：小白点（2-3px），透明度 0.3-0.6
  - 连线：粒子间距 < 阈值时画线，线条透明度与距离成反比
  - 运动：缓慢随机漂移，速度 0.1-0.5px/帧
  - 颜色：白色/浅蓝色，低透明度
- **性能：** 粒子数量 50-80 个，使用 `requestAnimationFrame`，帧率 ≤ 30fps

### 伪代码

```
particles = 初始化 60 个随机位置粒子
每帧:
  清空画布
  移动每个粒子（加随机微扰动）
  对每对粒子，距离 < 150px 时画连线（透明度 = 1 - 距离/150）
  画粒子圆点
```

---

## 六、AI Agent 开发约束

> 以下规则在使用任何 AI 编码助手（Claude Code, Cursor, Copilot 等）开发 catbus.ai 时 **强制执行**。

### 6.1 技术栈约束

```yaml
框架:      Next.js 15 (App Router)
语言:      TypeScript (strict mode)
样式:      Tailwind CSS 4 + CSS Variables (本文档定义的 tokens)
组件库:    shadcn/ui (仅作基础, 必须按本文档覆盖样式)
图表:      Recharts 或 Visx
动画:      Framer Motion (克制使用)
Canvas:    原生 Canvas API (不引入 Three.js 等重型库)
图标:      Lucide Icons
字体:      Inter (Google Fonts) + JetBrains Mono
```

### 6.2 样式约束（必须遵守）

```
[MUST] 只使用本文档定义的 CSS 变量，禁止硬编码颜色值
[MUST] 只使用 dark 主题，不实现 light 模式（Phase 1 不需要）
[MUST] 背景色必须是纯黑 #000000，不是 #0a0a0a 也不是深蓝
[MUST] 卡片使用边框分层，不使用彩色背景块
[MUST] 按钮默认透明底 + 边框，不使用实心彩色按钮
[MUST] 区块标题上方必须有 eyebrow 标签（大写、小字号、宽字间距）
[MUST] 统计数字使用 30px bold，配语义色
[MUST] 代码块使用 JetBrains Mono
[MUST] 所有可交互元素必须有 hover 状态（边框变亮或透明度变化）

[NEVER] 禁止使用白色/浅色背景（除了反转按钮 active 状态）
[NEVER] 禁止使用渐变色背景
[NEVER] 禁止使用 box-shadow 作为主要层级区分手段
[NEVER] 禁止使用大面积彩色块
[NEVER] 禁止动画时长 > 0.3s
[NEVER] 禁止使用 emoji 作为图标
[NEVER] 禁止在正文中使用 text-transform: uppercase（仅限标签/眉题）
```

### 6.3 组件开发约束

```
[MUST] 每个组件独立文件，一个文件一个组件
[MUST] 组件文件名使用 kebab-case（stat-card.tsx, nav-bar.tsx）
[MUST] 使用 CSS 变量而非 Tailwind 的默认色板（bg-black → 用 CSS 变量）
[MUST] 统计卡片组件必须支持 props: { label, value, description, color?, icon? }
[MUST] 所有列表页必须支持：搜索、筛选、分页
[MUST] 表格组件必须支持排序和 hover 高亮

[PATTERN] 页面布局统一结构：
  <PageHeader eyebrow="..." title="..." description="..." />
  <StatsRow items={[...]} />
  <ContentSection>
    {children}
  </ContentSection>
```

### 6.4 文件结构约束

```
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # 全局布局（Navbar + Canvas + Footer）
│   ├── page.tsx                # Landing Page
│   ├── network/
│   │   ├── page.tsx            # 网络总览
│   │   ├── skills/page.tsx     # Skill 目录
│   │   └── nodes/page.tsx      # 节点列表
│   ├── dashboard/
│   │   ├── layout.tsx          # Dashboard 布局（需登录）
│   │   ├── page.tsx            # 概览
│   │   ├── agents/[id]/page.tsx
│   │   ├── calls/page.tsx
│   │   └── settings/page.tsx
│   └── (auth)/
│       └── login/page.tsx
├── components/
│   ├── ui/                     # 基础 UI 组件 (shadcn 覆盖)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── table.tsx
│   │   └── dialog.tsx
│   ├── layout/
│   │   ├── nav-bar.tsx
│   │   ├── footer.tsx
│   │   └── page-header.tsx
│   ├── data-display/
│   │   ├── stat-card.tsx
│   │   ├── stats-row.tsx
│   │   ├── data-table.tsx
│   │   └── activity-feed.tsx
│   ├── canvas/
│   │   └── constellation-bg.tsx  # 粒子背景
│   └── market/
│       ├── skill-card.tsx
│       ├── search-bar.tsx
│       └── tag-filter.tsx
├── lib/
│   ├── api.ts                  # API 请求封装
│   ├── types.ts                # 全局类型定义
│   └── utils.ts                # 工具函数
└── styles/
    └── globals.css             # CSS 变量定义（本文档的 tokens）
```

### 6.5 数据展示约束

```
[MUST] 大数字自动格式化：1000 → 1K, 1000000 → 1M, 1000000000 → 1B
[MUST] 延迟显示单位：ms / s（自动转换）
[MUST] 百分比保留两位小数
[MUST] 时间显示使用相对时间（"2h 15m ago"）+ tooltip 显示绝对时间
[MUST] 在线/离线状态使用圆点指示器：绿色=在线，灰色=离线
[MUST] 空状态必须有友好提示，不允许空白页面
[MUST] 加载中使用骨架屏（Skeleton），不使用 Spinner
```

### 6.6 交互约束

```
[MUST] 所有外部链接 target="_blank" rel="noopener noreferrer"
[MUST] 代码块右上角有复制按钮，点击后显示"Copied"反馈
[MUST] 表格行 hover 时背景变为 --c-bg-subtle
[MUST] 分页显示 "Showing X / Total" + 上一页/下一页
[MUST] 搜索支持防抖（300ms）
[MUST] 筛选状态同步到 URL query params
```

---

## 七、Tailwind CSS 配置参考

```ts
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:          "hsl(var(--c-bg) / <alpha-value>)",
        "bg-subtle": "hsl(var(--c-bg-subtle) / <alpha-value>)",
        "bg-elevated": "hsl(var(--c-bg-elevated) / <alpha-value>)",
        border:      "hsl(var(--c-border) / <alpha-value>)",
        "border-hover": "hsl(var(--c-border-hover) / <alpha-value>)",
        text:        "hsl(var(--c-text) / <alpha-value>)",
        "text-dim":  "hsl(var(--c-text-dim) / <alpha-value>)",
        "text-muted":"hsl(var(--c-text-muted) / <alpha-value>)",
        primary:     "hsl(var(--c-primary) / <alpha-value>)",
        success:     "hsl(var(--c-success) / <alpha-value>)",
        warning:     "hsl(var(--c-warning) / <alpha-value>)",
        danger:      "hsl(var(--c-danger) / <alpha-value>)",
      },
      fontFamily: {
        ui:   ["var(--font-ui)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm:   "var(--radius-sm)",
        md:   "var(--radius-md)",
        lg:   "var(--radius-lg)",
        xl:   "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        10: "var(--space-10)",
        12: "var(--space-12)",
      },
    },
  },
} satisfies Config;
```

---

## 八、组件示例代码片段

### PageHeader

```tsx
interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
}

function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="mb-[--space-10]">
      <p className="uppercase text-[12px] font-semibold tracking-[2.4px] text-text-muted mb-[--space-3]">
        {eyebrow}
      </p>
      <h1 className="text-[36px] font-bold leading-[1.1] tracking-[-1.2px] text-text">
        {title}
      </h1>
      {description && (
        <p className="mt-[--space-3] text-[16px] text-text-dim max-w-[640px]">
          {description}
        </p>
      )}
    </div>
  );
}
```

### StatCard

```tsx
interface StatCardProps {
  label: string;
  value: string;
  description: string;
  color?: "default" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
}

function StatCard({ label, value, description, color = "default", icon }: StatCardProps) {
  const colorMap = {
    default: "text-text",
    success: "text-success",
    warning: "text-warning",
    danger:  "text-danger",
  };

  return (
    <div className="border border-border rounded-lg p-[--space-5]">
      <p className="uppercase text-[12px] tracking-[0.6px] text-text-muted mb-[--space-2]">
        {label}
      </p>
      <p className={`text-[30px] font-bold ${colorMap[color]} flex items-center gap-2`}>
        {icon}
        {value}
      </p>
      <p className="text-[13px] text-text-dim mt-[--space-1]">
        {description}
      </p>
    </div>
  );
}
```

---

## 九、参考截图索引

以下截图保存在项目根目录，供开发时对照：

| 文件 | 内容 |
|------|------|
| `evomap-01-hero.png` | 首页 Hero + 导航栏 + 快速接入面板 |
| `evomap-scroll-test.png` | Protocol 区 + Agent 图标行 + 指标仪表盘 + 大数字统计 |
| `evomap-05-qa.png` | QA 审核区 + Biology 哲学区 |
| `evomap-full.png` | 首页完整全页截图 |
| `evomap-market.png` | Market 页头部 + 统计 |
| `evomap-market-cards.png` | Market 搜索 + 标签筛选 + 每日发现 |
| `evomap-bounties.png` | Bounties 页（问答列表布局） |
| `evomap-bounties-list.png` | Bounties 列表卡片详情 |
| `evomap-wiki.png` | Wiki 文档页（左侧导航 + 右侧卡片网格） |
| `evomap-blog.png` | Blog 页（图文卡片网格） |

---

## 十、检查清单

AI Agent 在提交代码前必须逐项确认：

- [ ] 背景色是纯黑 `#000000`
- [ ] 所有颜色来自 CSS 变量，无硬编码
- [ ] 卡片使用边框区分，无彩色背景
- [ ] 标题上方有 uppercase 眉题标签
- [ ] 统计数字 30px bold + 语义色
- [ ] 按钮透明底 + 边框，hover 有反馈
- [ ] 粒子背景 Canvas 正常渲染
- [ ] 字体加载正确（Inter + JetBrains Mono）
- [ ] 空状态有友好提示
- [ ] 加载状态使用骨架屏
- [ ] URL 中的筛选参数正确同步
- [ ] 移动端响应式正常
