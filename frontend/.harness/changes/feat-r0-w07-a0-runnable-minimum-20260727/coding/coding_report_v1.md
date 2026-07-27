# 实现报告 v1

## 改动

- generated OpenAPI contract 增加 `ContractTaskReadModelV1` 及 read-model route。
- 新增 fail-closed parser、server action policy、API adapter 和
  `ContractReviewPanel`。
- `ShangshufangPage.tsx` 只以 hunk 接入合同审查面板。
- `ShiguanPage.tsx` 只以 hunk 接入 exact archive receipt 回读和可见身份。
- 非合同任务不再因 `task_`/`task-` 前缀进入合同模式；服务端 mission/pack
  识别后才锁定旧动作。
- 下载服从 server action；lineage parser 与 exact error fail closed；delivery
  retry 在未确认成功前复用内存 idempotency key。

## 取舍

- 前端不推导可执行动作；未知 action/blocker 直接拒绝。
- Checkpoint A 不提供 PARTIAL refresh resume，页面显示 blocker。
- 不新增产品 route、BFF、Agent、任务状态或裁决系统；test-only launcher 的 JWT
  seed hook 不注册到生产入口或产品 OpenAPI。

## 验证

- focused contract-review Node 31/31、TypeScript pass、real-mode Next build pass。
- Playwright 真实后端 READY + PARTIAL refresh 纵向流 fresh 1/1。
