# CI 摘要：fix-p4-5-semantic-freeze-20260716

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `python3 -m pytest -q tests/test_emperor_decision_kind.py`（实现前） | 1 | 3 failed（预期 RED） | 映射模块、6 写入口、模型约束均缺失 | 本地终端，2026-07-16 |
| 同命令（实现后） | 0 | 3 passed | action→kind、未知 fail closed、AST 写入口、模型约束 | 本地终端，2026-07-16 |
| 4 个相关 API 测试文件 | 0 | 28 passed | 上书房、朝堂奏折、兼容入口回归 | 本地终端，2026-07-16 |
| 专用 Alembic 1.18.5 + 临时旧库 011→012→011 | 0 | PASS | 回填、非 NULL/check、约束拒绝、降级 | `/tmp` 临时库，已清理，2026-07-16 |
| 专用 Alembic + 未知 action 临时库 | 0 | 按预期升级失败 | 未知历史语义 fail closed | `/tmp` 临时库，已清理，2026-07-16 |
| 专用 Alembic + 空库 `upgrade head` | 0 | PASS，head=012 | 004b 已带最终模型列时的幂等路径 | `/tmp` 临时库，已清理，2026-07-16 |
| `python3 -m compileall -q ...` | 0 | PASS | 变更 Python 语法 | 本地终端，2026-07-16 |
| `python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | 后端 harness 完整性 | 本地终端，2026-07-16 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 根级边界与两线委托检查 | 本地终端，2026-07-16 |
| `pytest tests/test_execution_state_projection.py`（实现前） | 1 | 5 failed（预期 RED） | 派生器、失败/回执终态缺失 | 本地终端，2026-07-16 |
| 三套 execution-state 读模型测试（接线前） | 1 | 6 failed（预期 RED） | 上书房、task detail、SSE 尚未暴露派生语义 | 本地终端，2026-07-16 |
| P4.5a-b 相关后端 13 文件 | 0 | 82 passed | 词表、attempt、工件、worker、两套读模型与相邻回归 | 本地终端，2026-07-16 |
| frontend chancellor-routing nodetest | 0 | 4 passed | TS/Zod 镜像契约 | `NODE_PATH` 指向主工作区依赖，只读复用，2026-07-16 |
| P4.5b backend/root doctor | 0 | 0 errors / 0 warnings | 后端与根级边界 | 本地终端，2026-07-16 |
| `pytest tests/test_swarm_quality_gate_seam.py`（实现前） | 1 | 2 failed（预期 RED） | seam 缺失、生产者仍直连 review | 本地终端，2026-07-16 |
| seam + review + distillation | 0 | 12 passed | 行为快照与兼容 re-export | 本地终端，2026-07-16 |
| swarm execution API + perf wiring | 0 | 12 passed | 生产调用链零行为漂移 | 64.37s，本地终端，2026-07-16 |
| CourtReview inventory（实现前） | 2 | 1 collection error（预期 RED） | 冻结清单模块缺失 | brew Python 3.14，2026-07-16 |
| CourtReview inventory | 0 | 1 passed | 生产 AST 路径/函数/数量 multiset，总数 8 | brew Python 3.14，2026-07-16 |
| CourtReview 事实链相邻回归 7 文件 | 0 | 42 passed | canonical dispatch、上书房循环、账本与终奏门 | 6.51s，2026-07-16 |
| DepartmentOpinionV1 投影（实现前） | 1 | 2 failed（预期 RED） | memorial 尚无 `department_memorials` | brew Python 3.14，2026-07-16 |
| DepartmentOpinionV1 契约 | 0 | 7 passed | 严格 JSON Schema、映射表、逐部门来源、fail closed | 3.00s，2026-07-16 |
| P4.5e 相关后端 5 文件 | 0 | 41 passed | 投影、持久化/status、review/seam、上书房 API | 79.04s，2026-07-16 |
| final memorial gate | 0 | 8 passed | 新投影随正式奏折安全快照 | 3.27s，2026-07-16 |
| 前端 canonical 消费者 3 文件 | 0 | 22 passed | 军机处读模型、上书房视图、live bridge | tsx nodetest，2026-07-16 |
| P4.5e ruff + py_compile | 0 | PASS | 3 个变更 Python 文件 | 本地终端，2026-07-16 |

## 结果

P4.5a-e VERIFIED；P4.5 全包仍在进行中。

## 未验证项

- 系统 Python 缺 Alembic，pytest 迁移文件收集为 1 skipped；已用仓库现有 `.venv-alembic` 对同等场景取得真实执行证据。
- P4.5f 与全包独立审查尚未执行；收口时仍须重跑 doctor。
- ministry output YAML/validator 与可执行 JSON Schema/TS 类型的既有漂移已记录，另立变更处理。

## Diff 与回滚复核

- changed files：P4.5a-e 的语义 helper/model、生产接线、012、ADR/冻结清单、定向测试与本变更记录。
- diff review：`git diff --check` 与 compileall 通过；提交前再审。
- 回滚是否演练：临时库 012→011 已通过；未对真实库执行。
- 真实库指纹：前后均为 size `2121728`、mtime `1783863664`、inode `302265`、SHA-256 `10dbcf48d3fb4c6a5297bd2f42b73c030d9db7a79c1e0e47734df5dac60859e2`。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| P4.5a 三值语义冻结 | 3 个契约测试 + 28 个 API 回归 | PASS |
| 012 旧库安全与未知值阻断 | 临时旧库 upgrade/downgrade | PASS |
| 012 空库链兼容 | 空库 upgrade head | PASS |
| 不触碰真实库 | 四元指纹 + SHA-256 相同 | PASS |
| P4.5b attempt/工件双证 | 六路径 + 全组合唯一命中 + worker/stale 终态 | PASS |
| 两套读模型一致 | 上书房、朝堂 task detail、canonical SSE | PASS |
| P4.5c 质量门归属 | AST import/definition 守门 + 24 个行为回归 | PASS |
| P4.5d writer 基线 | 独立 AST multiset + 42 个相邻回归 | PASS |
| P4.5e 完整意见投影 | 严格 schema 7 tests + 后端 49 tests + 前端 22 tests | PASS |

## 声明状态

- `VERIFIED_PARTIAL`：P4.5a-e 完成；全包未完成。
