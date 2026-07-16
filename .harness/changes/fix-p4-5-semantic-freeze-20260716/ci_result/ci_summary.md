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

## 结果

P4.5a VERIFIED；P4.5 全包仍在进行中。

## 未验证项

- 系统 Python 缺 Alembic，pytest 迁移文件收集为 1 skipped；已用仓库现有 `.venv-alembic` 对同等场景取得真实执行证据。
- P4.5b–f 与全包独立审查尚未执行；本步 doctor 已通过，收口时仍须重跑。

## Diff 与回滚复核

- changed files：P4.5a helper/model、6 个写入口、012、两份测试，以及本变更记录。
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

## 声明状态

- `VERIFIED_PARTIAL`：P4.5a 完成；全包未完成。
