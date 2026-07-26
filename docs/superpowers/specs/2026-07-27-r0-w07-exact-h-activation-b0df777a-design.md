# R0-W07 Exact-H Activation Recovery Design

## Goal

从 local EXT `b0df777a...` 重新建立唯一 W07 activation 证据链，并保持
fail-closed。旧 W07 activation Packet 仅作为历史资产，不参与授权计算。

## Architecture Decision

采用三个有序治理事件：

1. `Quiescent Profile Candidate`：迁移 canonical profile，提交后才冻结 H/tree；
   不在该提交内生成引用自身 H 的 intent。
2. `Evidence Registration Parent`：后继提交生成绑定 Event 1 H/tree 的
   intent/package，记录 exact-H owner approval 和独立 review，仍保持 W07 STOP。
3. `Atomic Activation Event`：单父提交只执行 manifest 的 W07 ACTIVE 转换。

这使 reviewer overlay、activation evidence 和运行状态彼此可审计，同时避免在同一
commit 内自我批准。

## Canonical Path Decision

新的 W07 evidence root 为：

```text
.harness/changes/docs-r0-w07-exact-h-activation-b0df777a-20260727
```

后续 TDD 实施必须更新 loader 的 W07 profile 并拒绝旧 root。旧 root 不得保留为
fallback，也不得与新 root 混合。manifest 仍是唯一执行状态事实源。

## Identity Binding

每个后续 exact candidate 必须绑定：

- local `refs/heads/feature-chaotang-ext`；
- Event 1 candidate H 与 `H^{tree}`；
- deterministic raw-byte Git diff 与 SHA-256；
- activation intent 的原始字节 SHA-256；
- owner approval path/digest；
- independent review path/digest；
- approved scope 仅 `R0-W07`；
- 完整 ledger transition 和固定 exclusions。

不得预计算包含自身 commit H 的文件。Event 1 H 在其 commit 后由 Event 2 intent、
owner approval 和 review evidence 绑定；activation event 再从已包含全部证据的
registration parent 前向产生。owner approval 必须同时绑定 intent digest，独立 review
必须再绑定 owner approval digest。

## Authority Boundary

v1 保持全局 STOP；v2 只在全部 W07 evidence 和 history gate 通过后对 W07 返回 GO。
本设计不改变已批准 threat-model-B 外部前提，也不扩大到部署、数据库或 listener。

## Product Boundary

W07 激活后只允许推进 `/shangshufang`、`/shiguan` 的既有产品闭环。activation
Packet 不包含产品实现；W08/W09 继续未授权。

## Rollback

激活前通过丢弃未集成隔离候选回滚。激活后只能提交新的受审 forward transition，
不得 reset、删除 ledger 或回写历史 evidence。
