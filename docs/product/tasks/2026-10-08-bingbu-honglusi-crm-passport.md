# 任务：鸿胪寺 CRM 能力护照与兵部只读准入

## Status

Implemented

## Boundary

鸿胪寺负责判断 CRM 是否可以接入并签发能力护照；兵部只负责接入后的销售经营和本地事实同步。兵部不得保存外部凭据，也不得绕过鸿胪寺直接授权 CRM。

## Product Definition

本任务把 CRM 的外部接入审批固化为能力护照。鸿胪寺签发准入事实，兵部在本地只读同步中消费该事实。

## Acceptance Criteria

- [x] 能力护照明确 `honglusi` 来源、`approved_read_only` 准入、只读动作、审计要求和证据引用。
- [x] 兵部只接受已登记且护照完全匹配的 provider；缺失、未知或伪造护照在读取前失败关闭。
- [x] CRM adapter 只接受注入式 transport；护照、兵部模型和 API 不包含 token、secret、password 或 API key 字段。
- [x] 鸿胪寺提供只读护照查询 API；未知 provider 返回脱敏 404。
- [x] 不增加 CRM 写入、真实网络、凭据读取、前端路由或模型调用。

## Allowed Paths

详见 `.harness/approvals/BINGBU-HONGLUSI-CRM-PASSPORT-20261008.json`。实现集中在 CapabilityRegistry projection、兵部 adapter/service、只读 capabilities API 和离线测试。

## Delivery Constraints

只允许改动审批清单中的后端模块与测试；不读取 dotenv，不新增 SDK、队列、外部网络、CRM 写入或前端路由。

## Affected Modules

- 模块：CapabilityRegistry 签发并查询 CRM 能力护照；兵部 adapter/service 在读取前执行护照匹配和只读边界校验；capabilities API 提供认证后的脱敏护照查询。
- 允许路径：见 `.harness/approvals/BINGBU-HONGLUSI-CRM-PASSPORT-20261008.json` 的 `productPaths`。

## Technical Plan

1. 用严格 Pydantic 契约描述只读准入、证据、审计和凭据边界。
2. 由鸿胪寺 projection 提供 provider passport 副本，兵部不保存外部凭据。
3. 在 adapter 与 service 两层 fail closed，并用离线 fake transport 覆盖缺失/伪造护照。
4. 运行 focused 回归、Ruff、Harness 和 diff 检查。

## Implementation Report

- 新增 `CrmProviderPassport` 严格契约及 `get_crm_provider_passport`，当前为 Twenty 只读能力的鸿胪寺签发记录。
- Twenty adapter 和 BingbuService 在任何 CRM 读取前校验护照；连接仍由外部注入 transport 提供，兵部不接触凭据。
- 新增 `GET /api/v1/capabilities/crm-providers/{provider}`，只返回能力边界与证据引用。
- 新增未知/缺失护照、API 脱敏和无密钥字段测试。

## Verification

- focused CRM、兵部同步和 capabilities API 测试。
- 新增护照契约测试。
- Ruff、diff check、Harness check。
- 未访问真实 CRM、真实模型、公网或 dotenv。

## Acceptance Review

- 验收结果：Accepted for offline candidate。
- 验收证据：27 个兵部/能力 API 回归测试、Ruff、diff check、Harness 159 基线通过。
- 后续边界：真实 CRM 权限和 schema 仍需鸿胪寺单独完成连接审查后再接入，不由兵部放行。
