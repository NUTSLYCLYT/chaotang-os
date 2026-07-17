# 任务：fix-migration-015-literal-normalization-20260717

## 任务 1：RED 锁定 015 fail-open

- 目标：证明结构合法、仅 `users.role` 默认值大小写漂移的 014 库被旧 015 错误放行。
- 前置条件：精确 ext 基线 `86c83a4`。
- 输入：临时 SQLite、Alembic 001–015 链。
- 输出：失败的 e2e 回归。
- 涉及文件：`test_migration_014_tenant_identity_tables.py`。
- 状态 / 数据变化：仅 pytest 临时库。
- 验证命令与证据：定向 pytest `DID NOT RAISE`，日志显示升级到 015。
- 回滚边界：删除测试即可，无真实数据。
- 完成定义：RED 原因精确为大小写误判。

## 任务 2：最小实现与回归

- 目标：引号字面量原样比较，SQL 语法层继续规范化。
- 前置条件：任务 1 RED。
- 输入：runtime 已审的引号感知算法。
- 输出：新的 validation-only 016，采用 `_normalize_sql_syntax` 与修正
  `_normalize_default`；015 保持历史内容。
- 涉及文件：migration 016、head 断言与同一测试文件。
- 状态 / 数据变化：无 DDL 变化。
- 验证命令与证据：从 stamp 015 起步的新 e2e GREEN、007–016 代表集、静态与 doctor。
- 回滚边界：revert 代码；不需要数据库 downgrade。
- 完成定义：已 stamp 015 的漂移库被挡，合法库到 016，无新增 fail-open。

## 任务 3：独立审查与集成

- 目标：精确绑定 ext 前序与实现头，生成 review-only 证据和 clean merge。
- 前置条件：任务 2 完成、远端零漂移。
- 输入：B/H、CI 证据、前一 review F-A。
- 输出：Claude GO、approval、candidate、fast-forward ext。
- 涉及文件：本 change `packet_review/` 两文件。
- 状态 / 数据变化：只更新 Git 远端引用。
- 验证命令与证据：D6 nodetest、candidate verifier、push 后 ls-remote。
- 回滚边界：push 后只允许新 revert。
- 完成定义：远端含修复，P6 才可进入下一阶段。
