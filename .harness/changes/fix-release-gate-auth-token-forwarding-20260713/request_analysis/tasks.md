# 任务：fix-release-gate-auth-token-forwarding-20260713

## 任务 1

- 目标：修复最终发布门 jiqun 契约的 401 假失败。
- 输入：已验证的 `HARNESS_AUTH_TOKEN`。
- 输出：契约烟测携带 Bearer token 及回归测试。
- 验收：完整 production release gate GREEN。
