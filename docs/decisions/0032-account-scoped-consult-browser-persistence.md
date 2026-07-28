# ADR 0032: 丞相咨询按账号隔离的浏览器持久化

## Status

Accepted — 2026-07-28

## Context

ADR 0030 最初把咨询历史限定为页面 React 内存，导致用户刷新 `/study` 后丢失全部对话。同一域名可能先后登录多个朝堂账号，因此使用一个共享 localStorage 键会造成不同账号之间串话。

## Decision

丞相咨询仍不写入后端、史馆或任何业务档案，只在当前浏览器的 localStorage 中保存。存储键固定为 `chaotang:consult:v1:<encoded userId>`，其中 `userId` 来自服务端已认证的公开用户对象，不使用用户名、邮箱、session 或客户端输入作为隔离标识。

缓存只保存最多 20 条完整、严格交替的 user/assistant 消息，不保存 pending、错误或草稿。读取时校验版本、角色顺序、消息数量、字段集合和内容长度；JSON 损坏、结构非法、浏览器禁止存储或配额耗尽时回退为空且不阻断咨询。为满足后端单次最多 20 条消息的契约，开始新一轮时只携带最近 18 条历史，再追加本轮用户消息。

## Consequences

刷新后同一账号可以恢复最近咨询，不同账号在同一域名下互不读取对方记录。同一账号的同源标签页共享底层缓存，但当前页面不做实时跨标签同步。记录不会跨浏览器、设备或隐私模式迁移；清理站点数据会删除记录。该本地缓存不是史馆归档，也不得改变 ADR 0028 的业务流。

## Verification

```powershell
cd frontend
node --test src/app/study/chancellorConsultPersistence.test.ts src/app/study/StudyClient.test.ts
npm run lint
npm run typecheck
npm test
npm run build

cd ..
node scripts/check_harness.mjs
```
