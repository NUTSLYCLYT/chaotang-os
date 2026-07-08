# Scribe 史馆 · 中栏卷宗接真数据 + 来源显式化（第一刀）

> 日期 2026-07-07 · 范围：scribe hub 中栏「今日引卷 / 卷宗要览」从 MOCK 接后端真数据，每卷显式带来源。
> 这是"前端 UI 升级"大任务拆出的第一刀（安全、可验证、不碰并发 agent 改的 API 路由）。左栏复盘索引 /
> 右栏复盘飞轮接真数据是紧随其后的第二、三刀，不在本 spec。

## 1. 目标（对应用户 4 诉求）

1. **内容有来源**：中栏卷宗从 `MOCK_COURT_DOCS` 换成后端真 court_doc，每张卡显式渲染来源
   （sourceLabel / 证据授权 authenticated·orphan / evidence_ref），复用现有 `EvidenceChainPanel` + `isUnverifiable`。
2. **链接跑通**：卷宗卡的 trace-evidence / export-amulet / open-annals 动作与 taskId 链接实测可达。
3. **面板清晰**：中栏三态（loading/empty/error）按 DESIGN.md（帝王金·暗金·克制）排布，不堆砌。
4. **用户喜欢**：真数据 + 诚实空态 + 干净证据链，比"画死的假 36 件"可信；照 DESIGN.md 视觉意图。

## 2. 非目标（本刀不做）

- 左栏复盘索引、右栏飞轮的真数据接入（第二、三刀）。
- 新建/修改任何后端 API 路由（并发 agent 在改，避开）。后端端点已存在，只在前端调。
- 视觉大改版 / 新设计语言。严格照 `DESIGN.md` + `src/config/design-tokens.ts` 既有系统。

## 3. 数据源（已存在，无需后端改动）

- 端点：`GET /api/court/backend/archive/cases` → 代理到 CourtOS `${courtosApiUrl}/api/tasks/audit-feed`。
- 未配置 CourtOS 时返回 `503 {success:false, error:'courtos_api_not_configured'}`。
- 契约类型已在 `src/features/scribe/lib/court-doc.ts`：`CourtDoc` / `CourtDocProvenance` / `CourtDocItem` /
  `LIGHT_COLOR` / `AUTH_LABEL` / `isUnverifiable` / `canExportAmulet`。

## 4. 架构 · 组件与数据流

**新增** `src/features/scribe/hooks/use-court-docs.ts`（薄 SWR hook，照 `useDepartmentPageView.ts` 模式）：
- `useCourtDocs(): { docs: CourtDoc[]; isLoading; error; source: 'live'|'empty'|'error'|'sample' }`
- 内部：`useSWR('/api/court/backend/archive/cases', fetcher)` → 纯函数 `mapAuditFeedToCourtDocs(raw): CourtDoc[]`
  把 audit-feed 响应映射成 `CourtDoc[]`，**保留 provenance/evidence_ref/sourceLabel**（映射时缺失字段
  按契约诚实置默认：sourceLabel 缺 → `'MIXED'`，证据授权无法判定 → `'unknown'`，绝不臆造 `authenticated`）。
- 503 / 空数组 / 网络错 → `docs: []` + `source: 'empty'|'error'`；不静默塞 MOCK。

**改** `src/features/scribe/components/scribe-hub-board.tsx` 中栏（仅中栏，左右栏不动）：
- 引入 `useCourtDocs()`，替换两处 `MOCK_COURT_DOCS`（L106 exportableDoc、L266 卷宗列表）。
- 三态渲染：
  - `isLoading` → 骨架卡（暗金占位，非 spinner 滥用）。
  - `source==='live'` → 真卷宗列表（`ArchiveCard`），顶部小徽标"LIVE · 真数据"。
  - `source==='empty'|'error'` → **诚实空态**："暂无真实卷宗（后端未配置/无数据）"，并给一个"查看样例"开关，
    点开才显示 `MOCK_COURT_DOCS` 且每卡打"样例·非真数据"角标（对齐 DESIGN.md：demo 不冒充产线）。
- 每张 `ArchiveCard` 已接受 `CourtDoc`：确认渲染 sourceLabel + `AUTH_LABEL[evidence auth]` + evidence_ref；
  `isUnverifiable(doc,item)` 为真时卡片标"未接地·待核"（不给绿灯），呼应后端"占位不冒充权威"原则。

## 5. 错误处理 · 诚实红线

- 后端不可用 = 显示"暂无真实卷宗"，**绝不回退成看起来像真的 MOCK**（DESIGN.md 硬红线：数据画死=demo 不上产线）。
- MOCK 仅在用户显式"查看样例"时出现，且每卡带"样例"角标。
- 映射缺字段一律诚实置默认（unknown/MIXED），不臆造 authenticated/绿灯。

## 6. 测试 · 验证（本仓 nodetest + 浏览器）

- `use-court-docs.nodetest.ts`：`mapAuditFeedToCourtDocs` 纯函数——真样例→CourtDoc[] 字段正确；
  缺 provenance→置 unknown/MIXED 不臆造；空/503 输入→[]。
- 浏览器实测：`/scribe` 页面 —— 后端起时中栏显真卷宗且每卡有来源；后端停时显诚实空态+样例开关；
  trace-evidence 打开 `EvidenceChainPanel`、export-amulet 按 `canExportAmulet` 可点、taskId 链接可达。
- 不新增/不改动 `src/app/api/**` 路由文件（避并发冲突）。

## 7. 关键文件清单（都在 scribe feature 内，最小面）

- 新增：`src/features/scribe/hooks/use-court-docs.ts`、`src/features/scribe/hooks/use-court-docs.nodetest.ts`
- 改：`src/features/scribe/components/scribe-hub-board.tsx`（仅中栏）
- 复用不改：`court-doc.ts`、`archive-card.tsx`、`evidence-chain-panel.tsx`、`glass-panel.tsx`、`design-tokens.ts`

## 8. 并发协调（本仓 AGENTS.md 已警示多 agent 同跑）

- 本刀只碰 scribe feature 内文件，避开并发 agent 正在改的 `src/app/api/**`、`departments/**`、censor。
- 提交走文件级 pathspec，只提交上面清单文件，绝不 `git add .`。
- 实现分支：off 当前 HEAD 新建 `feat/scribe-real-court-docs`（避免混入他人 `fix/censor-menxia-pointer` 提交）——
  具体分支/worktree 隔离方式在进入实现前与用户确认（并发共享工作树，切分支会影响他人）。
