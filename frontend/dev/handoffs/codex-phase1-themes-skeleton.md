# Codex Handoff · 朝堂 OS 主题皮肤化（Phase 1 骨架）

> 把这份文档整段贴给 Codex 即可。指令自包含，Codex 无需看对话历史。

---

## 给 Codex 的指令

你在 `chaotang-web-lyt` 前端主仓工作。仓库根目录有 `AGENTS.md` 和 `CLAUDE.md`，开工前**必读**，里面有铁律和端口纪律。

### 任务

实施主题皮肤化架构的 **Phase 1：骨架透明注入**。目标是在 `src/lib/themes/` 新建一个 theme 抽象层模块，挂载 ThemeProvider，但**视觉和文案零变化**（chaotang 主题的 token 为空对象，全回退现状）。

完整设计文档在 `dev/notes/theme-skin-architecture.md`，必读。

### 必须遵守的硬约束

1. **四层架构依赖方向不变**：App Router → Components → Lib → Core。themes 是 Lib 层新模块，向上供 Components 消费，不向下侵入 Core。
2. **Core / contracts 零改动**：`src/core/` 和 `src/lib/contracts/` 下的文件一个字都不准改。概念键复用 `contracts/agent.ts` 已有的 AgentCode。
3. **视觉资产冻结**：不准改 `src/app/globals.css`、`src/lib/design/design-tokens.ts`。chaotang 主题的 `tokens` 字段是空对象 `{}`，运行时回退 design-tokens 默认值 = 现状。
4. **不新增任何页面/版面**：没有新路由。ThemeProvider 挂到现有 `layout.tsx` 的 `<AuthGate>` 内层。
5. **Phase 1 不替换任何组件硬编码**：30+ 文件里的"户部/上书房"等文案保持原样。Phase 1 只建骨架，不动组件。
6. **端口纪律**：本地验证用 `pnpm dev`（端口 3002），不要碰 3050。

### 要交付的文件

```
src/lib/themes/
├── concept-keys.ts      # 稳定概念键枚举（复用 AgentCode + 新增 place.*/term.*）
├── contract.ts           # Theme 接口 + Zod schema（copy 必须覆盖全部概念键，缺失 fail-fast）
├── registry.ts           # 按 id 查找主题，ChaotangTheme 已注册
├── provider.tsx          # ThemeProvider + useCopy/useTheme/useThemeToken
├── server.ts             # getTheme(themeId) / getCopy(themeId, key) 服务端同步取值（RSC 用）
├── themes/
│   └── chaotang.ts       # 朝堂主题：tokens={} 空对象，copy 填入现有文案
└── index.ts              # 统一导出
```

### 接口契约

```ts
// concept-keys.ts
export const CONCEPT_KEYS = [
  // domain — 复用 contracts/agent.ts 的 AgentCode（从那里 import，不要重新定义）
  // place — 场所词
  'place.decision', 'place.command', 'place.archive', 'place.briefing',
  // term — 术语词
  'term.edict', 'term.memorial', 'term.verdict',
] as const;
export type ConceptKey = AgentCode | typeof CONCEPT_KEYS[number];

// contract.ts
export interface Theme {
  id: string;
  name: string;
  tokens: {
    colors?: Partial<typeof colors>;      // 从 design-tokens import
    agentColors?: Partial<typeof agentColors>;
    shadows?: Partial<typeof shadows>;
  };
  copy: Record<ConceptKey, string>;        // Zod 校验：必须覆盖全部 ConceptKey
  cssVars?: Record<string, string>;
}

// provider.tsx
export function ThemeProvider({ themeId, children }: { themeId: string; children: ReactNode }): ReactElement;
export function useCopy(key: ConceptKey): string;
export function useTheme(): Theme;
export function useThemeToken(): Theme['tokens'];

// server.ts（RSC 用，不依赖 React Context）
export function getTheme(themeId: string): Theme;
export function getCopy(themeId: string, key: ConceptKey): string;
```

### 挂载点

读 `src/app/layout.tsx` 找到 `<AuthGate>` 组件的位置。在 AuthGate **内层**包一层 ThemeProvider：

```tsx
<AuthGate>
  <ThemeProvider themeId="chaotang">   {/* Phase 1 硬编码 chaotang，Phase 4 才接 session */}
    {children}
  </ThemeProvider>
</AuthGate>
```

如果 AuthGate 是 client component 而 layout 是 server component，用 AuthGate 自己内部包 Provider，或建一个 client wrapper。自行判断最干净的方式。

### chaotang 主题的 copy 填什么

填**现有文案**，保证 Phase 1 渲染结果不变。示例：

```ts
export const ChaotangTheme: Theme = {
  id: 'chaotang',
  name: '朝堂',
  tokens: {},   // 空对象 = 全回退 design-tokens 默认值 = 现状
  copy: {
    // domain — 从 contracts/agent.ts 的 AGENT_META.label 取
    hu_bu: '户部',
    li_bu: '礼部',
    bing_bu: '兵部',
    gong_bu: '工部',
    xing_bu: '刑部',
    // ... 其余 AgentCode 从 AGENT_META.label 同步过来
    'place.decision': '上书房',
    'place.command': '军机处',
    'place.archive': '史馆',
    'place.briefing': '朝报',
    'term.edict': '圣旨',
    'term.memorial': '奏折',
    'term.verdict': '裁决',
  },
};
```

**关键**：domain 概念键的文案必须从 `contracts/agent.ts` 的 `AGENT_META` 同步过来，不要自己编。如果 AGENT_META 没有 label，去仓库里 grep 现有用法。

### 验收标准（缺一不可）

1. `pnpm tsc` 零错误（root tsc 门）
2. `pnpm build` 零错误（next build 门）
3. `pnpm dev` 启动后访问 `/chaotang` 首页，视觉和文案与改造前**完全一致**——截图对比
4. `src/core/` 和 `src/lib/contracts/` 的 `git diff` 为空
5. `src/app/globals.css` 和 `src/lib/design/design-tokens.ts` 的 `git diff` 为空
6. Zod schema 校验：故意删一个 copy key 跑测试，必须 fail-fast 报错（铁律2）

### 不要做的事

- ❌ 不要替换任何组件里的"户部/上书房"硬编码文案（那是 Phase 2）
- ❌ 不要新增 company / minimal 主题（那是 Phase 3）
- ❌ 不要改后端 session 或 middleware（那是 Phase 4）
- ❌ 不要碰 `src/lib/types.ts`（已 deprecated）
- ❌ 不要在 components/ 下新建主题切换 UI（Phase 3 才做）
- ❌ 不要为了"顺手"重构其他代码——本任务只建骨架

### 完成后

1. 跑双门验收（tsc + build）
2. 在 `dev/handoffs/` 下写一份 `phase1-completion.md`，记录：新增文件清单、挂载点位置、chaotang copy 来源说明、验收截图路径
3. git commit message 格式：`feat(themes): Phase 1 skeleton — transparent theme layer injection`
4. 不要 push，等人工 review

---

## 备注：未决问题（Phase 2 再定，Phase 1 不涉及）

`AgentMeta.color` 在 contracts 里硬编码了 hex。Phase 2 文案替换时需要决定：
- **方案 A**：contracts 不动，theme.agentColors 运行时覆盖优先于 AgentMeta.color
- **方案 B**：把 color 从 AgentMeta 移除，颜色完全归 theme

Phase 1 不碰颜色，这个问题先搁置。Codex 不要在 Phase 1 处理它。
