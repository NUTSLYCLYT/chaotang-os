# 对抗审查交接

## 范围

- 文档：`docs/multi-agent-harness-control-plane-blueprint-2026-07-13.md`
- 审查方式：独立只读 Agent，三轮 Go/No-Go。

## 第一轮

结论：NO-GO。

关键问题：重叠路径租约缺少单一事务；Git hook 被误当成 OS 写保护；测试会话路由可能成为生产后门；依赖图、Next build 隔离、运行身份和 rollout 回退不完整。

修订：改为 SQLite 单事务 + fencing；attestation + integration/CI 权威门；外置测试身份；不可变 Next build；artifact digest + ledger hash chain；补回退和 break-glass。

## 第二轮

结论：NO-GO。

剩余问题：worktree 可能各自使用 SQLite；hash chain 不能防整链重写；活 PID 但 heartbeat 停止时锁回收规则矛盾；build 目录不可变尚未机器强制。

修订：数据库固定到 `git-common-dir` 并验证 inode/repository identity；READY 强制使用外部信任锚；锁状态机改为 `active -> suspect -> fenced -> reclaimed`；OS socket 为最终事实；build digest 后只读并持续校验。

## 第三轮

结论：GO。

- 无剩余 CRITICAL、HIGH 或 MEDIUM。
- 共享控制面数据库、外部信任锚、资源回收状态机、只读 build、角色权限和 SQLite 退出条件均已通过审查。

