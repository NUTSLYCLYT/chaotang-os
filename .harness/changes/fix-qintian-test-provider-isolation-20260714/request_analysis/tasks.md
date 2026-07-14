# 任务：fix-qintian-test-provider-isolation-20260714

## 任务 1：隔离钦天监契约测试 provider

- 目标：让 SSE 兼容契约测试不依赖开发机 API key、provider 可用性或模型输出。
- 前置条件：生产 `_call_qintian_agent()` 同时支持 `LIVE` 与 `FALLBACK`，本轮不改变它。
- 输入：固定消息“预测 AI 采纳率”。
- 输出：测试 stub 返回确定性 token 与 `FALLBACK` 标签；路由仍负责 SSE 序列化。
- 涉及文件：`backend/tests/test_contract_alignment_p0.py`。
- 状态 / 数据变化：测试进程内 monkeypatch，测试结束自动恢复；无生产状态变化。
- 验证命令与证据：见 `ci_result/ci_summary.md`。
- 回滚边界：撤销测试 patch 会重新允许真实网络污染；生产代码无需回滚。
- 完成定义：有效 RED→GREEN，整合集无该失败，三层 doctor/diff/security 通过。
