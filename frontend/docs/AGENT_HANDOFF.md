# AGENT HANDOFF — feat/courtos-loop-harness（2026-06-17）

> 本分支同时有多个 agent 在推 CourtOS §13 Loop+Harness。本文是**协调与交接现状**，
> 规则正本见 `AGENTS.md` §13.2 规则 9（引擎边界）+ 规则 10（地盘协议）。改前必读。

## 1. 两个决策引擎（这是当前最重要的架构现实）

朝堂现在有 **两个** 决策引擎，**不要让它们各自长出第二套奏折/sourceLabel/质门**：

| 引擎 | 入口 | 实现 | 定位 |
|---|---|---|---|
| **前端 CourtOS（轻咨询）** | `/throne/decision` → `/api/court/decision` | `src/core/courtos/**`，直连 `callLLM`→LiteLLM:4444→真 Claude | 无重资产、无外部副作用的**咨询决策** |
| **后端 jiqun（重产线）** | command-center → `POST /swarm/run` | `jiqun_ai_fresh` FastAPI `:8081`，蜂群 flow | **PACK/报价/真实产线**全流程 |

**边界（§13.2 规则 9）**：前端 CourtOS 一旦触碰 **真实产线资产**（PACK / 报价 / BOM / 交期 / 交付 / 付款 / 对外承诺 / 供应商锁定）→ **必须 HTTP 转后端 `:8081`**，禁前端自建第二套产线 flow。判据是「是否触碰真实产线资产」，不是「谁先写好」。

## 2. 地盘（§13.2 规则 10）

- **core-builder**：独占 `src/core/courtos/**`（decision-loop / agent-harness / report-quality-gate / human-approval-gate / runtime / executors）。
- **fusion（本说明作者）**：`e2e/**` + 发布门禁 + 后端 `jiqun_ai_fresh/web/**` + 端到端验证。
- **共享文件**（`AGENTS.md` / `src/lib/jiqun-api.ts` / `src/lib/contracts/**` / `package.json` / `next.config.ts`）：改前 commit message 首行喊 `[shared] <文件>`，改完立刻 `pnpm build`。
- 禁 `git add .`；两 agent 不在对方地盘内改文件。

## 3. fusion 侧已完成 / 已验证（2026-06-17）

- 后端 `jiqun_ai_fresh/web/routers/runs.py`：新增 `GET /api/runs/{id}/report`（打包 final_output+qa_result+quality_score）。TestClient smoke：health 200、/report 200(真 run)+404 均验过。
- **§13 活链已端到端验证**：curl `/api/court/decision` → HTTP 200 / 21s / **真 Claude 奏折** / `sourceLabel=LIVE`（标对没误标）/ 驳回-缺证（质量门工作）/ 八段齐全。
- 前端 `command-center/page.tsx`：接入 `useJiqunRunProgress`+`SwarmProgressStrip`（提交→进度可见），tsc 0 + build 0。
- 发布门禁起步：`e2e/decision-loop.spec.ts`（mock `/api/court/decision`，断言八段+sourceLabel+**FALLBACK 不伪装成 LIVE**），`--list` 绿。

## 4. 环境坑（务必知道）

- **basePath**：用 `pnpm dev` 起的 :3002 带 `/chaotang` 前缀（`/throne/decision`→404，`/chaotang/throne/decision`→200）。playwright e2e 范式假设**无 basePath**，所以 **e2e 不能复用这个共享 dev**；跑 e2e 要让 playwright 自起干净 dev（:3002 空闲时）或 CI。
- model gateway：`LITELLM_PROXY_KEY` + `DEEPSEEK_API_KEY` 在后端 `jiqun_ai_fresh/.env`；LiteLLM:4444 活、Ollama:11434 活、:4000 死。
- 改 `AGENTS.md` 前先 `grep "Launch target"` 查深夜冻结。

## 5. 待办（fusion 视角）

- [ ] command-center 4 组开关折叠进「高级」抽屉（降首屏认知税）。
- [ ] evidence loop（上传 UI→lyt / 解析+claim+风险→后端），闭环跑通后单开 track；§13.2 规则 4：上传文件是证据不是 attachment。
- [ ] 把 `e2e/decision-loop.spec.ts` 接进发布门禁脚本（pnpm test:e2e + golden）。

## 6. 前端地盘划分（2026-06-18 立，止血）

本分支两个 agent 反复回退共享文件（personnel/eval:libu/package.json），纯内耗。物理分仓：

| 地盘 | 归属 | 范围 |
|---|---|---|
| 前端页面/UI | **frontend-agent** | `src/app/(dashboard)/**` 页面、`src/features/shangshufang/**`（含 `ShangshufangPage`）、组件、样式 |
| 后端引擎/API/契约 | **fusion-agent** | `src/core/courtos/**`、`src/app/api/court/**`、`config/*.yaml`、`dev/contracts/loops/`、`dev/contracts/schemas/`、`dev/contracts/prompts/departments/**`、`scripts/validate-*.mjs`、`dev/contracts/evals/` |
| 共享文件 | 改前 commit 首行喊 `[shared]` | `config/departments.registry.yaml`、`package.json`、`src/lib/contracts/**`、`AGENTS.md`、`next.config.ts` |

规矩：不在对方地盘内改文件；共享文件改完立刻 `pnpm build` 自检；禁 `git add .`。

## 7. 当前"已建好但没接线"的孤岛（下个工作日第一优先 = 接线，不是新建）

1. **吏部子司 runtime** — 契约+自适应+`determineLibuMode`/`applyEscalationRules` 已建（test:core 绿），但 `unified-decision-loop.ts` 选中 `personnel` 时**还没调它**，吏部分奏没进奏折。
2. **交互智能层 briefing** — `src/core/courtos/interaction/**` 全套已建 + `GET /api/court/briefing` 已 200，但**上书房首屏还没消费它**。接线归 frontend-agent（它的地盘 ShangshufangPage）。
   - ⚠️ briefing 现喂 mock DEMO 数据：接进上书房首屏时必须**明确标 DEMO 横幅**或连真任务，禁 mock 静默冒充真实洞察（PRD §11）。
3. **信任地板分散** — source_label/高风险人工确认/缺证守卫散在 libu/interaction/六部各一套；应收成 `unified-loop` 一个所有输出必过的 chokepoint gate。
