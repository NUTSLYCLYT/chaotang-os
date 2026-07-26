# 任务：R0-W07 Exact-H Activation Recovery

## 本轮：Packet Preparation

- [x] 从 exact local EXT `b0df777a...` 创建 isolated worktree。
- [x] 证明基线 tree 为 `a7beae65...` 且工作树初始干净。
- [x] 证明 W07 为 `STOP / NO_ACTIVE_WORK_PACKAGE`。
- [x] 核对已登记 reviewer reassignment overlay。
- [x] 将旧 activation worktree 和 Packet 降级为 Asset Pool。
- [x] 定义新的 canonical evidence root 与三事件激活协议。
- [x] 定义后续 TDD、证据、审查和 exact-H 门。
- [x] 完成本 Packet 的治理验证。
- [ ] 完成本 Packet 的独立只读审查。
- [ ] 冻结本 Packet candidate H/tree。
- [ ] 请求本 Packet 受控整合审批。

## 后续 Event 1：Quiescent Evidence Candidate

- [ ] 取得 authority/profile TDD 实施授权。
- [ ] RED：新增测试拒绝旧 W07 evidence root 和跨 Packet 证据混用。
- [ ] GREEN：将 W07 profile 收敛到本 Change ID。
- [ ] 运行 authority、amendment、doctor 全套回归。
- [ ] 生成 deterministic review package 和 activation intent。
- [ ] 冻结 exact H/tree/package digest，保持 W07 STOP。

## 后续 Event 2：Approval And Review

- [ ] 请求 Product Owner exact-H approval。
- [ ] 记录 owner approval 原始字节与 SHA-256。
- [ ] 运行 fresh、read-only Codex Independent QA。
- [ ] 要求 `GO / HIGH 0 / MEDIUM 0`。
- [ ] 冻结包含全部证据的 registration parent。

## 后续 Event 3：Atomic Activation

- [ ] 取得 atomic activation candidate 明确授权。
- [ ] 只修改已审查的 manifest 状态转换。
- [ ] 证明 activation commit 恰好一个父提交。
- [ ] 在 exact candidate 上运行完整 verification。
- [ ] 独立审查并请求本地 EXT 集成批准。

## 停止条件

authority conflict、production ambiguity、scope conflict、file ownership
conflict、candidate drift 或 concurrent writer 任一出现时立即 `BLOCKED`。
