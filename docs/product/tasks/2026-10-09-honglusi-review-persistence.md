# 任务：鸿胪寺 CRM 审查记录持久化

## Status

Implemented

## Product Definition

把 CRM provider 审查从代码内 fixture 迁移到本地 SQLite 审查表。护照由持久化审查记录按有效期签发；兵部只消费签发结果，不读取审查存储和外部凭据。

## Acceptance Criteria

- [x] 审查记录持久化 provider、状态、证据、审查人、有效期和只读边界。
- [x] Twenty 首次初始化时仅写入无凭据的离线审查记录。
- [x] 撤销记录后护照查询立即 fail closed。
- [x] 兵部既有 adapter/service 契约不变。
- [x] SQLite 测试使用临时数据库，不污染生产数据。

## Delivery Constraints

不保存 API key、token、secret 或密码；不访问真实 CRM；不引入 SDK、迁移服务或外部队列。

## Affected Modules

- 模块：CapabilityRegistry review storage、passport projection、兵部护照回归测试。
- 允许路径：见 `.harness/approvals/HONGLUSI-CRM-REVIEW-PERSISTENCE-20261009.json` 的 `productPaths`。

## Technical Plan

1. 建立最小 SQLite provider review 表。
2. 保留离线 Twenty 审查记录作为首次初始化数据。
3. 从存储记录按 fake clock 签发或拒绝临时护照。
4. 覆盖持久化、撤销、过期和无凭据检查。

## Implementation Report

- 新增 `review_storage.py`，支持查询、upsert 和撤销审查记录。
- CapabilityRegistry 已改为从审查记录生成护照。
- 当前默认 seed 仅为离线预审数据，后续可替换为鸿胪寺管理界面和正式迁移。

## Acceptance Review

- 验收结果：Accepted for offline candidate。
- 保留风险：正式多租户审查权限、数据库迁移和真实 CRM 连接仍需单独任务。
