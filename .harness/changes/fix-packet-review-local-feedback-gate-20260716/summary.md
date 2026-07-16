# 变更摘要：fix-packet-review-local-feedback-gate-20260716

| 字段 | 值 |
| --- | --- |
| Change ID | fix-packet-review-local-feedback-gate-20260716 |
| 类型 | fix |
| 状态 | READY_FOR_REVIEW |
| Owner | Project Agent |
| 创建日期 | 20260716 |

Packet ID: D6-L

## 范围

- 主线：根项目工程反馈门；不改前端、后端业务运行时。
- 文件：`scripts/lib/packet-review-local-feedback.mjs`、pre-push 入口与安装器、Node 测试、根 manifest/文档。
- 验证：真实临时 Git DAG 正反例、安装器 linked-worktree/core.hooksPath 测试、根 doctor、`git diff --check`。

## 安全声明

本门固定标记为 `LOCAL_FEEDBACK_ONLY`。它用于阻止误把未审 Packet 推到
`origin/feature-chaotang-ext`，可被 `git push --no-verify`、本机 hook 篡改或换客户端绕过，
不证明 reviewer 身份，也不替代外部签名、受保护分支或 required check。

## 完成结果

- 验证器只读取候选 Git objects，精确校验一个 root change、一个版本化 approval、报告 digest
  与 `B→H→R→M` 拓扑；merge tree 必须等于 review tree。
- 安装器支持 linked worktree、`core.hooksPath`、stdin replay、幂等和定向卸载；不会覆盖 unmanaged hook。
- 安装保持显式 opt-in；本变更没有修改真实 `.git/hooks`，没有合并或推送。
