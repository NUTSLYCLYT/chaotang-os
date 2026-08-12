# 任务：fix-professional-agent-k0-root-registration-20260810

## 任务 1

- 目标：让根 harness 强制索引 K0，删除或漂移时 fail closed。
- 前置条件：K0 candidate `ac815b52` 与独立 GO。
- 输入：matrix schema/manifest/CLI/tests。
- 输出：project manifest registration、doctor delegation、wiki 与负向测试。
- 涉及文件：根 harness 登记面，不含产品 runtime。
- 状态 / 数据变化：治理状态从 candidate-only 变为 `REVIEW_GO_PENDING_PROMOTION`。
- 验证命令与证据：见 CI 摘要。
- 回滚边界：单注册提交 revert。
- 完成定义：exact-H review/authority 完成后经 Gitee 合入唯一 EXT。
