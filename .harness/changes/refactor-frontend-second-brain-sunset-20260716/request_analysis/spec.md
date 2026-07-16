# 规格说明：refactor-frontend-second-brain-sunset-20260716

## 背景

P4 要消除前端“第二大脑”：军机处和上书房当前在拿到后端状态后，仍调用
`ministry-review-loop`、`yushitai-auditor`、`imperial-report-synthesizer` 与
`unified-decision-loop`，从问题文本和局部数据重新生成六部会审、御史审核、综合报告与
圣裁。该结果会与后端 canonical 奏折混合，形成无权威来源的 `MIXED` 事实。

本 Packet 只让前端投影后端事实，不新增状态机、不改变平台 API。执行纪律来自
`codex-absorption-plan.md` P4 与单线裁决：P4a、P4b、P4c 严格顺序，每一步先 RED、后
实现，并在三步完成后停审。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 两页面生产代码直接调用四个本地决策引擎 | `junjichu/page.tsx:380-406`；`ShangshufangPage.tsx:1526-1549`，2026-07-16 只读审计 | Project Agent + 三路只读研究 | 是，本 Packet 修复目标 |
| 已确认事实 | 既有 status 读模型已含 task/review/formal memorial/execution status；memorial 含部门奏报、证据、缺证、风险、后令、来源与质量门 | `backend/web/routers/shangshufang.py:1331-1370`；`frontend/src/lib/jiqun-api.ts:201-301,441-490` | 契约测试 + projector 测试 | 否 |
| 已确认事实 | 上书房当前只读候选 `review.memorial`，忽略正式 `formal_memorial.memorial` | `ShangshufangPage.tsx:1489-1508` | P4b RED 哨兵测试 | 是 |
| 已确认事实 | P3 已 GO 并合入 ext，P4 是唯一允许启动的下一 Packet | ext `188fb3d`；P3 change `VERIFIED_COMPLETE` | Project Owner | 否 |
| 推测 | P4a/P4b 不需要后端字段扩展 | 已有 TypeScript 契约字段覆盖当前 UI 消费面 | 以 RED/实现时字段追踪复核 | 若证伪则仅扩 court projection |
| 未知问题 | 四引擎之外的侧脑生产可达性与规则蒸馏最小集合 | P4c 只读调用图仍在收口 | P4c 开工前形成清单 | 否；不得提前扩范围 |

## 数据流与调用链

目标链：canonical worker / swarm run → CourtReview / FinalMemorial →
`GET /api/shangshufang/tasks/{id}/status` → 纯 projector → 军机处/上书房展示。

禁止链：页面问题文本或局部响应 → 任一前端决策引擎 → 新的 signal/verdict/risk/
missing evidence/next action/quality gate/圣裁。没有后端字段时显示“待回报/未提供”，不得
用空数组推断“无风险/已通过”。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `ShangshufangTaskStatusResponse` | backend `shangshufang` court-owned status projection | P4a/P4b pure projector | 保持 endpoint 与外层响应兼容；用契约/哨兵测试锁定 |
| `review.memorial` | canonical CourtReview 候选会审 | awaiting-evidence 候选展示 | 必须标候选/阻断，不冒充正式圣裁 |
| `formal_memorial.memorial` | canonical FinalMemorial 快照 | 正式奏折/圣裁展示 | 存在时优先于 review；来源取正式快照外层 source label |
| `execution_status` / swarm-runs | canonical execution ledger | 军机处进度、部门运行展示 | 只做排序/标签/格式化，不推断裁决 |
| backend P4 golden cases | P4c 蒸馏后的规则知识 | backend read-model tests / Wave 3 | 先测试入库，再断生产 import |

## 范围

- P4a：军机处改用 canonical projector；无真实 review/final memorial 时为空态或等待态。
- P4b：上书房正式奏折优先、候选会审诚实标记、空读继续有限重试；删除本地四引擎调用。
- P4c：先把关键词、分诊与风险规则蒸馏为 backend golden dataset/test，再将四引擎标记
  deprecated/test-only 并清零生产 imports；侧脑只做 `EXPERIMENTAL/SHADOW` 诚实降级。
- 同一 change 内分别保留 P4a/P4b/P4c 原子提交和 RED/GREEN 证据。

## 非目标

- 不修改 `runs/prompts/flows/swarm/chat/knowledge/memory` 平台路由族。
- 不新增前端 BFF、浏览器持久化事实源、writer、schema 或状态机。
- 不后端化工部/御史纯前端脑、刑部 clause 扫描、锦衣卫雷达；仅诚实标降级。
- 不处理 P5+、7 条已登记 backend known-red 或 P6 前端已登记失败。
- 不改典仪、王座、release 分支，不部署。开工时未授权 push；用户随后以“收口提交上传”
  明确授权将本 Packet 合入并上传 `feature-chaotang-ext`，该授权不扩展为部署授权。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 无 review / formal memorial | 显示等待或“未提供”，不构造会审与圣裁 | projector empty-state RED |
| formal 与 review 同时存在 | 正式快照胜出，review 不混入正式结论 | 不同哨兵文本 RED |
| awaiting_evidence 只有 review | 显示候选/质门阻断，不称正式奏折 | P4b projector RED |
| direct_completed | 原样展示 backend direct receipt，并明确简单任务回执 | P4b projector RED |
| 终态但 memorial 瞬时缺失 | 不停止于空视图；按既有上限继续重试，最终诚实报完整性异常 | polling RED |
| 后端数组为空 | 显示暂无回报，不推断无风险、无冲突或质门通过 | empty-array RED |
| 后端未给 trace | 显示未提供，不生成本地确定性 trace | projector RED |
| source label 为 LIVE/REAL/DEMO | 保留后端标签；正式奏折采用外层 canonical label | source sentinel RED |

## 风险与回滚边界

- 最大风险是把旧本地推断换成新 adapter 推断；projector 只能复制、选择、稳定排序、去重、
  枚举标签与视觉 tone，任何新 verdict/risk/gap/next action 均属越界。
- rollout flag 默认启用 canonical 完整投影；关闭时只降级为 canonical 状态/等待安全视图，
  不重新启用本地圣裁。一个版本周期内保留 test-only 引擎与原子提交，若必须恢复旧行为，
  只能显式回滚对应提交并重新进入审查，不能运行时静默切回不可信事实源。
- rollout 环境变量为 `NEXT_PUBLIC_COURTOS_CANONICAL_PROJECTION`；缺省及
  `1/true/on/canonical` 为启用，其他显式值一律 fail closed，不接受 `legacy` 回切。
- P4a 若只能改平台路由补字段，立即 `BLOCKED` 请求用户裁决；不得绕过。
- 真实数据库只读：验收前后复核 size/mtime/SHA；测试使用隔离临时库。

## 计划确认记录

- 批准人：用户（“按照顶尖大神的方式处理好，并按顺序执行”“继续任务”）
- 批准日期：2026-07-16
- 批准范围：absorption P4a→P4b→P4c，同一 change/branch，完成后停审。
- 明确未批准：P5+、平台路由改造、release/push/deploy、范围外 known-red 修复。
- 后续授权：2026-07-16 用户“收口提交上传”，仅覆盖本 Packet 的提交、合入 ext 与 push；
  P5+、release 分支和部署继续冻结。

## 验收标准

1. 军机处和上书房生产代码对四引擎 import/call 为 0；command-center 自动跟随。
2. 所有正式结论直接来自 CourtReview/FinalMemorial/swarm-run；无 `MIXED` 本地合成路径。
3. 正式/候选/direct/空态/瞬时空读/source/trace 边界测试通过。
4. P4c golden dataset/test 先于退役提交存在；四引擎仅 test/eval 可达并有 deprecated 边界。
5. 侧脑不得进入正式结论区，并显示 `EXPERIMENTAL/SHADOW`。
6. targeted、相邻、typecheck、批准全量套件、三层 doctor 通过；known-red 与基线一致。
7. 上书房下旨→军机处看状态→圣裁浏览器冒烟通过；数据库指纹不变。

## 验证计划

- P4a：先写 pure projector 与军机处 production-import guard，运行并保存 RED；最小实现后
  跑 projector、现有 page/view-model/architecture tests 与 `tsc`。
- P4b：先收紧 Shang whitelist/旧反向断言，并新增 formal precedence、candidate、direct、
  retry、empty、trace tests；保存 RED 后实现并复跑。
- P4c：先新增 backend golden dataset/test 并观察预期 RED/xfail，再接读模型或登记 Wave 3
  期望，随后断生产 import、标 deprecated/SHADOW，运行 golden + import graph。
- 收官：frontend/backend 全量、三层 doctor、browser smoke、DB 指纹、`git diff --check`，
  证据写入 `ci_result/ci_summary.md`，输出 `PACKET_P4_READY_FOR_CLAUDE_REVIEW` 后停。
