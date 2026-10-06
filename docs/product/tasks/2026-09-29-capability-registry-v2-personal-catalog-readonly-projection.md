# CapabilityRegistry V2 个人能力目录只读投影

## Status

Ready

## Product Definition

- Task ID：`CAPABILITY-REGISTRY-V2-PERSONAL-CATALOG-READONLY-PROJECTION-20260929`
- 修正 Base：`ext-dev@3c913e38e0dc883220269822fe66e5547a665b43`
- Base tree：`5a50c821eb59be9b6fe22b27e060f62af8f333c2`
- 输入快照：`personal-capability-snapshot-2026-09-29.json`
- 输入 SHA-256：`aa516d2a9d54ea53a046eda8767085872a2e946038b3714bd16ff8758468a818`

扩展现有 CapabilityRegistry，让朝堂只读展示个人 Codex 的 73 个翰林院 Skill、16 个鸿胪寺服务组与 92 个 MCP 工具明细，同时保持目录元数据与运行权限完全分离。

本次修正审批同时纳入机器门禁在原审批基线上发现的 3 处 Ruff E501，只做等价换行，不改变 Harness 行为或测试语义。

### 核心合同

1. 唯一事实源仍是现有 CapabilityRegistry；不新建第二总账。
2. Skill、Prompt、模板和方法归 `hanlin`；MCP、插件、API、外部 Agent 和账号连接归 `honglusi`；朝堂 Runtime Skills 继续独立登记。
3. 每项能力分别记录 `visible`、`installed`、`connected`、`verified`、`runtime_bound`，不得互相代替。
4. 调用策略只允许 `AUTO_MATCH`、`EXPLICIT_ONLY`、`PREPARE_THEN_CONFIRM`、`DISABLED`。
5. 快照只含元数据；拒绝绝对路径、账号标签、密钥模式、未知字段、重复 ID、超限字符串和超限条目。
6. `runtime_binding_status=not_bound` 永远不授予执行能力；卡片不能直接调用 MCP、模型、发布、发送、删除、付费或交易。
7. 92 个 MCP 工具按服务组折叠展示；9 个内部 Safety/Hotline 与 Node REPL 支撑工具保留审计记录但不可产品投影。
8. V2 客户端做闭合解析；V1→V2 升级显式处理，不静默接受额外字段。

## Acceptance Criteria

- [ ] 翰林院推荐区只出现 `registry_home=hanlin` 的能力。
- [ ] 鸿胪寺候选区按 provider 折叠，明细数量和快照一致。
- [ ] 每张卡显示自然语言触发、显式触发、调用策略、费用、权限、数据外发、五态 readiness 和阻挡原因。
- [ ] 恶意、过大或含隐私字段的快照失败关闭；API 错误不泄漏本机路径或原始敏感值。
- [ ] 未绑定能力不出现“运行”“授权”“连接”类误导按钮。
- [ ] 后端 focused/full pytest 与 Ruff、前端 focused/full test、lint、typecheck、build、Root Harness 全部通过。
- [ ] 候选只改以下 14 条允许路径，不带入共享工作区已有改动与残缺 venv。

## Delivery Constraints

- 不修改 ADR、Harness、authority、CI、数据库和部署。
- 不登录、安装或永久授权任何外部平台。
- 不复制第三方 Skill 源码、Prompt 正文、凭据或私人文件到产品。
- 不让能力目录成为第二执行入口。
- 两个既有 Ruff 文件只允许等价换行，不改变逻辑、判断、数据或测试期望。
- 候选必须是本修正审批提交的唯一直接子提交；任何第 15 条路径都必须停止并重新签发。

## Affected Modules

- 模块：CapabilityRegistry V2 只读投影、个人能力快照、前端目录视图、既有 Ruff 基线修正。
- 允许路径：以下 14 条精确路径，禁止通配符和范围外修改。

1. `backend/app/api/capabilities.py`
2. `backend/app/capabilities/contracts.py`
3. `backend/app/capabilities/projection.py`
4. `backend/config/personal_capabilities.snapshot.json`
5. `backend/harness/capability_candidates/eval_runner.py`
6. `backend/tests/test_capabilities_api.py`
7. `backend/tests/test_capability_registry_projection.py`
8. `backend/tests/test_eval_runner_judgement.py`
9. `frontend/src/features/capabilities/CapabilityRegistry.module.css`
10. `frontend/src/features/capabilities/CapabilityRegistryClient.tsx`
11. `frontend/src/features/capabilities/capabilityRegistryViewModel.test.ts`
12. `frontend/src/features/capabilities/capabilityRegistryViewModel.ts`
13. `frontend/src/lib/backendClient.capabilities.test.ts`
14. `frontend/src/lib/backendClient.ts`

## Technical Plan

1. 从批准的个人能力快照生成严格、失败关闭的后端 V2 投影。
2. 前端闭合解析 V2，并以只读卡片呈现翰林院与鸿胪寺目录。
3. 保持全部能力 `runtime_binding_status=not_bound`，不给予执行、连接或授权入口。
4. 对两处既有 Ruff 文件仅拆分超长行，使全量 lint 恢复通过。
5. 运行审批清单中的完整验证矩阵和产品 authority 候选验证。

## Implementation Report

待本修正审批签发和推送后，将把已完成的 12 路径实现重建为审批提交的直接子提交，并补入两处等价 Ruff 换行。实现报告以候选提交 SHA、Tree、精确路径清单和新鲜验证输出为准。

## Acceptance Review

待机器门禁返回 `PASS / CANDIDATE_ELIGIBLE_FOR_OWNER_ACCEPTANCE` 后，再向所有者报告候选 SHA、Tree 与证据摘要；只有所有者另行确认候选和外部 Git 动作后，才允许快进推送候选。
