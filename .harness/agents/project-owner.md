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
