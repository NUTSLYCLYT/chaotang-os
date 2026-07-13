# chaotang-os 重复/冲突设计审计

> 生成方式：4 agent 并行只读扫描（部门协议 / 多智能体控制面 / 文档一致性 / git 分支）+ 1 agent 汇总去重。
> 目的：为"融合成一个主线、确定编排逻辑和飞轮体系"提供裁决依据，本身不包含任何代码改动。

## 一句话总结

共发现 **16 处**（原始 17 条 finding 中，2 条关于"libu 代码指代混乱"的 department 类发现系同一根因，已合并为 1 条）。severity 分布：**high 4 / medium 7 / low 5**。最值得优先处理：(1) `departments.yaml` 内部对 `libu` 代码含义自相矛盾并已级联到前后端代码方向相反；(2) 六部系统存在三套互不打通的独立实现（YAML 协议层 / 人设 prompt 层 / 前端 unified registry 层）；(3) 礼部（lifu）后端零引擎支撑却在前端标记为 `active` 并已接入真工作台，与 `PROJECT_PRODUCT.md` §7.1 明文承诺矛盾。

---

## 高优先级 (severity: high)

### 1. `libu` 代码在 departments.yaml 内部自相矛盾，并已级联为前后端方向相反的路由错误
**涉及路径**：`backend/harness/chaotang_department_protocol/departments.yaml`、`backend/tests/test_chaotang_department_protocol.py`、`frontend/src/features/libu/lib/libu-roster.ts`、`frontend/src/features/lifu/lib/lifu-roster.ts`、`backend/src/chaotang_department_payload.py`

**冲突**：同一份 `departments.yaml` 中，`v1_taxonomy.liubu` 块（39-49 行）里 `libu` = 吏部，而 `six_ministries`（290 行）/`departments`（521 行）块里 `libu` = 礼部（吏部另用 `libu_personnel`，且该 key 在 `v1_taxonomy` 中根本不存在）。该文件自带的测试（`test_v1_taxonomy_matches_product_module_tree` 等，52-111 行）把两种含义并列收录而未捕获冲突。这一内部矛盾已经传导到消费端：前端 `libu-roster.ts` 采用了 `v1_taxonomy` 的含义（libu=吏部），而后端实际生效的 `six_ministries/departments` 与 `chaotang_department_payload.py` 的 `DEPARTMENT_ALIASES`（`'礼部': 'libu'`）采用另一种含义（libu=礼部）——前后端刚好指向相反的部门。

**证据引用**：departments.yaml L39-54 / L263 / L290 / L456 / L521；`libu-roster.ts`（吏部尚书/选才司…）vs `lifu-roster.ts`（礼部尚书/流量增长司…）与 `DEPARTMENT_ALIASES`。

**为何严重**：任何把部门代码在前后端之间原样传递的调用点，会把吏部工作错路由到礼部（反之亦然），且没有类型系统或测试能拦截，因为两边"看起来"都是合法代码。

---

### 2. 六部体系存在三套互不知晓、互不调用的独立实现
**涉及路径**：`backend/harness/chaotang_department_protocol/departments.yaml`、`backend/src/chaotang_department_router.py`、`backend/skills/chaotang_departments/*/SKILL.md`、`backend/agent_design/buildAgent/三省六部体系/*`、`backend/src/prompts_court.py`、`frontend/src/core/courtos/unified/department-registry.ts`、`frontend/src/core/courtos/departments/registry.ts`

**冲突**：(a) Python "protocol" 方案（`departments.yaml` + `chaotang_department_router.py` + skill 文档，暴露于 `POST /api/chaotang/department-system/route`）；(b) 人设/prompt 方案（`agent_design/buildAgent/三省六部体系/` 下的 IDENTITY/SOUL 文件，内容明显是从无关的个人助理项目直接搬运——含 "Docker Sandbox""Telegram ID: 8682549016"等——被 `prompts_court.py` 显式引用来驱动完全不同的"太子→中书省→门下省→尚书省"治理流程）；(c) 前端 unified registry，自定义 id（`jinyiwei/finance/war/…`）和 `protocol_id`（`hubu_cfo/bingbu_sales/…`），与后端任何真实部门代码都不匹配，且没有前端代码实际调用后端真实路由（仅生成的 OpenAPI 类型文件引用了它）。

**证据引用**：`prompts_court.py` 注释"来源：agent_design/buildAgent/三省六部体系/…"；grep `frontend/src` 显示唯一命中是 `backend-openapi-2026-07-09.d.ts`。

**为何严重**：三套系统各自演化、术语不通、无共享 ID，任何"给六部加能力"的改动都可能只命中其中一套，造成假完成。

---

### 3. 控制面（control-plane）与部门派发系统是两套完全不相干的机制，零代码互相引用
**涉及路径**：`scripts/harness-task.mjs`、`scripts/lib/{resource-lock,lease-attestation,release-commander,recovery-control}.mjs`、`backend/src/swarm_execution_loop.py`、`backend/src/execution/outbox_worker.py`

**冲突**：全仓 grep 确认 control-plane 脚本对 `department|六部|部门|swarm|agent_id` 零命中；`swarm_execution_loop.py`/`outbox_worker.py` 对 `control.?plane|lease|resource_lock|harness.task` 同样零命中。control-plane 的 resource 词表硬编码为 `port:*/build:*/release:*/integration:*`，没有部门/司资源类型，也没有机制让部门派发去获取 lease 或读取 control-plane 的任务状态。`.harness/wiki/multi-agent-control-plane.md` 自己也声明其范围仅为"同一 Git 仓库内并发 Agent 的任务/租约/资源锁/构建/发布证据协调层"——不涉及业务决策路由。

**证据引用**：`.harness/wiki/multi-agent-control-plane.md` L3；`resource-lock.mjs` L27；`harness-task.mjs` L18。

**为何严重**：两套系统共用"task""lease"等词汇但语义完全不同（见下方 medium #8），容易让读者误以为存在协同关系，从而在排障或扩展时假设了不存在的联动。**注：这条经下方"建议的下一步"判定为设计上合理的分离，不是真冲突，只需补文档说明。**

---

### 4. `PROJECT_PRODUCT.md` 要求礼部首发隐藏/实验，但代码标记 active、接入真工作台
**涉及路径**：`docs/product/PROJECT_PRODUCT.md`、`frontend/src/config/chaotang-v1-modules.ts`、`frontend/src/features/lifu/lib/*`（negotiation/crisis/relationship/stakeholder-priority，约 1069 行）、`frontend/src/features/lifu/components/lifu-office-wiring.nodetest.ts`、`frontend/e2e/lifu-office.spec.ts`、`backend/src/real_department_engines.py`

**冲突**：`PROJECT_PRODUCT.md` §7.1 已将六部树降为长期能力地图，并要求除刑部合同主线外的模块在客户证据门前保持隐藏或实验状态。但 `chaotang-v1-modules.ts` 中礼部（`libu_rites`）状态为 `'active'`，与其余五部同级；`lifu/` 下有真实决策逻辑代码、专属 nodetest 断言"接入真工作台"、独立 e2e spec。而后端 `real_department_engines.py`（其余五部真实引擎所在文件）对 `lifu`/`libu_rites` 零引用——礼部拿到了前端"已上线"的旗标，却没有后端"真引擎"支撑，也没有按首发边界隐藏。

**证据引用**：`PROJECT_PRODUCT.md` §5.1.3/§7.1；`chaotang-v1-modules.ts` `status: 'active'`；`real_department_engines.py` grep 零命中 lifu/libu_rites。

**为何严重**：文档失真的方向是"功能其实比文档说的更进一步"，但进一步的部分（前端）恰恰缺失了应该支撑它的后端能力——用户可能点开一个"活跃"的礼部工作台，背后完全没有真实决策引擎在跑。

---

## 中优先级 (severity: medium)

### 5. `chaotang-build-office` SKILL.md 记录的注册文件与派发桥不存在于磁盘
**路径**：`.claude/skills/chaotang-build-office/SKILL.md`、`frontend/src/app/(dashboard)/liubu/[code]/[office]/page.tsx`、`frontend/src/lib/auth/require-court-swarm-auth.nodetest.ts`
skill 声明新建部门需改 `department-offices.ts`（不存在该文件，只有语义不同的 `courtos/departments/offices.ts`）；声明"唯一派发桥"`dispatchDeptToSwarm`（铁律9）目前只出现在注释和一个当前找不到调用方的守卫测试里，未实现。

### 6. 两张部门别名映射表各自维护、字段集不一致
**路径**：`backend/src/chaotang_department_autosubmit.py`（`FLOW_DEPARTMENT_MAP`）、`backend/src/chaotang_department_payload.py`（`DEPARTMENT_ALIASES`）
前者有 `ops/physician` 等映射后者没有，后者有 `hr→libu_personnel` 及中文名映射前者没有，无任何机制保证两表同步。

### 7. Python 后端自认三层部门派发机制互不调用
**路径**：`backend/src/real_department_engines.py`、`backend/src/chaotang_orchestrator.py`、`backend/src/swarm_execution_loop.py`
`real_department_engines.py` 模块 docstring 自陈："①②从未调用过③"。`swarm_execution_loop.py`（约 229-238 行）与 `chaotang_orchestrator.py`（43-44 行，用 `li_bu_rites` 又是礼部的第三种拼法）各自硬编码了独立的部门代码/swarm_id 映射，不读 `departments.yaml` 的 `calls_swarms`。

### 8. control-plane "task" 与部门系统 "task"（DecisionTask）是两套不兼容 schema
**路径**：`.harness/contracts/task.schema.json`、`scripts/harness-task.mjs`、`backend/src/db/models.py`
control-plane task_id 格式 `^task-[A-Za-z0-9._-]+$`，字段面向 git worktree/资源锁；`DecisionTask.id` 是 sha1 opaque id，字段面向决策/决旨流程。两者同名"task"但无任何转换路径，容易被误认为有联动。

### 9. `feature-changtang-ext`（少一个"o"）不是 `feature-chaotang-ext` 的重名/笔误分支，而是独立、未合并的旧 fork
**路径**：`origin/feature-changtang-ext`、`feature-chaotang-ext`、`origin/master`
分叉点在 dev 落后 36 commit 的 `0d13ff34`，携带 `efaee776`（harness 架构统一，也存在于 `origin/master` 但从未进 dev）和 `cb2b8b99`（BFF 防护 guard，真实未整合工作）。命名相似但内容完全无关，属于"孤儿真实工作"未被 dev 吸收，而非重复分支。

### 10. `origin/master` 与 `dev` 已真实分叉，双向都有未合并提交
**路径**：`origin/master`、`dev`
`git merge-base --is-ancestor` 双向均为 false。`origin/master` 独有 `efaee776`（重写 backend 顶层文档/AGENTS.md 等，删除约 15 个 legacy 文档），`dev` 独有 36 个 commit。这与项目 memory 记录的"release worktree 只是落后 16+ commit"不一致——`origin/master` 不是单纯落后，而是走了一条 dev 从未接收的独立重构提交，naive fast-forward/merge 会在两边都改过的 harness/docs 文件上冲突。

---

## 低优先级 (severity: low)

### 11. "lease" 术语在 control-plane 内部一致，唯一跨界点是 commit-gate 集成，不构成语义冲突
**路径**：`.harness/contracts/lease.schema.json`、`scripts/lib/lease-attestation.mjs`、`backend/scripts/commit_closeout_check.py`
`commit_closeout_check.py --verify-lease-attestation` 真实 shell out 到 `integration-lease-gate.mjs`，是 CI/commit-gating 的合法接入，不是部门系统的联动，仅需留意别误读成部门集成。

### 12. `verification-matrix.md` 没有覆盖当前正在改动的 swarm-execution-loop/outbox-worker 子系统
**路径**：`.harness/wiki/verification-matrix.md`、`backend/src/swarm_execution_loop.py`、`backend/src/execution/outbox_worker.py`、对应测试文件
工作区里这几个文件正被改动（对应 DRAFT 设计文档提到的"丞相→军机处…编排重构"），但 verification-matrix 里没有它们的行，无法查到验证命令/证据日期。

### 13. `chore/launch-s1-source-of-truth` 与 `feature-chaotang-ext` 是同一 commit 的两个分支名
**路径**：`chore/launch-s1-source-of-truth`、`feature-chaotang-ext`
`git rev-parse` 完全相等，无独立提交，纯粹是 worktree 记账分支，名字"source of truth"容易误导，且下次任一分支移动就会静默漂移。

### 14. `feature-chaotang-ext` 与 `feature-changtang-ext` 都改了 `harness-doctor.mjs`，但改动区域不重叠
**路径**：两分支、`frontend/scripts/harness-doctor.mjs`
一个改约 262 行端口校验，一个改 1-80 行 BFF 扫描，3-way merge 大概率能干净合并，但仍需人工确认而非假设无冲突。

### 15. `feature-chaotang-release` / 本地 `master` / `origin/dev-rpy` 已完全被 dev 吸收，不是"落后"而是"已归并"
**路径**：三个分支、`dev`
`git rev-list --count dev..<branch>` 均为 0，均是 dev 的祖先，无孤立未合并工作。与 memory 记录的"落后 16+ commit"仅在程度上不符——它们不是待合并，而是已完全包含，无需处理。

---

## 建议的下一步

**需要裁决/合并（真冲突，不是文档缺口）**：
- 高优先级 #1（libu 代码含义）：这是唯一一处会造成**实际业务路由错误**的冲突，必须先在 `departments.yaml` 内统一 `libu`/`libu_personnel`/`lifu` 三个 key 的唯一含义，再回填前端 `libu-roster.ts`/`lifu-roster.ts` 和 `chaotang_department_payload.py` 的 `DEPARTMENT_ALIASES`，并把 medium #6 的两张别名表在此次修复中合并成单一来源，避免二次分叉。
- 高优先级 #2（三套六部实现）：需要产品/架构层先裁决哪一套是"唯一真实"（从证据看是 (a) Python protocol 层，因为它是唯一有真实 API 路由的），(b)(c) 要么被废弃要么被明确标注为"未接线的历史遗留"，否则新人会继续往错的那套里加功能。
- 高优先级 #4（礼部状态矛盾）：需要产品决定是"补齐后端引擎让代码追上文档承诺"还是"文档追上代码现状"，这不是文档措辞问题，是需要业务决策的真实产品范围问题。
- medium #10（origin/master 分叉）：在下次任何 master/dev 合并前必须先确认 `efaee776` 是否要 cherry-pick 进 dev，否则合并会在已被双方独立修改的 harness 文档上产生冲突。

**只是需要补文档说明，不算真冲突**：
- 高优先级 #3（control-plane 与部门系统分离）：这是设计上的合理分离，只需要在 `.harness/wiki/multi-agent-control-plane.md` 或顶层架构文档里加一句明确声明"control-plane 不管理业务部门派发"，防止误读。
- low #11（lease 术语）：同上，加一句范围说明即可。
- medium #8（两套 task schema）：只要在两份 schema 文档互相加一句"同名不同物，无转换路径"的旁注，就能消除误解，不需要改代码。
- low #12（verification-matrix 缺行）：纯粹补一行文档，等这次 swarm_execution_loop 改动定稿后一并补上。
- medium #9、low #13/14/15（分支类发现）：都不是代码冲突，是分支卫生问题，建议按 low→先删除/重命名 `chore/launch-s1-source-of-truth`，medium #9 的 `feature-changtang-ext` 需要人工决定是继续推进合并还是关闭该 fork。
