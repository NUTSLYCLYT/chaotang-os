# CI 摘要：feat-r0-w05-evidence-rework-implementation-20260723-20260723

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pytest ...::test_request_evidence_invalidates_old_memorial_before_later_adopt`（实现前） | 1 | RED：旧奏折仍被成功 adopt | 真实行为缺口 | 本地 / 2026-07-23 |
| 新增测试 + reject 回归 + 双入口一致性 | 0 | 3 passed | 最小 GREEN 与相邻语义 | 本地 / 2026-07-23 |
| missing hash 测试（实现前） | 1 | RED：无 hash 补证仍成功 | 精确版本必填门 | 本地 / 2026-07-23 |
| stale hash 测试（匹配校验前） | 1 | RED：伪造 hash 补证仍成功 | 乐观并发/stale object 门 | 本地 / 2026-07-23 |
| slice 1–2 聚焦回归 | 0 | 5 passed | 正确/missing/stale hash、reject、双入口 | 本地 / 2026-07-23 |
| `pytest test_final_memorial_gate.py test_shangshufang_loop_api.py` | 0 | 31 passed / 1 skipped | 正式奏折与公共 loop API 回归 | 本地 / 2026-07-23 |
| root/backend harness doctor | 0 | 均 0 errors / 0 warnings | 三层边界与后端 harness | 本地 / 2026-07-23 |
| self-asserted source promotion（validator 前） | 1 | 3 failed：均 DID NOT RAISE | 非空内容不得自升可信 | 本地 / 2026-07-24 |
| uploaded object without receipt（receipt 门前） | 1 | DID NOT RAISE | GROUNDED 必须有验证收据 | 本地 / 2026-07-24 |
| `pytest tests/test_evidence_packet_v1.py` | 0 | 5 passed | EvidencePacketV1 晋升门正反例 | 本地 / 2026-07-24 |
| W02/W05 contracts + final/loop API 回归 | 0 | 55 passed / 1 skipped | 契约兼容与 canonical 行为 | 本地 / 2026-07-24 |

## 结果

纵切 1–3A 已完成 RED→GREEN：补证关闭旧奏折裁决资格、绑定精确 current content hash，并建立
EvidencePacketV1 的最小可信晋升门。

## 未验证项

- EvidencePacketV1、generation、重审、append-only 新奏折版本、精确 hash 裁决。
- 全量 W05 回归、独立代码审查、推送/合并/发布。

## Diff 与回滚复核

- changed files：2 个产品/测试文件 + 本 change record。
- diff review：待 W05 完整实现后独立双轴审查。
- 回滚是否演练：无 migration；单一逻辑分支可直接 revert。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 先 RED | 失败为 `assert True is False`，证明旧稿仍可 adopt | PASS |
| 最小 GREEN | 3 passed | PASS |
| missing/stale hash fail closed | 两次行为 RED 与 5 passed | PASS |
| 自述来源/无收据不得 GROUNDED | 4 个行为 RED 与 5 passed | PASS |
| W05 全包完成 | 后续纵切 | PENDING |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL / SLICE_3A_GREEN`
