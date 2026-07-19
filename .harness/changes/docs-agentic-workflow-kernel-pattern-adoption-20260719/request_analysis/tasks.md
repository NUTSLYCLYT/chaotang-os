# 任务：docs-agentic-workflow-kernel-pattern-adoption-20260719

## 任务 1：基线与写入隔离

- 目标：证明当前主工作树不适合落稿，并从产品 PR 精确头建立干净 stacked worktree。
- 前置条件：产品 PR head 与远端 target/ref 可只读核对。
- 输入：`0290dd7...` 主工作树、`3c05aae...` 产品头、`e38b31f...` 目标头。
- 输出：`docs/agentic-pattern-adoption-20260719` 分支与独立 worktree。
- 涉及文件：无业务文件；Git worktree 元数据。
- 状态 / 数据变化：只创建本地 branch/worktree，不推送。
- 验证命令与证据：`git status --short --branch`、`git worktree list --porcelain`。
- 回滚边界：未提交前可移除本地 worktree/branch；不得 reset/restore 用户主工作树。
- 完成定义：新 worktree clean，初始 HEAD 精确为 `3c05aae...`。
- 状态：`COMPLETE_HISTORICAL / BASELINE_SUPERSEDED_BY_TASK_4`。

## 任务 2：来源与模式差距研究

- 目标：把 Claude Code、Tencent WorkBuddy、开源 `work-buddy` 分开并形成采用矩阵。
- 前置条件：任务 1；只使用官方/项目一手资料。
- 输入：官方文档、产品宪法、PRD、M0–M10、canonical 架构。
- 输出：来源处置、双泳道、模式落点、安全门和反模式。
- 涉及文件：只读官方来源与仓库文档。
- 状态 / 数据变化：无运行态变化。
- 验证命令与证据：官方链接、三路独立只读会审。
- 回滚边界：撤回研究结论，不接外部服务。
- 完成定义：每个模式有处置、owner 落点、阶段和负例；来源歧义保持 BLOCKED。
- 状态：`COMPLETE`。

## 任务 3：Pattern Adoption Decision 与 Amendment 编制协议

- 目标：形成不产生第二路线的长期设计输入，以及只约束 future M0–M10 amendment 完整性的编制协议。
- 前置条件：任务 1–2，用户已批准文档范围。
- 输入：采用矩阵、安全会审、产品/工程权威顺序。
- 输出：`docs/plans/chaotang-os-agentic-workflow-kernel-pattern-adoption-2026-07-19.md`。
- 涉及文件：Decision、`docs/README.md`、本 change。
- 状态 / 数据变化：仅文档。
- 验证命令与证据：结构/链接/不变量检查、root doctor、diff check、独立 review。
- 回滚边界：删除 Decision 和导航；产品 PR/运行时不变。
- 完成定义：文档完成定义 8 项全部可追踪，不创建 S/P/ABS 等第二执行编号，状态诚实为 `NO_RUNTIME_ADOPTION`。
- 状态：`COMPLETE`。

## 任务 4：产品合入后的基线重绑定

- 目标：将 Pattern 工作树从旧 stacked 头安全重绑定到产品 PR !3 的正式 integration exact HEAD，并刷新所有当前事实与阻塞状态。
- 前置条件：Gitee PR !3 已正式合入；目标提交、双亲、树和审定来源头可核验。
- 输入：`df632e4...` 产品规格审定头、`05582e5...` 合入前目标、`ef9b597...` integration head。
- 输出：同一 8 文件文档集的 post-merge evidence rebind；不新增运行时范围。
- 涉及文件：Decision、`docs/README.md` 与本 change 文档。
- 状态 / 数据变化：分支纯快进；文档事实更新；前后端运行态、schema、数据和外部服务不变。
- 验证命令与证据：`git merge-base --is-ancestor`、`git show` 双亲/树、重绑定前后 `sha256sum`、root doctor、Markdown/链接/不变量、临时 index diff check 与独立复审。
- 回滚边界：撤销本 Decision 文档；不得回退或改写已正式合入的产品 PR，也不得触碰 dirty 主工作树。
- 完成定义：基线精确为 `ef9b597...`；旧“PR 未合入”事实清零；所有文档验证与 post-merge stop-gate 通过。
- 状态：`COMPLETE_HISTORICAL / BASELINE_SUPERSEDED_BY_TASK_5`。

## 任务 5：提交前目标漂移重绑定

- 目标：处理产品 PR 合入后、Pattern 提交前出现的目标分支产品/PRD digest 漂移，确保最终候选绑定最新权威基线。
- 前置条件：`e69f279...` 是 `ef9b597...` 的直接子提交；变更范围和 Pattern 8 文件可只读核对。
- 输入：`e69f279...` 产品一致性修复、`ef9b597...` 上的历史验证、当前 8 文件候选。
- 输出：重绑定到 `e69f279...` 的同一 8 文件文档集与最终 exact-baseline 证据。
- 涉及文件：Decision、`docs/README.md` 与本 change 文档；目标新增的产品文件只读。
- 状态 / 数据变化：分支再次纯快进；Pattern 内容哈希不变；运行态、schema、数据和外部服务不变。
- 验证命令与证据：目标 ancestry/tree、路径交集、产品/PRD 语义对账、两次 `sha256sum`、root doctor、Markdown/链接/不变量、临时 index diff check 与独立 stop-gate。
- 回滚边界：撤销本 Decision 文档；不得回退产品一致性修复、改写共享历史或触碰 dirty 主工作树。
- 完成定义：`HEAD=e69f279...`；产品边界与 Pattern 无冲突；8 文件 scope/哈希准确；最终机器验证和复审通过。
- 状态：`COMPLETE`。

## 后续阻塞（不属于本 change 的执行任务）

以下事项只记录下一授权点，不获得任务编号、路径租约或开工权。本 change 完成时它们仍可保持阻塞。

### exact-HEAD M0–M10 amendment

- 目标：在正式合入后的干净 HEAD 对账 M0–M10，并形成唯一 amendment。
- 前置条件：Gitee PR !3 已正式 merged（已满足）；从届时最新目标头建立干净 branch/worktree；另获 amendment 文档授权。WorkBuddy 身份/版本/许可证作为 M0 阻塞输入冻结，未冻结不得授权 benchmark 或运行时。
- 输入：当前 Decision、PRD REQ、exact-HEAD 实现/change/CI。
- 输出：单独 change 中的 M0–M10 状态对账与获批 amendment。
- 涉及文件：由未来 change 精确指定；本 change 不预授权。
- 状态 / 数据变化：未来仅文档，运行时仍需逐 Packet 授权。
- 验证命令与证据：每个 M 的精确 SHA/owner/schema/negative tests/rollback；独立 review。
- 回滚边界：撤回 amendment，新范围保持未授权。
- 完成定义：Product + Engineering Owner 批准精确 hash；无第二 DAG。
- 当前状态：`READY_FOR_SEPARATE_AMENDMENT_CHANGE / RUNTIME_BLOCKED_ON_M0_IDENTITY_AND_GATES`。

### 六能力 authority reconciliation

- 目标：把未跟踪六能力资料降为 M8/R3+ 设计输入，消除独立 ABS 施工权。
- 前置条件：上述正式 amendment 已获批；六能力资料进入同一 lineage 并有自己的干净 change。
- 输入：六能力蓝图/catalog、正式 amendment、专业包扩张门。
- 输出：`REFERENCE_INPUT_FOR_M8` / `CANDIDATE_PACKET_CATALOG` 状态与依赖声明。
- 涉及文件：未来 change 精确指定；当前 dirty 主工作树保持不动。
- 状态 / 数据变化：仅文档权威收敛。
- 验证命令与证据：状态一致性、DAG owner、链接、root doctor、独立 review。
- 回滚边界：撤回权威头变更；不得因此授权 runtime。
- 完成定义：ABS 标签只能作 M8 原子分解，不能独立开工；R0/R1 不依赖六能力完成。
- 阻塞状态：`BLOCKED_ON_AMENDMENT_AND_CLEAN_LINEAGE`。
