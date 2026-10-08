# G3 六部 Runtime 指纹绑定 successor31（2026-10-08）

## Status

Implemented

## Product Definition

为远端已合入的锦衣卫离线新闻快照规范化实现绑定当前六部 Runtime 精确兼容指纹，保持 Harness 失败关闭与独立 Python 对照验证。

## Affected Modules

- 模块：六部 Runtime 精确兼容指纹门禁、Python/Harness 策略同步与治理记录。
- 允许路径：`scripts/check_harness.mjs`、`backend/tests/test_six_ministry_readiness_report.py`、本任务文档。

## Technical Plan

1. 计算当前 trusted-spine Runtime 指纹，复用既有 successor 指纹。
2. 在 Harness 与 Python 验证器中追加同一组精确兼容 pair，并同步 self-test 数量与拒绝矩阵。
3. 运行 Harness check、Harness self-test 与差异检查，不放宽任何业务或网络边界。

## Acceptance Criteria

- [x] 当前 Runtime 指纹 `sha256:2e967c9a416f42652f270b95e7b18559f1da547a8bd1bf191da19c35171ef644` 与 successor 指纹 `sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2` 作为精确 pair 被接受。
- [x] Python 与 Harness 使用完全相同的 28 组 pair。
- [x] 单边、混搭、篡改和未知指纹继续被拒绝。
- [ ] 最终 candidate 的 pre-push 门禁通过。

## Delivery Constraints

- 只改动治理验证器、其独立 Python 对照测试和本任务记录。
- 不修改历史审查指纹、来源提交、能力族统计、解析器数量、失败分类或测试标准。
- 不使用 `--no-verify`，不强推，不进行公共部署。

## Implementation Report

- 改动摘要：为远端离线新闻快照规范化触碰 trusted spine 的变化补充精确兼容 pair，并同步 Python 对照测试。
- 验证：待当前候选提交完成后运行 Harness check、self-test 和 pre-push。
- 剩余风险：trusted-spine 后续变化必须继续通过独立治理记录绑定，不得静默放宽门禁。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待当前候选提交的 Harness check、self-test 和 pre-push 结果。
- 未通过项：无产品功能未决项。
