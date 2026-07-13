# 前端架构

## 系统位置

`frontend/` 是朝堂 OS 的前端体验线。

```text
浏览器
  -> src/app 中的 Next.js App Router 页面
  -> src/features 中的功能 UI / 工作流
  -> src/core 中的前端领域逻辑与 CourtOS 协议适配
  -> src/lib 中的类型化 adapter、source label、工具函数
  -> 明确 API 契约 / 外部来源
```

`src/app` 不承载 BFF 层。禁止新增 `src/app/api/**` 或 `src/app/**/route.*`；运行服务必须由后端线提供明确 API，前端只通过类型化 adapter 调用。

## 主产品闭环

```text
经营信号
  -> 上书房
  -> 圣旨 / 任务
  -> 军机处编排
  -> 部门会审
  -> 奏折 / 报告
  -> 老板裁决
  -> 史馆归档与召回
```

前端只负责用户可见体验与浏览器证据。非前端运行事实以根级 manifest、API 契约和明确验证输出为准。

## 状态与数据

- UI 状态：React state、轻量客户端 store、URL state。
- 运行数据：明确 API 契约与类型化 fetch adapter。
- 领域逻辑：`src/core/**`，尤其是 CourtOS 协议适配与前端可执行的纯逻辑。
- 运行事实证据：根级 manifest、API 契约和明确验证输出。
- 前端工程事实源：`frontend/.harness/` 与 `frontend/scripts/harness-doctor.mjs`。

## Harness 分层

```text
../.harness
  -> 项目级边界、manifest、根级 doctor
frontend/.harness
  -> 前端 owner、rules、skills、wiki、templates、changes
运行证据
  -> 根级 manifest、API 契约、验证输出
```

前端 `.harness` 可以引用根级运行评测验证结果，但不能吸收运行记录、质量基线和生产执行逻辑。

## 证据边界

UI 不得模糊：

- LIVE：真实模型、真实运行、真实记录。
- MIXED：有真实来源，但仍有 fallback、缓存或部分样例。
- DEMO：fixture、静态样例、mock 或说明性流程。
- FALLBACK：主来源不可用后的降级结果。

组件展示 fallback 或样例结果时，view model 应携带 source label，或页面必须明确披露边界。

## 发布路径

- Dev HMR：`pnpm dev`，端口 3002。
- Production build：`pnpm build`。
- Production start：`pnpm start`，端口 3050。
- 发布门禁：`pnpm harness:chaotang:gates`、`pnpm gate:prod-release`，并按需运行领域 guard。
