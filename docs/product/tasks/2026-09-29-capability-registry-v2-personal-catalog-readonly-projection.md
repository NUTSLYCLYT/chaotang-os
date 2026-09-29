# CapabilityRegistry V2 个人能力目录只读投影

状态：`READY_FOR_OWNER_REVIEW / NON_AUTHORIZING`。

## 任务

- Task ID：`CAPABILITY-REGISTRY-V2-PERSONAL-CATALOG-READONLY-PROJECTION-20260929`
- Base：`ext-dev@9b0775e05651335d611fe383936a31c3b306113d`
- Base tree：`aa2a456904e39ef3a9c90b4bb47cf7fee2ab8add`
- 输入快照：`personal-capability-snapshot-2026-09-29.json`
- 输入 SHA-256：`aa516d2a9d54ea53a046eda8767085872a2e946038b3714bd16ff8758468a818`

## 目标

扩展现有 CapabilityRegistry，让朝堂能只读展示个人 Codex 的 73 个翰林院 Skill、16 个鸿胪寺服务组与 92 个 MCP 工具明细，同时保持目录元数据与运行权限完全分离。

## 产品路径

1. `backend/app/api/capabilities.py`
2. `backend/app/capabilities/contracts.py`
3. `backend/app/capabilities/projection.py`
4. `backend/config/personal_capabilities.snapshot.json`
5. `backend/tests/test_capabilities_api.py`
6. `backend/tests/test_capability_registry_projection.py`
7. `frontend/src/features/capabilities/CapabilityRegistry.module.css`
8. `frontend/src/features/capabilities/CapabilityRegistryClient.tsx`
9. `frontend/src/features/capabilities/capabilityRegistryViewModel.test.ts`
10. `frontend/src/features/capabilities/capabilityRegistryViewModel.ts`
11. `frontend/src/lib/backendClient.capabilities.test.ts`
12. `frontend/src/lib/backendClient.ts`

任何第 13 条路径都必须停止并重新签发。

## 核心合同

1. 唯一事实源仍是现有 CapabilityRegistry；不新建第二总账。
2. Skill、Prompt、模板和方法归 `hanlin`；MCP、插件、API、外部 Agent 和账号连接归 `honglusi`；朝堂 Runtime Skills 继续独立登记。
3. 每项能力分别记录 `visible`、`installed`、`connected`、`verified`、`runtime_bound`，不得互相代替。
4. 调用策略只允许 `AUTO_MATCH`、`EXPLICIT_ONLY`、`PREPARE_THEN_CONFIRM`、`DISABLED`。
5. 快照只含元数据；拒绝绝对路径、账号标签、密钥模式、未知字段、重复 ID、超限字符串和超限条目。
6. `runtime_binding_status=not_bound` 永远不授予执行能力；卡片不能直接调用 MCP、模型、发布、发送、删除、付费或交易。
7. 92 个 MCP 工具按服务组折叠展示；9 个内部 Safety/Hotline 与 Node REPL 支撑工具保留审计记录但不可产品投影。
8. V2 客户端做闭合解析；V1→V2 升级显式处理，不静默接受额外字段。

## 验收

- 翰林院推荐区只出现 `registry_home=hanlin` 的能力。
- 鸿胪寺候选区按 provider 折叠，明细数量和快照一致。
- 每张卡显示自然语言触发、显式触发、调用策略、费用、权限、数据外发、五态 readiness 和阻挡原因。
- 恶意/过大/含隐私字段快照失败关闭；API 错误不泄漏本机路径或原始敏感值。
- 未绑定能力不出现“运行”“授权”“连接”类误导按钮。
- 后端 focused/full pytest 与 Ruff、前端 focused/full test、lint、typecheck、build、Root Harness 全部通过。
- 候选只改以上 12 条路径；不得带入当前共享工作区已有改动与残缺 venv。

## 非目标

- 不修改 ADR 0028、Harness、authority、CI、数据库和部署。
- 不登录、安装或永久授权任何外部平台。
- 不复制第三方 Skill 源码、Prompt 正文、凭据或私人文件到产品。
- 不让能力目录成为第二执行入口。
