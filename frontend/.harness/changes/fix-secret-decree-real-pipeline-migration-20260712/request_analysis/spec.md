# 需求说明

## 背景

"统一决策任务生命周期"架构讨论落地方案(见 `/home/ubuntu/.claude/plans/valiant-crunching-candy.md`)的阶段2。两轮 Explore 发现密旨(secret 模式)走的是完全独立于下旨的 `chaotang.orchestrateAll()` → `OrchestrateResult` 路径，命中后端 `court_compat.py::orchestrate_all` 兼容占位实现，恒为 FALLBACK，从不调用任何真实部门引擎——这是本次 session 前半段花五轮 Codex 停止前审查才修完诚实标注的那条路，但没解决"它是条岔路"这个根问题。本轮把密旨并入下旨已验证真实可用的 `draft-edict/confirm-edict` 管线，让"密旨"从"看起来存在、实际空转"变成真功能。

## 范围

- `ShangshufangPage.tsx`：`runOrderDecree` 加 `mode: ExecutableDecreeMode = 'order'` 参数，`runSecretDecree` 改为 `runOrderDecree(cmd, undefined, 'secret')` 的薄封装。
- 删除 `secretBriefToEdict()`(专门渲染 `OrchestrateResult` 占位数据的函数，102 行)，复用已经通用、mode 无关的 `confirmedEdictToView()`。
- `chaotang.ts`：退役 `orchestrateAll()` 前端 API 客户端函数(零生产调用者)。
- `DecreeInput.tsx`：移除已经过时的密旨"占位"诚实降级徽标(常驻 badge + 按钮上的圆点标记)——密旨现在是真功能，继续显示"占位"字样本身就是新的诚实性 bug。
- `court_compat.py::orchestrate_all`：加弃用注释，不删除端点本身(见风险)。

## 非目标

- 不删除 `OrchestrateResult` 类型本身——它仍被"问丞相"(chaotang.orchestrate，一条完全独立的真实会审功能)使用。
- 不给 `DraftEdictRequest`/`ConfirmEdictRequest` 加后端 `mode` 字段——当前功能目标(密旨走真实管线)不需要，`confirmedEdictToView` 已经是 mode 无关的通用渲染，加这个字段是超出当前需求的设计。
- 不处理各司手动派单(阶段3)、timeline 序号(阶段4)。

## 验收标准

- 真实浏览器提交一次密旨，任务能在 `GET /tasks/{id}/status` 里看到和下旨一样结构的 `DecreeExecutionStatusV1`。
- 至少一个部门返回 `LIVE_ENGINE`(证明真实调用了部门引擎，不是恒定 FALLBACK)。
- 密旨入口的 UI 不再显示"占位"类文案(功能已经是真的)。
- 现有测试(`tsc`/`test:node`/三层 harness doctor)不回归。

## 风险

- `court_compat.py::orchestrate_all` 有既有契约测试(`test_contract_alignment_p0.py`)依赖它的返回形状，且可能有仓库外调用方——保留端点本身，只加弃用注释，不做破坏性删除。

## 验证计划

`pnpm exec tsc --noEmit`、`pnpm test:node`、`pnpm harness:doctor`、`python3 backend/scripts/harness_doctor.py`、`node scripts/harness-doctor.mjs`、真实浏览器提交密旨全流程验证。
