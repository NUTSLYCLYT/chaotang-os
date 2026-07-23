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
| high risk anchor 参数化测试（validator 前） | 1 | 3 failed：均 DID NOT RAISE | critical/high 原文锚点门 | 本地 / 2026-07-24 |
| medium risk 缺锚点且无 missing evidence（实现前） | 1 | DID NOT RAISE | 较低风险缺证诚实门 | 本地 / 2026-07-24 |
| `python3 -m pytest -q backend/tests/test_contract_risk_item_v1.py backend/tests/test_evidence_packet_v1.py` | 0 | 10 passed | 两个 W05 v1 契约聚焦回归 | 本地 / 2026-07-24 |
| W02/W05 contracts + final/loop API 扩大回归 | 0 | 57 passed / 1 skipped | 契约兼容与 canonical 行为 | 本地 / 2026-07-24 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 三层边界及委派后端 harness | 本地 / 2026-07-24 |
| critical risk + PROCEED（validator 前） | 1 | DID NOT RAISE | 安全关键放行门 | 本地 / 2026-07-24 |
| unsupported jurisdiction + 普通裁决（validator 前） | 1 | DID NOT RAISE | 超范围法务升级门 | 本地 / 2026-07-24 |
| 其余 3 个超范围维度（通用 scope 门前） | 1 | 3 failed：均 DID NOT RAISE | 语言/合同类型/交易角色升级门 | 本地 / 2026-07-24 |
| pack 外 evidence 引用（绑定门前） | 1 | DID NOT RAISE | review pack 证据归属门 | 本地 / 2026-07-24 |
| 三个 W05 v1 contract 聚焦回归 | 0 | 18 passed | 契约正反例 | 本地 / 2026-07-24 |
| W02/W05 contracts + final/loop API 扩大回归 | 0 | 86 passed / 1 skipped | 契约兼容与 canonical 行为 | 本地 / 2026-07-24 |
| repeated evidence request（generation 实现前） | 1 | 重试触发 CourtLoopRun UNIQUE conflict | 补证 generation 幂等缺口 | 本地 / 2026-07-24 |
| repeated evidence request（最小实现后） | 0 | 1 passed | 同一请求复用 generation 2 | 本地 / 2026-07-24 |
| Alembic 019（migration 实现前） | 1 | head 仍为 018、缺 generation identity | 真实 SQLite migration RED | 本地 / 2026-07-24 |
| Alembic 018/019 相邻回归 | 0 | 4 passed | 旧行保留、唯一性、018/019 downgrade | 本地 / 2026-07-24 |
| final/loop/execution/outbox 扩大回归（兼容修复前） | 1 | 3 failed | 无 prior memorial 的补证兼容缺口 | 本地 / 2026-07-24 |
| final/loop/execution/outbox 扩大回归（修复后） | 0 | 51 passed / 1 skipped | canonical 状态、worker、fencing、poller | 本地 / 2026-07-24 |
| `ruff check`（Slice 4A 目标文件） | 0 | All checks passed | Python 静态规范 | 本地 / 2026-07-24 |
| accepted artifact bind（endpoint 实现前） | 1 | HTTP 404 | W03→W05 证据绑定缺口 | 本地 / 2026-07-24 |
| accepted artifact bind（最小实现后） | 0 | 1 passed | EvidencePacket exact identity | 本地 / 2026-07-24 |
| same artifact bind retry（幂等实现前） | 1 | generation 不再等待证据 | packet 绑定重试缺口 | 本地 / 2026-07-24 |
| same artifact bind retry（最小实现后） | 0 | 1 passed | 同一 packet/无副本 | 本地 / 2026-07-24 |
| W03/W05 secure-ingest + final/loop 扩大回归 | 0 | 77 passed / 1 skipped | 摄取安全、证据契约、公共 API | 本地 / 2026-07-24 |
| Slice 4B Ruff + backend/root doctors | 0 | lint pass；doctor 0/0 | 静态规范与三层边界 | 本地 / 2026-07-24 |
| generation request/affected section（payload 修复前） | 1 | KeyError evidence_request | worker 输入事实缺口 | 本地 / 2026-07-24 |
| evidence.rework worker（实现前） | 1 | 未知 event_type | generation 消费缺口 | 本地 / 2026-07-24 |
| stale generation fencing（superseded 状态前） | 1 | 旧代被记为 completed | 迟到旧代审计语义 | 本地 / 2026-07-24 |
| bind → outbox pending（worker 接通前） | 1 | 仍为 evidence_bound | 真实 poller 接管缺口 | 本地 / 2026-07-24 |
| honest locator/risk（修复前） | 1 | 伪 page_number=总页数、risk=high | 候选事实诚实性 | 本地 / 2026-07-24 |
| Slice 4C 聚焦 worker/fencing | 0 | 2 passed | 局部重算与旧代围栏 | 本地 / 2026-07-24 |
| W05 contracts + final/loop/outbox 扩大回归 | 0 | 72 passed / 1 skipped | worker、poller、状态投影、候选契约 | 本地 / 2026-07-24 |
| canonical re-review（修复前） | 1 | task/review 错误停在 reviewing | 质量门状态闭环 | 本地 / 2026-07-24 |
| canonical re-review 聚焦回归 | 0 | 2 passed | fail-closed quality/provenance 重审与 generation fencing | 本地 / 2026-07-24 |

## 结果

纵切 1–4C 已完成 RED→GREEN：补证关闭旧奏折裁决资格、绑定精确 current content hash，
建立三个 W05 v1 契约门，让 accepted evidence 经 canonical outbox generation 局部重算现有
CourtReview，并以 superseded 状态围栏旧 generation。

## 未验证项

- canonical 质量/来源门重审、append-only 新奏折版本、精确 hash 裁决。
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
| 风险结论锚定原文或明确声明缺证 | 4 个行为 RED 与 5 passed | PASS |
| candidate 不绕过 critical/范围/evidence 门 | 6 个行为 RED 与 8 passed | PASS |
| 补证 generation 幂等且 migration 保留旧事实 | API/migration RED 与扩大回归 | PASS |
| W03 accepted artifact 形成可信 generation-bound packet | bind/retry RED 与 77 passed / 1 skipped | PASS |
| current generation 局部重算且 old generation fenced | worker/fencing RED 与 72 passed / 1 skipped | PASS |
| W05 全包完成 | 后续纵切 | PENDING |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_PARTIAL / SLICE_4D_GREEN`
