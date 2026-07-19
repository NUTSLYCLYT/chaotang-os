# CI 摘要：fix-gongbu-component-scope-p18-20260719

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| 4 个精确回归（实现前） | 1 | 4 failed | 四条旁路 RED | P18 worktree / 2026-07-19 |
| 4 个精确回归（实现后） | 0 | 4 passed | 四路径闭环 | 同上 |
| 五文件跨模块聚焦 | 0 | 96 passed | engine/L4/YAML/router | 同上，68.73s |
| `python3 -m pytest -q backend/tests -p no:randomly` | 0 | 2789 passed, 37 skipped, 4 warnings | 后端全量 | 同上，288.22s |
| `git diff --check` | 0 | clean | 候选补丁格式 | 同上 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 根级护栏 | 同上 |
| `python3 backend/scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | 后端护栏 | 同上 |
| `node frontend/scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 前端护栏边界 | 同上 |

## 结果

实现、后端测试和三层 doctor 全绿。4 warnings 与 P17 基线一致：2 条 FastAPI duplicate
operation ID、2 条 OpenClaw fallback 行为警告。等待 Claude/D6，不宣称发布完成。

## 未验证项

- 未验证生产部署；D6 属本地可绕过 feedback，不是外部 required check。
- 尚未执行 Claude 固定 SHA 复审和 D6。

## Diff 与回滚复核

- changed files：6 个实现/配置/测试文件 + 4 个根 Harness 文件。
- diff review：无前端、数据库、provider、旧分支 ancestry。
- 回滚是否演练：未演练；安全旁路修复不得无审查回滚。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 四旁路真实 RED | 4 failed | PASS |
| 四路径修复 | 4 passed + 96 passed | PASS |
| 后端无回归 | 2789/37/4/0 | PASS |
| 三层 doctors | 0 errors, 0 warnings | PASS |
| Claude / D6 | 待执行 | PENDING |

## 声明状态

- `VERIFIED_PARTIAL`：实现和后端全量已验证，Claude/D6 尚未完成。
