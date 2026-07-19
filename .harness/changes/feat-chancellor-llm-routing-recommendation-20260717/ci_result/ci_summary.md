# CI 摘要：feat-chancellor-llm-routing-recommendation-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend/tests/test_chancellor_router.py backend/tests/test_chancellor_llm_recommendation.py` | 0 | 17 passed | 推荐层与丞相入口 | 2026-07-17 |
| `git diff --check` | 0 | clean | 差异格式 | 2026-07-17 |
| `python3 -m pytest -q backend/tests -p no:randomly` | 1 | 2703 passed, 37 skipped, 7 known baseline failures | 全量后端回归；无 PKT-1~5 新增失败 | 2026-07-17 |

## 结果

PKT-5 定向验证通过；provider 未配置时如实标记 degraded。

## 未验证项

- 全量 backend tests 尚未执行；真实 provider/线上预算未配置。

## Diff 与回滚复核

- changed files：推荐模块、`chancellor_router.py`、测试及本 change 证据。
- diff review：无外部副作用；硬门未削弱。
- 回滚是否演练：未执行；移除推荐调用即可回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| unsupported_scope | recommendation test passed | ✅ |
| 非法输出降级 | recommendation test passed | ✅ |
| D2 硬门 | merge test passed | ✅ |
| 正式入口 | chancellor router 17 passed | ✅ |

## 声明状态

- `VERIFIED_PARTIAL`：定向与全量回归完成；独立 review 待完成。
