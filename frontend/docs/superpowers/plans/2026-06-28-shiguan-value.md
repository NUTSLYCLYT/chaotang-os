# 史馆「鉴往知来」闭环 v1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。Steps 用 `- [ ]`。

**Goal:** 让史馆从"只归档"升级为**看得见 + 带结果**的鉴往知来:决策时可见"引用了 N 条旧案 + 旧案的真实结果",旧决策可回填 outcome(达成/未达成/部分)。

**Architecture:** 复用已接通的归档/召回闭环(`findSimilarCourtArchives` / `court_archives` / `shiguan_archives` / 已存在的 retrospective API)。仅补 3 处:① 召回 SQL LEFT JOIN 带出 outcome;② 史馆时间轴卡加 outcome 回填控件+角标;③ 上书房圣旨"史馆旧案"行加"引用 N 条"徽章+旧案结果。前端咨询性质(铁律13.2.9),不碰后端 jiqun。

**Tech Stack:** Next.js 16 App Router、TypeScript、Turso(@libsql)、tsx `--test`、Playwright。

## Global Constraints

- **铁律4(高危·双门)**:本功能命中两类高危——(1) 加"引用旧案 N 条"**徽章**(给决策呈现加视觉权重);(2) outcome 回填**写 shiguan_archives**。**强制**:① 独立 code-reviewer 会审真实 diff;② 至少 2 条回归断言(召回带 outcome 正确 / 徽章只在真有旧案时显示且不冒充定论)。
- 召回只读 `court_archives` + LEFT JOIN `shiguan_archives` ON task_id;**不改归档写入逻辑**,不新建第二套召回。
- outcome 回填走**已存在**的 `POST /api/shiguan/archives/[archive_id]/retrospective`(已守会话鉴权,铁律1);**不新建写端点**。
- sourceLabel/reality 一律经 `@/lib/reality/reality-state`;outcome 取不到显"未回填",**绝不编**"达成"。
- 视觉只用已注册 utility class / design-tokens,**不改 globals.css / design-tokens.ts**(AGENTS.md §2)。
- 测试 `npm run test:node`(*.nodetest.ts);改 tsx 必跑 `pnpm exec tsc --noEmit` + `NEXT_PUBLIC_API_MODE=real NEXT_DIST_DIR=.next-buildcheck npm run build`。
- 不提交/不推(铁律15),等用户指令;本分支在隔离 worktree。

---

### Task 1: 召回带 outcome(后端 SQL + 类型)

**Files:**
- Modify: `src/core/courtos/archive/archive-store.ts`(`findSimilarCourtArchives` 的 SELECT + `PriorCase` 映射;~172-192)
- Modify: `PriorCase` 类型定义处(grep `interface PriorCase` 或 `type PriorCase`,加 `retrospectiveStatus?: string` + `outcome?: string`)
- Modify: `src/core/courtos/archive/buildRecallQuery`(召回 SQL 所在;grep `buildRecallQuery`)— LEFT JOIN `shiguan_archives` ON `court_archives.task_id = shiguan_archives.task_id`,SELECT `shiguan_archives.retrospective_status`
- Test: `src/core/courtos/archive/recall-outcome.nodetest.ts`(新建)

**Interfaces:**
- Produces: `PriorCase` 增 `retrospectiveStatus?: string`;`findSimilarCourtArchives` 返回项带它

- [ ] **Step 1:先读真身**:读 `archive-store.ts` 全文 + `recall-guard.ts`(buildRecallQuery)+ `schema.ts` 的 `court_archives`/`shiguan_archives` 两表定义,确认 ① 两表都有 `task_id` 列 ② 召回 SQL 当前 SELECT 字段。若 `court_archives` 无 task_id 则改用其它可关联键(如 id),据真实 schema 决定 JOIN 键。
- [ ] **Step 2:写失败测试** `recall-outcome.nodetest.ts`:用内存 libsql 建 court_archives + shiguan_archives 两表,插一条归档 + 对应 retrospective_status='达成' 的 shiguan_archives 行,调 `findSimilarCourtArchives`,断言返回项 `retrospectiveStatus === '达成'`;再插一条无 retrospective 的,断言其 `retrospectiveStatus` 为 undefined/'not_started'(不编)。
- [ ] **Step 3:运行验证 FAIL** — `npm run test:node -- src/core/courtos/archive/recall-outcome.nodetest.ts`
- [ ] **Step 4:改 SQL + 类型**:`PriorCase` 加 `retrospectiveStatus?: string`;buildRecallQuery 的 SELECT 加 LEFT JOIN + `s.retrospective_status`;`findSimilarCourtArchives` 映射 `retrospectiveStatus: r.retrospective_status ? String(r.retrospective_status) : undefined`。
- [ ] **Step 5:验证 PASS + tsc 0**
- [ ] **Step 6:提交** `git add ... && git commit -m "feat(shiguan): 召回带旧案 outcome(LEFT JOIN shiguan_archives)"`

---

### Task 2: outcome 回填 UI(史馆时间轴卡)

**Files:**
- Modify: `src/features/shiguan-ui/components/ShiguanPage.tsx`(`TimelinePanel` 或归档卡渲染处)+ 可能拆一个 `RetrospectiveControl.tsx` 小组件
- Test: 纯函数若有抽取则测;UI 走 Task 5 E2E

**Interfaces:**
- Consumes: `POST /api/shiguan/archives/[archive_id]/retrospective`(body `{ retrospective_status: '达成'|'未达成'|'部分' }`)

- [ ] **Step 1:读真身** ShiguanPage.tsx 的时间轴卡渲染 + `useArchiveRecords` 数据形状(归档行有没有 archive_id / retrospective_status 字段可读)。若时间轴数据未含 archive_id,需确认 `/api/court/shiguan/archive` 返回是否带 id —— 带才能回填。
- [ ] **Step 2:卡上加 outcome 角标**:每条归档卡显示当前 `retrospective_status`(not_started→"未回填"灰;达成→绿;未达成→红;部分→黄),用已注册 utility class,**不冒充**(未回填就显"未回填",不显"达成")。
- [ ] **Step 3:加"标记结果"控件**:卡上一个小按钮组(达成/未达成/部分),点击 `fetch POST /api/shiguan/archives/<id>/retrospective {retrospective_status}` → 成功后 SWR `mutate` 刷新 → 角标更新。失败 toast/inline 错误,不静默。
- [ ] **Step 4:tsc 0 + build 成功**
- [ ] **Step 5:提交** `git commit -m "feat(shiguan): 史馆时间轴卡 outcome 回填(达成/未达成/部分)+ 角标"`

---

### Task 3: 召回可见(上书房徽章 + 旧案结果)+ 史馆空态 CTA

**Files:**
- Modify: `src/features/shangshufang/ShangshufangPage.tsx`(~1089 "史馆旧案"行)
- Modify: `src/features/shiguan-ui/components/ShiguanPage.tsx`(时间轴空态)

- [ ] **Step 1:读真身** ShangshufangPage.tsx 1080-1100 区(archive_hints/priorCases 渲染)+ 圣旨视图数据里 priorCases 是否带 Task1 加的 retrospectiveStatus。
- [ ] **Step 2:上书房徽章**:"史馆旧案"行,当 `priorCases.length > 0` 时显示"引用旧案 N 条"徽章(已注册 utility class,克制——**不放大、不帝金环、不让结论更像定论**,只是中性计数标签,避免铁律4 视觉权重陷阱);每条旧案后缀其 outcome("《XX》· 上次结果:达成/未达成/未回填")。
- [ ] **Step 3:史馆空态 CTA**:时间轴 `chronicleRows.length === 0` 时,显示一句引导 + 跳 `/shangshufang` 的链接("史馆还没有档案 — 去上书房下第一道旨,裁决后这里自动留档")。复用 `DataState` 空态组件若适用。
- [ ] **Step 4:tsc 0 + build 成功**
- [ ] **Step 5:提交** `git commit -m "feat(shiguan): 上书房引用旧案徽章+旧案结果 + 史馆空态CTA"`

---

### Task 4: 铁律4 回归断言

**Files:**
- Create: `src/core/courtos/archive/shiguan-honesty.nodetest.ts`

- [ ] **Step 1:写断言**:① 召回带 outcome——无 retrospective 的旧案 `retrospectiveStatus` 不得是"达成"(只能 undefined/'not_started'),证"不编结果";② 徽章数据——`priorCases` 为空时上书房不显示徽章(从纯函数/数据层断言 N=0 不渲染计数),防"0 条也挂徽章冒充有先例"。若徽章逻辑在 tsx 内联无法纯测,则抽一个 `shouldShowRecallBadge(priorCases): boolean` 纯函数到 lib 并测它。
- [ ] **Step 2:PASS**
- [ ] **Step 3:提交** `git commit -m "test(shiguan): 铁律4 回归断言(不编outcome + 空旧案不挂徽章)"`

---

### Task 5: 独立会审 + 上线端到端验证

> 非纯代码任务,controller 执行。

- [ ] **Step 1:独立会审(铁律4)**:派 code-reviewer 读全分支真 diff,重点:① 召回 JOIN 会不会漏行/串租户(recall-guard 的租户隔离是否仍生效);② outcome 回填鉴权/幂等;③ 徽章是否制造"定论"视觉权重(铁律4 part2);④ outcome 不冒充。修 CRITICAL/HIGH 再继续。
- [ ] **Step 2:上线端到端验证(GSTACK 理念)**:worktree 起 dev(空闲端口),走一遍:① 上书房下旨→裁决 adopt→史馆时间轴出档;② 史馆卡标"达成"→角标变绿;③ 再下同类旨→上书房圣旨显示"引用旧案 1 条 · 上次结果:达成"。截图存 `dev/screenshots/`。
- [ ] **Step 3:全套门**:`npm run test:node` 全绿 + `tsc 0` + `build 成功`。

---

## Self-Review
- 召回带结果(Task1)/ outcome 回填(Task2)/ 召回可见徽章+空态CTA(Task3)/ 铁律4断言(Task4)/ 会审+E2E(Task5)——覆盖"完整闭环"scope。
- 复用已有:findSimilarCourtArchives、retrospective API、court_archives/shiguan_archives、DataState、utility class。无新端点、无新版面(铁律5:溶进史馆已有工位)。
- 待执行期确认:court_archives/shiguan_archives 的 JOIN 键(task_id 是否两表都有);史馆时间轴行是否带 archive_id 供回填;priorCases 是否已透传到上书房圣旨视图。
