# CI 摘要：refactor-chaotang-endpoint-absorb-20260715

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q tests/test_scribe_lessons.py tests/test_scribe_archive_docs.py tests/test_court_flywheel_button.py`（实现前） | 1 | 6 failed / 5 passed（预期 RED） | 旧实现未读 canonical、仍依赖旧双读 | 2026-07-15 本地终端 |
| `python3 -m pytest -q tests/test_scribe_lessons.py tests/test_scribe_archive_docs.py tests/test_court_flywheel_button.py tests/test_shiguan_page_contract.py tests/test_shiguan_unified_read.py` | 0 | 22 passed | P3a 正常/失败/权限/租户/重复归档、相邻史馆契约 | 2026-07-15 本地终端 |
| `python3 -m py_compile ... && python3 -m pytest -q tests/test_final_memorial_gate.py tests/test_chaotang_memorials.py tests/test_contract_alignment_p0.py tests/test_commercial_loop_harness.py tests/test_legal_redteam_harness.py` | 0 | compile PASS；65 passed | canonical 正式奏折、旧契约、两组 golden harness | 2026-07-15 本地终端 |
| `frontend/node_modules/.bin/tsx --test .../court-doc-adapter.nodetest.ts .../shiguan-view-model.nodetest.ts` | 0 | 3 passed | 前端 CourtDoc adapter 同形消费 | 2026-07-15 本地终端 |
| 根 / backend / frontend harness doctor | 0 | 三层均 0 errors / 0 warnings | 护栏结构与边界 | 2026-07-15 本地终端 |

## 结果

P3a 聚焦与相邻回归全绿；P3 整包仍为部分验证，P3b–P3e 未执行。

## 未验证项

- backend/frontend 全量与全仓 API contract 生成式 audit 留到 P3e 汇总；P3a 已跑接口
  精确/相邻契约、前端 adapter 与代表性 golden harness。
- 项目环境未安装 `ruff` / `black`；用 `py_compile`、`diff --check` 与现有 pytest 代替，
  此项不构成产品门禁缺失。

## Diff 与回滚复核

- changed files：P3a 生产文件 1、测试 3、根 change 证据。
- diff review：`git diff --check` 通过；`scribe.py` 旧依赖 grep 为 0；changed-files 未含
  `throne.py` 或 `backend/src/db/flow_store.py`。
- 回滚是否演练：未演练；P3a 单 commit 可精确 revert。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| canonical 单读源 | canonical projection tests + structural grep | PASS |
| 正常/失败/权限 | focused pytest | PASS |
| 冻结王座不修改 | changed-files + deferred record | PASS |
| 整个 P3 完成 | P3b–P3e | PENDING |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：VERIFIED_PARTIAL
