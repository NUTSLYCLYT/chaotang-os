# CI 摘要：feat-r0-w05-evidence-rework-implementation-20260723-20260723

> 历史证据更正：本记录描述的是已进入
> `3cb508e06464de78facae09b93c132eb16023f94` 的 pre-merge 实施候选；其中
> `1f1800c7` 与“等待独立复审”不再是当前候选身份。post-merge MUST、当前
> RED/GREEN、验证和 exact review 只以
> `.harness/changes/fix-r0-w05-postmerge-remediation-20260724/` 为准。

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
| FinalMemorial migration（020 实现前） | 1 | head 仍为 019 | 版本谱系 schema 缺口 | 本地 / 2026-07-24 |
| FinalMemorial v2 service（实现前） | 1 | formal_memorial_conflict | append-only service 缺口 | 本地 / 2026-07-24 |
| current memorial API（修复前） | 1 | 返回 v1 id | current 读取缺口 | 本地 / 2026-07-24 |
| FinalMemorial version 聚焦回归 | 0 | 3 passed | migration、service、current API | 本地 / 2026-07-24 |
| FinalMemorial/W05 扩大回归 | 0 | 84 passed / 1 skipped | 正式奏折、归档适配、metrics、019/020 migrations | 本地 / 2026-07-24 |
| stale v1 hash 裁 v2（修复前） | 1 | adopt 成功 | 乐观并发门缺口 | 本地 / 2026-07-24 |
| 裁决缺 current hash（修复前） | 1 | adopt 成功 | 必填身份缺口 | 本地 / 2026-07-24 |
| EmperorDecision hash 审计（修复前） | 1 | KeyError | 持久化绑定缺口 | 本地 / 2026-07-24 |
| brief 兼容入口 hash 门（修复前） | 1 | issue_decree 成功 | 旁路缺口 | 本地 / 2026-07-24 |
| 精确 hash 裁决聚焦回归 | 0 | 5 passed | task/brief 入口、别名和状态一致性 | 本地 / 2026-07-24 |
| W05 产品行为扩大回归 | 0 | 125 passed / 1 skipped | final、worker、poller、契约、状态投影、019/020 migration | 本地 / 2026-07-24 |
| 4G 真实公共补证链（实现前） | 1 | RED：worker quality gate=`FAILED`，没有 v2 | 证明旧测试直调 formalize 掩盖真实链缺口 | 本地 / 2026-07-24 |
| 021 DecisionTask 合同范围 migration（实现前） | 1 | RED：head 仍为 020，缺 `contract_scope_json` | canonical 范围投影 schema | 本地 / 2026-07-24 |
| 冻结合同范围替换（实现前） | 1 | RED：不同 scope 被接受 | 防止补证阶段重写已冻结范围 | 本地 / 2026-07-24 |
| Slice 4G 聚焦回归 + Ruff | 0 | 61 passed / 1 skipped；All checks passed | 公共 API→worker→canonical run/quality→FinalMemorial v2、迁移图和 fail-closed 回归 | 本地 / 2026-07-24 |
| brief 补证 generation parity（实现前） | 1 | RED：重试写入重复 EmperorDecision，且响应无 generation | brief/task 两入口单一补证事实 | 本地 / 2026-07-24 |
| current memorial CAS（实现前） | 1 | RED：缺少数据库条件 claim | 防止 adopt/reject/request_evidence 并发双成功 | 本地 / 2026-07-24 |
| Slice 4H 裁决兼容回归 + Ruff | 0 | 75 passed / 1 skipped；All checks passed | task/brief 共用裁决 writer、generation 幂等、原子 current hash claim、旧别名/取消兼容 | 本地 / 2026-07-24 |
| v2 史馆精确身份（实现前） | 1 | RED：ShiguanArchive 缺 final memorial id/version/hash | 归档不能只存无版本正文 | 本地 / 2026-07-24 |
| 022 archive identity migration（实现前） | 1 | RED：head 仍为 021，缺三列 | 保留旧归档并允许新归档绑定精确版本 | 本地 / 2026-07-24 |
| Slice 4I 归档/迁移回归 + Ruff | 0 | 77 passed / 1 skipped；All checks passed | v2 准奏身份、旧史馆数据、020–022 迁移链、归档读取兼容 | 本地 / 2026-07-24 |
| evidence binding CAS（实现前） | 1 | RED：缺少数据库原子 claim | 两个附件候选可先查后写互相覆盖 | 本地 / 2026-07-24 |
| Slice 4J 绑定/摄取回归 + Ruff | 0 | 73 passed / 1 skipped；All checks passed | 第一 payload 胜出、竞争 payload 失败、同附件幂等、scope/tenant/摄取门 | 本地 / 2026-07-24 |
| 020 version-history downgrade（实现前） | 1 | RED：SQLite 在重建旧 task unique 时才抛 IntegrityError | 拒绝过晚，不能证明 DDL 前数据保持 | 本地 / 2026-07-24 |
| Slice 4K 迁移链 + Ruff | 0 | 15 passed；All checks passed | v2 明确拒降且数据完整、单 v1 可降、019–022/schema authority | 本地 / 2026-07-24 |
| W05 修复后整包回归 | 0 | 165 passed / 1 skipped | 契约、真实补证链、裁决、归档、secure-ingest、019–022、状态/取消 | 本地 / 2026-07-24 |
| exact base→candidate Python Ruff | 0 | All checks passed | W05 全部 Python 变更；019 import order 机械收口 | 本地 / 2026-07-24 |
| backend/root harness doctors | 0 | 均 0 errors / 0 warnings | 后端运行护栏与根级三层边界 | 本地 / 2026-07-24 |
| authority v2 tests + W05 authorize | 0 | 27 passed；`GO / APPROVED_WORK_PACKAGE` | manifest 结构、审批摘要与单包执行权 | 本地 / 2026-07-24 |
| 独立双轴 + gstack 预审 | 0 | 发现 generation race、能力门、绑定授权/原子性、降级链、精确 API 身份和契约类型化问题 | fixed base→`79547ea7` 的修复输入 | 本地 / 2026-07-24 |
| Slice 4G.1 generation fence | 0 | 聚焦回归通过 | allocation/publish 共用 task lock，发布前重检 generation | 本地 / 2026-07-24 |
| Slice 4G.2 capability gate | 0 | 聚焦回归通过 | 生产默认关闭；request/enqueue/bind/worker/publish 五处 fail closed | 本地 / 2026-07-24 |
| Slice 4H.1 linearizable replay | 0 | 聚焦回归通过 | task lock、CAS winner reload、durable failed/dead-letter 语义 | 本地 / 2026-07-24 |
| Slice 4J.1 binding security | 0 | 聚焦回归通过 | owner/tenant/purpose、真实 receipt、scope 顺序、typed bind response | 本地 / 2026-07-24 |
| Slice 4K.1 downgrade preflight | 0 | 12 passed | 019–022 链式降级在任何 DDL 前统一拒绝有损状态 | 本地 / 2026-07-24 |
| Slice 4L exact API identity | 0 | 109 passed / 1 skipped | 精确 hash schema、真实 HTTP 状态、legacy writer 收口 | 本地 / 2026-07-24 |
| `test_evidence_rework_generation_v1.py`（4M 实现前） | 2 | RED：`EvidenceReworkGenerationV1` 模块不存在 | raw generation dict 缺少公共契约 | 本地 / 2026-07-24 |
| 4M contract + final/worker 聚焦回归 | 0 | 54 passed / 1 skipped | typed generation、固定 section/hash、append-only FinalMemorial 身份说明 | 本地 / 2026-07-24 |
| 4M 目标文件 Ruff | 0 | All checks passed | 新契约及集成文件静态规范；legacy router 使用既有显式 ignore | 本地 / 2026-07-24 |
| 完整 backend 首轮复验 | 1 | 3046 passed / 32 skipped / 15 failed | 暴露 4N 冻结基线、4O legacy adoption 和 3 个 fixed-base 基线问题 | 本地 / 2026-07-24 |
| Slice 4N canonical baselines | 0 | 28 passed | writer 数量、decree event 扫描边界和 migration head 022 | 本地 / 2026-07-24 |
| Slice 4O legacy adoption + W05 migrations | 0 | 32 passed | 010/011 历史 schema 验证后安全升级到 022 | 本地 / 2026-07-24 |
| Slice 4P P0-B ownership probe | 0 | 19 passed；Ruff pass | W05 新增测试 import order 机械收口 | 本地 / 2026-07-24 |
| exact implementation `1f1800c7` W05 定向包 | 0 | 164 passed / 1 skipped | contracts、secure ingest、binding、worker、并发/幂等、FinalMemorial、019–022 | 本地 / 2026-07-24 |
| exact implementation `1f1800c7` backend 全量（明确排除 3 项） | 0 | 3058 passed / 32 skipped / 3 deselected | 当前 HEAD 的仓库级非排除回归 | 本地 / 2026-07-24 |
| 3 个 fixed-base 排除项单独复现 | expected 1 | 3 failed | RAG mock 仍指向旧 constructor；FastAPI route 项无 `.path` | 本地 / 2026-07-24 |
| 排除项路径 fixed base→implementation diff | 0 | `BASELINE_EXCLUSION_PATHS_UNCHANGED` | `case_archive.py`、`knowledge_rag.py` 及两个失败测试均非 W05 diff | 本地 / 2026-07-24 |
| authority v2 exact implementation 复验 | 0 | 27 passed；check valid；W05 `GO` | 当前执行包唯一授权 | 本地 / 2026-07-24 |
| backend/root harness doctors | 0 | 均 0 errors / 0 warnings | 后端与三层项目边界 | 本地 / 2026-07-24 |
| Alembic graph | 0 | 单 head `022_shiguan_memorial_identity` | 018→019→020→021→022 连续链 | 本地 / 2026-07-24 |
| fixed base→implementation Python Ruff | 0 | All checks passed | 明确忽略 legacy `E402,E731,I001,F601,B009,F541`；W05 新增 import 已单独修正 | 本地 / 2026-07-24 |
| fixed base→implementation `git diff --check` | 0 | clean | 60 files / 32 commits / binary diff SHA-256 `b357feec…fa22` | 本地 / 2026-07-24 |

## 结果

纵切 1–4M 已完成 RED→GREEN：补证关闭旧奏折裁决资格、绑定精确 current content hash，
建立三个 W05 v1 契约门，让 accepted evidence 经 canonical outbox generation 局部重算现有
CourtReview，并以 superseded 状态围栏旧 generation。支持范围由已有 `ContractIntakeV1`
显式输入后冻结在 canonical `DecisionTask`；通过质量与来源门的真实 worker 路径会持久化
SwarmRun/SwarmQualityResult，并追加 current FinalMemorial v2。独立预审发现的问题已按
4G.1–4M 分片修复；`EvidenceReworkGenerationV1` 现在是 generation payload 的类型事实源。

## 未验证项

- 独立 Claude Code/gstack 修复后复审尚未运行；本窗口按 Owner 停止线只交付
  `REVIEW_READY` 候选，不自行审查或合并。
- 完整 backend 零排除仍有 3 个 fixed-base 既有测试失败；相关产品/测试路径不在 W05 diff，
  未获批准在本包顺便修复。
- 前端仍未传精确 FinalMemorial hash；前端、W06–W09、LangGraph、真实客户数据、推送、
  合并、发布和生产切换均未获批准。

## Diff 与回滚复核

- changed files：以 fixed base `67bcc78e` 到最终候选 SHA 的 exact diff 为准；包含 W05
  contracts/service/API/tests、019–022 migrations 与本 change record。
- diff review：预审已完成；修复后独立双轴复审与 gstack review 待最终候选执行。
- 回滚是否演练：升级/安全降级测试已覆盖；含版本事实时 downgrade 会在 DDL 前明确拒绝。

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
| W05 审查修复实现 | 4G.1–4M 聚焦回归 | PASS |
| W05 历史 review-ready 候选 | exact-HEAD 定向/全量/authority/doctor/Ruff | MERGED_AT_3CB508E / EVIDENCE_SUPERSEDED |
| W05 post-merge 独立复审 | remediation exact-SHA read-only review | TRACKED_IN_POSTMERGE_REMEDIATION |

## 声明状态

- `HISTORICAL_MERGED / POSTMERGE_REMEDIATION_OPEN`
