# 规格说明：docs-agentic-workflow-kernel-pattern-adoption-20260719

## 背景

业主要求把当天学习和准备研究的 Claude Code、WorkBuddy 优秀机制吸收到朝堂 OS，并明确同意“吸收模式、补蓝图、保持 canonical 主链”的建议。

初始调查发现主工作树 `feature-chaotang-ext@0290dd7...` 相对当时远端分叉，且包含整套未跟踪六能力文档；直接写入会混合用户内容、旧产品路线与新产品冻结 lineage。因此本 change 最初从产品 PR 当时的精确头 `3c05aae...` 建立独立 stacked docs worktree，保持产品 PR 原提交和用户主工作树不变。

随后产品 PR !3 以审定来源头 `df632e4f7c95b7c53a5ad9cb2a725a1e404976fd` 正式合入；目标分支从 `05582e520300e32a5d84e2b38b3822903f75c954` 生成 merge commit `ef9b597412f53c00fb717ea5b7a2a265fd599f0f`，树为 `4f7477de6c93768bf156f793dd7db04f5361cd7b`。本 Pattern 分支已纯快进到该 integration exact HEAD；重绑定前后 8 个工作文件 SHA-256 全部不变，dirty 主工作树仍未触碰。

提交前远端复核又发现目标分支新增直接子提交 `e69f2795a8a144a4e9a89ccc7b690c2ecbe10707`，只修订产品宪法、PRD、收敛指南和对应 change：收紧 R0 客户数据边界，统一合同风险口径，并冻结 R1 5/3/1/1 统计门。它与 Pattern 8 文件路径无交集，但改变产品/PRD digest，因此 `ef9b597...` 上的批准按本 Decision 协议转为历史证据。本分支第二次纯快进到 `e69f279...`，8 个工作文件 SHA-256 再次全部不变，随后重跑验证与独立 stop-gate。

PR !4 合入审查时，远端目标已从 `e69f279...` 推进到 `4b0deee3335f874f98bd83b5b62e67452aed064b`，两侧提交计数为目标独有 85、PR 独有 1，目标累计变化 106 个文件。虽然目标变化与 Pattern 8 文件无路径交集，且产品宪法、R0/R1 PRD 与 M0–M10 权威计划摘要未改变，但目标 HEAD 漂移仍按 Decision §9/§10 使 e69 证据失效。本分支因此以 merge rebind 纳入 `4b0deee...`，同步修复评审发现的权限副作用分类缺口，并重新执行验证、复审和 Product Owner stop-gate。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 产品宪法已冻结单助手、单计划、真实进度、成果包、稀疏组阁和三次人工决定 | `docs/product/PROJECT_PRODUCT.md` | 2026-07-19 全文核对 | 否，不重开产品定位 |
| 已确认事实 | R0/R1 PRD 已覆盖版本计划、精确确认、最小权限、成果、恢复、取消和完成公式 | `docs/product/releases/product-r0-trusted-kernel/PRD.md` | 2026-07-19 全文核对 | 否，只允许补实施语义 |
| 已确认事实 | 工程顺序只由 M0–M10 计划及获批 amendment 拥有 | `docs/plans/chaotang-os-world-class-agent-harness-execution-plan-2026-07-17.md` | 产品冻结 change 与 Decision Record | 是，禁止新 DAG |
| 已确认事实 | Claude Code 官方提供 Plan/权限/Subagents/Skills/Hooks/MCP/恢复/验证等可借鉴机制 | 决策文档 §2/§14 官方链接 | 官方文档只读研究 | 否，不能推导生产依赖 |
| 已确认事实 | “WorkBuddy”至少对应腾讯商业产品和 GPL-3.0-only 开源 `work-buddy` 两个对象 | 决策文档 §2/§14 | 官方产品/文档/仓库 | 是，实施前必须冻结准确身份 |
| 已确认事实 | 当前 dirty 主工作树不可安全落稿 | `git status --short --branch`：ahead 79 / behind 23 + 未跟踪文档 | 2026-07-19 第二次重绑定后只读复核 | 已通过独立 worktree 规避 |
| 已确认事实 | Gitee PR !3 已按普通 merge 正式落到目标分支，审定产品头是其第二父节点 | `git ls-remote`、`git show ef9b597...`、`git merge-base --is-ancestor df632e4... ef9b597...` | 2026-07-19；目标、双亲、树、祖先关系均核验通过 | 否，产品合入门已解除 |
| 已确认事实 | Pattern 工作树已从旧 stacked 头纯快进到 integration exact HEAD，8 个工作文件内容未变 | `git merge --ff-only origin/feature-chaotang-ext`；重绑定前后逐文件 `sha256sum` | 2026-07-19；`HEAD=ef9b597...`、`HASHES_UNCHANGED=yes` | 否，提交前仍须重跑本 change 验证 |
| 已确认事实 | 目标分支新增产品一致性修复后，Pattern 工作树再次零冲突重绑定 | `git show e69f279...`、路径交集检查、`git merge --ff-only`、逐文件 `sha256sum` | 2026-07-19；`HEAD=e69f279...`、`HASHES_UNCHANGED=yes` | 否；产品 digest 漂移使旧 review 失效，必须复验 |
| 已确认事实 | PR !4 审查时目标已推进到 `4b0deee...`，旧 e69 GO 已历史化，当前目标已成为 PR candidate 祖先 | 远端 refs、`git merge-base --is-ancestor`、路径交集和三份权威文档 digest | 2026-07-19；在干净独立 worktree merge rebind，按当前目标重跑验证 | 否；须以本轮新证据和 Owner 授权为准 |
| 未知问题 | Tencent WorkBuddy 精确合同版本、数据地域与 subprocessor；开源项目精确 commit 与许可证处置 | 决策文档 §2/§5 | Product/Legal/Security | 是，阻塞真实数据和源码使用 |

## 数据流与调用链

本 change 不改变生产数据流。设计输入流为：

```text
官方来源与许可证观察
  + 产品宪法 / R0-R1 PRD
  + canonical 主链 / M0-M10
→ 模式 ADOPT/ADAPT/BENCHMARK/HOLD/REJECT
→ canonical owner 与负例映射
→ 产品 PR 合入后的 exact-HEAD 状态对账
→ 唯一 M0-M10 amendment
→ 独立原子 Packet
```

## 接口、数据结构与事实源

| 契约/概念 | 事实源或 owner | 本 change 的动作 | 兼容性与验证 |
| --- | --- | --- | --- |
| 产品身份/首个 Offer | `PROJECT_PRODUCT.md` | 不修改 | 文档链接与不变量核对 |
| R0/R1 用户需求 | release PRD | 不修改；仅列 v1.1 候选澄清 | 后续由 Product Owner 原子裁决 |
| 工程顺序 | M0–M10 + 未来获批 amendment | 保留原顺序 | 禁止独立 DAG/M10 偷换 |
| 任务/计划 | `DecisionTask` 输入快照 + `ChancellorRouteDecision` | 映射模式，不建 Workflow DB | second-ledger review |
| 执行/候选 | outbox + `DecreeExecutionEvent/CourtReview` | 外部 runtime 只交 candidate/receipt | callback/replay/worker negative cases |
| 正式结果/裁决/归档 | `FinalMemorial / EmperorDecision / ShiguanArchive` | 禁止外部 writer | writer tripwire 待 amendment |
| 权限信封 | 候选版本化协议，owner 待 amendment | 定义语义，不建 ConsentLedger | deny-first 负例规格 |
| 记忆/结果 | M7 候选晋级与现有史馆/outcome 边界 | 定义主权与删除门 | 跨租户/撤销/删除传播负例 |

## 范围

- 三个来源对象的身份、版本冻结义务和处置。
- 开发控制面与产品运行时双泳道。
- 计划、权限、子 Agent、Skill、Hook、MCP、恢复、成果、通知、记忆、sidecar 等模式矩阵。
- 权限、数据外发、Provider、kill switch、许可证与 canonical writer 安全门。
- 现有 M0–M10 的唯一映射输入、PRD 澄清候选和 future amendment 编制协议；不创建第二施工 DAG。
- 合成数据 benchmark 的前置、负例、退出和清理边界。

## 非目标

- 不修改产品宪法、PRD、已接受产品 Decision Record 或 M0–M10 主计划。
- 不修改产品 PR !3 或当前 dirty 主工作树。
- 不修改六能力未跟踪蓝图；其后续 authority reconciliation 另案处理。
- 不接 Claude Code/WorkBuddy runtime，不复制开源源码，不安装依赖。
- 不接真实 Provider、MCP、Skill 市场、记忆服务或客户数据。
- 不直接 push 目标分支模拟 PR merge，不切换服务或声明生产就绪；本轮只按用户 / Product Owner 的明确授权更新 PR !4 并通过正式 PR 流程合入。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 产品 PR 已合入且 Pattern 分支已重绑定到当前目标 | 允许完成本 Decision 候选并进入独立 Git/PR stop-gate；不自动授权 commit/push/merge。正式 amendment 仍须单独 change、exact-HEAD handoff 与 Owner 批准 | `ef9b597...` 产品 merge 证据、`4b0deee...` 当前基线与 Decision §9.1 |
| 后续目标分支或产品摘要漂移 | 当前批准与预演标记 `STALE_BASELINE`，重新绑定并复审 | Decision §9.2、§10 |
| WorkBuddy 身份含糊 | 两个对象分别登记；实现保持 BLOCKED | 来源矩阵 |
| 外部工具自带 task/memory/consent store | 只返回 candidate/receipt，不获得 canonical 写权 | 双泳道、writer tripwire 规格 |
| 本地/开发 hook 成功 | 只能当开发反馈，不能证明生产 gate | 双泳道规则 |
| 数据宣称 local-first | 仍逐 processor/region/purpose 判断外发 | Provider/egress 门 |
| 授权撤销时有在途动作 | 停新调用，queued/in-flight 查单并标 `UNKNOWN/RECONCILING` | 权限负例 |
| Provider/worker 报 complete | 不直接推进 `DELIVERED` | M5/M6 完成门 |
| 六能力设计提出独立 ABS DAG | 降为 M8/R3+ 输入，不获得开工权 | §6 与后续 reconciliation |

## 风险与回滚边界

- 最大风险：把外部优秀工具复制成第二套产品操作系统。通过双泳道、唯一权威、candidate-only 和 writer tripwire 规避。
- 基线风险已收敛：产品 PR 已落到 `ef9b597...`，产品一致性修复落到 `e69f279...`，PR !4 合入审查又将 Pattern 分支重绑定到当前目标 `4b0deee...`。e69 证据已历史化；后续目标或产品摘要再次漂移时仍必须按 Decision §9/§10 标记 `STALE_BASELINE` 并复审。
- 隐私风险：外部 LLM/Skill/MCP/通知均可能成为 processor。R0 只允许合成材料，或经合法性复核且不可重新识别的去标识材料；客户原件和可重新识别材料即使获授权也保持 BLOCKED。R1+ 真实数据还必须等待 DPA/TOS、合法依据与用途、数据类别/最小化、地域、保留/删除、训练使用、subprocessor、fallback/退出和具名 Product/Data/Security Owner 冻结，并满足当前 `docs/product/releases/product-r0-trusted-kernel/PRD.md` §8.2、关闭其 §2.3 指定的 OQ-01–06、OQ-09、OQ-10。
- 许可证风险：开源 `work-buddy` 只作参考；具名 Legal/License Owner 批准前发布 artifact 中相关代码/资产为零。
- 文档回滚：删除新增 Decision、导航条目和本 change；不影响产品 PR或运行时。
- 运行时未来回滚：必须停接、drain、查单、保持 compatible read、forward-fix，并继续履行删除/审计；不能只关 feature flag。

## 计划确认记录

- 批准人：用户 / Product Owner
- 批准日期：2026-07-19
- 批准范围：吸收 Claude Code 与 WorkBuddy 的优秀模式，补充蓝图；保持产品 SSOT、canonical 主链和唯一 M0–M10 路线。
- 本次计划批准明确未包含：运行时代码、外部源码复制、真实数据、Provider/服务接入、commit、push、merge、cutover；后续 Git 动作须经独立 stop-gate 和用户授权。
- PR !4 修复与合入授权：2026-07-19，用户 / Product Owner 明确授权修复两项 MUST FIX、更新远端 PR 分支并正式合入；该授权不扩展到运行时、真实数据、外部接入或直接 push 目标分支模拟合入。

## 验收标准

1. 三个来源对象身份与处置分开，WorkBuddy 歧义不会进入实现。
2. 开发控制面与产品运行时无隐式状态转换。
3. 每个模式有用户价值、canonical 落点、阶段和负例，且无第二事实源。
4. 权限副作用分类覆盖产品红线并对未知/未映射动作 fail closed；记忆、Provider/egress、kill switch、许可证和完成状态同样有明确失败关闭边界。
5. M0–M10 原顺序不变，M9/M10 不被扩权，六能力只作 M8/R3+ 输入。
6. future amendment 的基线交接、逐 M 模块卡、并行条件、clean-lineage、变更与回滚字段完整，且不创建可直接执行的第二 DAG。
7. 根 doctor、Markdown 结构/链接、diff check 与独立对抗评审无未处理 MUST FIX。

## 验证计划

- `node scripts/harness-doctor.mjs`
- 临时 Git index 纳入本 change 精确文件后运行 `git diff --cached --check`，不污染真实 index。
- Markdown fence、merge marker、相对链接与关键权威语句检查。
- `rg` 检查状态、双泳道、M0–M10 顺序、M9/M10、`NO_RUNTIME_ADOPTION` 与 stop-ship。
- 独立架构/安全/权威对抗评审；所有 MUST FIX 必须修复或由状态明确阻断。
- `python -m pytest -q tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py tests/test_menxia_veto.py tests/test_direct_canonical_dispatch.py`。
