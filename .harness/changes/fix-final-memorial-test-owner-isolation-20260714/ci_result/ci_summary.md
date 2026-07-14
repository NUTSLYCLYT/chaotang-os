# CI 摘要：fix-final-memorial-test-owner-isolation-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| focused pytest（修复前） | 1 | RED：`无权查看该任务` | owner/auth 契约漂移 | 2026-07-14 终端 |
| `pytest -q tests/test_final_memorial_gate.py` | 0 | 8 passed | 正式奏折形成、裁决、归档与 worker gate | 2026-07-14 终端 |
| 正式主链 6 文件 pytest | 0 | 41 passed，2 个既有 LiteLLM coroutine warning | 任务/事件/outbox/奏折/裁决/归档 | 2026-07-14 终端 |
| P0-B status + ownership ratchet | 0 | 3 passed | 跨用户访问继续拒绝 | 2026-07-14 终端 |
| 真实 DB 前后快照 | 0 | SHA-256/size/mtime 完全相同 | production-path 无污染证据 | 2026-07-14 终端 |
| `python3 -m compileall -q tests/test_final_memorial_gate.py` | 0 | PASS | Python syntax | 2026-07-14 终端 |
| `python3 -m ruff check ...` | 1 | 环境未安装 ruff，未执行 lint | lint availability | 2026-07-14 终端 |
| backend/root harness doctor | 0 | 0 errors / 0 warnings | 后端与跨线 harness | 2026-07-14 终端 |

## 结果

- 本测试契约纵切 `VERIFIED_COMPLETE`；生产授权代码零改动。
- 真实 DB 证据：`10dbcf48d3fb4c6a5297bd2f42b73c030d9db7a79c1e0e47734df5dac60859e2`、size `2121728`、mtime epoch `1783863664`，主链测试前后相同。

## 未验证项

- 全仓 production-path tripwire 尚未实现；本证据只覆盖本轮正式主链与 P0-B 聚焦测试。
- ruff 不在当前 Python 环境；以 compileall、pytest 和 doctor 替代语法/行为验证，但不宣称 lint 已完成。
- 测试/文档变更无前端运行代码，build/type/browser 不适用。

## Diff 与回滚复核

- changed files：正式奏折测试、根 change、launch blueprint。
- diff review：只对齐测试 seed owner 并增加明确 success 断言；未修改 router/auth/DB。
- 回滚是否演练：未部署；单提交可反向回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| RED 明确归因 | API 返回“无权查看该任务” | PASS |
| 正式奏折闭环 | 8 passed | PASS |
| 正式业务主链 | 41 passed | PASS |
| 对象级授权无弱化 | P0-B 3 passed；生产代码零 diff | PASS |
| 真实 DB 不变 | hash/size/mtime 三元一致 | PASS |
| 全仓 tripwire | 未实施 | NOT VERIFIED |

## 声明状态

- `VERIFIED_COMPLETE`：仅指本测试 owner/隔离契约纵切；S2 与生产发布仍未完成。
