# 变更摘要：refactor-dept-id-ssot-20260714

| 字段 | 值 |
| --- | --- |
| Change ID | refactor-dept-id-ssot-20260714 |
| 类型 | refactor |
| 状态 | READY_FOR_REVIEW |
| Owner | Project Agent |
| 创建日期 | 2026-07-14 |
| PREDECESSOR_INTEGRATION_SHA | `f9b3e88668cfa0e891274a0b4b5cc3947c1e36fe` |
| 原 P1 提交 | `c06d66dffc1c9048040c1ec2506ede68b39ed717` |
| 重切 P1 提交 | `8a16e8760f34490ba720eb8a662766cc1ddd340d` |
| EXT merge | `defd157739ab1815eafeccfe420348ab452eae1a` |

## 范围

- 后端 SSOT：`backend/harness/chaotang_department_protocol/departments.yaml`。
- 前端 SSOT：`frontend/src/lib/contracts/dept.ts`。
- 消费者：P1 提交中的 29 个后端、前端实现与测试文件。
- 证据：本目录中的 spec、tasks、CI 摘要和 smoke artifacts。

## 当前结论

P1 已语义等价重切并合入 EXT；change 目录已恢复。后端/前端 SSOT、34 条 golden
routing、三层 doctor、TypeScript、隔离 build、代表主链和当前规范浏览器旅程均通过。
完整 nodetest 仍是 P0 已登记的同一组 7 个失败，P1 新增 6 项全部通过。

历史临时 worktree 中未提交的原始 RED 日志无法恢复，因此不会伪造 TDD 时序；本次
记录以 patch-id 等价证明和重新执行的独立验收为准。浏览器 smoke 的质门前置为隔离
synthetic seed，不冒充真实模型或 EXT 三证认证。详证见 `ci_result/ci_summary.md`。
