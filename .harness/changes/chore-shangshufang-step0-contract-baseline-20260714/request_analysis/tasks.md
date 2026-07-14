# 任务：chore-shangshufang-step0-contract-baseline-20260714

## 任务 1

- 目标：冻结上书房正式 API 请求、来源词汇和黄金行为现状。
- 前置条件：用户已批准 S1；不改变运行逻辑。
- 输入：FastAPI OpenAPI、前端 adapters、既有 API tests。
- 输出：backend JSON baseline/Python test、frontend Node test。
- 涉及文件：`backend/tests/fixtures/`、`backend/tests/test_shangshufang_contract_baseline.py`、frontend contract baseline test。
- 状态 / 数据变化：测试使用隔离内存 DB；无运行数据变化。
- 验证命令与证据：专项 pytest、tsx node test。
- 回滚边界：删除新增测试/fixture。
- 完成定义：8 个新测试通过且 known gaps 未被掩盖。

## 任务 2

- 目标：建立 S1 进程、STOP、数据库、旧路径、待审队列与架构基线。
- 前置条件：只读取证。
- 输入：git/worktree、ss/proc、prod:doctor、rg、SQLite 只读计数。
- 输出：`baseline.md`、`adr.md`、`threat-model.md`、`s1-inventory.md`。
- 涉及文件：仅本 change。
- 状态 / 数据变化：无。
- 验证命令与证据：静态字段检查、对抗复审。
- 回滚边界：删除文档不影响运行时。
- 完成定义：每个未知项有 blocks_steps，ADR 无悬空冲突。

## 任务 3

- 目标：完善十阶段 launch blueprint 并准确记录 S1 当前进度。
- 前置条件：基线证据已产生。
- 输入：用户批准路线、本 change 证据、控制面细化蓝图。
- 输出：更新 `plans/chaotang-os-launch-blueprint-2026-07-14.md`。
- 涉及文件：指定 plan。
- 状态 / 数据变化：无。
- 验证命令与证据：Markdown/diff check、对抗复审。
- 回滚边界：回滚本轮段落。
- 完成定义：十阶段、指标、TDD/verification、S1进度和 S10 外部信任锚一致。

## 任务 4 — 正式入口清算

- 状态：`DOC_COMPLETE_WITH_BLOCKED_UNKNOWNS`（8 组 UNKNOWN 均带 `blocks_steps`，不视为已裁决）。
- 目标：列出所有建案、派单、状态、奏折、裁决和归档入口，并标记 `KEEP / ADAPT / READ_ONLY / RETIRE`。
- 前置条件：只读调查；不修改运行逻辑。
- 输入：`backend/web/`、`backend/src/`、`frontend/src/` 的路由、adapter 和 dispatch 调用点。
- 输出：本 change 下新增 `entry-inventory.md`，每项包含 owner、事实源、消费者、处置、退役前置和证据路径。
- 涉及文件：只修改本 change 文档。
- 调查命令：`rg -n "APIRouter|@router\\.|dispatch|swarm|DecisionTask|FinalMemorial|EmperorDecision|ShiguanArchive" backend/web backend/src frontend/src`。
- 预期输出：所有业务写入口均在 inventory 中有唯一处置；无法确定的项标 `UNKNOWN` 和 `blocks_steps`，不得遗漏或猜测。
- 回滚边界：删除新增 inventory，不影响运行时。

## 任务 5 — D0/D1/D2 与升级 ADR

- 状态：`APPROVED_FOR_PLANNING`（ADR-005 已冻结；运行时尚未实施）。
- 目标：冻结 `processing_depth=D0|D1|D2`、风险硬门、动态升级、D0 ingress/审计边界和 D1/D2 共用 `DecisionTask` 的语义。
- 前置条件：任务 4 入口清算完成；复用现有 ADR-001–004，不重新裁决 direct/durable planning。
- 输入：`docs/product/CHAOTANG_CONVERGENCE_GUIDE.md` 第 3 节、现有 `adr.md`、产品法域/人工门红线。
- 输出：在 `adr.md` 追加 ADR-005，包含决策表、override 权限、版本和兼容策略。
- 涉及文件：仅本 change 的 `adr.md`。
- 验证命令：`rg -n "ADR-005|D0|D1|D2|processing_depth|escalation|hard gate" .harness/changes/chore-shangshufang-step0-contract-baseline-20260714/adr.md`。
- 预期输出：D0 无业务副作用且可审计升级；D1/D2 不产生第二任务；风险硬门不能由模型 override。
- 回滚边界：删除 ADR-005；不改变运行状态。

## 任务 6 — 双黄金资产目录

- 状态：`DOC_COMPLETE`（目录与治理边界已冻结；fixtures/runner、双人实名标注和 `30/30` 尚未实施）。
- 目标：分别冻结工作流黄金旨意和合同领域黄金案例，禁止混算。
- 前置条件：ADR-005 已批准；不写运行代码或真实客户正文。
- 输入：canonical blueprint Step 0/7/12、产品支持法域和质量红线。
- 输出：本 change 下新增 `golden-assets-plan.md`：30 条正式工作流案例目录（10 D1、10 D2、10 失败/对抗/恢复）、D0 咨询契约目录、合同领域 schema/分层/双人标注 owner/授权规则。
- 涉及文件：只修改本 change 文档。
- 目录格式：每条正式工作流案例使用 Markdown 表行，第一列 ID 分别以 `WF-D1-`、`WF-D2-`、`WF-FAIL-` 开头；ID 必须唯一，字段至少包含目的、输入类别、预期终态、是否形成正式奏折、预期阻断/裁决和 owner。
- 验证命令：`test "$(rg -c '^\\| WF-D1-' /home/ubuntu/Projects/chaotang-os/.harness/changes/chore-shangshufang-step0-contract-baseline-20260714/golden-assets-plan.md)" -eq 10`；`test "$(rg -c '^\\| WF-D2-' /home/ubuntu/Projects/chaotang-os/.harness/changes/chore-shangshufang-step0-contract-baseline-20260714/golden-assets-plan.md)" -eq 10`；`test "$(rg -c '^\\| WF-FAIL-' /home/ubuntu/Projects/chaotang-os/.harness/changes/chore-shangshufang-step0-contract-baseline-20260714/golden-assets-plan.md)" -eq 10`；`test -z "$(rg '^\\| WF-(D1|D2|FAIL)-' /home/ubuntu/Projects/chaotang-os/.harness/changes/chore-shangshufang-step0-contract-baseline-20260714/golden-assets-plan.md | cut -d'|' -f2 | sed 's/^ *//;s/ *$//' | sort | uniq -d)"`。
- 预期输出：四条断言退出码均为 0，证明三组各 10 且 ID 无重复；合同领域质量阈值明确留给 Step 7B，不在 Step 0 伪造统计结论。
- 回滚边界：删除计划文档；不影响已有测试。

## 任务 7 — 生产与数据治理 unknown closeout

- 状态：`DOC_COMPLETE_WITH_BLOCKERS`（本机/仓库事实已记录；production-only 项与真实客户数据门均保持 BLOCKED）。
- 目标：回答或明确阻断生产拓扑、容量、tenant 回填、provider 数据政策、删除、上传和备份治理未知项。
- 前置条件：具备相应环境/负责人授权；无权限时必须写 `BLOCKED`。
- 输入：当前部署/监控/数据字典/供应商政策；禁止复制客户正文。
- 输出：本 change 下新增 `production-unknowns.md` 和 `data-governance-gate.md`，每项包含 owner、证据时间、命令/来源、结论和 `blocks_steps`。
- 本机基线命令：`ss -ltnp`、`ps -eo pid,ppid,lstart,args`、`cd frontend && pnpm prod:doctor -- --json`。
- 生产证据命令：必须由有权限的 owner 在任务开始前写入文档；若无法确定，不得用本机结果代替生产结果。
- 预期输出：P50/P95/P99、并发、限流、成本、worker 拓扑/停机窗口、数据规模、孤儿/tenant 规则、retention/training/region、删除/备份、上传/下载安全均有事实或明确阻塞。
- 回滚边界：纯证据文档；不改变生产状态。

## 任务 8 — 动态验证基线与 Step 0 closeout

- 状态：`VERIFIED_PARTIAL_BLOCKED`（最终证据快照 `96d9a38`；构建/类型、前后端合同、上书房组合回归和三层 doctor 通过；全量后端为 2601 passed / 26 skipped / 9 failed，浏览器前置仍为 STOP，浏览器未运行）。
- 目标：从当前工作树重新生成契约、类型、doctor、相关回归和全量失败基线；不得在长期文档固定旧失败数字。
- 前置条件：任务 4–7 完成或带明确 BLOCKED；高成本 provider 测试仍需单独凭证/预算确认。
- 输出：更新 `ci_result/ci_summary.md`、`baseline.md` 和 `summary.md`，记录命令、退出码、通过/失败、owner、证据范围和未验证项；浏览器证据写入 `ci_result/artifacts/playwright/`。如现有 spec 缺最终截图或 console/pageerror 附件，可只修改 `frontend/e2e/shangshufang-unified-loop-smoke.spec.ts` 的证据采集，不改变业务行为。
- 最低命令：`(cd /home/ubuntu/Projects/chaotang-os/backend && python3 -m pytest -q tests/test_shangshufang_contract_baseline.py)`；`(cd /home/ubuntu/Projects/chaotang-os/frontend && npx --yes tsx --test src/features/shangshufang/api/contract-baseline.nodetest.ts)`；`(cd /home/ubuntu/Projects/chaotang-os/frontend && pnpm exec tsc --noEmit)`；`(cd /home/ubuntu/Projects/chaotang-os && node scripts/harness-doctor.mjs)`；`(cd /home/ubuntu/Projects/chaotang-os/backend && python3 scripts/harness_doctor.py)`；`(cd /home/ubuntu/Projects/chaotang-os/frontend && pnpm harness:doctor)`；`(cd /home/ubuntu/Projects/chaotang-os && git diff --check)`。
- 浏览器前置：`3050` 必须由本仓受控候选前端提供 `/chaotang`，后端必须是本仓真实服务但绑定隔离测试 tenant/DB，不得写生产或用户开发 DB；先保存 `pnpm prod:doctor -- --json`、前后端 health、PID/cwd/build identity 和测试隔离证明。任何一项不满足即记录 `BLOCKED`，不得为了跑绿而接管 foreign 3050、复用真实客户凭据或关闭隔离门。
- 浏览器命令：`(cd /home/ubuntu/Projects/chaotang-os/frontend && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3050/chaotang PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm exec playwright test e2e/shangshufang-unified-loop-smoke.spec.ts --project=chromium --trace=on --output=/home/ubuntu/Projects/chaotang-os/.harness/changes/chore-shangshufang-step0-contract-baseline-20260714/ci_result/artifacts/playwright)`。
- 浏览器范围：使用真实后端而非 route/mock，至少覆盖 draft -> confirm -> status/command-center；保留 Playwright trace、最终/失败 screenshot、console/pageerror、命令退出码、base URL、前后端 identity 和时间戳。若现有 spec 不能同时满足真实后端、隔离约束和证据采集，先标 `BLOCKED` 并为后续独立测试 change 写清缺口，不在 Step 0 临时放宽生产安全门。
- 全量命令：`(cd /home/ubuntu/Projects/chaotang-os/backend && python3 -m pytest -q)`；若因预算、凭证或外部依赖未运行，必须保持 `VERIFIED_PARTIAL` 并列出 owner/阻塞原因。
- 预期输出：所有新增文档结构检查通过；每个失败有 owner 和分类；浏览器证据 PASS 或诚实 BLOCKED；Step 0 unknown 全 resolved 且浏览器 baseline PASS 才可申请重新确认，否则保持 `VERIFIED_PARTIAL/BLOCKED`。
- 回滚边界：验证只读；文档更新可回滚，不回写运行数据。
