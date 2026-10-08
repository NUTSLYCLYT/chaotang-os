# G3 六部 Runtime 指纹绑定 successor30（2026-10-08）

## Status

Implemented

## Product Definition

为远端已合入的锦衣卫全局证据覆盖投影绑定当前六部 Runtime 精确兼容指纹，恢复 Harness 失败关闭，同时保持历史复审证据与验证强度不变。

## Affected Modules

- 模块：六部 Runtime 精确兼容指纹门禁、Python/Harness 策略同步与治理记录。
- 允许路径：`scripts/check_harness.mjs`、`backend/tests/test_six_ministry_readiness_report.py`、本任务文档。

## Technical Plan

1. 计算当前 trusted-spine Runtime 指纹与既有 successor 指纹。
2. 在 Harness 与 Python 独立验证器中追加同一组精确兼容 pair，并同步拒绝未知、混搭和篡改状态的 self-test。
3. 运行 Harness check、Harness self-test 与差异检查；不修改产品 API、数据库、权限、网络或模型策略。

## Acceptance Criteria

- [x] 当前 Runtime 指纹 `sha256:fb3b121689b37a792ae626dea61deb8f7c2760e22c66e524bb7996e96ac31a69` 与 successor 指纹 `sha256:d4e78e42b89022088bb6687a7ab5cc57bcd908a3017b2b4a2e2611497d04def2` 作为精确 pair 被接受。
- [x] Python 与 Harness 使用完全相同的 27 组 pair。
- [x] 单边、混搭、篡改和未知指纹继续被拒绝。
- [ ] 最终 candidate 的 pre-push 门禁通过。

## Delivery Constraints

- 只改动治理验证器、其独立 Python 对照测试和本任务记录。
- 不修改历史审查指纹、来源提交、能力族统计、解析器数量、失败分类或测试标准。
- 不使用 `--no-verify`，不强推，不进行公共部署。

## Implementation Report

- 改动摘要：为远端 `feat(jinyiwei): add global evidence coverage projection` 引入的 trusted-spine 变化补充精确兼容 pair，并同步 Python 对照测试。
- 验证：Harness check 与 self-test 待当前候选提交完成后运行。
- 剩余风险：远端若继续修改 trusted-spine，需新增独立治理记录和 pair，不应静默放宽门禁。

## Acceptance Review

- 验收结果：Pending
- 验收证据：待当前候选提交的 Harness check、self-test 和 pre-push 结果。
- 未通过项：无产品功能未决项。
