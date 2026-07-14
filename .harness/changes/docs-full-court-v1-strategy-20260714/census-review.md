# FULL_COURT_V1 CAPABILITY CENSUS 独立审查报告

> 审查者：Claude Code（只读，唯一写入为本文件）
> 审查对象：`census.md`（Codex，快照 `4f77396`）
> 审查方法：与三份独立只读侦查交叉核对（后端主线/前端消费线/重复实现地图，
> 见 `mainline-absorption-review.md` 及其证据），另做定点 grep 复核。
> 日期：2026-07-14（本文件为 2026-07-15 从审查者上下文原样恢复——
> 原件在并行工作区清理中丢失，结论未改动）

## 总体评价

census 质量高：74 项能力口径一致、证据可跳转、诚实区分"代码存在≠跑通"。
与我方独立侦查在全部重叠结论上互相印证：三条执行路径、部门 ID 多套词表、
四处迁移权威、前端本地二级状态机（UI-03/UI-04 与我方 ShangshufangPage.tsx:1526-1549、
junjichu/page.tsx:380-406 发现一致）、BFF 已退役仅剩死引用、两套御史 gate、
DepartmentMemorial 断链为主链最先断点——均双源确认。
First ten Task Packets 全部指向统一底座而非页面扩张，符合审查要求第 14 条。

但冻结宇宙存在**遗漏**——冻结名单的完整性是本次审查的核心标准，静默遗漏
正是冻结要防止的事，故判 NO_GO，修正成本低（补 3-4 条目+1 份对账说明）。

## 问题清单

### CEN-01
- Severity: MEDIUM
- 证据文件: `backend/web/routers/manor.py`、`backend/web/routers/manor_and_task_events.py`、
  `frontend/src/features/zhuangyuan/`（census.md 全文 grep "manor/zhuangyuan/庄园" 0 命中）
- 遗漏或错误: 庄园能力完全缺席 registry。它有真实前后端实现、走 legacy chaotang
  manor 链、生产被 middleware redirect、去留待用户裁决——正是"必须显式登记
  （或显式排除）"的对象。
- 影响: 冻结宇宙不完整；absorption P3c 正要处置 manor 派发链，census 却无
  对应 CAPABILITY_ID 可挂靠，后续对账会出现无主 diff。
- 最小修正: registry 增加 `MANOR-01`（L2、legacy 链、是否有效待用户裁决），
  或在第 7 节显式声明"庄园排除出 V1 冻结宇宙+理由"。

### CEN-02
- Severity: LOW
- 证据文件: `backend/web/routers/throne.py`、`frontend/src/features/throne/`
  （census.md grep "throne/御座/王座" 0 命中）
- 遗漏或错误: 御座/王座未登记。它是冻结礼仪边界+legacy chaotang_store 双读方
  （P3a 已列 DEFERRED_REQUIRES_USER_DECISION），应显式登记为 frozen/excluded
  而非静默缺席。
- 影响: 同 CEN-01，量级更小。
- 最小修正: 第 7 节加一行显式排除声明（冻结边界，双读收编 deferred）。

### CEN-03
- Severity: LOW
- 证据文件: `backend/web/routers/`（runs/flows/chat/ab_tests/votes/analytics/
  repairs/optimize/compare 等 jiqun_ai 平台路由，census 仅散见于 PROV/EXT/OBS/HANLIN）
- 遗漏或错误: jiqun_ai 工作流平台作为整族能力既未逐项入册也未显式排除。
  我方侦查判定其为正交平台（不该并入决策主链），census 应写明同一裁决。
- 影响: 后续有人可能把平台功能当"未盘点缺口"重复立项，或反向把它塞进主链。
- 最小修正: 第 7 节加"平台能力域显式排除/单独治理"声明一行。

### CEN-04
- Severity: LOW
- 证据文件: 策略文档能力域 13 明列"通知、Webhook"；repo grep webhook 0 命中
- 遗漏或错误: 口径不一致——同为零代码，SEC-02（删除）登记为 L0，
  通知/Webhook 却未登记。
- 影响: 轻微；冻结口径应自洽。
- 最小修正: 增加 `EXT-04 通知/Webhook L0` 或声明并入 EXT-02 语义。

### CEN-05
- Severity: MEDIUM（流程，非内容）
- 证据文件: census 第 8 节 FCV1-001..010 vs `codex-absorption-plan.md` P0–P9
- 遗漏或错误: 两套 Task Packet 序列范围重叠且并行存在——FCV1-001/007（部门
  registry）≈P1，FCV1-003（Alembic）≈P5，FCV1-004/008（provenance/gate）与
  P4 相交。absorption 战役已开跑。
- 影响: 不对账会出现双写同一改动面、违反单写者铁律。
- 最小修正: census 第 8 节或 claim 文件加一段对账：absorption P0–P9 是第一
  执行梯队，FCV1-00x 中被其覆盖的部分标"由 P 系列承接"，剩余（tenant、
  worker、DepartmentMemorial、外部效果安全）按 FCV1 顺序在 P 系列后执行。

## 重点核对项结论（审查提示词 1–14）

覆盖前端页面：**不完整**（庄园、御座缺，CEN-01/02）；后端 router：不完整（同上）；
Agent/flow/prompt：覆盖充分；六部/专署/锦衣卫/钦天监/翰林/史馆/国力：覆盖充分；
MCP/Provider：覆盖充分；数据库/迁移/发布：覆盖充分且与我方侦查一致；
功能能力 vs 重复实现区分：正确（第 3 节地图与我方一致）；
无用户入口功能、无后端页面：已识别（23/10 项统计）；
状态非后端派生：已识别（UI-03/04、2SM 列）；
Mock/Fallback 可达 production：已识别（UI-07 safeReal、EXT-02 伪 sent）；
canonical owner 推荐：合理；依赖顺序：合理（W1→W8 硬依赖成立）；
前十 Packet 是否先底座：是。

## 裁决

5 项问题中 CEN-01/05 为 MEDIUM，均为低成本修正；census 主体结论可信，
但冻结名单必须先补全/显式排除后才能作为 FULL_COURT_V1 权威宇宙。

CENSUS_REVIEW_NO_GO（修正 CEN-01..05 后可快速复审，预计一轮通过）
