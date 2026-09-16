# Project Owner

当前唯一真实 authority 是仓库 Owner。Codex 是实施者，确定性脚本是验证器；二者都不是第二或
第三 authority，也不能把聊天、文档或测试结果解释为产品 GO。

## Ownership

- 根层拥有项目入口、三层边界、观察 manifest 和 Harness 验证。
- `frontend/` 拥有浏览器体验、BFF 与前端契约。
- `backend/` 拥有运行、评测、证据、归档和后端 API。
- ADR 0028 是下旨、证据与史馆回奏业务流的唯一基线。

## Current State

- Root：`READY_FOR_OBSERVE`。
- Frontend Harness：`ABSENT`。
- Backend Harness：`PARTIAL`。
- Product authority：`STOP / canExecuteProductWork=false`。
- M0 consumer：`CONSUMER_AVAILABLE`；无 task 参数的默认决定：`STOP`。

`node scripts/harness-doctor.mjs --check` 只证明结构一致；`--status` 只报告观察态；`--ready`
固定返回 `NOT_READY`。M0 consumer 只机械核验先落地的 approval commit 和其单亲子候选；Owner
仍须分别确认 manifest digest、candidate SHA/tree 与 Git 外部动作。Deferred G2 不是产品前置；
G2 与产品任务如被选择，仍各自使用独立 exact task。

## Credential-separated receipt-gated v2 approvals

- `product-authority.m0.v1` 仍是唯一产品机器权威；`product-authority.m0.approval.v2` 只是向同一入口增加
  显式、closed、按任务选择的 `preAuthorizationReceipt` 合同，不创建第二 authority、第二 Harness 或授权账本。
- 未声明该字段的历史 v1 approval 保持原字节、canonical digest、命令与判定语义；v1 不得携带 v2 字段。
- v2 的 `--authorize` 只能把 approval commit 及其直接 base 的 exact object closure 发送给 root-owned、
  `SO_PEERCRED` 认证的 credential-separated broker；同 UID inline helper 与 fallback 均被禁止。
- broker 在独立 worker UID、PID/network namespace 和 per-connection systemd cgroup 中完成 sealed
  controller/verifier、read-only approval-source FD、18-case path-binding 与 nonce/TTL 检查。唯一 authority
  复核 closed inner/outer receipt、live peer、service invocation 与退出后空 cgroup 后才能构造 GO。
- 仓库中的 broker 仅是 reference source。当前 exact bytes、runtime profile、installation manifest 和 unit 未经
  独立管理员安装及 installed acceptance 时，v2 必须 fail closed；不得把 source tests 写成主机已可用。
- Owner 仍是唯一决策者。receipt、evidence digest、测试或 reviewer 结论都不能代替 Owner 对 approval digest、
  candidate identity 和外部 Git 动作的确认，也不宣称抵御已控制的 Owner、OS、Gitee 或整个 runner。
