# R3：最新完整版的预算与户部基础模块合入

## Status

Ready

任务定义及隔离验证已就绪，仍待 Owner 确认批准清单摘要。本文及同目录提案不是已落地批准，不产生产品 GO。现有主线、本机完整候选、用户数据和界面不因本材料被修改。

## Product Definition

目标是把最新完整朝堂逐批纳入 ext-dev。先合入可独立验证的预算账本与户部计算基础，再接入完整调用链；不是另建精简产品，不删除后续能力或测试。

用户已明确新任务累计预算为 50,000 tokens。旧任务保留原额度、已用量及未决预留；模型执行仍默认关闭。本批仅提供已有业务的基础代码，不新增网络接口或打开模型。

## Base and Scope

基点为当前 ext-dev `dfae1e7c57354c3942d4ad8668f8383fd6a3d30c`，精确 tree 和路径见 CT-R3-LATEST-FOUNDATIONS-20260928 批准提案。基点发生变化时重新冻结，不复用过期批准。

批准提交仅包含三份记录：本说明、新批准清单，以及已获本地修订批准的 R2 任务说明。本次才申请将 R2 修订说明一并提交；不改原 R2 批准 JSON、摘要、原候选历史或验证回执。

产品施工限下列十个新增文件：

- backend/app/cash_safety/__init__.py
- backend/app/cash_safety/calculation.py
- backend/app/cash_safety/contracts.py
- backend/app/cash_safety/work_product.py
- backend/app/fusion/__init__.py
- backend/app/fusion/budget.py
- backend/app/fusion/task_token_budget.py
- backend/tests/test_cash_safety_kernel.py
- backend/tests/test_fusion_task_token_budget.py
- backend/tests/test_persistent_budget_connections.py

## Delivery Constraints

沿用既有账户、任务、预算与成果契约；不得改主路由、授权、ADR 0028、审查指纹、界面或模型开关。真实任务的供应商计量、传输预检、取消、重试和宿主集成在完整后继批次验收，本批不能宣称已经完成真实模型闭环。

全量整合范围继续保留。不得以文件数量限制为由删除旧功能、保护或测试；本批只是分阶段合入，不是缩小 Goal。

## Affected Modules

预算基础：使用既有 Fusion provider-budget 数据库设计，保存尝试计数、owner/task 累计额度和预留。新增默认 50,000 与已知 20,000 表结构原子迁移，保留旧任务额度；不建另一份用户任务或权限系统。

户部基础：复用最新现金分析输入、确定性计算和既有 WorkProduct 产物写入适配。主线 API 尚不接线；不得称模型财务分析或真实资金操作。

修复一项已复现的连接生命周期问题：sqlite3 连接上下文只管理事务，不主动关闭连接。使用标准库 closing 关闭预算读写连接，成功、额度拒绝、额度不符都关闭；不改变计数语义。

## API Contract

本批不新增或修改 HTTP API。预算和现金分析只新增内部模块；不打开真实网络、供应商或用户操作入口。

## Storage and Compatibility

- 新任务默认 50,000；旧任务 cap 不变，调用方不能通过重开或重试扩额。
- 先预留整次输入与输出额度，可靠 usage 才结算；未知用量保持预留。
- 已知旧预算表在同一事务内迁移并核对外键；未知结构拒绝，不能删库或清账绕过。
- 连接关闭不是退款，不释放已用量或未知预留。
- 本批不运行用户数据库迁移，所有验证使用临时库；尚未证明最终全栈恢复包覆盖 Fusion 数据。

## Acceptance Criteria

- [ ] 实际 ext-dev 基点只增加十个批准文件，既有源码及用户改动保持。
- [ ] 户部确定性计算、原有 20,000 情形、并发预留、结算、未知用量和重启保护通过。
- [ ] 新任务 50,000 额度可预留到边界，超额拒绝，重开用量不重置，旧任务保留 20,000。
- [ ] 预算初始化、读取、预留、耗尽拒绝、额度不符均主动关闭 SQLite 连接；Windows 临时库可正常清理。
- [ ] 本批十文件 lint 与三组测试通过，差异检查无空白错误。
- [ ] 按 M0 得到精确 task 的 GO，产品候选为批准提交的精确单亲子并验证通过。
- [ ] 区分本批基础模块验收与全产品/真实用户验收，不勾选 G3 完成。

## Technical Plan

使用已有 lyt1 和 codex-engineering-workflow；按跨模块变更的 Codex 原生顺序步骤进行，不安装工具，不启动 Claude。只有明确隔离提案范围允许准备；真实产品写入遵循 M0。

1. 准备完整最新候选和原始主线差异，保持原 32 项。
2. 把本批十文件放到原始 ext-dev 隔离副本验证，证明不依赖尚未合入的大量模块。
3. 对连接问题先建立失败用例，再修复并复验。保持原事务提交/回滚及预算语义。
4. Owner 确认批准摘要后，独立提交并推送三份批准记录；authorize 对精确 task 返回 GO 后施工。
5. 只应用已冻结十文件，完成批准矩阵，生成并核验精确单亲子候选；最终候选身份与 Git 外部动作另按既有规则确认。
6. 继续最新完整版后继接线与测试合入，不能把本批当成第二产品。

## Rollback

十文件在基点均不存在。本批不开启路由/模型、不访问运行库。源码回退只针对该候选新增文件，先核对摘要和后续依赖；共享工作区不 reset、不删其他改动。

后续真正使用账本后，不得通过恢复旧数据库抹去新增用量。应先停止模型和写入、保存完整账本与回执，再按兼容性恢复。最终发布的数据库回退仍单独演练。

## Implementation Report

已准备隔离候选，没有在产品仓库实施。基点源自真实 Git 对象，初次复制误排除了 credentials.py 源码模块，导致收集失败；已补回该原始代码，未读取私人凭据，失败日志保留。

原基础模块测试 22 项通过。追加连接回归后，旧实现 5 项失败；修复后与基础测试共同通过。Windows 的临时目录清理失败是实际复现，不能用 GC 或忽略清理错误来充作修复。

当前 evidence 位于 outputs/Chaotang-Release-Consolidation-20260928/foundation-batch/，具体测试、lint、scope 与批准摘要以最终交付记录为准。没有真实产品模型调用、GUI 操作、部署或用户运行库修改。

六部原审查绑定以及主线检出字节问题仍需单独处理；本批不补假指纹，不把根检查失败改写为 PASS。完整版本还需要真实模型、来源、UI、恢复及原 32 项验收。

## Acceptance Review

Pending。材料供 Owner 审查；没有获得本批精确摘要批准，没有批准提交或产品候选提交。批准记录字段的 APPROVED_FOR_ONE_CHILD 是待提交清单的合同值，不代表本地草稿已经具有权限。
