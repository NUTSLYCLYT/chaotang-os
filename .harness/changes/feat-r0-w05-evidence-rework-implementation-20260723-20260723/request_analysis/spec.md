# 规格说明：feat-r0-w05-evidence-rework-implementation-20260723-20260723

## 背景

W05 获得 exact Owner approval、专属 review evidence 和机器 GO。当前
`request_evidence/followup` 只把 task/review 设为 `awaiting_evidence`，却让旧
`FinalMemorial.status=ready_for_decision` 保持可裁决，用户随后仍能 adopt 旧内容。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | W05 authority 为 GO | authority CLI / 2026-07-23 | 机器验证 | 否 |
| 已确认事实 | 补证后旧奏折仍可 adopt | 新公共 API RED | pytest | 否 |
| 推测 | 无 | 不适用 | 不适用 | 否 |
| 未知问题 | 新 generation 与新奏折版本尚未实现 | 后续纵切 | TDD | 是，但不阻塞本纵切 |

## 数据流与调用链

`POST decision(request_evidence)` → task/review awaiting evidence → current old FinalMemorial
失去 `ready_for_decision` → 后续 `POST decision(adopt)` fail closed。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 裁决状态转移 | `apply_task_decision` | 两个公共裁决入口 | 共享函数保证语义一致 |
| 正式奏折裁决资格 | `FinalMemorial.status` | adopt gate | 只有 `ready_for_decision` 可裁决 |

## 范围

已实现：

- 补证动作立即关闭旧正式奏折的裁决资格；
- 当前存在正式奏折时，补证必须携带 `expected_final_memorial_content_hash`；
- 请求 hash 与 current 不一致时，在任何裁决/状态写入前 fail closed。
- `EvidencePacketV1` 绑定 tenant/task/input version/digest、prior memorial hash、generation、source/content hash。
- `MANUAL_TEXT`、`URL`、`MODEL_ASSERTION` 不得自升 `GROUNDED`；任何 `GROUNDED` 必须绑定 verification receipt。

## 非目标

不实现 EvidencePacket 持久化、ContractRiskItem/ContractReviewPack、新 generation、重算、migration、
新奏折版本或前端。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 当前奏折存在且 ready，hash 匹配 | 补证后转为 awaiting evidence，不可 adopt | 新 RED/GREEN |
| 当前奏折存在，hash 缺失 | fail closed，不写裁决或状态 | slice 2 RED/GREEN |
| 当前奏折存在，hash stale/伪造 | fail closed，task/formal 状态不变 | slice 2 RED/GREEN |
| 非空手工文本、URL、模型自述声称 GROUNDED | ValidationError | slice 3A RED/GREEN |
| 用户上传无 verification receipt 声称 GROUNDED | ValidationError | slice 3A RED/GREEN |
| VERIFIED_TOOL 有 receipt | 接受 GROUNDED packet | slice 3A GREEN |
| 没有正式奏折 | 保持既有 task/review awaiting evidence 行为 | 既有参数化回归 |
| 已拒绝/归档奏折 | 补证不把它重新打开 | 只转换 ready 状态 |

## 风险与回滚边界

风险是误把其他终态重新打开；实现只匹配 `ready_for_decision`。回滚为撤销单一状态更新和测试，
不会迁移数据。

## 计划确认记录

- 批准人：Product Owner（lyt）
- 批准日期：2026-07-23
- 批准范围：R0-W05 获批后端 Packet
- 明确未批准：W06–W09、前端、真实数据、LangGraph、推送/合并/发布/生产

## 验收标准

公共 API 测试先因旧奏折仍可 adopt 而 RED；最小实现后该测试与既有 reject、双入口一致性测试全绿。

## 验证计划

运行单一新增测试记录 RED，再运行新增测试 + 两个相邻回归记录 GREEN。
