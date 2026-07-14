# 任务拆解

## 任务 1：确认真实契约与认证

- 目标：在编码前锁定请求、裸响应、硬灯所有权和认证传递方式。
- 输入：`backend/web/routers/swarm.py`、`backend/web/schemas/swarm.py`、`backend/src/lipu_compliance_report.py`、后端测试与 `frontend/src/lib/backend-api.ts`。
- 输出：明确使用 `backendFetch`，不增加 BFF；确认 hard gate 只由 `lipu_vet` 决定。
- 验收：契约无歧义、浏览器会话可携带 Bearer、与 dadian 无重叠。
- 依赖：无。

## 任务 2：实现 typed adapter 与回归测试

- 目标：建立可信的后端边界和诚实降级。
- 输入：`POST /api/swarm/lipu/compliance-report` 裸对象响应。
- 输出：`src/features/lifu/api/lifu-compliance.ts` 与对应 `.nodetest.ts`。
- 验收：成功解析并保留源标签；网络和 HTTP 失败返回 `FALLBACK`，不返回伪报告。
- 依赖：任务 1。

## 任务 3：接入承诺门 UI 并校正花名册

- 目标：让用户可提交任务、看到三源判定，并让引擎旗标与事实一致。
- 输入：`commitment-gate-tab.tsx`、`lifu-roster.ts`。
- 输出：真实会审区；只有 `commitment_gate.engine=true`。
- 验收：硬灯、软意见、缺失覆盖和错误态边界清楚；roster node test 断言 `1/8`。
- 依赖：任务 2。

## 任务 4：更新产品口径与审计证据

- 目标：让长期产品文档和 harness 记录反映已经接线的真实能力。
- 输入：`docs/product/PROJECT_PRODUCT.md` 第 7.1 节、前端 11 阶段模板。
- 输出：能力段落与本 change 目录全套记录。
- 验收：DELIVERED 记录没有占位符，frontend doctor 0 errors。
- 依赖：任务 2、任务 3。

## 任务 5：验证与提交

- 目标：证明前端契约、护栏和既有后端硬闸均未回归。
- 输入：任务包指定的验证序列。
- 输出：CI 摘要和单一分支提交。
- 验收：全部指定命令通过；提交含 `Change: feat-lifu-engine-wiring-20260714` trailer；不 push。
- 依赖：任务 1 至任务 4。
