# CI 摘要：fix-gongbu-component-scope-p18-20260719

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| 4 个精确回归（实现前） | 1 | 4 failed | 四条旁路 RED | P18 worktree / 2026-07-19 |
| 4 个精确回归（实现后） | 0 | 4 passed | 四路径闭环 | 同上 |
| 五文件跨模块聚焦 | 0 | 96 passed | engine/L4/YAML/router | 同上，68.73s |
| `python3 -m pytest -q backend/tests -p no:randomly` | 0 | 2789 passed, 37 skipped, 4 warnings | 后端全量 | 同上，288.22s |
| Claude v1 固定 SHA 复审 | 0 | 文本 GO，但含 F1=HIGH、F2=MEDIUM | 独立审查 | 本地隔离 R18=`a4b558b`；治理拒绝进入 D6 |
| v2 3 个精确负例（回修前） | 1 | 3 failed | 领域外假阳性 + canonical 不对称 | P18 worktree / 2026-07-19 |
| 原 4 条 + v2 3 条（回修后） | 0 | 7 passed | 安全边界双向回归 | 同上，4.08s |
| v2 五文件跨模块聚焦 | 0 | 99 passed | engine/L4/YAML/router | 同上，66.39s |
| v2 `python3 -m pytest -q backend/tests -p no:randomly` | 0 | 2792 passed, 37 skipped, 4 warnings | 后端全量 | 同上，270.43s |
| Claude v2 固定 SHA 复审 | 1（裁决） | PACKET_REVIEW_NO_GO：F1 HIGH + F2 MEDIUM | 独立审查 | H18-v2=`d48d207`；无 approval/commit |
| v3 3 个阻断回归（实现前） | 1 | 3 failed | 全文共现假阳性 + known/unknown 事实旁路 | P18 worktree / 2026-07-19 |
| v3 历次精确回归（实现后） | 0 | 9 passed | 三轮安全边界 | 同上，3.77s |
| v3 五文件跨模块聚焦 | 0 | 101 passed | engine/L4/YAML/router | 同上，65.04s |
| v3 `python3 -m pytest -q backend/tests -p no:randomly` | 0 | 2794 passed, 37 skipped, 4 warnings | 后端全量 | 同上，268.94s |
| Claude v3 固定 SHA 复审 | 1（裁决） | PACKET_REVIEW_NO_GO：review_plan route/run HIGH | 独立审查 | H18-v3=`2bb0319`；无 approval/commit |
| v4 review_plan 生产路径（实现前） | 1 | 1 failed：准奏≠复核 | 主循环参数传播 | P18 worktree / 2026-07-19 |
| v4 历次精确回归（实现后） | 0 | 10 passed | 四轮安全边界 | 同上，4.19s |
| v4 五文件跨模块聚焦 | 0 | 102 passed | engine/L4/YAML/router | 同上，68.31s |
| v4 `python3 -m pytest -q backend/tests -p no:randomly` | 0 | 2795 passed, 37 skipped, 4 warnings | 后端全量 | 同上，273.16s |
| `git diff --check` | 0 | clean | 候选补丁格式 | 同上 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 根级护栏 | 同上 |
| `python3 backend/scripts/harness_doctor.py` | 0 | 0 errors, 0 warnings | 后端护栏 | 同上 |
| `node frontend/scripts/harness-doctor.mjs` | 0 | 0 errors, 0 warnings | 前端护栏边界 | 同上 |

## 结果

v1 因 HIGH/GO 自相矛盾未进入 D6；v2/v3 独立复审均明确 NO_GO，同样未进入 D6。v4 已把
review_plan 旁路转成 1 条 RED 并修复，历次安全回归共 10 条全绿。4 warnings 与 P17 基线
一致：2 条 FastAPI duplicate operation ID、2 条 OpenClaw fallback 行为警告。v4 三层
doctor 复跑均为 0 errors / 0 warnings；等待 v4 Claude/D6，不宣称发布完成。

## 未验证项

- 未验证生产部署；D6 属本地可绕过 feedback，不是外部 required check。
- Claude v1/v2/v3 审查均不具发布资格；尚未执行 v4 固定 SHA 复审和 D6。

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
| v1 HIGH/F2 回修 | 3 RED → 7 passed + 99 passed | PASS |
| v2 后端无回归 | 2792/37/4/0 | PASS |
| v2 三层 doctors | 0 errors, 0 warnings | PASS |
| Claude v2 | F1 HIGH + F2 MEDIUM | NO_GO（已回修） |
| v3 blocker 回修 | 3 RED → 9 passed + 101 passed | PASS |
| v3 后端无回归 | 2794/37/4/0 | PASS |
| v3 三层 doctors | 0 errors, 0 warnings | PASS |
| Claude v3 | review_plan route/run HIGH | NO_GO（已回修） |
| v4 blocker 回修 | 1 RED → 10 passed + 102 passed | PASS |
| v4 后端无回归 | 2795/37/4/0 | PASS |
| v4 三层 doctors | 0 errors, 0 warnings | PASS |
| Claude v4 / D6 | 待执行 | PENDING |

## 声明状态

- `VERIFIED_PARTIAL`：v4 实现和后端全量已验证，v4 doctors/Claude/D6 尚未完成。
