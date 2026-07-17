# P9 security review v1

## 结论

`PASS_FOR_CANDIDATE`。独立 Packet review 仍待执行。

## Trust boundaries

| 边界 | 处理 | 证据 |
| --- | --- | --- |
| 浏览器 -> Next rewrite -> FastAPI | 所有 `/api/hanlin/*` 由 `require_admin` 决定；页面 flag 与 `x-hanlin-role` 不授权 | user 403 / anonymous 401 tests |
| 浏览器会话 -> backend credential | 统一 `backendFetch`，从既有会话取 token 并发 Bearer；401 最多 refresh 一次 | API node test + browser request header |
| ledger 文件 -> UI | 只读；仅确定性记录进入真实来源；React 文本渲染默认转义 | 正常/损坏/非确定性 tests |
| 未知/漂移 payload -> source badge | 未知值、缺 ledger、确定性计数 0 均 fail-closed 为 FALLBACK | read-model tests |

## Checklist

- Authorization：服务端执行，覆盖读端点及遗留 POST/PATCH 路径。
- Authentication：不新造 token/cookie 解析器，复用统一 transport；没有把 token 写日志或 URL。
- Input：experiments `limit` 仍限制为 1..200；P9 未新增写入输入。
- Secrets：代码和证据无真实 secret；浏览器 token 是固定无效夹具值。
- CSRF：P9 不新增成功写契约；服务端实际权限基于 Bearer/admin。遗留写 UI 仍 deferred，不能据此宣称可用。
- Data exposure：Hanlin 仍 internal-only 且 admin-only；ledger detail 只在该边界内展示。
- Error behavior：鉴权错误显式失败；账本读取错误诚实降级，不泄露路径或异常栈到响应。
- Replay/side effects：读模型无写入；`reset-demo` 是 admin-only no-op。

## Deferred security debt

- 客户端 `readHanlinRole()`/`x-hanlin-role` 只剩 UI 提示用途，最终应由 JWT 显式角色 claim 统一；见 deferred register。
- 真实浏览器登录签发旅程未在本夹具中运行，拒绝行为由 FastAPI 集成测试证明。
