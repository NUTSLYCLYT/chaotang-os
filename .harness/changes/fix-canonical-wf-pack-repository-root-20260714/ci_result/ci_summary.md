# CI 摘要：fix-canonical-wf-pack-repository-root-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| focused repository source test（实施前） | 1 | RED：旧 hardcoded REPO 未按文件定位 | 旧入口会绕过 monorepo | 2026-07-14 终端 |
| focused repository source test（实施后） | 0 | 1/1 passed | canonical backend root + 禁止旧路径 | 2026-07-14 终端 |
| wf source + pack cost validator/report/sizing pytest | 0 | 31 passed | 路径契约与 pack 确定性业务闸 | 2026-07-14 终端 |
| 正式下旨主链 6 文件 pytest | 0 | 43 passed, 1 deselected | task/event/candidate+final memorial/decision/archive | 2026-07-14 终端 |
| `python3 scripts/harness_doctor.py` | 0 | 0 errors / 0 warnings | 后端 harness | 2026-07-14 终端 |
| capability governance test | 0 | 2/2 passed | inventory/14 天删除门 | 2026-07-14 终端 |
| `pnpm exec tsc --noEmit` + real-mode build | 0 | PASS，31 routes | 前端集成/build | 2026-07-14 终端 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 三层 harness/change records | 2026-07-14 终端 |
| scoped diff/secret scan | 0 | PASS | 候选 diff、敏感值边界 | 2026-07-14 终端 |
| `pnpm prod:doctor -- --json` | 2 | 预期 STOP：foreign 3050 + missing immutable builds | 不误报生产 READY | 2026-07-14 终端 |

## 结果

- 本次 repository-root 纵切 `VERIFIED_COMPLETE`。
- S1 inventory 中三个旧入口均完成迁移并进入观察；这不等于可删除或生产 READY。

## 未验证项

- 仓库内未找到可复现的 `export meta`/`phase`/`agent` DSL runner，因此未执行完整高成本工作流，也未验证 runner 对 ESM file URL 的实际装载。
- 未调用 provider、未生成新 pack run、未重启 8081。
- runtime telemetry sink 未实施；调用量仍为 `null`。JWT 401 运行身份差异仍是独立发布阻断。

## Diff 与回滚复核

- changed files：workflow root/test、capability inventory、launch blueprint、root change record。
- diff review：只改变 REPO 求值和注释；phase/schema/prompt/restart/validator 均未改；无秘密值。
- 回滚是否演练：未部署；可反向恢复单提交。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 每旧入口至少 1 RED→GREEN | focused test RED -> 1 passed | PASS |
| pack 确定性闸无回归 | 31 passed | PASS |
| 正式业务六阶段无回归 | 43 passed | PASS |
| 三个旧入口均不再 MIGRATE_REQUIRED | capability test 2/2 | PASS |
| 完整 wf runner 执行 | runner 不在仓库内 | NOT VERIFIED |
| 生产发布 | JWT/foreign 3050/immutable identity | STOP |

## 声明状态

- `VERIFIED_COMPLETE`：仅指 repository-root 纵切与 S1 已登记旧路径清零；全局发布仍 `NOT_READY`。
