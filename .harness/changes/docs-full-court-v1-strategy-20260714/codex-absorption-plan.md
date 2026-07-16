# 主线归并作战方案（发给 Codex 整段执行）

> 依据：`mainline-absorption-review.md`（2026-07-14 三线只读审查，file:line 证据在该文件）。
> 你是唯一写入者。Claude Code 只读审查，每个 Packet 完成后停下等审查。
> 执行状态：FROZEN PLAN v2（2026-07-14 用户批准大神会审修订）。
> P0–P9 是十个顶层 Packet；`P1a/P1b`、`P3a–P3e`、`P4a–P4c` 只是同一 Packet
> 内的严格顺序步骤，不是额外 Packet。
> v2 修订内容：① P0 升级为"记录+修复阻塞验证的测试基础设施最小集"；
> ② P2 增加 canonical 链事件计数与常驻架构守门（import-linter/ESLint）；
> ③ P3 拆除旧端点前必须有 deprecation 计数证据；④ P4 退役前端引擎前必须
> 先蒸馏规则为后端 golden cases；⑤ P7 增加净删除 LOC 与事实源计数 KPI；
> ⑥ 新增 P8 国力卡片、P9 翰林最小读模型（断头板块薄纵切补齐）；
> ⑦ 每 Packet 统一浏览器冒烟旅程验收锚。庄园去留仍属用户裁决，不在本方案内。

```text
你现在是"朝堂 OS 主线归并执行工程师"。

## 总目标

朝堂只有一条 canonical 决策主线：

shangshufang → decision_task_kernel → chancellor routing_service → outbox_events
→ outbox_worker → swarm_execution_loop → CourtReview → FinalMemorial
→ EmperorDecision → ShiguanArchive

本方案不新增产品功能，只做四件事：
1. 统一事实源（部门 ID、迁移权威）；
2. 把 legacy 平行链吸收进主线；
3. 把前端本地二级状态机下沉为后端投影；
4. 退役无调用方的死码。

## 铁律（每个 Packet 都适用）

1. 一个顶层 Packet（P0–P9）= 一个 change（`node scripts/new-change.mjs <type> <name>`）
   = 一个任务分支 = 一个最小可回滚 diff。Packet 内可按 a/b/c 留原子 commit/checkpoint，
   但不得另建 change/分支，也不得在中间步骤越过顶层 Packet 停审门。
2. 分支模型：从 feature-chaotang-ext 切出本地集成线 integration/full-court-v1；
   每个 Packet 开 task/<packet-id> 分支，验收通过后合入 integration/full-court-v1。
   分支和执行必须放在独立 worktree，不得切换或携带当前脏 ext 工作树；
   禁止 push 到 feature-chaotang-ext / dev / master；合回 ext 由用户裁决。
3. TDD：先写失败测试（或先跑出失败证据），再改实现。
4. 不删除任何产品功能；退役=移到 archive/attic 或 feature flag 关闭，附恢复路径。
5. MOCK/DEMO/FALLBACK 不得标 LIVE；诚实标只能加强不能削弱。
6. 禁改：jiqun_ai 平台路由族（runs/prompts/flows/swarm/chat/knowledge/memory 等）、
   大殿/王座冻结礼仪边界（`frontend/src/features/dadian/`、
   `frontend/src/app/(dashboard)/dadian/`、`backend/web/routers/dadian.py`、
   `backend/web/routers/throne.py` 及对应冻结测试）、
   `backend/agent_design/retired_standalone_swarms/`。
7. 每个 Packet 完成后：
   - 证据写入该 Packet 的 change 目录（命令、退出码、测试输出、commit SHA）；
   - 聊天最后一行只输出 PACKET_<ID>_READY_FOR_CLAUDE_REVIEW 或 PACKET_<ID>_BLOCKED；
   - 停下等 Claude Code 审查，不得连做下一个 Packet。
8. 连续三次同因失败即停，输出根因与证据，不盲试。
9. 测试禁止触碰真实控制面数据库（历史事故 S1/S2/S10）；用测试专用 DB/fixture。
10. Claude 审查 NO_GO 时只允许在当前 Packet 分支修正并生成新版证据/审查报告；
    未收到 GO 不得合入 integration，也不得创建或开始下一 Packet。
11. 统一验收锚：每个 Packet（P0 除外）收尾必须跑同一条浏览器冒烟旅程
   （上书房下旨 → 军机处看状态 → 圣裁 → 史馆归档），截图/trace 入 change 目录；
    前端或后端服务不可启动时记录 `SMOKE_NOT_RUN(原因)`，不得默认跳过。
12. 蒸馏优先于删除：任何待退役代码中的规则表/关键词表/测试断言，先评估是否
    转成后端 golden case 或测试资产，再退役壳；蒸馏结论（收/不收+理由）写入
    change 目录。吸收的对象是行为和知识，不是代码文件。

## Campaign bootstrap gate（不是 Packet，不得夹带业务 diff）

P0 开始前必须先满足：

1. 用户明确批准一个 `BASE_SHA`；默认候选是当前远端一致的
   `feature-chaotang-ext@4f77396314ab91a6d2b7099c83ed135c3dad1037`，但不得由执行者
   在 dirty worktree 中自行猜测或移动。
2. 当前已批准的本方案必须先进入一个明确的 bootstrap docs commit，或由用户明确裁决
   “本轮分支不携带方案文件，只以固定 SHA-256 的外部编排输入执行”。bootstrap commit
   只能包含已批准的方案/审查文档，不能顺带提交当前 ext 的其他 tracked/untracked 改动。
3. 用 `git worktree add` 在独立路径创建 `integration/full-court-v1`，再从 integration
   创建 `task/p0-absorption-baseline`；两个新 worktree 的 `git status --porcelain`
   必须为空。禁止在当前 dirty ext worktree `switch`、stash、reset 或搬运用户改动。
4. 记录 `BASE_SHA`、bootstrap docs SHA、worktree 路径和 `git status --porcelain` 证据。

任一条件未满足，停止并输出 `PACKET_P0_BLOCKED`；不得用复制整个脏 change 目录绕过。

## Packet 序列（按伤害面排序，严格顺序执行）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### P0 基线快照（type: chore, name: absorption-baseline）

目标：记录归并前基线，后续每个 Packet 与它对比。
步骤：
- 先记录 `git rev-parse HEAD`、`git branch --show-current`、`git status --short`、
  测试隔离环境与真实控制面 DB 的测试前 hash/size/mtime；不得把现有脏 ext 改动带入 P0 worktree。
- 跑并记录：`node scripts/harness-doctor.mjs`；后端先运行
  `python3 -m pytest -q tests/test_production_db_tripwire.py` 和 P0 批准的只读/临时库
  代表套件，再做 `python3 -m pytest --collect-only -q` 记录全量集合事实。
- 在 legacy 裸 `sqlite3.connect`、Node/E2E 与脚本级生产路径 tripwire 完成前，
  **不得执行无选择的后端全量 pytest**：已知有测试会硬编码打开
  `backend/data/fengqun.db`。全量项在 baseline 标 `NOT_RUN_SAFETY_BLOCKED`，不算失败，
  也不得在 P0 顺手修复；其解除条件显式移交后续安全 Packet。
- 前端运行 `pnpm test:node` 与
  `pnpm exec tsc --noEmit`（同样使用有界超时）。
- 记录 `package.json` 是否存在 lint script；不存在只记 `MISSING`，不得临时补 lint。
- 测试后再次核对真实控制面 DB hash/size/mtime；任何变化立即 `PACKET_P0_BLOCKED`。
- 已知问题分两类处置（v2 修订）：
  a) **阻塞后续验证的测试基础设施问题**（后端契约测试 hang、前端测试套件跑不起来）
     ——在 P0 内修复最小集：只改测试基础设施（conftest/超时/隔离 fixture/测试脚本），
     严禁改产品行为代码；每项修复独立 commit + 前后对比证据。
  b) 其余（个别用例失败、Lint 缺失）只记录不修复。
  判据：修复后必须做到"后端 pytest 与前端 test:node 能在有界时间内跑完并给出
  真实红绿结果"——这是所有后续 Packet 验收的地基，红灯基线不叠 Packet。
验收：baseline.md 落盘，含全部命令+退出码；测试套件可在有界时间内完成
（或明确记录仍不可跑的项与原因）。
回滚：测试基础设施修复可独立 revert。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### P1 部门 ID 双 SSOT（type: refactor, name: dept-id-ssot）

伤害面第一：四套命名体系、≥7 份注册表、≥5 份部门码→AgentCode 映射副本。
canonical 裁决：
- 后端唯一真相源：backend/harness/chaotang_department_protocol/departments.yaml 的 v1_taxonomy；
- 前端唯一真相源：frontend/src/lib/contracts/dept.ts（已自称 SSOT 且有守门测试）。

分两个严格顺序步骤；两步都在 P1 的同一个 change、同一个任务分支内：

P1a 后端：
- chaotang_department_router.py 的 MINISTRY_KEYWORDS/DEPARTMENT_PERSONAS、
  real_department_engines.py、minister_personas.py、config/si_registry.yaml、
  config/court_roles.yaml 全部改为从 departments.yaml 派生或校验一致
  （启动时断言部门码集合与 v1_taxonomy 一致，不一致 fail-fast）。
- 不改 shangshufang_loop.py 的路由规则语义（它是路由真相源，只对齐部门码）。
- 守门：新增测试断言"仓库内部门码集合只有一处定义"，
  golden cases（test_chancellor_golden_cases.py）必须 100% 保持通过。

P1b 前端：
- lib/swarm/dept-identity.ts、lib/swarm/decision-ledger.ts(DEPT_CN)、lib/swarm/merge.ts、
  lib/department-learning/{advisor-signal,real-source,archive-backfill}.ts 中的
  部门码/映射副本全部改为 import contracts/dept.ts。
- ministry-registry.ts / unified/department-registry.ts / six-departments-content.ts /
  chaotang-v1-modules.ts 保留展示字段，ID 词表改为从 dept.ts 派生。
- 扩展 dept-ssot.nodetest.ts：断言全仓（除 dept.ts）不再出现独立部门码字典
 （grep 守门写进测试）。
验收：前后端各自 SSOT 测试通过；golden cases 通过；harness-doctor 0 errors。
回滚：revert 单分支。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### P2 legacy 写入 tripwire 扩容（type: fix, name: flow-store-legacy-tripwire）

目标：把最后一条平行主线的写入点关进 fail-closed。
- 参照 d990a47 的 legacy_write_tripwire.py 模式，把
  src/db/flow_store.py:544-908 的 Decree/Task/Memorial/Review/Retrospective 写入
  与 src/chaotang_store.py 的 JSON+SQLite 双写注册为 legacy writer；
  未注册调用方 fail-closed。
- 现存合法调用方（chaotang_orchestrator._persist_task_done/_error 等）
  暂列白名单并标注"P3 逐个吸收后移除"。
- governance_compat.py 的 _BILLS/_IMA_DOCS 内存 dict：本 Packet 一并处置——
  若前端仍有调用方则改为落 canonical 的最小 adapter，若无调用方则退役归档。
- （v2 新增）观测与守门基建，供 P3/P4 使用：
  a) canonical 链事件计数：outbox 消费、DecreeExecutionEvent 写入、FinalMemorial
     晋升各加计数指标（复用现有 telemetry/truth_ledger 机制，不新建存储）；
  b) legacy 端点 deprecation 计数：chaotang.py 待吸收端点、chaotang_store 读写
     各加调用计数+日志（含调用方标识），作为 P3 拆除前的流量证据源；
  c) 常驻架构守门：后端引入 import-linter（或等价 pytest 断言）声明依赖方向
     ——生产代码不得新增 import flow_store legacy 写路径；前端 ESLint
     no-restricted-imports 禁止生产代码 import dev/_attic 与本地决策引擎。
验收：新增 tripwire 测试（未注册写入必须抛错）；白名单清单落盘 change 目录；
计数指标可读出非零/零值证据；架构守门在 CI/测试中生效（违规样例必须报错）。
回滚：tripwire 注册表可整体关闭（保留开关）；计数与守门可独立 revert。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### P3 chaotang legacy 链逐端点吸收（type: refactor, name: chaotang-endpoint-absorb-<endpoint>）

样板：chaotang.py:788 memorial_review 已改写 canonical EmperorDecision——照抄该节奏。
规则：P3 只有一个 change、一个任务分支；五个端点步骤各自形成一个原子 commit/checkpoint，
严格按 P3a→P3e 推进，禁止一口吃 79KB，也禁止拆成五个并行分支。只有 P3e 完成并汇总
整个 P3 diff 后，才输出顶层 Packet 停审 token。

吸收顺序（先读后写，先低风险）：
1. P3a 只处理 scribe.py 的 chaotang_store 双读 → 切 canonical 单读源
   （FinalMemorial/ShiguanArchive 投影）。`throne.py` 属冻结王座边界，本 Packet
   只记录其 legacy 双读证据并列为 `DEFERRED_REQUIRES_USER_DECISION`，不得修改。
2. P3b chaotang.py taskDetail + /api/chaotang/stream/* → 用 canonical
   swarm-runs/DecreeExecutionEvent 事件投影替代；前端 lib/api/chaotang.ts:457
   调用点同步改接（前端改动最小化：同形状 adapter 优先）。
3. P3c manor.py / direct.py 的 chaotang_orchestrator 派发 → 改走
   decree_dispatcher+outbox；只允许等形 dispatch adapter，保持页面/路由现有可用性。
   庄园是否 feature flag 关闭、归档或退役属于用户裁决，本 Packet 不做。
4. P3d chaotang.py 剩余 daemon thread（:221,:1084）拆除：所有执行统一走
   outbox_worker；_RUNSTATE_TO_TASKSTATUS(:385) 随之删除。
   （v2 前置条件）拆除任一旧端点/旧链前必须出示 P2 的 deprecation 计数证据：
   新链事件计数上升、旧链调用计数在观测窗口内归零。内测环境流量少，观测窗口
   可由用户书面确认压缩（默认建议 ≥3 个真实使用日）；无计数证据只能
   feature flag 关闭，不得物理拆除。用数据宣布死亡，不用 commit message。
5. P3e 白名单清零：移除 P2 白名单里已吸收的 writer；flow_store legacy 表
   只读化（写路径全部 tripwire）。
每步验收：对应端点契约测试（正常+失败+权限）通过；前端调用点无 404/形状漂移
（api-contract audit 脚本跑通）；golden cases 通过。
回滚：P3 以各步骤原子 commit 为回滚检查点，但顶层仍只有一个 change/分支；
tripwire 白名单只能按已记录的临时恢复程序加回。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### P4 前端二级状态机下沉（type: refactor, name: frontend-second-brain-sunset）

目标：前端不再本地合成"六部会审/御史审核/综合报告/圣裁"，只投影后端事实。
现状锚点：ShangshufangPage.tsx:1526-1549、junjichu/page.tsx:380-406 调用
core/courtos/ministries/{ministry-review-loop,yushitai-auditor,imperial-report-synthesizer}
+ unified/unified-decision-loop。

分三个严格顺序步骤；三步都在 P4 的同一个 change、同一个任务分支内：
- P4a 军机处先行：junjichu 页改为纯投影 swarm-runs + CourtReview/FinalMemorial
  读模型；后端读模型若缺字段（nextAction/missingEvidence 等），先在后端补投影
  字段（读模型扩展，不新增状态机），再删前端重算。只允许改 court-owned projection，
  禁止修改 `runs/prompts/flows/swarm/chat/knowledge/memory` 平台路由族；若缺字段只能
  通过改平台路由满足，则 P4a `BLOCKED` 并请求用户裁决。command-center 复用页自动跟随。
- P4b 上书房跟进：同法删 :1526-1549 本地合成；保留纯展示派生（格式化、分组）。
- P4c core/courtos 本地引擎处置（v2：蒸馏后再退役，TDD 顺序强制）：
  第一步 **蒸馏**：把 ministry-review-loop/yushitai-auditor/
  imperial-report-synthesizer/unified-decision-loop 中的关键词规则表、
  分诊正则（hasFinanceIntent/hasLegalIntent 等）、风险规则导出为后端
  golden case 数据集与测试断言——先写这些 golden case 测试（对后端读模型，
  初始应失败或标 xfail 待 Wave 3 实现），确认规则知识已入库；
  第二步 **退役**：引擎移入 dev/_attic 或标记 @deprecated 并断开生产 import。
  删除即验证：蒸馏测试在，删壳不丢知识；
  工部/御史纯前端脑、刑部 clause 本地扫描、锦衣卫本地雷达（lead-radar/
  tender-radar/competitive-edge）在本 Packet 只做"诚实标降级"
 （不得出现在正式结论区，标 EXPERIMENTAL/SHADOW），后端化列入 FULL_COURT_V1
  Wave 3 对应部门的纵切任务，不在本方案内强行完成。
验收：junjichu/上书房 页面状态全部来自后端读模型（grep 守门：生产代码不再
import 上述引擎）；sourceLabel 不出现 MIXED 本地合成路径；浏览器冒烟
（上书房下旨→军机处看状态→圣裁）通过。
回滚：（v2.3 修订，2026-07-16——原文"切回旧渲染路径"作废）emergency
kill-switch：`NEXT_PUBLIC_COURTOS_CANONICAL_PROJECTION` 关闭时 fail-closed
进入诚实等待态，**永不恢复已退役前端引擎**。理由：回滚路径若能复活旧引擎，
引擎须保持生产可 import，架构守门与 P4c 退役即告作废；且事故时刻切回
关键词引擎=给用户看伪造裁决，空白等待态（"暂无裁决"）优于假结论——
"失败是一等状态/MOCK 不得冒充 LIVE"在回滚设计中的贯彻。实现见
frontend/src/lib/courtos/canonical-projection-rollout.ts（P4 审查 v2 GO 认可）。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### P5 迁移权威归一（type: fix, name: alembic-single-authority）

> **范围递减登记（2026-07-15，随 P1 落地）**：alembic 005 degenerate sequence
> 三连修已合入 ext（`a073811`、`df0c5d5`、`9968418`，P1 验证阻塞修复）。
> P5 执行时计入这三笔、不得重复修；P5 的 expand/contract 验证须覆盖修复后的 005。

- create_all 降级为 dev-only：backend/web/main.py:95、formal_memorial.py:50、
  flow_store.py 多处——生产路径启动断言"必须 Alembic head"，否则 fail-fast。
- flow_store.py 内手写 DDL/索引补丁迁入正式 alembic 版本后移除。
- 验证 expand/contract：旧库升级到 head、空库从零迁到 head 两条路径都要有证据。
验收：alembic upgrade head 幂等通过（两种起点）；生产模式下绕过 Alembic 的
建表路径 0 条。
回滚：迁移脚本带 downgrade；create_all 开关保留一个版本周期。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### P6 死码退役（type: chore, name: orphan-retirement）

全部"移动归档+断 import"，不物理删除：
- src/swarm_orchestrator.py（EventBus 孤儿，无 canonical 调用方）；
- 前端 governance 三省族：lib/orchestration/court-pipeline.ts、
  features/governance/lib/three-chamber-engine.ts、deliberation-console.tsx
 （0 运行时挂载）及其孤儿测试；
- qintian_forecast.py + forecast_intel_taiyi.py 的自承 mock 端点
 （qintianjian.py 为 canonical 保留）；
- `config/flow_opc.yaml.bak` 等 `.bak` 副本也移动到明确 attic/archive，并记录原路径；
  本 Packet 不物理删除任何文件，Git 历史不能替代本轮要求的显式恢复路径。
- （v2.1 增补，2026-07-15；v2.2 修正措辞）两个显式子步骤：
  a) **失效守门语义迁移（不是退役）**：台账前端 #2/#4/#5-7 五项测试因引用
     已删除 `frontend/src/app/api/**` 而 ENOENT，但其守门意图仍有效——
     零写主库隔离（铁律4/C1）、real-source 生产 sign-off 回填、
     e2e 伪造后门已除、dispatchDeptToSwarm 全部过 requireCourtSwarmAuth。
     处置：把每条守门**重写为针对现行架构的等价断言**（真实 backend
     boundary / 现行调用面），新旧意图一一对照落盘；只有当某条守门的
     威胁模型被证明整体消失时才允许退役，且须单独说明。禁止以"文件不存在"
     为由整批删除安全与数据隔离守门。
  b) **陈旧断言清理**：修正 chaotang 1.0 secondary modules `active/pending`
     与 bureau `出纳司/国库司` 旧预期（台账前端 #1/#3——纯展示预期漂移，
     无守门语义）。
验收：退役清单+恢复路径落盘；仅在生产路径 tripwire/隔离 wrapper 已证明安全时
运行全量测试，否则按 P0 口径执行批准代表套件并显式记录 `NOT_RUN_SAFETY_BLOCKED`；
harness-doctor 通过；
退役后 grep 0 生产引用。
回滚：从 attic 移回。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### P7 收尾对账（type: docs, name: absorption-closeout）

- （v2.1 增补）步骤一：修复 `test_commit_closeout_check.py`（文档重复主题
  检测，台账后端 #1），使收官文档自身通过机器门。
- 与 P0 基线对比：legacy 写入点清零证明、状态机计数（目标：后端 1 权威+投影、
  前端 0）、部门码定义点计数（目标：后端 1 + 前端 1）。
- （v2 新增）战役 KPI 对账：净删除 LOC（目标为负增长——本战役成功标志是仓库
  变小、定义点变少）；事实源计数前后对比表；新旧链流量曲线（canonical 事件
  计数上升 vs legacy 计数归零）作为吸收完成的最终数据证明。
- 更新 mainline-absorption-review.md 各项状态为 done/deferred。
- 剩余 deferred 项（prompt 三体系收敛、契约 codegen、庄园去留、部级前端脑
  后端化）明确列入 FULL_COURT_V1 Wave 对应位置，不悄悄消失。
P7 实现完成时仍按统一停审门，最后一行只输出
`PACKET_P7_READY_FOR_CLAUDE_REVIEW` 或 `PACKET_P7_BLOCKED`。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### P8 国力薄纵切（type: feat, name: guoli-thin-slice）（v2 新增，断头补齐）

原则：不建新页面王国。后端已被证明（guoli.py 御史封驳率 LIVE 读 truth_ledger），
前端只做薄投影。
- 把御史封驳率做成一张指标卡，嵌入**已有**权威页面（大殿 pulse 属冻结边界
  ——若唯一合理落点是大殿，则 `BLOCKED` 请求用户裁决；否则优先六部总览
  liubu/page.tsx 顶部）。
- 卡片字段严守国力契约：值、样本数、时间窗口、数据来源、截止时间、
  是否含 DEMO、状态；样本不足显示 NO_DATA，禁止伪精确百分比。
- 其余三个 NO_DATA 指标不做 UI；独立国力页面等 LIVE 指标 ≥4 再立项
 （列入 FULL_COURT_V2_BACKLOG 或 Wave 6，不在本 Packet）。
- 验收含"删除 mock 兜底"检查：卡片数据只能来自 /api/guoli 真实读模型，
  无本地合成、无静态数据。
验收：卡片渲染真实后端数据（浏览器截图+API 响应对照）；NO_DATA 分支有测试；
冒烟旅程通过。
回滚：feature flag 关卡片。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
### P9 翰林最小读模型（type: feat, name: hanlin-min-read-model）（v2 新增，断头补齐）

原则：UI 已证明，后端按 UI 实际消费字段倒推最小读模型，不建"翰林域"大后端。
- 盘点 hanlin 前端页面实际消费的字段（hanlin/lib/api.ts 各调用）；
- 选 1 条最有价值的数据线先接真源：skill ledger / overview 从真实归档或
  golden case 记录读取（复用 ShiguanArchive/truth_ledger 现有存储，
  不新建表、不新建状态机）；
- `hanlin-home-mock.ts` 兜底降级为明示 DEMO 标（sourceLabel），生产 flag
  默认关闭 mock；`/api/hanlin/reset-demo` 端点限内部账号；
- 其余数据线维持现状并在 change 目录记录 deferred 清单（归 Wave 3）。
- 验收含"删除（或降级）mock 兜底"检查：接入线的数据不再来自 mock。
验收：接真源的那条线端到端通过（正常+空态+权限）；mock 只在 DEMO 标下可见；
冒烟旅程通过。
回滚：feature flag 切回 mock 兜底（保留诚实标）。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 战役完成定义（DONE 的硬门，不可由实现者放宽）

`ABSORPTION_CAMPAIGN_DONE` 只有在以下条件**全部**满足时才允许输出：

1. P0–P9 十个 Packet 全部 Claude 审查 GO 且已本地合入 integration；
2. 全程零未闭环验证残留——以下任一存在即禁止 DONE：
   - 任何 Packet 的 `SMOKE_NOT_RUN`（冒烟旅程未真实跑通）；
   - 任何 `NOT_RUN_SAFETY_BLOCKED` 的测试套件（含 P6 全量测试）；
   - 任何 ci_summary 中的"未验证项"仍未验证；
   - P3 任何端点是"flag 关闭但计数证据缺失"的临时态；
   - P8/P9 的 mock 兜底仍在生产路径可达。
3. P7 KPI 对账三项齐备：legacy 写入点清零、事实源计数达标
  （部门码后端 1+前端 1、状态机后端 1+前端 0）、新旧链流量曲线交叉归零；
4. P4c 蒸馏 golden case 测试全部存在且被 CI 收录（允许 xfail 标记待 Wave 3
   实现，但必须计入 deferred 清单，不得静默消失）；
5. 显式 deferred 清单（庄园裁决、部级前端脑后端化、prompt/契约收敛、
   xfail golden cases 等）完整落盘并映射到 FULL_COURT_V1 Wave 位置。

任何一条不满足，只能申报 `PARTIAL(+逐项未闭环清单)`。
PARTIAL 不是失败，是诚实状态；把 PARTIAL 报成 DONE 等同伪造 LIVE。

### 收官时序（强制三步，实现者不得自证通过）

1. **Codex 申报**（P9 GO 并合入 integration 后）：写
   `.harness/changes/docs-full-court-v1-strategy-20260714/campaign-closeout-claim.md`，
   内容：对五项硬门逐条自检（每条附指向 change 目录可复核文件的证据路径）+
   申报结论（DONE 候选或 PARTIAL+清单）。聊天最后一行只输出
   `CAMPAIGN_CLAIM_READY_FOR_CLAUDE_REVIEW`。此时**不得**输出 DONE/PARTIAL 终token。
2. **Claude 终审**（独立于逐 Packet 审查的最后一道门）：按下方"收官终审提示词"
   逐条复核五项硬门，报告落盘
   `packet-reviews/campaign-closeout-review.md`，末行输出
   `CAMPAIGN_REVIEW_GO` / `CAMPAIGN_REVIEW_NO_GO(+不符项)` / `INSUFFICIENT_EVIDENCE`。
3. **Codex 宣布**：终 token 必须与终审通过的申报结论**同型**——
   - 收到 `CAMPAIGN_REVIEW_GO_DONE`（终审确认 DONE 候选五门全过）
     → 才可输出 `ABSORPTION_CAMPAIGN_DONE`；
   - 收到 `CAMPAIGN_REVIEW_GO_PARTIAL`（终审只确认了 PARTIAL 清单真实完整）
     → 只可输出 `ABSORPTION_CAMPAIGN_PARTIAL(+清单)`，**永远不得**升格为 DONE；
     后续想升 DONE 必须补齐缺项后重新从第 1 步走 DONE 申报；
   - 收到 NO_GO 时只能：a) 按不符项修正后重新走第 1 步（claim 文件出 -v2 版本，
     不覆盖历史），或 b) 降格改申报 PARTIAL 并重新走第 2 步终审。
   跳过终审、或输出与终审 token 不同型的终 token，均视为伪造，
   Claude 发现即整体 NO_GO 回退。

## 每个 Packet 的证据与停审协议

- change 目录至少包含 `summary.md`、`request_analysis/spec.md`、
  `request_analysis/tasks.md`、`ci_result/ci_summary.md`；P0 另含 `baseline.md`。
- `ci_summary.md` 逐命令记录：命令、工作目录、开始/结束时间、退出码、结果范围、
  未验证项；不得只写“通过”。
- Packet 分支必须有本地 commit；审查 diff 固定为
  `integration/full-court-v1...task/<packet-id>`（P0 则对其创建时的 integration base）。
- 每个 task 分支必须记录 `PREDECESSOR_INTEGRATION_SHA`，它只能是上一个已 GO Packet
  合入后的 integration HEAD；不得从未审或未合并的 sibling branch 起步。
- Codex 输出 diff 摘要、完整 commit SHA、change 证据路径和未验证项；聊天末行只能是
  `PACKET_<ID>_READY_FOR_CLAUDE_REVIEW` 或 `PACKET_<ID>_BLOCKED`。
- Claude 报告写入当前 Packet worktree 的 `packet-reviews/<packet-id>-review.md`，
  报告头必须绑定 `BASE_SHA`、`HEAD_SHA`、change ID、branch 和 worktree；Codex 随后
  只允许增加一个 review-evidence-only commit。GO 后才允许本地合入 integration。
  NO_GO 在原 Packet 分支修正，再产生新 HEAD 和 `-v2/-v3` 报告，不覆盖历史报告。

## 明确不在本方案内（防跑偏）

- prompt 三体系收敛、契约 codegen 化（列入后续，风险可控已有 audit 守门）；
- 国力**独立页面**、翰林**完整后端域**（P8/P9 只做薄纵切，扩建归 Wave 3/6）；
- 庄园/大殿/王座产品去留（用户裁决）；
- 部级前端脑（工部/御史/刑部 clause/锦衣卫雷达）的后端化（P4c 只降诚实标，
  实现归 Wave 3）；
- 任何六部业务能力增强；
- jiqun_ai 平台治理。

现在从 P0 开始。
```

---

## 给 Claude Code 的逐 Packet 审查提示词（每个 Packet 后使用）

```text
你是朝堂 OS 主线归并 Packet 审查者。仓库只读；唯一允许写入：
.harness/changes/docs-full-court-v1-strategy-20260714/packet-reviews/<packet-id>-review.md。

审查对象：Codex 刚完成的 Packet 分支相对 `integration/full-court-v1` 的完整 diff
+ 其 change 目录证据；不得只看最后一个 commit。

审查输入必须先记录：`BASE_SHA`、`HEAD_SHA`、branch、worktree、change ID、
`PREDECESSOR_INTEGRATION_SHA`、`git status --porcelain`、是否存在 push/upstream；
任一缺失时输出 `INSUFFICIENT_EVIDENCE`。

检查：
1. diff 是否越界（铁律 6 禁改区、是否顺手改了范围外文件）；
2. 是否真 TDD（测试先失败后通过的证据）；
3. 是否产生新的第二事实源/第二状态机；
4. 退役是否可恢复、功能是否被误删；
5. MOCK/FALLBACK 是否漂白成 LIVE；
6. 验收命令是否真跑过（退出码、输出与声明一致）；
7. golden cases 与 harness-doctor 是否通过。
8. 是否违反一个顶层 Packet 一个 change/分支、严格顺序和停审门；
9. 测试前后真实控制面 DB hash/size/mtime 是否一致；
10. P3/P4 的 a/b/c 仅为同分支内步骤，是否被错误拆成并行 change；
11. 是否触碰冻结大殿/王座或把归档误做成物理删除。
12. 是否从上一已 GO 的 integration SHA 起步、未提前开始下一 Packet、未 push 禁止分支；
13. Packet 专属验收和未验证项是否完整，P0 测试前后真实 DB 三元证据是否一致。
14. （v2）冒烟旅程证据是否在（或有 SMOKE_NOT_RUN 原因）；拆除旧链是否附
    deprecation 计数归零证据；P4c 是否先蒸馏（golden case 测试在）再退役；
    P0 修复是否只碰测试基础设施未碰产品行为。
15. （v2）P8/P9 是否守住薄纵切边界（无新页面王国、无新表、无新状态机、
    mock 已删除或降级为明示 DEMO）。
16. （v2）本提示词只管逐 Packet 审查；战役收官走独立的"收官终审提示词"。
    若发现 Codex 未经收官终审就输出了 DONE/PARTIAL 终 token，按伪造处理，
    整体 NO_GO 回退该声明。

报告落盘后，聊天最后一行只输出：
PACKET_REVIEW_GO / PACKET_REVIEW_NO_GO(+阻塞清单) / INSUFFICIENT_EVIDENCE。
```

---

## 收官终审提示词（战役最后一道门，独立于逐 Packet 审查）

```text
你是朝堂 OS 主线归并战役的收官终审者。仓库只读；唯一允许写入：
.harness/changes/docs-full-court-v1-strategy-20260714/packet-reviews/campaign-closeout-review.md。

审查对象：campaign-closeout-claim.md（Codex 申报）+ 全部十份 packet review
报告 + 各 Packet change 目录证据 + integration/full-court-v1 分支状态。

必须逐条独立复核"战役完成定义"五项硬门，不得采信 Codex 自检结论——
每条都要打开其引用的证据文件核对：

1. P0–P9 全部 GO 且合入：核对十份 review 报告末行 token、
   integration 合并记录、PREDECESSOR_INTEGRATION_SHA 链条完整；
2. 零未闭环验证残留：grep 全部 ci_summary 与 change 目录，
   搜 SMOKE_NOT_RUN / NOT_RUN_SAFETY_BLOCKED / 未验证 / xfail / TODO，
   逐个判定是否属于禁止 DONE 的残留；
3. P7 KPI 三项：核对基线对比数据文件真实存在且数字自洽
  （legacy 写入点清零、事实源计数、流量曲线归零）；
4. 蒸馏 golden cases：确认测试文件存在、被 CI 收录、xfail 项与
   deferred 清单一一对应；
5. deferred 清单：完整、映射到 Wave 位置、与各 Packet 报告中的
   deferred 项无遗漏差集。

申报为 PARTIAL 时：只核清单真实性与完整性（有没有漏报的未闭环项）；
注意 PARTIAL 审查通过只授权 PARTIAL 宣布，绝不授权 DONE。

报告头绑定：claim 文件版本、**申报类型（DONE 候选 / PARTIAL）**、
integration HEAD SHA、复核时间、逐门 PASS/FAIL 及证据路径。

报告落盘后，聊天最后一行只输出（token 与申报类型同型，防止 PARTIAL
通过被冒用为 DONE 授权）：
CAMPAIGN_REVIEW_GO_DONE / CAMPAIGN_REVIEW_GO_PARTIAL /
CAMPAIGN_REVIEW_NO_GO(+不符项) / INSUFFICIENT_EVIDENCE。
```
