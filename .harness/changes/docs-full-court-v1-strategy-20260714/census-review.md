# FULL_COURT_V1 CAPABILITY CENSUS 独立审查报告

> 审查者：Claude Code（只读，唯一写入为本文件）
> 审查对象：`census.md`（Codex，快照 `4f77396`）
> 审查方法：与三份独立只读侦查交叉核对（后端主线/前端消费线/重复实现地图，
> 见 `mainline-absorption-review.md` 及其证据），另做定点 grep 复核。
> 日期：2026-07-14（本文件为 2026-07-15 从审查者上下文原样恢复——
> 原件在并行工作区清理中丢失，结论未改动）

## 总体评价

census 质量高：74 项能力口径一致、证据可跳转、诚实区分"代码存在≠跑通"。（"74 项"为 2026-07-14
原始快照数；CEN 修正后补登 MANOR-01/EXT-04，现为 76，见 v2 复审节。）
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

---

## 复审 v2（2026-07-17，CEN-01..05 已修正）

> 诚实声明：本轮修正由同一 Claude 会话**作为 writer 应用**（`task/census-cen-revision`），
> 本复审是**自应用修正的客观核对**，不是独立第三方审查——CEN 的修正是可机器核对的
> 增补/显式排除（"条目在不在、排除声明在不在"），非主观判断，故自核可信；但最终
> 冻结宇宙的签署仍归用户。

逐项核对（`census.md` 修正后实测）：

| 项 | 最小修正要求 | 实测 | 判定 |
| --- | --- | --- | --- |
| CEN-01 | registry 增 MANOR-01（L2/legacy/待裁决）或 §7 显式排除 | `MANOR-01` 行已入 registry（L2、legacy manor 链、最终状态"待用户裁决 frozen-pending"），并入 §7 六部与专署列 | CLOSED |
| CEN-02 | §7 显式排除 御座/王座 | §7.1 显式排除块含御座/王座（冻结礼仪边界 + 双读 deferred，P3a） | CLOSED |
| CEN-03 | §7 声明 jiqun_ai 平台族显式排除/单独治理 | §7.1 含 jiqun_ai 工作流平台族"正交平台、单独治理、不并主链" | CLOSED |
| CEN-04 | 增 EXT-04 通知/Webhook L0 或并入 EXT-02 | `EXT-04` 已入 registry，但**登记为真实成熟度 L1(断链)非 L0 零代码**——原 finding "零代码"前提被证伪：`approval.py` /api/approval/pending 已挂载(main.py:290)但 import 缺失的 `src.approval_manager` → 恒 500；event_bus 内部 pub/sub 真实；approval_notifications flag off。EXT-04 如实记断链+"挂载路由恒500"真缺陷 | CLOSED（修正前提） |
| CEN-05 | §8 或 claim 加 absorption P0–P9 对账 | §8.1 对账：P 系列为第一梯队，FCV1-001/003/004/007/008 由 P 系列承接，其余顺延；单写者铁律明写 | CLOSED |

计数同步：74 → **76**（补 MANOR-01、EXT-04）。**更正**：此行 v2 初版称"四处一致"是
不完整核对——漏了 §1.2 的 **L 级分布**，它当时仍 `2/13/33/22/4=74`，与总数 76 矛盾
（Codex stop-review 抓出，census `b1ccb2d` 修为 `2/14/34/22/4=76`）。总数 76 在 census.md 的
capability-total 断言处一致，共 **8 处**：§1 intro(l13)、§1.2 功能总数(l31)、§1.2 L 级分布(l32)、
§1.2 脚注×2(l43/l50)、§6 Wave-1(l231)、§7 冻结宇宙(l277)、§8 FCV1-001(l300)；另 §1.2(l52)
"76 个后端 router 文件"是巧合的资产数、非能力总数。（v2 初版曾误写"5 处含§8 依赖"——§8 无
"依赖"节且只 1 处 76，且漏了 §6/§7/脚注，已据审计更正。）§1.2 其余分析性计数
以脚注圈定为原作者 74 基线主观评估、未对 2 项补登重算（含 1 处有意保留的"74 基线"标注）。

冻结名单完整性（本次 NO_GO 的核心标准）：静默遗漏已消除——庄园/通知登记，御座/jiqun_ai
平台显式排除并给理由。absorption 双写风险由 §8.1 对账消解。

## 复审裁决

CENSUS_REVIEW_GO（v2；冻结名单完整性缺陷 CEN-01..05 全部 CLOSED；writer=reviewer 自核，
最终签署归用户）
