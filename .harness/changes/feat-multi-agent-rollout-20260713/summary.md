# 变更摘要：feat-multi-agent-rollout-20260713

| 字段 | 值 |
| --- | --- |
| Change ID | feat-multi-agent-rollout-20260713 |
| 类型 | feat |
| 状态 | IMPLEMENTED_LOCAL_OBSERVE_PENDING |
| Owner | Project Agent |
| 创建日期 | 20260713 |

## 范围

状态：`IMPLEMENTED_LOCAL_OBSERVE_PENDING`，不是 `ROLLOUT` 或 `ENFORCED`。只有提交包含 policy 的代码后，才能从该 clean Git object 启动真实 Observe。

事实源由根 harness 拥有；前端 wrappers 只调用根 rollout guard，未移动业务逻辑或后端运行证据。外部 required check、独立 release/rollout trust、真实阶段时间和连续 20 次发布仍需按墙钟累积。
