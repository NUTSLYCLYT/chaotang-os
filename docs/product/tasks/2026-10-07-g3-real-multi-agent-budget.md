# G3 真实多 Agent 预算与路由收口（2026-10-07）

## Status

Implemented

## Goal

在单次真实任务不超过 20,000 token 的硬上限内，跑通“上书房→户部＋工部→军机处→丞相→史馆”的真实 DeepSeek 多部门流程，并保留失败闭环。

## Product Definition

- 用户价值：多部门任务能在预算内得到真实的部门意见、军机处会审和丞相回奏。
- 非目标：本任务不开放公网调查、不改变外部发布、不授予部门新增权限。

## Scope

- 任务账本存在时，DeepSeek 请求根据剩余额度动态收紧 `max_tokens`；没有任务账本时保持原 2,500 输出上限。
- 真实执行的已批准部门路由直接传入军机处下游，避免重复调用模型重新选择司级路由。
- 不改变 DataGapDraft 的最多 5 个事实约束，不放宽证据、权限或取消规则。

## Affected Modules

- 模块：DeepSeek 任务预算适配、军机处已批准路由转发、Harness 指纹。
- 允许路径：`backend/app/langgraph_runtime/deepseek_client.py`、`backend/app/agents/chancellor/graph.py`、`backend/app/agents/junjichu/agent.py`、相关测试、`scripts/check_harness.mjs` 和本任务文件。
- `backend/app/langgraph_runtime/deepseek_client.py`
- `backend/app/agents/chancellor/graph.py`
- `backend/app/agents/junjichu/agent.py`
- 对应预算、Graph、军机处和 Harness 测试/指纹。

## Delivery Constraints

- 保持 20,000 token 硬上限和 provider 失败闭环。
- 真实模型调用必须由用户授权的本地凭据发起；证据不得伪造。
- 失败时不写入客户产品数据库，不把临时探针当作客户试用完成。

## Technical Plan

1. 任务账本存在时，在预留前按保守输入界限计算本轮可用输出额度。
2. 已批准的真实路由在军机处转发给部门执行器，跳过重复的司级路由模型轮次。
3. 用离线契约测试、Harness 和一次真实规范性多部门探针验证。
4. 让图层只写一次规范化的军机处会审检查点；兼容编排层继续保存军机处报告，但不重复写入较短路径。

## Acceptance

- `node scripts/check_harness.mjs` 通过。
- `node scripts/check_harness.mjs --self-test` 通过（175 项）。
- `backend/tests/test_deepseek_task_token_budget.py`、`backend/tests/test_deepseek_client.py`、`backend/tests/test_chancellor_graph.py`、`backend/tests/test_junjichu_runtime_skill.py` 通过（120 tests）。
- 真实 DeepSeek 多部门探针成功：`C:\Users\Administrator\Desktop\Chaotang-G3-Real-Multi-Agent-Evidence-20261007.json`，SHA256 `8988A6B2966FCA35EDC8E788C44E62B0FC80ABF354AF9CF85ABFF6966A8C3CB2`。
- 探针路径包含上书房、丞相、军机处、户部·预算司、工部·技术司、军机处会审和丞相最终汇总；实际计费 10,976 / 20,000 token，7 次 provider 调用。
- 真实 DecreeJob worker 通过：任务 `SUCCEEDED`，8 次 provider attempt，预算 11,709 / 20,000；军机处 1 个案卷为 `ARCHIVED`，史馆写入 1 条与 `reply_id` 同源的 `REPLY`。本次使用临时 SQLite，未写入产品运行库。

## Acceptance Criteria

- [x] 真实多部门流程在 20,000 token 内返回两部意见、会审结论和丞相最终回奏。
- [x] 预算适配在剩余额度不足时仍 fail-closed，不发送无额度请求。
- [x] 已批准路由不被真实执行中的重复模型路由覆盖。
- [x] 持久化 worker 能完成执行、结果检查点、军机处归档和史馆回奏归档。
- [x] 同一 `COUNCIL_REVIEWING` 状态不会因兼容层重复回写而产生路径冲突。
- [x] Harness 指纹与运行时实现精确匹配。

## Limits

- 本轮使用规范性内部任务和零公网调查，锦衣卫公网证据能力仍未宣称开放。
- 持久化验收使用隔离临时 SQLite；客户试用前仍需配置自己的 DeepSeek 凭据、明确网络策略并按本地启动说明运行。

## Implementation Report

- 动态输出上限、真实路由转发和会审检查点幂等已落地；既有 2,500 上限在无任务预算的离线调用中保持不变。
- 本轮 focused pytest 共 304 项通过；针对会审、持久化 worker、异步整合和六部治理的回归 163 项通过；Harness 基线 159 文件、自测 175 项通过。

## Acceptance Review

- 翰林院验收范围：预算账本、路由不可变性、真实 Graph 路径、会审检查点幂等和失败闭环。
- 史馆留存：真实探针 JSON 与 SHA256；持久化 worker 的隔离 SQLite 结果包含任务、案卷和回奏同源 ID。

## Rollback

回退本任务对应提交即可恢复固定 2,500 输出预留和原军机处路由调用；不涉及数据迁移。
