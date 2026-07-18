# 规格说明：fix-gongbu-battery-safety-p17-20260719

## 背景

Opus 对 department-agent 架构的独立复审已实证：旧工部引擎只识别“热失控/冒烟/漏液/燃烧”，
把“储能柜爆炸并起火”判为 P2/yellow，给出补遥测而非断电撤离消防。后续对抗性检查又发现：
未命中有限白名单的储能事故默认 P2；工部可命中修复前的陈旧缓存；yellow 会进入可自动继续档，
无法兑现“强制人工复核”。这些是同一 fail-open 根因，不应只补两个关键词。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | “爆炸并起火”在旧实现为 P2/yellow | 新增回归在基线 RED | Codex 实跑 | 是 |
| 已确认事实 | 工部可读取陈旧 P2 缓存 | 带兵部对照的真实缓存行为测试 RED | Codex 实跑 | 是 |
| 已确认事实 | yellow 不要求人签，black 才进入强制人签 | `src/signoff_gate.py` + 行为测试 | Codex 实跑 | 是 |
| 设计取舍 | 储能范围内不自动降 P2，只允许 P0/P1 | 本 spec 与实现 | Claude 复审待定 | 否 |
| 未知问题 | 所有未来派单入口是否都消费 signoff 信号 | 不适用 | 后续端到端包 | 否；本包不扩线 |

## 数据流与调用链

`task_text` → `_call_adapter_observed("工部", adapt_gongbu, ...)` → 工部跳过旧缓存 →
`adapt_gongbu` 先判储能 scope，再判危险信号 → P0/black 或 P1/black → court_doc →
`signoff_gate.needs_signoff(doc)` 必须为 true。P0 给出断电、撤离、消防；P1 给出严重度未确认、
禁止远程复位并要求人工复核。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `risk_level` / `light` | `adapt_gongbu` | court_doc / signoff gate | P0/P1 均 black；聚焦与全量测试 |
| `_ENGINE_CACHE_EXCLUDED_DEPTS` | `real_department_engines.py` | adapter observation wrapper | 工部与锦衣卫实时重算；真实 cache-hit 对照测试 |
| `needs_signoff(doc)` | `signoff_gate.py` | 审批/自动化分档 | 四类储能输入均断言 true |

## 范围

- 修改一个生产文件与一个测试文件。
- 增加危险用字/前兆覆盖、P1 fail-safe、人签和缓存行为回归。
- 新建本 change 的 summary/spec/tasks/ci 证据。

## 非目标

- 不修改 Menxia、Chancellor、前端、数据库或外部 provider。
- 不宣称完成所有派单入口的 P1 执行闭环。
- 不引入旧混合分支，也不顺带发布 Guoli/Census 修复。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 爆炸、起火、烧穿、焚毁、高温短路 | P0/black，断电撤离消防 | hazard phrasing 回归 |
| 温度 90 度但严重度未确认 | P1/black，强制人签 | unconfirmed + signoff 回归 |
| 文本声称“一切正常” | 仍为 P1/black，不以客户端措辞自动授权降级 | never-auto-downgrade 回归 |
| 陈旧缓存含 P2 | 工部忽略缓存并实时重算 | cache behavior 回归 |
| 非储能普通任务 | `adapt_gongbu` 返回 None | 既有 scope 回归 |

## 风险与回滚边界

主要代价是常规储能咨询也会进入 P1/black，增加人工确认与延迟；这是有意选择的漏报优先风险策略。
若业务未来需要 P2，必须引入结构化、可验证的安全确认事实与独立降级授权，不能恢复关键词 benign
白名单。回滚边界是这两个代码文件，但在出现物理安全假阴性时不得无审查回滚。

## 计划确认记录

- 批准人：业主通过连续“继续任务”授权按既定顺序处理悬挂 blocker
- 批准日期：2026-07-19
- 批准范围：最新远端上的最小 P17 修复、验证、Claude 复审、GO 后 D6 发布
- 明确未批准：混合旧分支整体合入、绕过 Claude/D6、修复范围外问题

## 验收标准

1. 旧实现上新增安全测试必须 RED，证明缺陷真实存在。
2. 修复后爆炸/起火/热失控前兆为 P0/black；其他储能输入为 P1/black。
3. P0/P1 均满足现有 `needs_signoff()`，工部不读取陈旧严重度缓存。
4. 聚焦、全量后端、三层 doctor 与 diff check 全绿。
5. Claude Code 对固定 B/H 独立复审 GO 后才可构造 D6 no-ff 候选。

## 验证计划

- `python3 -m pytest -q backend/tests/test_real_department_engines.py -k gongbu -p no:randomly`
- `python3 -m pytest -q backend/tests/test_real_department_engines.py backend/tests/test_signoff_gate.py backend/tests/test_automation_tier.py -p no:randomly`
- `python3 -m pytest -q backend/tests -p no:randomly`
- 三层 harness doctor、`git diff --check`、Claude 精确 SHA review、D6 verifier。
