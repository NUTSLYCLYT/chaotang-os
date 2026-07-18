# Packet Review：P6.4 PKT-2/PKT-3/PKT-5 合并 + P6 测试隔离 + council usage tracker

| 项 | 值 |
| --- | --- |
| 复审者 | Claude Code（本会话），独立实测，非转述 |
| 被审内容 | 见 `summary.md` 范围段 |
| Predecessor | `6069a13fc685d6067fd2b215937e955fb6c3cf3a`（origin/feature-chaotang-ext） |
| Reviewed head | `9daa3917d5972aa53d8ba5dee2fe5c27e28d8fc7` |

## 复审历史（本会话内已完成，本次是最终整合确认）

### PKT-2 路由关键词收口
初版有 HIGH 回归：`DEPARTMENT_RULES` 改为 `_department_rules_from_canonical()` 后，
锦衣卫（专署，不在 `CANONICAL_MINISTRY_IDS` 六部范围）关键词条目被删除且无替代
路径。已提交独立 NO_GO（本会话此前记录，原文件未随本次合并单独携带，结论并入
本报告）。

### PKT-3 门下省路由否决关卡
`menxia_veto.py::_route_has_scope_evidence()` 继承 PKT-2 同一根因，对正确的锦衣卫
路由给出错误封驳（`封驳`，理由"不属于任何部门真实职责范围"）。已提交独立 NO_GO
（同上）。

### 修复与验证
`df21744`（原始序列）在 `department_identity.py` 补齐专署 canonical 关键词投影，
同时修复 PKT-2 与 PKT-3。本会话独立实测（非读 diff）：

```python
from src.shangshufang_loop import infer_departments
from src.menxia_veto import review_route
infer_departments('这条情报的信源可信度存疑，需要查证是不是谣言')  # -> ['锦衣卫']
review_route({'departments': ['锦衣卫']}, '...同上...')['verdict']  # -> '准奏'
```
两处均已确认修复，本次在独立 worktree 中重新验证一致（干净结果，非缓存）。

### PKT-5 丞相 LLM 推荐层
不引用 canonical registry，与 PKT-2/PKT-3 缺口无关，独立 GO（本会话已记录）。
`test_unsupported_scope_is_structured` 用本次调查起点原句"我要去美国看世界杯
决赛"回归验证 `unsupported_scope` 结构化输出。生产路径 `call_fn` 未接线，如实
降级，未夸大为已生效。

### P6 测试隔离
`FENGQUN_RUNTIME_ROOT` 隔离缺口（裸 pytest 曾真实写入 `backend/var/data/
fengqun.db`）已修复，回归守卫覆盖全部 10 个已知冻结路径模块（而非仅
`kpi_tracker`），并有裸子进程验证证明隔离是 load-bearing（非 vacuously green）。

### council_persona_usage.py
新增顾问人格使用统计追踪，含 3 轮 fail-closed 加固（非 dict JSON 防护、缺失/损坏
`run_meta.json` 防护、pytest 污染 run 过滤）。

### 全量回归
`2703 passed / 37 skipped / 7 known baseline failures`（对齐既有基线，无新增）。
另发现一项全量套件下的概率性失败（`pytest-randomly` 随机顺序偶发触发2项
golden case 失败），已定位根因（随机顺序 + 某测试遗留共享状态），非本批逻辑
错误，`-p no:randomly` 可稳定复现干净结果。

## Blockers

无——已知问题均已确认修复并本会话独立复测。

## 裁决

PACKET_REVIEW_GO
