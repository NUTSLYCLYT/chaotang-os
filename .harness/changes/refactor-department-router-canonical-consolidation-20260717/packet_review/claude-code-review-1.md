# 独立复审：refactor-department-router-canonical-consolidation-20260717

| 项 | 值 |
| --- | --- |
| 复审者 | Claude Code（本会话），只读复审，未改动被审对象 |
| 被审 commit | `3450277 refactor: consolidate department routing keywords` |
| 结论 | **NO_GO（1 项 HIGH 回归，未在自身测试中暴露）** |

## 复审做了什么（实测，非转述）

1. 读 `3450277` 全 diff（`shangshufang_loop.py`/`departments.yaml`/`chaotang_department_router.py`）。
2. 直接跑代码验证行为（不是只读 diff）：

```python
from src.shangshufang_loop import infer_departments, DEPARTMENT_RULES
print('锦衣卫 in DEPARTMENT_RULES:', '锦衣卫' in DEPARTMENT_RULES)
# → False
print(infer_departments('这条情报的信源可信度存疑，需要查证是不是谣言'))
# → ['户部', '工部']
print(infer_departments('请锦衣卫查一下这个供应商的背景'))
# → ['户部', '工部']
```

## Finding（HIGH）

`_department_rules_from_canonical()`（`shangshufang_loop.py`）只遍历
`CANONICAL_MINISTRY_IDS`（六部），锦衣卫是专署、不在此列表。旧的手写
`DEPARTMENT_RULES["锦衣卫"]`（keywords=情报/核实/可信度/信源/谣言/线报/传闻/查证）
在这次重构里被删除且**没有替代路径**接住。

后果：
- 关键词匹配路径：锦衣卫关键词全部命中 0 → 触发 `infer_departments` 第170行左右
  的硬编码兜底 `["户部", "工部"]`。
- 新增的显式点名匹配（本次改动同时加的
  `explicit = [dept for dept in DEPARTMENT_RULES if dept in question]`）同样救不回来，
  因为"锦衣卫"这个 key 已经不在 `DEPARTMENT_RULES` 里，显式点名"请锦衣卫"也匹配不到。

这精确复现了本仓库这几天一直在追的"世界杯 bug"根因类型：零匹配 → 硬塞户部+工部 →
两部真实引擎不命中 → 退化成 LLM 顶人设瞎答。区别是这次是重构**制造**了一个新的
零匹配案例，不是原有 bug 复发。

## 为什么 29 passed 没挡住

`ci_summary.md` 命令：`test_shangshufang_loop_api.py`/`test_chaotang_department_router.py`/
`test_department_identity_ssot.py`——三个文件全仓 grep "锦衣卫" 零命中，没有任何现有
测试断言锦衣卫的路由匹配行为。这不是测试跑错，是这个场景从来没被测试覆盖过，
重构删掉一条没测试保护的路径，静默通过。

## Blocker

**是**。锦衣卫路由能力在合入 ext 前必须补回，且必须新增一条回归测试锁定
（例如 `infer_departments('信源可信度核查')` 断言结果含 `锦衣卫`），不能只补数据
不补测试，否则下次重构又会静默丢一次。

## 建议修法方向（供 Codex 参考，不是本复审的裁决范围）

`_DEPARTMENT_FOCUS`/`_department_rules_from_canonical()` 只覆盖
`CANONICAL_MINISTRY_IDS`（六部）是设计上的选择——锦衣卫/钦天监是专署，不在六部
canonical registry 里，这个边界本身可能是对的。缺的是：专署的路由关键词也需要一个
canonical 来源（departments.yaml 里锦衣卫/钦天监条目是否有 `routing_keywords`？
若有，`DEPARTMENT_RULES` 的生成函数应该同时并入六部+专署两类；若无，需要先给专署
补 canonical 关键词登记，再接回来），不能让专署路由退回硬编码字典或者干脆消失。

*复审范围：仅本 commit 引入的锦衣卫路由回归。未对本 commit 之外的其他变更做复审。*
