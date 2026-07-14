# CI 摘要：test-tenant-sqlite-production-db-tripwire-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q tests/test_production_db_tripwire.py`（实现前） | 1 | 3 passed / 2 failed，有效 RED；连接替身阻止真实连接 | import path + pre-connect guard | 2026-07-14 终端 |
| 同命令（实现后） | 0 | 5 passed | tenant + SQLAlchemy 双门 | 2026-07-14 终端 |
| tripwire + auth/invite/admin/tenant 组合 | 0 | 31 passed | legacy sqlite3 正常业务兼容 | 2026-07-14 终端 |
| `python3 -m pytest -q` | 1 | 2481 passed / 13 failed / 27 skipped / 9 xfailed；13 项与上轮基线清单一致，无 tenant tripwire failure | 完整 backend 回归 | 273.85s，2026-07-14 终端 |
| 真实 DB 前后快照 | 0 | SHA/size/mtime 完全一致 | 无真实库污染 | 2026-07-14 终端 |
| `python3 -m py_compile ...` | 0 | 3 个 Python 变更文件可编译 | 静态语法 | 2026-07-14 终端 |
| `python3 -m ruff check ...` | 1 | 环境未安装 ruff，非有效 lint 结果 | lint | `No module named ruff` |
| 取消 DB 环境变量后仅导入 `src.tenant` | 0 | 默认路径仍是 `backend/data/fengqun.db`；未建立连接 | 生产默认兼容性 | 2026-07-14 终端 |
| `python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | 后端 harness | 2026-07-14 终端 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根级 harness/change | 2026-07-14 终端 |
| `python3 scripts/commit_closeout_check.py` | 0 | 暂存区无运行产物；仅列出脏工作区人工确认项 | 提交边界 | 2026-07-14 终端 |

## 结果

- S2.3b `VERIFIED_COMPLETE`：pytest collection-time 默认绑定临时 tenant DB，runtime 在真实路径连接前 fail closed。
- 真实 DB 保持 `10dbcf48d3fb4c6a5297bd2f42b73c030d9db7a79c1e0e47734df5dac60859e2`、size `2121728`、mtime `1783863664`。

## 未验证项

- 通用裸 `sqlite3.connect`、Node/E2E、scripts 仍未阻断，归入 S2.3c。
- 完整套件 13 个既有/环境失败尚未修复；本轮不扩大范围。
- ruff 未安装；已用 `py_compile`、pytest 与 doctor 验证，但本轮没有有效 lint 证据。

## Diff 与回滚复核

- changed files：tenant runtime 配置/测试门、pytest pre-import 配置、2 条 tripwire test、根 change 与 launch blueprint。
- diff review：默认生产路径不变；测试门只在显式环境变量为 `1` 时生效；无 bypass allowlist、无数据写入。
- 回滚是否演练：未部署；单提交可反向回滚，无 schema/data 回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 有效且安全的 RED | 2 failures；`sqlite3.connect` 被替身拦截 | PASS |
| import-time 临时绑定 | tenant path test | PASS |
| connection-time fail closed | guard test；连接替身未被调用 | PASS |
| legacy auth/tenant 兼容 | 31 passed | PASS |
| 完整回归无新增失败 | 2481 passed；13 项与上轮失败清单一致 | PASS |
| 真实 DB 不变 | SHA/size/mtime 前后一致 | PASS |
| 通用 sqlite3/Node/E2E | 未在本闭环范围 | NOT VERIFIED |

## 声明状态

- `VERIFIED_COMPLETE`：仅指 S2.3b pytest `src.tenant` tripwire；S2 全阶段与生产发布仍未完成。
