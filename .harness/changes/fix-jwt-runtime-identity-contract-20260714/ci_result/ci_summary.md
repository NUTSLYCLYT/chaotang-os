# CI 摘要：fix-jwt-runtime-identity-contract-20260714

## 命令

| 命令 | 退出码 | 结果 | 证据覆盖范围 | 证据位置 / 时间 |
| --- | ---: | --- | --- | --- |
| backend focused（实施前） | 1 | RED：2 failed，`details.auth` 缺失 | health auth identity | 2026-07-14 终端 |
| frontend focused（实施前） | 1 | RED：identity module 不存在 | doctor identity classifier | 2026-07-14 终端 |
| `python3 -m pytest -q tests/test_health_auth_identity.py tests/test_auth_whitelist.py` | 0 | 4 passed | health metadata、无 secret、whitelist | 2026-07-14 终端 |
| `node --test scripts/jwt-runtime-identity.nodetest.mjs` | 0 | 6 passed | key id、unknown/disabled、loopback、probe、无 token | 2026-07-14 终端 |
| health/whitelist/web focused regression | 0 | 5 passed, 66 deselected | API regression | 2026-07-14 终端 |
| 正式下旨主链 6 文件 pytest | 1 | 40 passed, 1 failed | 既有 final memorial DB fixture 隔离失败 | 2026-07-14 终端；HEAD 临时导出同样失败 |
| `pnpm exec tsc --noEmit` | 0 | PASS | frontend types | 2026-07-14 终端 |
| `NEXT_PUBLIC_API_MODE=real pnpm build` | 0 | PASS，31 routes | production build | 2026-07-14 终端 |
| 三层 harness doctor | 0 | 0 errors / 0 warnings | root/frontend/backend harness | 2026-07-14 终端 |
| `docker compose -f backend/docker-compose.yaml config` | 0 | PASS（仅 obsolete version warning） | key id env propagation | 2026-07-14 终端 |
| `pnpm prod:doctor -- --json` | 2 | 预期 STOP；JWT 元数据未知 + expected id 缺失，且 foreign 3050/builds 缺失 | live fail-closed | 2026-07-14 终端 |

## 结果

- JWT runtime identity 契约纵切 `VERIFIED_COMPLETE`；当前 live rollout `NOT_READY`。
- live 输出把缺失 auth metadata 记录为 unknown，而不是脑补成 auth disabled。
- 本变更没有发送 probe token：key id/expected id 预检未通过，`shouldProbe=false`。

## 未验证项

- live 8081 未按受控流程重启/配置，未证明真实 MATCH；外部发布权限方尚未提供临时 probe token。
- 既有 `test_final_memorial_gate.py::test_live_quality_passed_candidate_is_formalized_once` 失败：fixture 写内存 Session，HTTP status 走应用默认 Session；在 `git archive HEAD` 的无本轮改动基线中同样复现。本纵切未修改该主线。
- 无 UI 改动，浏览器验证不适用；30 条黄金旨意未运行。

## Diff 与回滚复核

- changed files：backend health/test/compose；frontend doctor/classifier/test/env/wiki/change；root change/launch blueprint。
- diff review：无 secret digest、无 token 输出、无非 loopback探针、无数据库/UI/BFF 变更。
- 回滚是否演练：未部署；可反向回滚本提交，不触碰服务或数据库。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| 每个行为先 RED | backend 2 failed；frontend missing module；unknown-vs-disabled 1 failed | PASS |
| identity classifier GREEN | 6 passed | PASS |
| backend contract GREEN | 4 passed + focused web regression | PASS |
| 类型/build/三层 doctor | 全部 exit 0 | PASS |
| live 不误报 READY | prod doctor exit 2 / STOP | PASS |
| live runtime MATCH | key id/token 未配置，未重启 8081 | NOT VERIFIED |
| 全主链回归 | 40 passed；1 个 HEAD 基线既有失败 | BASELINE BLOCKED |

## 声明状态

- `VERIFIED_COMPLETE`：仅指 JWT identity contract 纵切；live rollout 与全局发布保持 `NOT_READY`。
