# P8 累计主闭环 smoke blocker（已解阻）

日期：2026-07-17

## 最终结论

P8 国力卡专属验收与全战役统一 smoke 均已通过。用户在 blocker 报告后授权继续，P3 canonical-path 回归已纳入本分支修复；生产 UI 现通过统一 `backendFetch` 调用 `/api/shangshufang/finance-intel-loop/complete`。

## 历史失败证据

1. `finance-intel-loop-smoke.spec.ts`：POST `/api/court/shangshufang/finance-intel-loop` → 404；后端当前无此 route。
2. `finance-intel-loop-ui.spec.ts`：进入已退役 `/court-briefing`，30 秒内找不到 `ssf-ask-input`。
3. 当前生产 `/chaotang/shangshufang?skipOnboarding=1`：输入 AAPL SEC 指令并点击下旨后，页面状态显示 `finance_intel_loop_failed:404`；网络/后端日志确认生产 `ShangshufangPage.tsx` 仍 POST `/api/court/shangshufang/finance-intel-loop/complete`，而后端 canonical route 是 `/api/shangshufang/finance-intel-loop/complete`。

代码证据：`frontend/src/features/shangshufang/ShangshufangPage.tsx:3255` 使用原生 `fetch(withBasePath(...))`，没有经过 `backendFetch/toBackendApiPath` 的 canonical path 转换。

## 根因与修复

- 根因：`ShangshufangPage.tsx` 使用原生 `fetch(withBasePath(...))` 直打退役 `/api/court/.../complete`，绕过统一 transport。
- 生产修复：改用 `backendFetch('/api/shangshufang/finance-intel-loop/complete', ...)`。
- 回归保护：新增 `finance-intel-loop-path.nodetest.ts`，修复前 1 failed，修复后 1 passed。
- 冒烟校准：`finance-intel-loop-ui.spec.ts` 改用当前 `/shangshufang` 页面、canonical API 拦截路径，以及当前补证路由。
- 安全语义：后端当前明确停在 `awaiting_authorized_decision`；统一 smoke 验证公开/密旨均到达人工授权闸，且未下旨、未执行、未归档。旧“自动归档成功”断言违反当前人工裁决边界，因此不再作为成功标准。

## 解阻证据

- `PLAYWRIGHT_SKIP_WEBSERVER=1 ... pnpm exec playwright test e2e/finance-intel-loop-ui.spec.ts --trace on --workers=1` → 2 passed。
- 公开与密旨均向 canonical endpoint POST，后端返回 200；UI 显示 authorized-decision 状态和 SEC 来源。
- 缺证据分支显示“需补证 / 不可放行”，无归档成功入口，并跳转 `/zhuanshu/jinyiwei`。
- trace（ignored）：公开/密旨 SHA-256 `f498e012a48ed79df82a547c2e5ccb5f972ad354cbaba1f7d748462bb9a9c8bc`；缺证据 SHA-256 `5cca8bbea0dc38b76835fa0be3588719613ffafc59696c546658264012f282a3`。

## 安全边界

- 所有运行验证只写 `/tmp/p8-guoli-fengqun-*.db` 副本；生产 DB 未写。
- 生产 DB SHA-256 保持 `e77959b8c89f07f4717dce6c4461df0b211655883b594b14b8fecab7201112bd`，mtime 保持 `2026-07-17 02:32:15 +0800`。
- 未新增 BFF 或兼容 route；修复发生在前端 canonical client 调用边界。

## 状态

RESOLVED，等待独立 Claude Packet review。
