# ADR 0030: 丞相非业务咨询对话契约

## Status

Accepted — 2026-07-28

## Context

上书房需要在当前页面会话中提供与丞相的真实多轮咨询，同时保持 ADR 0028 的下旨、会审、取证与归档闭环不变。咨询不是旨意，不应写入史馆、调度六部或军机处，也不应调用锦衣卫。

## Decision

新增受认证保护的 `POST /api/v1/chancellor-consult`，请求只接受严格交替、以用户开始和结束的 1–20 条消息；单条去空白后 1–4000 字，总长度不超过 20000 字。服务为每次请求追加“仅咨询”的系统提示并恰好调用一次 DeepSeek 模型，返回独立的 `consultant/reply` 契约。浏览器经同源 BFF `POST /api/chat/chancellor-consult` 调用；历史按 ADR 0032 仅在当前浏览器中以认证用户 ID 隔离保存，不进入后端业务存储。咨询包不得导入下旨、六部、军机处、锦衣卫、史馆或案卷模块。

## Consequences

咨询和下旨拥有平行端点与独立类型，错误统一脱敏为 validation/config/model/unauthenticated 等稳定分类。用户必须在发送前看到真实模型调用和非办理性质提示。该能力只做账号隔离的当前浏览器持久化，不写入后端、不跨设备同步、不流式输出；需要办理的事项仍使用御前“下旨”入口。

## Verification

```powershell
cd backend
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\python.exe -m pytest

cd ..\frontend
npm run lint
npm run typecheck
npm test
npm run build

cd ..
node scripts/check_harness.mjs
```
