# 独立复审：feat-menxiasheng-routing-veto-20260717

| 项 | 值 |
| --- | --- |
| 复审者 | Claude Code（本会话），只读复审，未改动被审对象 |
| 被审 commit | `58c5693 feat: add menxia routing veto gate` |
| 结论 | **NO_GO（继承自 PKT-2 的同一根因，症状更严重）** |

## 复审做了什么（实测）

`menxia_veto.py::_route_has_scope_evidence()` 判断"这单是不是真的在候选部门职责
范围内"，依据 `runtime_projection("routing_keywords")`——跟
`refactor-department-router-canonical-consolidation-20260717`（见该 change 的
`packet_review/claude-code-review-1.md`）同一个数据源，同一个只覆盖
`CANONICAL_MINISTRY_IDS`（六部）的边界。

实测：

```python
from src.menxia_veto import review_route
route = {'departments': ['锦衣卫']}
result = review_route(route, '这条情报的信源可信度存疑，需要查证是不是谣言')
# → verdict: '封驳'，veto_reasons: ['不属于任何部门真实职责范围，不能顶着部门人设执行']
```

这是一个**真实、正确、关键词完全命中的锦衣卫任务**，被门下省错误封驳。

## 为什么比 PKT-2 的问题更严重

PKT-2 的回归是"锦衣卫路由不到"（静默降级，用户看不出发生了什么，只会收到一份
挂错部门的回奏）。PKT-3 这个是"就算路由对了，门下省也会主动否决"——门下省的设计
初衷就是"专职挑刺、独立于丞相判断"，现在它对锦衣卫**永远**给出"不属于任何部门职责"
这个错误理由，因为它的证据检查函数天生看不到专署的关键词。两个 bug 同源
（专署未纳入 canonical 关键词投影），但 PKT-3 这个如果单独存在（假设 PKT-2 以后被
修复、锦衣卫又能被正确路由），会立刻显形成一个新故障：锦衣卫任务全部被门下省
挡下，丞相要重判 3 轮才能强制通过。

## Blocker

**是**，且建议与 PKT-2 的修复合并处理，不要分别打补丁——两处用的是同一个
`runtime_projection("routing_keywords")` 数据源，专署的 canonical 关键词一旦补齐，
`shangshufang_loop.py` 和 `menxia_veto.py` 应该同时受益，不要各修各的产生新的
不同步。

## 范围外观察（非 blocker）

同批 `2dbeca7`（PKT-4 反幻觉铁律）实现质量良好，`DEPARTMENT_ANTI_HALLUCINATION_CLAUSE`
确认被追加进六部人设且有测试锁定。该 commit 额外给多位阁员人设加了具名视角
（卡尼曼/塔勒布/德鲁克/芒格/马克斯/格鲁夫/谢尔/高汀），这不在原 PKT-4 spec 范围内，
不是 bug，但属于范围外扩展，供业主知悉。

*复审范围：仅本 commit 的 scope-evidence 逻辑。未复审 `review_route` 之外的其余
门下省接线（是否已真的插入 `chancellor_decide_route` 和军机处派单之间）。*
