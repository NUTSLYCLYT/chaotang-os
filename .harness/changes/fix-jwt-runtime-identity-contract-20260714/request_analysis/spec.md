# 规格说明：fix-jwt-runtime-identity-contract-20260714

## 背景

canonical 8081 的公开健康检查可达，但使用候选 `backend/.env` 生成的 JWT 对 4 个受保护端点均返回 401。发布门无法区分“候选配置错误”与“运行进程使用另一套 JWT 身份”，而读取进程 secret 或公开 secret digest 都会扩大秘密暴露面。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | health 未公开认证身份，prod doctor 未验证后端受保护资源 | `backend/web/routers/health.py`；`frontend/scripts/prod-doctor.mjs` 的变更前版本；既有 `fix-canonical-jiqun-smoke-start-help-20260714` 证据 | 代码审查 + live smoke 既有记录 | 是 |
| 已确认事实 | 稳定 secret digest 会成为低熵 secret 的离线猜测 oracle | 本变更安全设计：只采用人工 key id + 主动受保护探针 | security-review | 是 |
| 推测 | 当前 8081 由旧环境或不同凭据权限方启动 | 受保护端点 401 只能证明 token 被拒绝 | 待服务管理器证据验证 | 否 |
| 未知问题 | 当前 8081 实际使用的 secret、启动权限方和轮换历史 | 本轮禁止读取进程 secret | S2 后续 provisioning/rotation runbook | 是 |

## 数据流与调用链

`release authority -> 临时 Bearer token + expected key id -> frontend/scripts/prod-doctor.mjs -> GET 8081/api/health -> details.auth -> key id 预检 -> GET 8081/api/tasks -> JWT middleware -> decision STOP/PROD`。标识不匹配时不发送 token。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| `details.auth.{enabled,jwt_key_id}` | `backend/web/routers/health.py` + runtime env | prod doctor | key id 非 secret，非法/缺失归一为 null；pytest |
| `FENGQUN_JWT_KEY_ID` | 部署权限方 | backend health | 1–64 位 `[A-Za-z0-9._-]` |
| `CHAOTANG_EXPECTED_JWT_KEY_ID` | 发布候选配置 | prod doctor | 与 runtime key id 必须全等 |
| `CHAOTANG_RUNTIME_PROBE_TOKEN` | 外部发布权限方临时注入 | loopback `/api/tasks` | 不写报告、不提交、不由 doctor 读取 secret 现签 |

## 范围

只实现 JWT 运行身份元数据、纯分类器、loopback 主动探针、发布 STOP 门、部署契约和证据。

## 非目标

不读取/修改 secret；不重启或接管 8081/3050；不完成管理员 bootstrap、JWT 强度/轮换/吊销；不宣称 S2 或生产 READY。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| auth disabled | STOP | node 分类测试 |
| key id 缺失、非法或不一致 | STOP，且不发送 token | pytest + node 测试 |
| backend URL 非 loopback | STOP，不发送 token | node 测试 |
| token 缺失或 protected probe 非 2xx | STOP | node 测试 + live doctor |
| key id 一致且 protected probe 2xx | JWT 子门 ready | node 测试；仍需其他发布门 |
| health 响应 | 不含 JWT secret 或 token | pytest + diff/secret scan |

## 风险与回滚边界

最大风险是探针 token 被发送到错误主机或进入报告；通过 loopback allowlist、无重定向 GET、报告只传 `probeTokenPresent` 和状态码控制。回滚只回滚本 change 的代码/文档，不触碰运行进程或数据库。

## 计划确认记录

- 批准人：用户（连续“下一步”，且指定 TDD/verification-loop）
- 批准日期：2026-07-14
- 批准范围：S2 单一最小闭环
- 明确未批准：读取 secret、重启进程、公开上线、扩展其他 S2 子项

## 验收标准

RED 可复现；后端和分类器测试 GREEN；doctor 增加 JWT 子门且当前现场诚实 STOP；三层 doctor、类型检查/build 与安全扫描通过；证据说明未验证项。

## 验证计划

聚焦 pytest/node test；后端回归；前端 typecheck/build；三层 doctor；live prod doctor（预期 STOP）；diff 与秘密字面量扫描。
