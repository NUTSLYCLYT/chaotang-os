# CI 摘要：feat-r0-w05-evidence-rework-implementation-20260723-20260723

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `pytest ...::test_request_evidence_invalidates_old_memorial_before_later_adopt`（实现前） | 1 | RED：旧奏折仍被成功 adopt | 真实行为缺口 | 本地 / 2026-07-23 |
| 新增测试 + reject 回归 + 双入口一致性 | 0 | 3 passed | 最小 GREEN 与相邻语义 | 本地 / 2026-07-23 |

## 结果

纵切 1 已完成 RED→GREEN；只关闭旧奏折裁决资格。

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
| W05 全包完成 | 后续纵切 | PENDING |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL / SLICE_1_GREEN`
