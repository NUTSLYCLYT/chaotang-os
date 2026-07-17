# CI 摘要：fix-migration-015-literal-normalization-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| 新增 015 字面量大小写 e2e（实现前） | 1 | DID NOT RAISE；错误升到 015 | 实证 `'USER'` 被误判为 `'user'` | 临时 SQLite，2026-07-17 |
| 同一 e2e（实现后） | 0 | 1 passed | 015 拒绝并保持 version=014 | 临时 SQLite，2026-07-17 |
| migration 014/015 测试文件 | 0 | 6 passed | fresh/existing/malformed/default/FK/downgrade | 临时 SQLite，2026-07-17 |
| 007–015 / authority / adoption / runtime DDL 代表集 | 0 | 56 passed | 相邻迁移、strict、adoption 与新负例 | 临时 SQLite，2026-07-17 |
| Ruff + 隔离 compileall | 0 | All checks passed / 通过 | 变更 Python 静态与语法 | 2026-07-17 |
| backend/root harness doctor | 0 | 0 errors / 0 warnings | 两层护栏 | 2026-07-17 |

## 结果

RED→GREEN 已闭合 reviewer F-A。修复只改变 015 对引号字面量的比较；合法 identity
形态与 validation-only downgrade 继续通过。

## 未验证项

- PostgreSQL inspector 文本形态未验证。
- 未连接或迁移真实数据库；已到 015 的既有库不会自动重跑该 revision。

## Diff 与回滚复核

- changed files：migration 015、本地 e2e、本 root change。
- diff review：只收紧 validator，revision 图和 DDL 不变。
- 回滚是否演练：validation-only，无数据变化；代码 revert 即可。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| `'USER'` 不得等价于 `'user'` | 旧 RED / 新 GREEN | 完成 |
| 合法 014/015 行为不回归 | 6 passed | 完成 |
| 代表集、静态、doctor | 56 passed；Ruff/compile/双 doctor 全绿 | 完成 |
| 精确 Claude review | 待运行 | 待完成 |

## 声明状态

- `READY_FOR_CLAUDE_REVIEW`：实现与本地验证完成，尚未获得精确 H 的独立 GO。
