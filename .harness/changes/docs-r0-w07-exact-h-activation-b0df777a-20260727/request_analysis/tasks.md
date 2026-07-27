# 任务：R0-W07 Exact-H Activation Recovery

## 本轮：Packet Preparation

- [x] 从 exact local EXT `b0df777a...` 创建 isolated worktree。
- [x] 证明基线 tree 为 `a7beae65...` 且工作树初始干净。
- [x] 证明 W07 为 `STOP / NO_ACTIVE_WORK_PACKAGE`。
- [x] 核对已登记 reviewer reassignment overlay。
- [x] 将旧 activation worktree 和 Packet 降级为 Asset Pool。
- [x] 定义新的 canonical evidence root 与四事件激活协议。
- [x] 定义后续 TDD、证据、审查和 exact-H 门。
- [x] 完成本 Packet 的治理验证。
- [x] 完成本 Packet 的独立只读审查。
- [x] 冻结本 Packet candidate H/tree。
- [x] 请求本 Packet 受控整合审批。

## 后续 Event 1：Authority Identity Remediation Candidate

- [x] 取得 authority/profile TDD 实施授权。
- [x] RED：新增测试拒绝旧 W07 evidence root 和跨 Packet 证据混用。
- [x] RED：新增测试证明 activation commit 集成 EXT 后，旧 ref/effective-base
  等值规则拒绝有效 mainline。
- [x] GREEN：将 W07 profile 收敛到本 Change ID，并实现
  `EXT ref == pinned HEAD`、approved candidate first-parent ancestry。
- [x] 将 W07 review base 固定为 `b0df777a...`。
- [x] 固定测试 evidence 生成器使用 authority 的 `/usr/bin/git` 外部信任根。
- [x] 补齐 exact Event 1 candidate 的 12 路径 allowlist 回归。
- [x] 拒绝影响 exact diff 的 repository-local config 与 `info/attributes`。
- [x] 拒绝 `extensions.worktreeConfig` 和未检查的 `config.worktree` 覆盖。
- [x] 禁用 system/user attributes，并在 diff 后重验 repository-local metadata。
- [x] 用 `GIT_ATTR_SOURCE=candidateH` 将 `.gitattributes` 绑定到候选树。
- [x] 用 `core.commitGraph=false` 禁用未绑定的 commit-graph acceleration。
- [x] 对 ACTIVE W07 运行 hardened fsck，并拒绝 alternates、partial clone
  配置、`fsck.*` 降级配置、`.promisor` pack markers 与 object database
  symbolic links。
- [x] 将 Event 1 review path set 收紧为冻结的 12 条路径完全相等。
- [x] 运行 authority、amendment、doctor 全套回归。
- [x] 先提交 authority candidate，再冻结 exact H/tree，保持 W07 STOP。

## 后续 Event 2：Reviewer Overlay Refresh

- [x] 对 Event 1 的 protected authority blobs 生成 reviewer reassignment package。
- [x] 取得两轮 fresh/read-only Codex GO 和 Product Owner exact-H approval。
- [x] 以 quiescent forward event 刷新 W07-only overlay。
- [x] 证明旧 overlay 保留历史、W07 仍 STOP。

## 后续 Event 3：Activation Evidence Registration Parent

- [x] 从 Event 1 的已知 H/tree 生成 deterministic review package 和 activation intent。
- [x] 请求 Product Owner 对 H/tree、package digest、intent digest、scope 和 exclusions
  的 exact approval。
- [x] 记录 owner approval 原始字节与 SHA-256。
- [x] 运行 fresh、read-only Codex Independent QA。
- [x] 要求 `GO / HIGH 0 / MEDIUM 0`。
- [x] 冻结包含全部证据但仍无 W07 ledger 的 registration parent。

## 后续 Event 4：Atomic Activation Event

- [ ] 取得 atomic activation candidate 明确授权。
- [ ] 只修改已审查的 manifest 状态转换。
- [ ] 证明 activation commit 恰好一个父提交。
- [ ] 在 isolated candidate 上运行 pre-integration verification；真实 EXT ref 尚未移动，
  W07 只允许因一个预期 ref-identity gate 返回 STOP。
- [ ] 在 disposable integration simulation 中令 EXT ref 指向 activation H，证明 W07 GO。
- [ ] 完成独立只读审查并请求本地 EXT fast-forward 集成批准。
- [ ] 获批后更新 local EXT ref，再在 exact integrated HEAD 上运行 fresh acceptance。
- [ ] 只有 post-integration W07 GO 后才解除产品实施等待；失败时 fail closed 并前向修复。

## 停止条件

authority conflict、production ambiguity、scope conflict、file ownership
conflict、candidate drift 或 concurrent writer 任一出现时立即 `BLOCKED`。
