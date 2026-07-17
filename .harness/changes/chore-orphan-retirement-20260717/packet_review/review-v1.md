# Claude backend 分片审查 v1

## 范围

- B：`d7f7436fb6a7f257df7b13a4bc703c866602b243`
- reviewed H：`3996c7d087f313523c0ab592fba456fd5251ef3f`
- 模型：Claude Fable（Sonnet 多次无终态超时后的显式降级）

## 结论

强认证、用户归属、响应契约和招聘代码路径本身方向正确，但审查时证据不足：

1. 需要明确 H 全量第七条失败身份，并证明 clean B/clean H 一致。
2. golden case 不能只验证 JSON 自身，必须驱动后端审查/质量门原语。
3. DecisionTask 零写测试需要证明应用与计数使用同一隔离引擎，或增加直接禁止持久化调用的断言。

非阻塞观察：两个 result GET 仍匿名且 sid 熵较低；属于存量接口，需后续独立安全变更。

## 回修

- 全新 detached H 对同七条测试复现 6 failed/1 passed，与 clean B 完全一致；第七条为
  `test_forecast_endpoint_end_to_end`，只在被其他测试污染过的工作树变为 9 vs 6。
- 三个 P6 case 现驱动 `evidence_audit → critic/conflict → synthesize → quality_gate` 并全部 fail-closed；
  README 同步纠正 runner 边界。
- 招聘测试保留同一 `isolated_session_local` 计数与 production DB tripwire，并直接禁止调用
  `persist_compat_decision_task`。

本报告不签发 GO；完成回修后必须以更高 review 版本重审全包。

INSUFFICIENT_EVIDENCE
