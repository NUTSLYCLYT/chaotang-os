# 任务：Twenty CRM 鸿胪寺 provider 预审与护照生命周期

## Status

Implemented

## Product Definition

基于 Twenty 官方 API 与许可证资料，建立 CRM provider 的鸿胪寺预审记录。审查记录批准且未过期时，才签发给兵部的临时只读能力护照；撤销、过期或证据失效时 fail closed。

官方依据：Twenty API 支持按 workspace schema 生成的 REST/GraphQL 接口，并使用 Bearer API key；Twenty 主体主要为 AGPLv3，部分 Enterprise 文件为商业许可，官方 SDK 标注 MIT。正式商用仍需单独法务确认。

## Acceptance Criteria

- [x] 增加 `CrmProviderReview`，包含审查状态、审查人、证据、有效期和凭据边界。
- [x] 只有 `approved` 且处于有效期内的记录才能签发护照。
- [x] `revoked`、`expired`、尚未审查、未来生效或缺少审查证据的记录全部拒绝。
- [x] 兵部现有 adapter/service 准入边界保持不变，不接触 API key，不调用真实网络。
- [x] 用 fake clock 覆盖签发、过期和撤销场景。

## Delivery Constraints

本任务只修改 CapabilityRegistry 合同、投影和离线测试；不引入 Twenty SDK，不复制 Twenty 源码，不保存真实凭据，不访问公网 CRM。

## Affected Modules

- 模块：CapabilityRegistry provider review/passport issuance、兵部准入回归测试。
- 允许路径：见 `.harness/approvals/TWENTY-PROVIDER-PRE-REVIEW-20261009.json` 的 `productPaths`。

## Technical Plan

1. 用严格模型记录鸿胪寺审查结果。
2. 用纯函数按 fake clock 签发临时护照。
3. 让现有 provider lookup 复用同一签发规则。
4. 运行 focused pytest、Ruff、diff check 和 Harness check。

## Implementation Report

- Twenty provider 从静态护照记录升级为有效期审查记录。
- 新增签发函数，拒绝撤销、过期和未完成审查的 provider。
- 当前仍使用代码内离线审查 fixture，下一步可替换为持久化审查存储，不改变兵部契约。

## Acceptance Review

- 验收结果：Accepted for offline candidate。
- 风险保留：AGPL/商业许可边界需要法务确认；真实 workspace schema、API key scope 和网络行为尚未验证。
