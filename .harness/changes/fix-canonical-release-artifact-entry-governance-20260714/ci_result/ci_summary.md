# CI 摘要：fix-canonical-release-artifact-entry-governance-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| package identity test（实施前） | 1 | RED：旧 `chaotang-web-lyt` 命中 | 旧发布入口绕过 canonical identity | 2026-07-14 终端 |
| package identity test（实施后） | 0 | 1/1 GREEN | canonical source contract | 2026-07-14 终端 |
| capability governance test（实施前） | 1 | RED：2/2，manifest 字段与 inventory 缺失 | harness 治理缺口 | 2026-07-14 终端 |
| capability governance test（实施后） | 0 | 2/2 GREEN | inventory、event、14 天删除门 | 2026-07-14 终端 |
| `pnpm exec tsc --noEmit` | 0 | PASS | 前端类型 | 2026-07-14 终端 |
| `node --check` 两个 package 脚本 | 0 | PASS | Node 语法 | 2026-07-14 终端 |
| `BASE_PATH=/chaotang ... pnpm package:release` | 0 | PASS：31 路由、3089 entries；tar/manifest 为 canonical identity | 实际 release package | 2026-07-14 终端/本地 gitignored artifact |
| 正式下旨主链 6 文件 pytest | 0 | 43 passed, 1 deselected | task/event/candidate+final memorial/decision/archive | 2026-07-14 终端 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 三层 harness | 2026-07-14 终端 |
| `pnpm exec eslint ...` | 254 | NOT AVAILABLE：仓库未安装 eslint command | lint 未验证 | 2026-07-14 终端 |
| `pnpm prod:doctor -- --json` | 2 | 预期 STOP：foreign 3050 + missing immutable builds | 不误报生产 READY | 2026-07-14 终端 |

## 结果

- 本最小纵切 `VERIFIED_COMPLETE`；真实 package identity 已验证。
- 业务六阶段主链没有回归，但本轮不是黄金旨意质量发布门。

## 未验证项

- runtime telemetry sink 未实施，调用量为未知而不是零。
- 未执行浏览器验证：无 UI 变化。
- 未运行 30 条黄金旨意；必须在发布前独立完成。
- lint 命令不可用；以 TypeScript、Node check、测试和真实 build 覆盖，未伪报 lint PASS。

## Diff 与回滚复核

- changed files：package identity/test、根 capability governance、change records、launch blueprint。
- diff review：不含并行用户改动；无秘密值；没有运行时埋点或数据库变更。
- 回滚是否演练：未部署，未做生产回滚；可反向恢复单提交。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 每入口至少一条 RED→GREEN | package test 1 RED -> 1 GREEN | PASS |
| 清算表和 14 天门可机检 | governance 2 RED -> 2 GREEN + doctor | PASS |
| 纵切不破坏正式业务链 | 43 passed | PASS |
| 实际 artifact 使用 canonical identity | package/tar/manifest | PASS |
| 不误报上线 | prod doctor STOP | PASS |

## 声明状态

- `VERIFIED_COMPLETE`：仅指本次 release identity + harness governance 纵切；全局仍 STOP。
