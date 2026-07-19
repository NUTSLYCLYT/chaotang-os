# CANON-IDEMPOTENCY-01 历史规格快照（非当前产品分数）

日期：2026-07-19

## 结论

下述 **26/100** 是原本地 reviewed worktree 的历史估算，不是当前远端产品分数。它曾把
第 9 份原子规格计入 canonical 清晰度，并冻结至少 12 套局部机制与未来 authority 的
边界；最新远端已退役该 CANON 计划，因此 P21 不把这 1 分写回现行产品 KPI。

P21 只保留本表作为历史推理证据。当前中央状态必须由未来重新批准的现行 SSOT 重新
测量，禁止引用本表宣称“9/16”或“26/100”已经落地。

## 可复算分数

| 维度 | 当前 | 本次变化 | 未得分主因 |
| --- | ---: | ---: | --- |
| 计划治理 | 10/10 | 0 | 已有原子 Packet、owner、依赖、回滚与 change evidence |
| Canonical 清晰度 | 11/15 | +1 | Idempotency spec ready；其余 7 份 CANON spec 与全部 runtime owner 收敛仍待完成 |
| 安全/许可/隐私 | 5/15 | 0 | 只有 fail-closed contract；0/6 具名真实数据/source/processor 批准 |
| 实现 | 0/25 | 0 | 没有 service/model/migration/adapter/KMS/runtime 接线 |
| 验证 | 0/20 | 0 | focused facts regression/文档 review 不等于 CANON runtime、逐能力 evaluator/shadow/L1-L3 |
| Cutover | 0/15 | 0 | selector/canary/回切与 6/6 cutover 均不存在 |
| **总计** | **26/100** | **+1** | 目标仍是 100/100 |

## 硬指标

| 指标 | 当前值 |
| --- | ---: |
| 六项 semantic mapping | 6/6 |
| CANON readiness 原子规格 | 历史草案 9/16；当前产品未计入 |
| CANON inventory-only verified | 1/16（COURT-01A） |
| CANON runtime implemented | 0/16 |
| 真实数据批准 | 0/6 |
| durable candidate runtime | 0/6 |
| L3 正式链 | 0/6 |
| cutover | 0/6 |

## 我们在做什么、执行得怎样

我们正在为“能力并购的唯一正式主链”补可信事务底座。不是把所有 `idempotency_key` 改成同一个名字，而是先把 cache、identity unique、mutable dedup、worker claim、request replay 五类语义拆开，再规定唯一 authority 如何绑定 tenant/scope/payload、如何与目标写共享事务、以及哪里必须交给 receipt/provider token。

执行质量在治理正确性上保持 **A-**，产品交付仍为 **D**。优点是识别并写明 routing 假幂等、launch-loop/Court 单机局限、outbox external exactly-once 缺口和 keyed digest/rotation 风险；缺口是本轮按批准边界完全没有触碰 runtime，因此它只减少未来错误实现概率，不直接产生用户可见能力。

到 100/100 仍需：补完其余 7 份 CANON 规格；实现并验证全部 16 个 CANON 节点；完成 6 个领域 contract/evaluator/adapter；取得 6/6 数据授权；提供 6/6 同 tenant/task/trace 的 L3；完成 6/6 selector/canary/rollback/cutover。文档、mock、旧测试或 count-only inventory 都不能抵扣这些分数。
