# census CEN-01..05 独立复审（2026-07-17）

| 项 | 值 |
| --- | --- |
| 复审 | 对抗性核对：验证每条 CEN 修正真实落地 + **引用证据文件确实存在** + 计数自洽 |
| 诚实声明 | 本复审由**同一会话内联执行**（非全新子代理）——独立子代理连续两次 529 Overloaded 失败，遂降级内联。CEN 是可机器核对的客观增补（条目在不在、文件存不存在、计数对不对），非主观判断，故内联仍可信；但缺少全新上下文的独立性，最终签署归用户。 |

## 逐项核对（实测，含引用证据存在性）

| 项 | 要求 | 实测 | 判定 |
| --- | --- | --- | --- |
| CEN-01 | 登记 MANOR-01 或显式排除 | MANOR-01 入册；引用 `backend/web/routers/manor.py`、`manor_and_task_events.py`、`frontend/src/features/zhuangyuan/` **均实测存在**（非捏造） | CLOSED |
| CEN-02 | §7 显式排除御座/王座 | §7.1 含御座/王座排除；`backend/web/routers/throne.py`、`frontend/src/features/throne/` **均存在** | CLOSED |
| CEN-03 | §7 声明 jiqun_ai 平台族排除/单独治理 | §7.1 含，判正交平台、不并主链 | CLOSED |
| CEN-04 | 登记 EXT-04 通知/Webhook L0 | EXT-04 入册，但**登记为 L1(断链)非 L0 零代码**——原 finding "零代码"前提被证伪（见下） | CLOSED（前提修正） |
| CEN-05 | §8 与 P0–P9 对账 | §8.1 对账 + 单写者铁律 | CLOSED |

## 对抗性发现并已修（两轮）

**第一轮（内联复审）**：EXT-04 行原写"repo grep webhook 0 命中"，实测 `grep -rli webhook` 得 3 命中
（feature_flags 描述串、SKILL.md、提示词），已改措辞。

**第二轮（Codex stop-review 追加）**：Codex 指出仍把"已有实现误判零实现"——**Codex 对**。
我第一轮只搜字面 "webhook"，漏了以别名实现的**审批通知**能力：
- `backend/web/routers/approval.py` `/api/approval/pending` **已挂载**（`main.py:290 include_router`），
  但 import `src.approval_manager`——该模块**全仓缺失**（`find_spec` False）→ **路由恒 HTTP 500**。
- `backend/src/event_bus.py` 内部 pub/sub **真实**（swarm_orchestrator 消费）。
- `feature_flags.approval_notifications` off。

故 EXT-04 **不是零实现**，是"挂载但断链"的 L1。已把 EXT-04 改记真实成熟度 L1(断链)，
并显式登记"挂载路由 /api/approval/pending 恒 500"为真缺陷（待修或退役），风险 高。
教训：搜能力不能只搜字面名（"webhook"），要搜别名（通知/notification/approval/event_bus）。

## 计数自洽（含本复审自身的漏检更正）

**本复审第一版此节是错的**：当时只核对"总数/registry 行数=76、'74' 残留 0 处"，
**漏检了 §1.2 的 L 级分布**——它仍是 `2/13/33/22/4=74`，与总数 76 自相矛盾。
Codex stop-review 抓出此内部不一致（census commit `b1ccb2d` 修复）。即"四处一致"的原判
是不完整核对得出的假结论，据实更正如下：

- **L 级分布**：`2/14/34/22/4 = 76`，与实表逐级吻合（EXT-04=L1 断链、MANOR-01=L2）。已修。
- **总数 76 的位置（8 处 capability-total 断言）**：§1 intro(l13)、§1.2 功能总数(l31)、
  §1.2 L 级分布(l32)、§1.2 脚注×2(l43/l50)、§6 Wave-1(l231)、§7 冻结宇宙(l277)、§8 FCV1-001(l300)。
  （§1.2 l52 的"76 个后端 router 文件"是巧合资产数、非能力总数。本节初版曾误写"5 处含§8 依赖"——
  仍是"只数部分位置"的同一漏检，经全量审计更正为 8 处。）
- **"74" 残留**：现有 **1 处**，且是**有意保留**——§1.2 脚注"pre-CEN 74 项基线"，用于圈定其余
  分析性计数（有真实实现/Mock/重复/未接入/测试/无 UI/无 owner/安全）为原作者对 74 基线的
  主观评估、未对 2 项补登重算（避免混算）。故非残留错误。
- registry 行数实测仍 **76**。

**教训**：计数一致性核对必须覆盖**所有子分布**（尤其 L 级这种应 sum 到总数的），不能只看总数。
本复审内联执行（子代理两次 529 降级），是漏检的直接原因。

## 裁决

**CENSUS_REVIEW_GO**：CEN-01..05 全 CLOSED，引用证据实测存在，计数自洽，一条可证伪措辞已收紧。
冻结名单完整性（本次 NO_GO 核心标准）达成——静默遗漏消除，排除项带理由。
（内联复审，非全新上下文；最终冻结宇宙签署归用户。）
