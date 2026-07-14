# CI 摘要：fix-qintian-test-provider-isolation-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| 114 项整合集（实现前） | 1 | RED：113 passed / 1 failed；实际 `LIVE`、期望 `FALLBACK` | provider 环境污染可复现 | 2026-07-14 本地终端 |
| 单测试 `-k qintian_chat...` | 0 | 1 passed / 25 deselected | 确定性 GREEN | 2026-07-14 本地终端 |
| 114 项整合集（实现后） | 0 | 114 passed；2 个既有 OpenAPI warnings | 远端 DecisionTask + K0C + qintian | 2026-07-14 本地终端 |
| Python compile + 三层 doctor / diff / security | 0 | 0 errors、0 warnings；diff/secret PASS | 语法、护栏与变更边界 | 2026-07-14 本地终端 |

## 结果

钦天监契约测试已从环境相关失败变为确定性通过；整合集 114/114 通过，生产代码零变化，三层护栏和差异安全检查通过。

## 未验证项

- 全量 backend/frontend suite 本轮不运行，剩余失败数沿用后续专门清零闭环重新测量。
- 当前 3050/发布身份不属于测试隔离范围。

## Diff 与回滚复核

- changed files：单个 backend contract test + root change evidence。
- diff review：生产文件零变化；不读取/删除密钥；不修改模型行为。
- 回滚是否演练：pytest monkeypatch 用例结束自动恢复；生产运行路径保持原状。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| RED 有效 | 真实 provider 返回 LIVE 导致固定断言失败 | PASS |
| 单测 GREEN | 1 passed | PASS |
| 整合集 | 114 passed / 2 个既有 warnings | PASS |
| 三层护栏 | 全部 0 errors / 0 warnings | PASS |

## 声明状态

- `VERIFIED_COMPLETE`：本测试隔离纵切全部门禁通过；不代表全量套件或生产发布 READY。
