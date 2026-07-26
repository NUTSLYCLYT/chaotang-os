# R0-W07 Exact-H Activation Recovery Design

## Goal

从 local EXT `b0df777a...` 重新建立唯一 W07 activation 证据链，并保持
fail-closed。旧 W07 activation Packet 仅作为历史资产，不参与授权计算。

## Architecture Decision

采用四个有序治理事件：

1. `Authority Identity Remediation Candidate`：迁移 canonical profile，并把
   integrated-mainline identity 改为 EXT ref 绑定 pinned HEAD、approved candidate
   绑定其第一父祖先；提交后才冻结 H/tree。
2. `Reviewer Overlay Refresh`：重新审查 Event 1 的 protected authority blobs，并
   静默刷新 W07-only overlay；仍保持 W07 STOP。
3. `Activation Evidence Registration Parent`：生成绑定 Event 1 H/tree 的
   intent/package，记录 exact-H owner approval 和独立 review，仍保持 W07 STOP。
4. `Atomic Activation Event`：单父提交只执行 manifest 的 W07 ACTIVE 转换。

这使 authority runtime、reviewer overlay、activation evidence 和运行状态彼此可审计，
同时避免在同一 commit 内自我批准。

## Canonical Path Decision

新的 W07 evidence root 为：

```text
.harness/changes/docs-r0-w07-exact-h-activation-b0df777a-20260727
```

后续 TDD 实施必须更新 loader 的 W07 profile 并拒绝旧 root。旧 root 不得保留为
fallback，也不得与新 root 混合。manifest 仍是唯一执行状态事实源。

## Integrated Mainline Identity

`effectiveBase.sha` 表示经过审查的 Event 1 authority candidate，不表示持续移动的
branch tip。ACTIVE W07 loader 必须证明：

- `effectiveBase.sha == approvalEvidence.candidateH`；
- candidate H 是 registration parent 和 activation HEAD 的第一父祖先；
- `refs/heads/feature-chaotang-ext == pinned HEAD`；
- 初始/最终 HEAD 与 EXT ref 采样不漂移；
- exact review package 等于
  `b0df777a1fe94d98afdc62b4cdd02a2f8a091391..candidateH` 的 hardened raw diff。

现有 overlay 把四个 protected authority files 固定为旧 candidate bytes。Event 1
完成后必须用两轮新的 Codex review 和 Product Owner approval 静默刷新 overlay，
否则 Event 4 必须 fail closed。

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

不得预计算包含自身 commit H 的文件。Event 1 H 在其 commit 后先由 Event 2 refreshed
overlay 绑定，再由 Event 3 intent、owner approval 和 review evidence 绑定；activation
event 从已包含全部证据的 registration parent 前向产生。owner approval 必须同时绑定
intent digest，独立 review 必须再绑定 owner approval digest。

## Authority Boundary

v1 保持全局 STOP；v2 只在全部 W07 evidence 和 history gate 通过后对 W07 返回 GO。
本设计不改变已批准 threat-model-B 外部前提，也不扩大到部署、数据库或 listener。

## Product Boundary

W07 激活后只允许推进 `/shangshufang`、`/shiguan` 的既有产品闭环。activation
Packet 不包含产品实现；W08/W09 继续未授权。

## Rollback

激活前通过丢弃未集成隔离候选回滚。激活后只能提交新的受审 forward transition，
不得 reset、删除 ledger 或回写历史 evidence。
