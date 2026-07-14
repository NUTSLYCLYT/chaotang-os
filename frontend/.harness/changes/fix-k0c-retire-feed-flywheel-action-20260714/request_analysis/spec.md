# 需求说明

## 背景

K0C 要把知识写权收敛到 canonical archive/outcome promotion。后端 producer 已停止下发旧动作并建立 stale-client tripwire，但前端 mock、类型、adapter 和 ArchiveCard 仍会接受或显示“喂飞轮”，会产生坏按钮或离线旁路错觉。

## 范围

只移除 `feed_flywheel` 的前端生产、接受与渲染路径；保留查证据和导护身符行为。

## 非目标

不实现知识 promotion、不改史馆布局、不新增 BFF、不删除历史数据、不处理其他 actions。

## 验收标准

带旧 action 的 API payload 经 adapter 后被过滤；类型/mock/组件不含旧动作；Node test、tsc、production build 与 doctors 通过。

## 风险

主要风险是删除整个 action bar 或误伤 export/trace；聚焦 adapter test、TypeScript 和 build 共同防护。真实浏览器受 3050 身份阻塞。

## 验证计划

`tsx --test court-doc-adapter.nodetest.ts`、`pnpm exec tsc --noEmit`、`NEXT_PUBLIC_API_MODE=real pnpm build`、`pnpm harness:doctor`、根 doctor。
