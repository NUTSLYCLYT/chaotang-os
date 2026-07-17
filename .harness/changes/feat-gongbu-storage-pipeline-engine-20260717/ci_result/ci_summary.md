# CI 摘要：feat-gongbu-storage-pipeline-engine-20260717

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q backend/tests/test_real_department_engines.py` | 0 | 48 passed | 工部适配器及共享注册表 | 2026-07-17 |
| `python3 .claude/skills/dept-capability-map/scripts/audit.py` | 0 | 工部 `adapt_gongbu` | 能力图谱 | 2026-07-17 |
| `python3 backend/scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | 后端护栏 | 2026-07-17 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 根护栏 | 2026-07-17 |
| `git diff --check` | 0 | clean | 差异格式 | 2026-07-17 |
| `python3 -m pytest -q backend/tests -p no:randomly` | 1 | 2703 passed, 37 skipped, 7 known baseline failures | 全量后端回归；无 PKT-1~5 新增失败 | 2026-07-17 |

## 结果

PKT-1 定向验证通过；全量 backend tests 尚未在本轮执行。

## 未验证项

- 未执行全量后端测试；未接入真实 MCP/工单系统。

## Diff 与回滚复核

- changed files：`backend/src/real_department_engines.py`、`backend/tests/test_real_department_engines.py`、本 change 证据。
- diff review：已检查，无生产数据库/外部写入。
- 回滚是否演练：未执行；删除适配器及注册映射即可回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 工部真实引擎注册 | audit 显示 `adapt_gongbu` | ✅ |
| 五阶段 RED→GREEN | 48 tests passed | ✅ |
| 无新增共享引擎回归 | test_real_department_engines 全绿 | ✅ |

## 声明状态

- `VERIFIED_PARTIAL`：PKT-1 定向验证完成；全量回归无新增失败，但独立 Packet review 待完成。
