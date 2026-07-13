# chaotang-os 重复/冲突设计审计

> 生成方式：4 agent 并行只读扫描（部门协议 / 多智能体控制面 / 文档一致性 / git 分支）+ 1 agent 汇总去重。
> 目的：为"融合成一个主线、确定编排逻辑和飞轮体系"提供裁决依据，本身不包含任何代码改动。

## 执行后核实更新（2026-07-14，处理任务 #1/#3 时发现）

审计 agent 的发现在**动手改代码前**都需要人工复核一次运行时证据，不能直接按 severity 标注执行。两条重要修正：

- **高优先级 #1（libu 命名冲突）已核实为假警报，代码零改动**：三套系统（`features/libu`+真实 `libu.py` 路由 / `features/lifu`→`market`→`backend-api.ts` 里明确记录在案的历史别名转译层→真实 `/api/chaotang/dept/market/overview` / `departments.yaml`+`chaotang_department_router.py`）运行时互不传递 "libu" 字符串，互不干扰。最初怀疑的"死链" `/api/court/libu/promo` 其实是刻意保留、有退役计划文档的合法别名（见 `frontend/src/lib/backend-api.ts` L14-25）。
- **高优先级 #2（三套六部实现）机制描述有误，但结论方向对**：`chaotang_orchestrator.py` 实际读的是 `minister_personas.py`，从不读 `agent_design/buildAgent/三省六部体系/` 或 `prompts_court.py`——原文"被 prompts_court.py 显式引用来驱动…"这条引用链不存在。`departments.yaml` 协议层不是孤儿——它被 `chancellor_router.py`/`chancellor/routing_service.py` 真实使用，只是服务于"内部决策路由建议"而非 `libu.py`/`lifu` 的"用户可见办公真操作"，两者不是同一件事的重复实现，是分工不同的两层。
- **补充修正（2026-07-14，第二轮）：上一条"prompts_court.py / department-registry.ts 零调用方"的结论本身错了，已撤回**。`prompts_court.py` 实际被 `backend/config/flow_court.yaml`（10 处 `prompt_module: src.prompts_court`）通过 `flow_engine.py` 的 `importlib.import_module()` 动态加载，且 `flow_court.yaml` 被 `chaotang_api.py` 注册为 `chancellor` 部门的真实 flow——是活代码。`department-registry.ts` 有三个真实 importer（`unified-loop.nodetest.ts`、`unified-ui-adapter.ts`、`unified-decision-loop.ts`），第一轮排查只查了其中经 `courtos-decision-store.ts` 这一条链，漏查了另外两条——`unified-decision-loop.ts`/`unified-ui-adapter.ts` 被 `frontend/src/app/(dashboard)/junjichu/page.tsx`、`frontend/src/features/shangshufang/ShangshufangPage.tsx` 等真实路由页面引用，同样是活代码。两处源文件头部的 ORPHANED 标记均已撤回改正。**教训：判断"零调用方"必须枚举全部 import 路径（含 YAML/JSON 配置驱动的动态加载），只查到一条链就下结论是本轮两次误判的共同原因。**`agent_design/buildAgent/三省六部体系/` 原始 markdown 文件本身是否被 `prompt_validator.py`/`prompt_composer.py` 这类通用 prompt 工具实际处理过，尚未查清，不再假设它是孤儿。

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

**冲突（2026-07-14 二次核实后更新）**：(a) Python "protocol" 方案（`departments.yaml` + `chaotang_department_router.py`，服务 `chancellor_router.py` 内部决策路由建议，**活代码**）；(b) `prompts_court.py`（**活代码**——被 `backend/config/flow_court.yaml` 十处 `prompt_module: src.prompts_court` 声明，经 `flow_engine.py` 的 `importlib.import_module()` 动态加载，`flow_court.yaml` 本身被 `chaotang_api.py` 注册为 `chancellor` 部门的真实 flow；其内容源头 `agent_design/buildAgent/三省六部体系/` 原始 IDENTITY/SOUL 文件是否仍被读取未查清，不下结论）；(c) 前端 `department-registry.ts`（**活代码**——被 `unified-decision-loop.ts`/`unified-ui-adapter.ts` 引用，两者又被 `frontend/src/app/(dashboard)/junjichu/page.tsx`、`frontend/src/features/shangshufang/ShangshufangPage.tsx` 等真实路由页面引用；此前"没有前端代码实际调用"的判断是只查了一条 import 链就下的结论，已证伪）。

**证据引用**：`prompts_court.py` 头部已加注运行时加载证据；`department-registry.ts` 头部已加注三个真实 importer；`agent_design/buildAgent/三省六部体系/` 里 IDENTITY.md 内容仍明显是从无关的个人助理项目直接搬运（"Docker Sandbox""Telegram ID: 8682549016"等），这一点未变。

**为何严重（更新）**：三套系统术语不通、无共享部门 ID，是真的，但**不是"一个真两个假"，是三套都在跑、各管一段**（内部决策建议 / 治理流 prompt / 前端统一注册表），风险不是"往错的死系统里加功能"，而是"改一处以为影响全局，实际另外两套完全感知不到"——真正的修复方向是打通共享 ID 或明确分工文档，不是废弃其中任意一套。

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

**核实更新（2026-07-14）——重新读取当前 `PROJECT_PRODUCT.md` 原文并枚举全部消费方后确认**：

- `PROJECT_PRODUCT.md` §7.1/§8 现在的措辞更明确：1.0 客户交付树只有上书房/刑部合同决策单/圣裁确认/史馆档案，"其余模块在 5/3/1/1 客户证据门之前保持隐藏或实验状态"，礼部"不展示二级模块、不承诺运行能力"。这不是模糊的历史遗留措辞，是当前生效的、有具体门禁标准的产品纪律。
- **`status` 字段并不能真正隐藏礼部**：`getV1LiubuStaticParams()` 只用 `status === 'active'` 控制静态生成，`[code]/page.tsx` 运行时路由从不检查 `status`；真正控制导航栏可见性的 `SIX_MINISTRIES_NAV`（`frontend/src/features/shangshufang/constants.ts` L44-46）只按 `href` 是否存在过滤，不看 `status`。也就是说**就算把 `status` 改成 `'pending'`，礼部依然会出现在侧边导航、依然能被直接访问**——现在没有任何机制能真正满足文档要求的"隐藏"。
- `real_department_engines.py` 仍然零命中 `lifu`/`libu_rites`，缺口没有被并发工作补上。
- **处理方式（用户决定）**：本轮只记录这个差距，不改代码也不改文档。真正"隐藏礼部"需要新建门控逻辑（导航过滤 + 路由守卫），属于功能开发，不是本次融合任务范围；是否要做、什么时候做，留给产品/工程负责人决定。

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
- ~~高优先级 #1（libu 代码含义）~~：**已证伪，撤回**。深挖运行时路径后确认三套系统从不互相传递 "libu" 字符串，怀疑的死链其实是 `backend-api.ts` 里有文档记录的合法历史别名。代码零改动，无需统一 key 含义，也不需要合并 `DEPARTMENT_ALIASES`（后者作为独立的"减少重复维护"改进已完成，跟 libu 含义无关）。
- 高优先级 #2（三套六部实现）：**"裁决唯一真实、废弃另外两套"这条建议已证伪，撤回**——(a)(b)(c) 三套经核实全部是活代码，服务于不同职责（内部路由建议 / 治理流 prompt / 前端统一注册表），不是同一功能的重复实现，废弃任何一套都会破坏真实调用方（尤其 (c)，被 `junjichu`/`shangshufang` 真实页面依赖）。改为：需要产品/架构层做的是**给三者写清楚各自的职责边界和共享 ID 映射**（如果确实需要打通），而不是三选一淘汰两个。
- 高优先级 #4（礼部状态矛盾）：**已重新核实（见上方"核实更新"），用户决定本轮只记录差距、不改代码不改文档**。需要注意：即使以后要"隐藏礼部"，光改 `status` 字段不够——导航栏和路由都不看这个字段，得新建门控逻辑，这是功能开发工作量，留给产品/工程负责人另行排期。
- medium #10（origin/master 分叉）：**已实测验证，比预想更严重**——2026-07-14 对 `efaee776` 做了真实 dry-run cherry-pick（`-m 1`，非推演），19+ 个文件冲突，全部是 ext 分支这段时间独立演化、内容已经明显更成熟的核心 harness 文件（`project-boundaries.md`、`project-harness.json`、`architecture.md`、两处 `harness-doctor.mjs`）。已 abort 并确认 ext 分支未受影响（`courtos-brain` 相关内容抽查确认完整）。**结论：`efaee776` 不建议直接合并/cherry-pick 进 ext 或 dev，需要人工逐文件对比裁决哪边内容更新，工作量相当于重新走一遍这两条线各自的 harness 演进历史，不是机械合并能解决的。**

**只是需要补文档说明，不算真冲突**：
- ~~高优先级 #3（control-plane 与部门系统分离）~~：**已完成（2026-07-14）**。`.harness/wiki/multi-agent-control-plane.md` 加了"范围声明"段落，明确不管理业务部门派发。
- low #11（lease 术语）：已随上一条一并覆盖（多智能体控制面新增段落里已说明 lease/task 词汇的边界）。
- ~~medium #8（两套 task schema）~~：**已完成（2026-07-14）**。`.harness/contracts/task.schema.json` 加了 `description` 字段，`backend/src/db/models.py` 的 `DecisionTask` docstring 加了互相指向的旁注。
- low #12（verification-matrix 缺行）：纯粹补一行文档，等这次 swarm_execution_loop 改动定稿后一并补上。
- ~~medium #9（`feature-changtang-ext` 的 `cb2b8b99`）~~：**已完成（2026-07-14，commit `962c6e8`）**。真实 cherry-pick 到 ext，只有一处文档冲突（`api-contracts.md`，两边内容互补，已手动合并保留双方），`frontend/scripts/harness-doctor.mjs` 自动合并干净，功能性代码零冲突。过程中发现 `git cherry-pick -n` 会把工作区里其他无关文件的改动一并带进 index（本例中带进了 3 个跟这次改动完全无关的并发文件），已逐一核实并 unstage，最终提交只含 18 个真正属于 `cb2b8b99` 的文件，行数与原 commit（232 insertions/3 deletions）完全一致。**教训：`-n` cherry-pick 之后一定要用 `git diff --cached --stat` 核对文件数和行数是否跟原 commit 吻合，不能只看有没有冲突标记。**
- low #13/14/15（其余分支类发现）：都不是代码冲突，是分支卫生问题，建议按 low→先删除/重命名 `chore/launch-s1-source-of-truth`。
