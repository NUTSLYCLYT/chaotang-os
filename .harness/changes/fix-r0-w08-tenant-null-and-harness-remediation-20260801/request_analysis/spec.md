# 规格说明：fix-r0-w08-tenant-null-and-harness-remediation-20260801

## 背景

EXT exact-H 的回归发现确定性合同入口在 `CurrentUser.tenant_id` 与 `DecisionTask.tenant_id` 均为空时可能继续确认，违反 fail-closed 租户归属；同时发现若干测试夹具、writer 基线、前端 runner/validator/guard 与现行 canonical schema 漂移。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | tenantless 合同确认存在可达路径；前端 canonical schema 与 validator/YAML 不一致 | 完整回归初始结果 | Codex + 独立只读审查 | 是 |
| 推测 | 旧测试夹具缺 tenant 是失败主因 | focused pytest | 后端 owner | 否 |
| 未知问题 | W08 非开发用户验收尚无记录 | W08 preflight | 人工验收 | 是 |

## 数据流与调用链

上传/拟旨 -> `DecisionTask` -> 合同确认 -> `CourtReview`/`FinalMemorial`。合同路径必须在写入前同时具备请求者和任务租户；前端只消费 canonical DepartmentOpinionV1。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| DecisionTask tenant ownership | 后端 `shangshufang.py` + canonical access | 合同确认与后续 review | tenantless fail-closed focused tests |
| DepartmentOpinionV1 | `frontend/dev/contracts/schemas/DepartmentOpinionV1.json` | validator/YAML/registry | validator + node tests |

## 范围

见摘要中的允许文件集合；仅修复行为门禁、测试事实源与护栏契约。

## 非目标

部署、迁移、3050、push、新页面、新 Agent、新状态机、生产声明均不在范围内。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 合同用户或任务 tenant 为空 | 拒绝且不落库/不推进状态 | `test_shangshufang_loop_api.py` |
| 正常 tenant 合同 | 保持现有 ContractReviewPack 路径 | W08 focused + full pytest |

## 风险与回滚边界

回滚为恢复本候选前的 exact-H；不触碰持久数据库 schema 或运行中服务。测试/基线变更不得通过放宽授权换绿。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-08-01
- 批准范围：tenant-null 安全修复 + 测试/harness 漂移修复
- 明确未批准：EXT 整合、push、部署、迁移、3050

## 验收标准

正常租户合同流程不回归；tenantless 合同 fail-closed；后端全量回归、前端 node/core、build、doctor 均通过；W08 preflight 仅保留真实用户验收阻塞。

## 验证计划

先 RED/GREEN focused tests，再运行后端全量、前端两组测试、build、harness doctor、W08 preflight，最后独立只读 review 与 diff 范围检查。
