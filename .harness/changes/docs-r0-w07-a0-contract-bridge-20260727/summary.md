# 变更摘要：docs-r0-w07-a0-contract-bridge-20260727

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
>
> 本目录只记录需求、边界和计划；产品实施必须绑定后续获批 amendment、
> exact-HEAD authority 和独立 implementation Packet。

| 字段 | 值 |
| --- | --- |
| Change ID | docs-r0-w07-a0-contract-bridge-20260727 |
| 类型 | `docs` |
| 状态 | `DESIGN_CANDIDATE / NON_AUTHORIZING / PRODUCT_CODE_UNCHANGED` |
| Owner | EXT Master Governance / Product Owner `lyt` |
| 创建日期 | `2026-07-27` |
| 基线 | `feature-chaotang-ext@b8f7b27b87a68b159e6db1b0a39a205c13126721` |
| 基线 tree | `156ad59c927d9e8f47a6ab8a97642da69b97e362` |
| 机器 authority | `R0-W07 = GO / APPROVED_WORK_PACKAGE` |

## 产品裁决

W07-A0 是 `R0-W07` 内的前置合同桥接，不是第二 work package。执行策略固定为：

1. `RUNNABLE_MINIMUM`：只用现有持久表、现有后端能力和现有
   `/shangshufang`、`/shiguan`，先跑通一条合成合同真实后端闭环。
2. `PRE_W08_HARDENING`：在 W08 激活前补齐专用 mission revision 持久化、
   数据库唯一性/并发、PARTIAL 刷新恢复、事务快照和异常路径。

第一阶段通过只证明工作可全面展开，不等于 W07 完成，更不等于 W08、W09 或生产就绪。

```text
W07-A0 Checkpoint A: RUNNABLE_MINIMUM
  -> W07-A0 Checkpoint B: PRE_W08_HARDENING
    -> W07 exact-H closeout
      -> W08 36 goldens + 10/10 real backend + 5-user acceptance
        -> W09 immutable release identity + final candidate
```

## 当前范围

- 输出 W07-A0 authority scope amendment proposal。
- 输出两阶段设计规格。
- 输出逐任务 TDD 实施计划、文件 ownership、验证和停止条件。
- 保持 EXT、authority manifest、backend、frontend 和数据库不变。

## 已确认的阻塞事实

1. `MissionContractV1` 路由仍使用进程内字典，重启后不是事实源。
2. W05 rework 使用 `DecisionTask.id` 作为 `mission_contract_id`，但没有显式兼容合同。
3. task status 没有 server-owned `allowed_actions`、manifest 或 archive receipt 聚合。
4. Shiguan exact detail 仍是诚实的 `FALLBACK` 兼容空态。
5. PARTIAL raw resume token 只在 create/resume response 中返回，刷新后不能恢复。

## 本 Packet 不做

- 不修改 v1/v2 authority、activation evidence 或 ledger。
- 不修改 backend/frontend product code，不创建或执行 migration。
- 不新增页面、Agent、BFF、任务状态机、完成状态或裁决系统。
- 不实现 W08 数据集/scorer/验收证据，不实现 W09 release identity。
- 不 push、不部署、不操作 listener 3050，不使用真实客户数据。

## 完成定义

本 Packet 的完成条件只是：scope、设计、TDD 计划和验证证据完整，并形成一个
non-authorizing candidate H/tree。后续产品施工仍需 Product Owner 对精确 scope
明确批准，并从届时最新 EXT 创建新的 isolated implementation worktree。
