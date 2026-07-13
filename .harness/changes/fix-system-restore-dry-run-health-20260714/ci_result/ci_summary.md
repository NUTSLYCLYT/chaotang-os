# CI 摘要：fix-system-restore-dry-run-health-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| 新 Node 测试（首次） | 1 | RED：unhealthy fixture 仍 exit 0、打印全部正常 | 跳过 HTTP 健康 | 2026-07-14 本地终端 |
| 新 Node 测试（端点修复后） | 1 | RED：healthy `ss` 仍全部误报未监听 | 端口证据 | 2026-07-14 本地终端 |
| 新 Node 测试（最终） | 0 | 2 passed | 健康/异常、无 restart、端口证据 | 2026-07-14 本地终端 |
| S1 联合 Node 回归 | 0 | 20 passed | deploy/service/operational/restore | 2026-07-14 本地终端 |
| 实际 `system-restore.sh --dry-run` | 0 | 五项端点/通路健康，四端口 LISTEN，无重启 | 本机运行证据 | 2026-07-14 本地终端 |
| 根/前/后 Harness Doctor | 0 | 0 errors, 0 warnings | 三层记录与边界 | 2026-07-14 本地终端 |
| `bash -n` | 0 | PASS | shell syntax | 2026-07-14 本地终端 |
| TypeScript + real-mode build | 0 | PASS | 前端候选构建 | 2026-07-14 本地终端 |
| `prod:doctor --json` | 2 | 预期 STOP：foreign 3050 + missing immutable builds | 生产身份门 | 2026-07-14 本地终端 |
| diff/secret/conflict scan | 0 | PASS | 精确候选差异 | 2026-07-14 本地终端 |

## 结果

最小闭环 GREEN。dry-run 现在真实探测端点，异常时返回非零，健康时 HTTP 与端口证据一致，且永不 restart。该结论不改变生产 STOP。

## 未验证项

- shellcheck 当前环境不可用；已运行 `bash -n` 与行为测试。
- 未测试正常模式的真实 restart；本轮未改其循环。
- 未接管 foreign 3050、未建立 immutable artifact 或外部信任锚。

## Diff 与回滚复核

- changed files：一个 shell 脚本、一个 Node 测试、根/前端 change records。
- diff review：只读健康分支与端口匹配；未带入并行部门路由改动。
- 回滚是否演练：无外部状态变更；可整体 revert 单提交。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| unhealthy dry-run fail closed | 首轮 RED + 最终 test case 1 | PASS |
| manual healthy process accepted | test case 2 | PASS |
| dry-run 不 restart | fake systemctl marker | PASS |
| HTTP 与端口证据一致 | test case 2 + 实际 dry-run | PASS |
| 候选工程门 | doctors、20 tests、type/build | PASS |
| 生产 READY | prod doctor STOP | NOT_READY（符合事实） |

## 声明状态

- `DRAFT / VERIFIED_PARTIAL / VERIFIED_COMPLETE / BLOCKED`：`VERIFIED_COMPLETE`（仅本闭环）
