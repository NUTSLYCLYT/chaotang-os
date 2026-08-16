# 任务：双编排公共合同与公平对比案例 V1

> Task ID：`DUAL-ORCHESTRATION-CONTRACT-V1-20260816`
>
> 本任务遵守 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；不改变下旨入口、
> 单部/多部串行办理、锦衣卫证据边界或一旨一条 `REPLY`。

## Status

Ready

## Product Definition

- 用户确认：Owner 于 2026-08-16 确认采用“一个产品、一个代码主线、Direct 与 LangGraph
  两个编排赛道”的方向，并要求按顺序执行。M0 approval manifest digest 尚待 Owner 单独确认。
- 问题：当前业务代码直接依赖 LangGraph 与 `app.langgraph_runtime`，旧无 LangGraph 分支又不是
  相同业务底盘；没有中立合同和同源案例，无法公平并行开发或比较两个编排器。
- 目标用户：维护朝堂 OS 的产品 Owner、后端实现者和验收者。
- 目标：新增不接入运行路径的公共编排合同、引擎 Protocol 与 24 个冻结对比案例，为后续
  Direct/Graph 两个独立 adapter 候选提供同一输入、业务不变量和裁判口径。
- 非目标：不实现 Direct adapter、不实现 LangGraph adapter、不切换现有丞相图、不改 API/前端/
  数据库/史馆/Provider、不访问公网、不运行真实模型、不发布或部署。

## Acceptance Criteria

- [ ] `backend.app.orchestration` 提供 frozen、closed 的公共 request/plan/event/checkpoint/failure/result
  数据合同，拒绝未知字段、空 owner/run/decree 身份、非法状态和不闭合的成功结果。
- [ ] `OrchestrationEngine` Protocol 只依赖公共合同，不导入 LangGraph、DeepSeek、HTTP、数据库、
  史馆或前端模块；本任务不注册或实例化任何引擎。
- [ ] 公共结果保留 ADR 0028 不变量：`single` 恰好一个部门，`multi` 至少两个且顺序唯一；成功结果
  有非空结论、恰好三条去空白且唯一建议、真实处理路径和有序证据引用。
- [ ] `cases.v1.json` 是 closed、版本化、确定性排序的数据集，恰好包含 24 例：8 个单部、8 个多部、
  4 个失败/恢复、4 个权限/篡改/缺证案例；每例绑定同一资源 manifest digest、预算和预期不变量。
- [ ] 案例不含密钥、真实个人/生产数据、任意 URL、模型输出或业务成功声明；synthetic 标志为真。
- [ ] 测试证明数据集 ID 唯一且顺序稳定、分类计数精确、跨 owner/重复副作用/多条 REPLY/缺证成功
  等负例失败关闭，并证明公共包没有 LangGraph import。
- [ ] 新增模块未被现有 API、worker、丞相图、RuntimeSkill、史馆或应用 composition root 导入；
  全量后端测试、ruff、根 Harness 与 M0 authority 回归保持绿色。

## Delivery Constraints

- Base：`ac3c94d9ab07d6f283c23dfda14d48bdb30f5c69`
- Base tree：`fa7f16222af27771387e877dc9e07190ec07f984`
- 范围：只允许修改 `Affected Modules` 中列出的 6 个产品路径。
- 兼容性：现有 `/study`、下旨、DecreeJob、军机处、46 RuntimeSkills、Evidence Spine、成果、确认、
  史馆和前端行为必须字节级不受本任务接线影响；本任务没有运行时接线。
- 外部副作用：禁止网络、Provider、生产数据库、真实凭据、Gitee policy、部署、发布和外部消息。
- 风险：公共合同若复制现有业务规则会形成第二事实源；因此只承载编排中立身份、状态、引用与
  终态不变量，部门名录和业务产物继续引用现有事实源。
- 回滚：产品候选是 approval commit 的一个精确单亲子；回滚该单一候选即可恢复到无公共合同状态。
- 技能计划：`loop-graph-architect` 固定状态/失败/恢复；`test-driven-development` 先 RED 后 GREEN；
  `verification-loop` 用于冻结候选验收。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 gstack-claude。

## Affected Modules

- 模块：候选 Orchestration Contracts、Orchestration Engine Port、Comparison Dataset V1。
- 允许路径：
  1. `backend/app/orchestration/__init__.py`
  2. `backend/app/orchestration/contracts.py`
  3. `backend/app/orchestration/engine.py`
  4. `backend/harness/orchestration_comparison/cases.v1.json`
  5. `backend/tests/test_orchestration_comparison_cases.py`
  6. `backend/tests/test_orchestration_contracts.py`
- 依赖模块：`pydantic`、标准库 `Protocol`/`StrEnum`、ADR 0028、现有六部名录与只读 fixture 语义。

## Technical Plan

- 架构边界：Graph Kernel/Direct Loop 未来都只能实现 `OrchestrationEngine`；公共包不选择引擎、不做
  IO、不调用 Provider、不归档、不发布成果。
- 接口与依赖：公共 request 绑定 owner/run/decree/input/resource digest；plan 绑定 route 与顺序节点；
  event/checkpoint 绑定 engine kind/version 与单调序号；result 只描述公共终态和不可变引用。
- 实施顺序：先写合同 RED → 最小 frozen models GREEN → 写 24 案例校验 RED → 数据集 GREEN →
  专项/ruff/全量回归 → 候选机械验收。
- 验证计划：使用 approval manifest 中固定的 5 条离线命令；任何失败、工作树写入、路径扩大或远端
  漂移均由 M0 consumer STOP。
- 技术风险：现有 `ChancellorGraphState` 含业务细节；本任务不得将其整体复制成第二合同，也不得
  修改 `backend/AGENTS.md` 或 ADR。后续 adapter 接线必须另建 exact task。

## Implementation Report

- 改动摘要：Pending
- 自审：Pending
- 验证：Pending
- 实际使用的 skill：Pending
- 验证命令与结果：Pending
- 未运行项与原因：产品 authority 尚未 GO。
- 剩余风险：Pending

## Acceptance Review

- 验收结果：Pending
- 验收证据：Pending
- 未通过项：approval manifest digest、approval commit 和产品候选尚未形成。
