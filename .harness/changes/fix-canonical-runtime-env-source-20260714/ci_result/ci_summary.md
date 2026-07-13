# CI 摘要：fix-canonical-runtime-env-source-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| `node --test scripts/runtime-env-source-contract.nodetest.mjs`（实施前） | 1 | RED：3/3 失败，三个消费者均命中 `jiqun_ai` | 证明旧 sibling/绝对路径真实存在 | 2026-07-14 本轮终端输出 |
| `node --test scripts/runtime-env-source-contract.nodetest.mjs`（实施后） | 0 | 3/3 通过 | canonical env discovery 契约 | 2026-07-14 本轮终端输出 |
| S1 deploy/service/operational/restore/runtime-env 联合 `node --test` | 0 | 23/23 通过 | S1 已有路径门与本次回归 | 2026-07-14 本轮终端输出 |
| `node --check scripts/next-with-base-path.mjs scripts/prod-release-gate.mjs` | 0 | 通过 | 两个运行脚本语法 | 2026-07-14 本轮终端输出 |
| `pnpm exec tsc --noEmit` 与 real-mode `next build --webpack` | 0 | TypeScript 与 31 路由构建通过 | 前端静态契约、生产候选构建 | 2026-07-14 本轮终端输出 |
| `node scripts/harness-doctor.mjs` | 0 | 0 errors / 0 warnings | 三层 harness 完整性 | 2026-07-14 本轮终端输出 |
| `pnpm prod:doctor -- --json` | 2 | 预期 STOP：foreign 3050、缺少 immutable builds；HTTP/真实链通过 | 不错误签发生产 READY | 2026-07-14 本轮终端输出 |
| scoped `git diff --check` 与秘密模式扫描 | 0 | 通过；无空白错误、无新增秘密命中 | 候选 diff 与敏感值边界 | 2026-07-14 本轮终端输出 |

## 结果

- 三个 live consumer 的自动发现只剩 `../backend/.env`。
- `CHAOTANG_BACKEND_ENV_FILE` 是新的 canonical 显式覆盖；两个旧环境变量只作为明确配置的兼容入口保留，不再触发旧路径自动探测。
- 本最小闭环已验证完成；它不改变全局生产 STOP。

## 未验证项

- 未部署，未执行浏览器行为验证：本变更无 UI 行为，候选构建作为集成证据。
- 外部 service manager 是否仍显式设置 `JIQUN_ENV_FILE` / `JIQUN_AI_ENV_FILE` 未知；本轮不删除兼容入口。
- immutable artifact、foreign 3050 接管和外部 trust anchor 均不在本闭环范围。

## Diff 与回滚复核

- changed files：三个 env consumer、一个 source-contract 测试、根/前端 change records、S1 蓝图。
- diff review：限定为 env candidate 列表与证据文档；未记录或输出秘密值。
- 回滚是否演练：未演练；可按本提交反向恢复，且生产未部署。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 自动发现不再引用旧 sibling/绝对仓库 | 3/3 source-contract 通过 | PASS |
| 已有 S1 路径门无回归 | 23/23 联合回归 | PASS |
| 类型与候选构建成立 | TypeScript + real-mode build exit 0 | PASS |
| 不误报生产 READY | `prod:doctor` exit 2 / STOP | PASS |

## 声明状态

- `VERIFIED_COMPLETE`：仅指 runtime env discovery 这一最小闭环。
