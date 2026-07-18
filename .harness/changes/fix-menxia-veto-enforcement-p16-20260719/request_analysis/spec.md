# 规格说明：fix-menxia-veto-enforcement-p16-20260719

## 背景

历史独立审查给 Menxia 路由链 `NO_GO (CRITICAL)`：丞相能够计算出“门下省封驳”，但
canonical dispatch 与上书房 confirm-edict 随后仍继续生成会审、写 outbox 或进入部门执行。
前端又把未知 terminal snapshot 兜底成 `done`，使“被治理规则拦住”可能显示成“已完成”。

本包以最新已发布 P15 远端为事实基点，先复现 `我要去美国看世界杯决赛` 返回
`edict_recorded` 的 RED，再只重建封驳执行边界和直接消费者，不携带旧 NO_GO 证据目录。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | P15 远端的世界杯请求被判封驳后仍返回 `edict_recorded` | B16 隔离行为探针，断言 exit 1 | Codex / P16 worktree | 是，已修复 |
| 已确认事实 | 旧 SSE adapter 对除 `failed` 外的未知终态发 `done` | adapter 负例与源码行为 | node:test | 是，已修复 |
| 已确认事实 | 首轮浏览器测试中，作战流已 blocked，但当前挂载中心面板没有“未生成奏折”说明 | Playwright 首跑 1 failed | Chromium / Codex | 是，已修复 |
| 已确认事实 | 新增两处 `CourtReview` 写入后冻结 writer inventory 仍为 8 | backend 全量首跑 2 failed / 2773 passed | AST 架构门 | 是，已更新为精确 10 |
| 已确认事实 | review-v1 发现客户端传 `ministers=['hu_bu']` 会把世界杯请求从封驳变准奏 | `packet_review/review-v1.md` + v2 两条 RED | Claude / Codex | 是，v2 已修复 |
| 未知问题 | Menxia 人工覆盖后的安全恢复协议尚不存在 | 当前 proceed event 不为 veto 注册恢复状态 | 后续独立 Packet | 是，阻断自动恢复，不阻断本包 fail-closed |
| 范围外问题 | 工部电池类 P0 关键词缺口仍持历史 HIGH | 历史 Opus review `e59df3b…` | 后续 Gongbu Packet | 是，不得随本包宣称整体 NO_GO 已清零 |

## 数据流与调用链

`raw command` → 丞相生成未覆盖的 canonical route → 门下省以该原始路由审查职责范围 →
通过后才应用客户端 `department_override` 执行约束；若门下省产生专属 `门下省封驳`
risk flag：

1. 构造只读 routing plan 与封驳纪要；
2. 写入 `DecisionTask.status = menxia_veto_pending` 和唯一 `CourtReview`；
3. `outbox_event_id = null`，不调用部门 engine，不启动 swarm；
4. REST status 返回同一 review，重复 confirm 命中终态幂等短路；
5. canonical terminal snapshot 映射为 `blocked`，不是 `done` 或 `error`；
6. 军机处页面展示质量门阻断和“未生成奏折、未派发执行”。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `menxia_veto_pending` | backend canonical dispatch / Shangshufang confirm | status API、SSE adapter、军机处 | 后端 API 回归 + node:test + Playwright |
| veto memorial | `CourtReview.memorial_json` | 上书房/军机处 canonical projection | 必填字段、blocked gate、真实响应 fixture |
| `canonical.snapshot` terminal | backend court stream | `adaptCanonicalCourtStreamEvent` | 成功白名单；veto→blocked；未知→error |
| CourtReview writer inventory | `backend/src/court_review_writer_inventory.py` | AST 架构门 | 精确 10 个写入点且全部显式 `tenant_id` |

## 范围

- 后端门下省规则、canonical dispatch、任务投影和上书房确认/状态链。
- 对应后端行为、API、租户 lineage 与 writer inventory 回归。
- 前端 canonical status/memorial/SSE 映射、作战流 blocked 状态和当前挂载中心面板。
- 一条真实浏览器 Playwright 回归及本根级 change 证据包。

## 非目标

- 不实现人工 override/恢复执行，不伪造可点击的放行能力。
- 不处理工部电池/物理安全 HIGH。
- 不处理 P17 memorial 历史数据回填、递归 validator 或其他合约清理。
- 不引入新数据库表或 migration，不改变正常 direct/council 路由。
- 不恢复旧 NO_GO/未终态 harness 目录，不整体合并本地 78 提交。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 专属 `门下省封驳` | 停在执行前，状态 veto pending，无 outbox/部门调用 | direct/canonical/API 回归 |
| 仅普通人工确认 flag | 不误触 Menxia 专属封驳 | Menxia 单测 |
| 客户端显式指定部门 | 只约束实际参与部门，不能作为职责范围证据；世界杯仍封驳 | 纯函数 + `/decree/dispatch` 回归 |
| 合法低温电池任务 + override | 原始路由已有职责证据，仍准奏并按 override 派单 | 既有 durable decision fact 回归 |
| 重复 confirm | 返回同一 review，零重复副作用 | 幂等 API 回归 |
| veto REST memorial | 必填数组/来源/next action/quality gate 齐全 | API + projection 回归 |
| veto terminal SSE | 映射 `blocked` | adapter + BattleStream 回归 |
| 已知成功 terminal | 仅白名单状态映射 `done` | adapter 回归 |
| 未知/失败 terminal | 不伪报成功 | adapter 回归 |
| 浏览器真页面 | 显示人工确认、未生成奏折、未派单；无已完成/异常终止 | Playwright Chromium |
| writer 数量变化 | baseline 精确更新为 10，所有构造显式 tenant | 两个 AST 架构门 |

## 风险与回滚边界

主要风险是误伤正常需要人工确认但不应封驳的任务，以及新增写入点破坏 tenant/单写者治理。
实现只匹配专属 risk flag，并由正常路由、幂等、无 outbox、writer inventory 与 tenant AST 门
共同约束。回滚可原子 revert P16；没有 schema migration。但回滚会重新开放 CRITICAL 执行
绕过，因此只能在替代 fail-closed 修复同时上线时执行。

## 计划确认记录

- 批准人：项目业主
- 批准日期：2026-07-19
- 批准范围：继续按 Harness 顺序把本地混杂提交重打包；P16 先关闭 Menxia CRITICAL，并由 Claude Code 独立复审。
- 明确未批准：整体合并 78 提交、夹带 Gongbu/P17、绕过复审或在 NO_GO 下推送。

## 验收标准

1. 两条生产入口都在任何部门/蜂群/outbox 副作用前停止封驳任务。
2. 状态、review、REST、SSE、军机处 UI 对封驳语义一致且不伪报成功/异常。
3. 重试幂等，普通人工确认任务不被误拦。
4. 后端聚焦、全量、前端契约、浏览器、类型检查和生产构建通过。
5. 三层 doctor、writer/tenant 架构门和 diff check 通过。
6. 固定 SHA 独立复审 GO 前不合 ext。

## 验证计划

B16 backend RED → 最小执行门 GREEN → REST/SSE/UI 契约测试 → Playwright RED/GREEN →
writer inventory RED/GREEN → Claude review-v1 NO_GO → override 旁路 RED/GREEN → backend 全量
复跑 → TypeScript/build → 三层 doctor → 精确 diff → 固定 SHA Claude Code review-v2。
