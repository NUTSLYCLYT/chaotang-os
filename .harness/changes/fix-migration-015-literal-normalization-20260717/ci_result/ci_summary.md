# CI 摘要：fix-migration-015-literal-normalization-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| 新增 015 字面量大小写 e2e（实现前） | 1 | DID NOT RAISE；错误升到 015 | 实证 `'USER'` 被误判为 `'user'` | 临时 SQLite，2026-07-17 |
| 发布迁移设计复核 | 不适用 | 否决“直接改 015” | 已 stamp 015 不会重跑；必须新增 016 | 送审前自查，2026-07-17 |
| 016 e2e（从已 stamp 015 起步） | 0 | 1 passed | 016 拒绝并保持 version=015 | 临时 SQLite，2026-07-17 |
| 007–016 / authority / adoption / runtime DDL 代表集 | 0 | 56 passed | 相邻迁移、strict、adoption 与新负例 | 临时 SQLite，2026-07-17 |
| Ruff + 隔离 compileall | 0 | All checks passed / 通过 | 变更 Python 静态与语法 | 2026-07-17 |
| backend/root harness doctor | 0 | 0 errors / 0 warnings | 两层护栏 | 2026-07-17 |

## 结果

RED 实证闭合 reviewer F-A；随后发布迁移原则复核发现直接修改 015 无法覆盖存量库，
因此在送审/上传前改为新增 validation-only 016。最终 e2e 从已 stamp 015 起步，证明
漂移库被 016 拒绝；合法 identity 形态到 head=016，validation-only downgrade 保持数据。

## 未验证项

- PostgreSQL inspector 文本形态未验证。
- 未连接或迁移真实数据库；真实部署需授权升级到 016 才会执行新验证。

## Diff 与回滚复核

- changed files：新增 migration 016、head/e2e 断言、本 root change；最终 diff 不修改 015。
- diff review：只新增 corrected validator head，既有 DDL 不变。
- 回滚是否演练：临时链验证 016 为 validation-only；真实回滚需先 downgrade marker
  016→015，再 revert，未获授权不执行。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| `'USER'` 不得等价于 `'user'` | 旧 RED / 新 GREEN | 完成 |
| 已 stamp 015 存量库重新过门 | 新 e2e 1 passed | 完成 |
| 合法 007–016 行为不回归 | 56 passed | 完成 |
| 代表集、静态、doctor | 56 passed；Ruff/compile/双 doctor 全绿 | 完成 |
| 精确 Claude review | 待运行 | 待完成 |

## 声明状态

- `READY_FOR_CLAUDE_REVIEW`：实现与本地验证完成，尚未获得精确 H 的独立 GO。
