# CI 摘要：feat-menxiasheng-routing-veto-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend/tests/test_menxia_veto.py backend/tests/test_chancellor_routing_service.py` | 0 | 8 passed | gate + 正式路由服务 | 2026-07-17 |
| `git diff --check` | 0 | clean | 差异格式 | 2026-07-17 |
| `python3 -m pytest -q backend/tests -p no:randomly` | 1 | 2703 passed, 37 skipped, 7 known baseline failures | 全量后端回归；无 PKT-1~5 新增失败 | 2026-07-17 |

## 结果

PKT-3 定向验证通过；封驳在服务边界转为人工确认，不继续自动派单。

## 未验证项

- `test_chancellor_golden_cases.py` 4 failures：PKT-2 关键词 canonical 收口后的既有基线漂移，未在本包修复。

## Diff 与回滚复核

- changed files：`menxia_veto.py`、`routing_service.py`、测试及本 change 证据。
- diff review：无外部副作用；无 schema 迁移。
- 回滚是否演练：未执行；feature flag 可关闭。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 世界杯封驳 | gate test passed | ✅ |
| 合同准奏 | gate test passed | ✅ |
| 正式服务接入 | routing service 5 passed | ✅ |
| 黄金路由全绿 | 4 个既有基线失败 | ⏳ |

## 声明状态

- `VERIFIED_PARTIAL`：PKT-3 定向与全量回归无新增失败；基于修复头的独立 review 待完成。
