# 实现报告 v1

## 改动

- 新增军机处 `canonical-read-model.ts` 与上书房 `canonical-memorial-view.ts`。
- 页面只消费后端 status；正式奏折覆盖 stale review，候选和缺证保持阻断语义。
- 四个前端决策引擎退出生产 import，三个无调用 writer/bridge 迁入 dated attic。
- 新增 default-on、显式关闭 fail-closed 的 canonical projection flag。

## 取舍

- 保留旧引擎供 test/eval 复盘，但禁止生产可达；恢复必须新建 change 重审。
- rollout 关闭只显示安全等待，不提供 legacy 双写或本地裁决旁路。

## 验证

- RED：rollout 3 failed / 10 passed；GREEN：14/14。
- P4 前端定向 34/34；TypeScript、production build、三层 doctor 和浏览器通过。
