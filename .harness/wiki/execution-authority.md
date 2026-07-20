# 执行权威 v1

`execution-authority.v1` 是 M0–M10 开工前的失效关闭护栏，不是产品实施授权。v1 永远保持：

```text
status = AMENDMENT_REQUIRED
canonicalPlan.state = INACTIVE
activation.activeAmendment = null
activation.approvalEvidence = null
activation.effectiveHead = null
```

## 命令语义

- `node scripts/execution-authority.mjs --status`：显示当前决定；v1 输出 `STOP`，命令本身成功读取时退出 0。
- `node scripts/execution-authority.mjs --check`：只证明 inactive guard 的结构、摘要和清单有效；它**不授予施工权**，因此即使退出 0 也不能接产品实现任务。
- `node scripts/execution-authority.mjs --authorize`：唯一开工查询；v1 必须输出 `STOP` 并退出 2。
- 不带参数时按 `--authorize` 处理；传入多个模式或其他多余参数时退出 64，避免把状态查询误当成开工授权。

调用方不得用 `--check && 开工`，也不得只检查命令是否退出 0；产品实现只能消费 `--authorize` 的结构化决定。

## 受控摘要重钉

受管入口、产品事实源或 `docs/plans/` 的任何字节变化都会让根 doctor 变红。这是设计行为，不能用自动“全部重算”脚本静默消除。

摘要重钉只能在独立治理 change 中执行：

1. 从真实 integration HEAD 创建新分支和唯一 change ID。
2. 说明受管文档为什么变化、谁批准、是否改变产品或执行语义。
3. 人工确认 v1 的 `status`、`canonicalPlan.state`、`sequence` 和三个 activation 字段完全未变。
4. 使用 `sha256sum <exact-file>` 只重算实际变更文件，在 manifest 中只修改对应 `sha256`。
5. 运行 authority suite、CLI、根/前端/后端 doctor 和 diff 检查。
6. 冻结 B/H/tree/binary-diff digest，由非实现 Claude Code 会话复核文档变化与摘要。
7. 托管平台 required check 未配置时，只能声明本地反馈，不能声明 ENFORCED。

如果变更需要激活 amendment，不得重钉 v1 达成；必须新建独立 schema/manifest/consumer 版本，并绑定用户批准、exact HEAD、迁移、回滚和独立审查。

## 同仓边界

schema、manifest、resolver 和 doctor 位于同一仓库，本地代码无法阻止恶意提交同时篡改检查器和被检查对象。真正的强制边界仍需托管平台分支保护、required check 和非提交者复核。
