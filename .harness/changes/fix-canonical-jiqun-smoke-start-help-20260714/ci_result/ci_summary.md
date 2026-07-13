# CI 摘要：fix-canonical-jiqun-smoke-start-help-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| focused smoke test（实施前） | 1 | RED：新增 help contract 失败，输出旧绝对路径/direct uvicorn | 证明旧入口真实存在 | 2026-07-14 终端 |
| focused smoke test（实施后） | 0 | 2/2 passed | auth token 既有断言 + canonical DOWN help | 2026-07-14 终端 |
| port 9 forced-DOWN CLI | 0 | 5 SKIP；打印 `cd ../backend && bash scripts/serve-dev.sh` | 实际 failure-path 输出/exit | 2026-07-14 终端 |
| canonical 8081 live smoke（无 token / backend `.env` token） | 1 | health PASS；4 个受保护端点均 401 | 发现运行进程 JWT 与候选 shell 不一致 | 2026-07-14 终端 |
| `pnpm exec tsc --noEmit` | 0 | PASS | 前端类型 | 2026-07-14 终端 |
| `pnpm build`（无 real mode） | 1 | 正确 fail closed：缺 `NEXT_PUBLIC_API_MODE=real` | 构建诚实门 | 2026-07-14 终端 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | PASS，31 routes | real-mode production build | 2026-07-14 终端 |
| 正式下旨主链 6 文件 pytest | 0 | 43 passed, 1 deselected | task/event/candidate+final memorial/decision/archive | 2026-07-14 终端 |
| capability governance test | 0 | 2/2 passed | inventory 仍禁止无遥测删除 | 2026-07-14 终端 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 三层 harness 与 change record | 2026-07-14 终端 |
| scoped diff/secret scan | 0 | PASS | 候选 diff、敏感值边界 | 2026-07-14 终端 |
| `pnpm prod:doctor -- --json` | 2 | 预期 STOP：foreign 3050 + missing immutable builds | 不误报生产 READY | 2026-07-14 终端 |

## 结果

- 本次 DOWN help 行为 `VERIFIED_COMPLETE`：RED→GREEN 且实际 forced-DOWN 输出成立。
- 候选不具备生产发布资格：真实 8081 protected smoke 暴露 JWT 运行配置不一致，生产仍须 STOP。

## 未验证项

- 运行中 8081 的 JWT secret/credential authority 与当前 canonical backend `.env` 不一致；本纵切不读取进程秘密、不越权修复认证。
- runtime entry telemetry sink 未实施，调用量仍为 `null`。
- 无 UI 行为，未做浏览器验证；未运行 30 条黄金旨意。

## Diff 与回滚复核

- changed files：smoke 实现/测试、inventory、root/frontend change records、launch blueprint。
- diff review：不改 HTTP contracts、认证、超时、SKIP 返回结构或 backend launcher；无秘密值。
- 回滚是否演练：未部署；可反向恢复单提交。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 每个旧入口至少 1 RED→GREEN | 新增 help test 1 RED -> GREEN | PASS |
| failure path 真实输出正确 | port 9 CLI exit 0 / canonical launcher | PASS |
| 正式业务六阶段无回归 | 43 passed | PASS |
| 旧入口不被误删 | inventory 2/2 | PASS |
| 生产发布门全部通过 | live protected smoke 4×401 | FAIL / STOP |

## 声明状态

- `VERIFIED_COMPLETE`：仅指 smoke DOWN help 纵切；release verification 为 `NOT_READY`。
