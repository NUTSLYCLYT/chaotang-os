# CI 摘要：refactor-department-router-canonical-consolidation-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend/tests/test_shangshufang_loop_api.py backend/tests/test_chaotang_department_router.py backend/tests/test_department_identity_ssot.py` | 0 | 29 passed | 路由/SSOT/上书房回归 | 2026-07-17 |
| `git diff --check` | 0 | clean | 差异格式 | 2026-07-17 |
| `python3 -m pytest -q backend/tests -p no:randomly` | 1 | 2703 passed, 37 skipped, 7 known baseline failures | 全量后端回归；无 PKT-1~5 新增失败 | 2026-07-17 |

## 结果

PKT-2 定向验证通过；旧路由调用方已盘点并保留兼容层。

## 未验证项

- 全量 backend tests 尚未执行；能力审计脚本对动态投影仍有静态扫描误报。

## Diff 与回滚复核

- changed files：YAML、上书房路由、兼容路由及本 change 证据。
- diff review：未删除活调用方，无数据库/外部副作用。
- 回滚是否演练：未执行；恢复 YAML 与投影改动即可回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| canonical 关键词投影 | 29 passed + SSOT projection tests | ✅ |
| 旧调用方保留 | rg 盘点；兼容函数未删除 | ✅ |
| 全量无新增失败 | 尚未执行 | ⏳ |

## 声明状态

- `VERIFIED_PARTIAL`：定向回归完成，全量无新增失败；最新修复头需独立复审。
