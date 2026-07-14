# Step 0 可信基线：上书房 → 蜂群

采集日期：2026-07-14（Asia/Shanghai）
代码快照：`feature-chaotang-ext` / `aa600fe`
声明：以下仅证明当前工作区和本机运行态，不代表生产环境。

## 1. 数据流与事实源

```text
ShangshufangPage
  -> frontend/src/lib/jiqun-api.ts (/api/court/shangshufang/*)
  -> frontend proxy/compat boundary
  -> backend/web/routers/shangshufang.py (/api/shangshufang/*)
  -> ChancellorRoutingService
  -> DecisionTask + CourtLoopRun + RouteDecision + Outbox
  -> current daemon dispatch / outbox_worker
  -> swarm_execution_loop
  -> status API
  -> frontend currently performs additional local synthesis
```

后端 Pydantic/OpenAPI 是请求契约事实源；前端类型目前为手工维护的消费契约，尚未由 OpenAPI 生成。正式响应没有 response model，因此当前只能冻结行为样例，不能宣称响应 schema 已收口。

## 2. 冻结的正式接口

| 接口 | 请求 schema | 响应 schema | 当前证据 |
| --- | --- | --- | --- |
| `POST /api/shangshufang/draft-edict` | `DraftEdictRequest` | 宽松 object | OpenAPI snapshot + direct/council/mixed/422 golden |
| `POST /api/shangshufang/confirm-edict` | `ConfirmEdictRequest` | 宽松 object | OpenAPI snapshot + 既有 API 回归 |
| `GET /api/shangshufang/tasks/{task_id}/status` | path param | 宽松 object | OpenAPI snapshot + 既有 API 回归 |
| `POST /api/shangshufang/tasks/{task_id}/decision` | `DecisionRequest` | 宽松 object | OpenAPI snapshot + 既有 API 回归 |

冻结产物：

- `backend/tests/fixtures/shangshufang_contract_baseline_v1.json`
- `backend/tests/test_shangshufang_contract_baseline.py`
- `frontend/src/features/shangshufang/api/contract-baseline.nodetest.ts`

## 3. sourceLabel / engineTier 裁决

`sourceLabel` 目标语义是**证据来源/可信边界**。蜂群 runtime/wire 当前实际接受以下六个 legacy 值：

- `LIVE`：真实服务结果，但仍需具体证据引用；不得仅因接口可达而使用。
- `LIVE_SWARM`：真实蜂群执行结果。
- `LIVE_ENGINE`：legacy 值，把引擎身份错误耦合进 sourceLabel。
- `MIXED`：真实用户/外部证据与规则或模型合成混合。
- `FALLBACK`：规则模板、降级或无真实执行证据。
- `DEMO`：演示数据。

正式上书房前端类型目前只有五值，遗漏 `LIVE_ENGINE`；后端 Chancellor `SourceLabel` 只有 `LIVE/MIXED/FALLBACK/DEMO`，还遗漏 `LIVE_SWARM`。六/五/四值都是当前事实，不是目标词汇。Launch S4 必须定义兼容迁移：legacy `LIVE_ENGINE` 映射为 `engineTier=real`，sourceLabel 再依据真实证据计算；兼容期接受旧值但不得继续生产新耦合。

`engineTier` 表达**计算引擎等级**，与 sourceLabel 正交，候选值为 `real | llm_roleplay | rule_template`。当前正式 API 没有这个字段，状态为 `BLOCKED_FOR_LAUNCH_S4_S8`，本步不擅自加入运行契约。

draft 当前外部 wire mode 使用 `cluster`，而 RouteDecisionV2 目标模式使用 `council`。`cluster` 仅作为 legacy alias 冻结；Launch S4 必须定义兼容 adapter/弃用窗口，不能把它提升成目标领域枚举。

已确认漂移：status 与 decision 顶层硬编码 `sourceLabel=LIVE`，可能与 task/review 的 `FALLBACK` 冲突。该事实已冻结为已知失败，不在 Step 0 修复。

## 4. 本机运行拓扑证据

| 端口 | PID / cwd | 结果 | 结论 |
| ---: | --- | --- | --- |
| 3050 | PID 1848，`/home/ubuntu/workspace/frontend/chaotang-master-wt` | `/chaotang/api/health` 200 | foreign frontend，不是本 monorepo |
| 8081 | PID 974，`/home/ubuntu/Projects/chaotang-os/backend` | `/api/health` 200 | 当前 monorepo backend |
| 4444 | PID 5066/6020，多监听地址 | `/v1/v1/models` 404 | LiteLLM 探针路径错误且存在多进程/多监听 |

`pnpm prod:doctor -- --json`：退出码 2，decision=`STOP`；失败项为 `foreign_prod_3050` 与缺少 `frontend/builds`。true-chain health 为 ready 不能覆盖这两个发布阻断项。

## 5. 本机数据库快照

- `backend/data/fengqun.db`：2,121,728 bytes，WAL，`user_version=0`。
- 只读计数：DecisionTask 13、CourtLoopRun 26、ChancellorRouteDecision 13、OutboxEvent 11、SwarmRun 11。
- `backend/memory/state.db`：4,272,128 bytes。

这些是本地开发数据，不证明生产规模。生产数据库类型、revision、行数、孤儿记录和 tenant 回填映射仍未知，阻塞 Step 1A–1C。

## 6. 已确认事实、推测与未知

| 分类 | 结论 | 证据 | blocks_steps |
| --- | --- | --- | --- |
| 事实 | 四个正式响应均无 Pydantic response model | `app.openapi()` + snapshot test | Launch S4 |
| 事实 | sourceLabel 在 legacy runtime、前端和 Chancellor 契约中分别为六/五/四值 | fixture + runtime constant + Node test | Launch S4/S8 |
| 事实 | direct 当前写 `direct_completed` 但未产生真实 agent receipt | `backend/web/routers/shangshufang.py` direct 分支 | Launch S6/S8 |
| 事实 | council confirm 同事务写 outbox，之后进程内触发派发 | router + dispatcher | Launch S8 |
| 事实 | 前端有 backend adapter 与 local synthesis 两套判断 | `jiqun-api.ts` + `ShangshufangPage.tsx` | Launch S6 |
| 推测 | 用持久化控制面包裹现有蜂群算法足以支持首发 | 待故障/容量数据验证 | Launch S8 |
| 未知 | 生产拓扑、流量、时长、限流、成本 | 无生产观测权限/证据 | Launch S3/S8/S10 |
| 未知 | 生产 tenant 回填与孤儿数据规则 | 无生产数据字典 | Launch S5 |
| 未知 | 质量门误放/误拦基线 | 尚无标注样本报告 | Launch S7 |

## 7. Step 0 完成边界

本步完成只表示：契约现状可重复、黄金行为可重复、ADR 与威胁边界已记录、未知项有阻断关系。它不表示权限、worker、DAG、前端事实源或上线门已经修复。

## 8. Task 8 动态复验（2026-07-14 23:55–2026-07-15 00:04）

最终记录快照：`feature-chaotang-ext` / `96d9a382f978bc457b9f4eb1e8c4a77ad650ac26`。复验期间 HEAD 曾从 `a073811` 前进到 `cbbe5e2`，全量测试期间又前进到 `96d9a38`；因此上书房组合与全量后端均在稳定的 `96d9a38` 上复跑。以下结果只绑定该最终快照和本机环境。

| 验证面 | 结果 | 结论 |
| --- | --- | --- |
| Build | PASS | 无环境首次 fail-closed；显式 `NEXT_PUBLIC_API_MODE=real` 后 `pnpm build` exit 0，40 routes |
| TypeScript | PASS | `pnpm exec tsc --noEmit` exit 0 |
| Lint | UNAVAILABLE | `package.json` 无 lint script，`node_modules/.bin/eslint` 不存在；不伪报 PASS |
| Frontend contract | PASS | 沙箱内 tsx IPC 为 EPERM；沙箱外同命令 2/2 passed |
| Backend OpenAPI baseline | PASS | 单测 1/1 passed，保留 2 个既有 duplicate operation ID warning |
| Backend contract baseline | PASS outside sandbox | 沙箱内 `direct_fallback` 超时根因为 asyncio 自唤醒 socket `send()` 被拒绝（`PermissionError: EPERM`），不是业务 hang；沙箱外整文件 6/6 passed，2 warnings，3.46s |
| Shangshufang related regression | PASS outside sandbox | 最终 SHA 上合同、主循环、outbox、Chancellor 和 execution status 组合回归 38/38 passed，4 warnings，9.87s |
| Backend harness doctor | PASS | 0 errors / 0 warnings |
| Frontend/root doctor | PASS on final SHA | 中途因范围外不完整 change 各失败一次；owner 收口后最终均 0 errors / 0 warnings |
| Secret scan | PASS | 本 change 未发现常见 token/private-key/credential assignment 模式 |
| Diff check | PASS | `git diff --check` exit 0 |
| Browser | BLOCKED | `prod:doctor` exit 2/STOP：foreign 3050、missing `frontend/builds`、JWT runtime identity 缺失 |
| Full backend | FAIL baseline captured | 最终 SHA 沙箱外全量 2601 passed / 26 skipped / 9 failed / 12 warnings，330.85s；失败集中在 doc duplicate、DecisionTask 单写门、legacy metric、lawyer RAG、persona roster、Tianjian item count，均不在本 change 文件范围 |

本轮总体结论：`NOT READY`。Task 8 已排除后端合同 hang，并获得合同及上书房相关回归绿色；全量后端仍有 9 个范围外失败，且没有真实浏览器或生产证据，不能把 Step 0 或发布状态升级为完成。
