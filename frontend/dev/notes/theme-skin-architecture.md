# 朝堂 OS · 主题皮肤化架构方案

> 目标：让"朝堂"隐喻成为可替换的 theme skin，支持朝堂 / 公司 / 极简等多套皮肤，
> 按组织多租户下发。**四层架构（App Router → Components → Lib → Core）依赖方向不变。**
>
> 决策基线：视觉 + 文案层更换（不重命名组件）+ 多租户按组织（后端下发 themeId）。

---

## 1. 核心思想：概念键与显示层分离

现有代码里"户部""上书房""帝金"是**硬编码**的，散落在 30+ 文件。本方案在 Lib 层
引入一个 theme 抽象层，把"稳定概念"和"可换呈现"切开：

| 层 | 内容 | 是否可换 |
|----|------|----------|
| Core / contracts | agent code（`hu_bu`、`li_bu`）等概念键 | ❌ 稳定，跨主题不变 |
| Lib · themes | token 覆盖 + copyMap（概念键→显示文案）+ cssVars | ✅ 每个 theme 一份 |
| Components | `useCopy(key)` / `useThemeToken()` 取当前组织呈现 | 消费方，无硬编码 |

**关键**：Core 层只认 agent code，本来就在 `contracts/agent.ts` 定义，零改动。
`agentColors` 的 key（`hu_bu` 等）也是概念键，不变；变的是它的 label 和颜色值。

---

## 2. 新增文件结构

```
src/lib/themes/
├── concept-keys.ts      # 稳定概念键枚举（复用 agent code + 新增 place.*/term.*）
├── contract.ts           # Theme 接口 + Zod schema（SSOT，呼应铁律2）
├── registry.ts           # 按 id 查找主题
├── provider.tsx          # ThemeProvider + useCopy/useTheme/useThemeToken
├── themes/
│   ├── chaotang.ts       # 朝堂主题（默认，token=空对象回退现状，copy=现有文案）
│   ├── company.ts        # 公司主题（企业蓝 + 财务部/决策中心）
│   └── minimal.ts        # 极简主题（中性灰 + 英文）
└── index.ts              # 统一导出
```

不新增任何页面/版面（呼应铁律5·版面预算）。主题切换入口溶解进 `/more` 设置页。

---

## 3. 关键接口

### 3.1 概念键（concept-keys.ts）

```ts
// 复用 contracts/agent.ts 的 AgentCode 作为 domain 概念键
// 另外枚举场所词、术语词
export const CONCEPT_KEYS = [
  // domain — 复用现有 agent code
  'hu_bu', 'li_bu', 'bing_bu', 'gong_bu', 'xing_bu', 'li_bu_rites',
  'prime_minister', 'scribe', 'qin_tian_jian', 'jin_yi_wei', 'tai_yi_yuan',
  // place — 场所
  'place.decision', 'place.command', 'place.archive', 'place.briefing',
  // term — 术语
  'term.edict', 'term.memorial', 'term.verdict',
] as const;
export type ConceptKey = typeof CONCEPT_KEYS[number];
```

### 3.2 Theme 契约（contract.ts）

```ts
import { colors, agentColors, shadows } from '@/lib/design/design-tokens';

export interface Theme {
  id: string;
  name: string;
  /** 覆盖 design-tokens，未覆盖的 key 回退默认值（朝堂现状） */
  tokens: {
    colors?: Partial<typeof colors>;
    agentColors?: Partial<typeof agentColors>;
    shadows?: Partial<typeof shadows>;
  };
  /** 概念键 → 显示文案。Zod 校验必须覆盖 CONCEPT_KEYS 全部，缺失即 fail-fast（铁律2） */
  copy: Record<ConceptKey, string>;
  /** 覆盖 globals.css 的 CSS 变量，运行时注入 <html style> */
  cssVars?: Record<string, string>;
}

// Zod schema：copy 必须覆盖所有概念键，缺一报错
export const ZTheme = z.object({ ... });
```

### 3.3 Provider 与 Hook（provider.tsx）

```ts
// 挂载点：layout.tsx 的 <AuthGate> 内层（登录后才知道组织 themeId）
<ThemeProvider themeId={session.orgThemeId}>
  {children}
</ThemeProvider>

// 组件侧消费
function useCopy(key: ConceptKey): string        // 'hu_bu' → '户部' / '财务部' / 'Finance'
function useThemeToken(): Theme['tokens']        // 取当前主题颜色等
function useTheme(): Theme                        // 取整个主题对象
```

---

## 4. 多租户下发链路

```
后端 org config (themeId)
        │  登录会话返回
        ▼
session.orgThemeId
        │  middleware.ts 透传（已有鉴权链路，加一个字段）
        ▼
layout.tsx · AuthGate 内
        │  <ThemeProvider themeId={session.orgThemeId}>
        ▼
ThemeProvider
   ├─ registry.get(themeId) → Theme 对象
   ├─ 注入 cssVars 到 <html style>（覆盖 globals.css 变量）
   └─ Context 提供 copy + tokens
        ▼
Components · useCopy('hu_bu') → 渲染当前组织文案
```

---

## 5. 渐进迁移策略（4 Phase，每 Phase 可独立上线、不破坏现状）

### Phase 1 · 骨架透明注入（零视觉变化）
- 建 `src/lib/themes/` 模块骨架
- `chaotang.ts` 的 `tokens` 为空对象（全回退 design-tokens 默认值）= 现状
- `copy` 填入现有文案（户部/上书房...），但暂不替换任何组件硬编码
- `ThemeProvider` 挂到 AuthGate 内，硬编码 `themeId='chaotang'`
- **验收**：`tsc` + `next build` 通过，视觉/文案零变化

### Phase 2 · 概念键收口 + 文案替换
- 在 `concept-keys.ts` 枚举全部概念键
- 逐步把 30+ 文件硬编码"户部/上书房/军机处"替换成 `useCopy('hu_bu')` 等
- `chaotang.ts` 的 copy map 保证渲染结果与现状一致
- **验收**：chaotang 主题下零变化；双门 `tsc` + `build` 通过

### Phase 3 · 新增公司/极简主题包
- `company.ts` / `minimal.ts` 填入对应 token + copy
- `/more` 设置页加主题切换入口（仅管理员可见，演示用）
- **验收**：切换主题后文案/颜色变化正确

### Phase 4 · 后端多租户下发
- 后端 org config 加 `themeId` 字段
- session 返回 themeId，middleware 透传
- Provider 按 session 应用，去掉硬编码
- **验收**：不同组织登录看到不同主题

---

## 6. 与现有铁律的兼容性

| 铁律 | 兼容方式 |
|------|----------|
| 视觉资产冻结（§2） | globals.css 不改；design-tokens.ts 保留为 chaotang 默认 SoT；theme.tokens 是 Partial 覆盖 |
| 枚举 SSOT（铁律2） | `concept-keys.ts` 是概念键唯一真相源；Zod 校验 copy 必须覆盖全部键，缺失 fail-fast |
| 版面预算（铁律5） | 不新增任何页面；主题切换入口溶解进 `/more` |
| 主仓锚点（§-1） | 纯前端改动，只在 chaotang-web-lyt 进行 |
| Core 零侵入 | Core/contracts 用 agent code（概念键），本来就在 contracts 定义，零改动 |

---

## 7. 风险与注意

1. **`useCopy` 不能在 Server Component 直接用**——需通过 Client Provider 下发，
   或在 RSC 里用 `getTheme(themeId).copy[key]` 同步取值。建议 Provider 走 Client，
   文案取值提供 `getCopy(themeId, key)` 服务端版本。
2. **CSS 变量覆盖时序**：globals.css 的 `@theme` 块在构建时生成，Provider 注入的
   inline style 需在 `<html>` 上才能覆盖根变量。注意 SSR 首屏闪烁（可加 `themeId` 到
   cookie，middleware 注入 `<html data-theme>` 属性避免 FOUC）。
3. **30+ 文件文案替换是主要工作量**，建议按 feature 分批迁移，每批跑双门验收。
4. **agentColors 的颜色覆盖**：现有 `AgentMeta.color` 在 contracts 里硬编码了 hex，
   主题化后需让 `AgentMeta` 只存 code，颜色从 theme 取——这一步可能触及 contracts，
   Phase 2 需评估是否一并改。
