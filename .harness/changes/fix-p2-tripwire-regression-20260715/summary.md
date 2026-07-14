# 变更摘要：fix-p2-tripwire-regression-20260715

| 字段 | 值 |
| --- | --- |
| Change ID | fix-p2-tripwire-regression-20260715 |
| 类型 | fix |
| 状态 | VERIFIED_PARTIAL |
| Owner | Project Agent |
| 创建日期 | 20260715 |

## 范围

- 主线：后端运行时与测试；根级 harness 仅记录证据。
- 文件：`backend/src/governance_compat_store.py`、`backend/tests/test_flow_store_legacy_tripwire.py` 及本变更记录。
- 验证：两个 P2 回归聚焦测试、P2 相关测试组、尚书房组合、后端全量测试、三层 doctor。

## 目标

关闭 P2 合入后的两个回归：治理兼容写入绕过 `DecisionTask` 唯一创建入口，以及遥测测试依赖进程级计数器初始值。

## 非目标

- 不处理全量测试中与本变更无关的既有失败。
- 不修改前端、大殿冻结边界或后端 flow-store 业务逻辑。

## 结果

- 两个 P2 回归均已关闭：目标测试、顺序污染复现、P2 相关 19 项和尚书房 38 项全部通过。
- 后端全量由基线 `9 failed, 2601 passed, 26 skipped` 改善为 `7 failed, 2603 passed, 26 skipped`；剩余 7 项均不在本变更范围。
- 根、后端、前端三层 doctor 均为 `0 errors, 0 warnings`。
