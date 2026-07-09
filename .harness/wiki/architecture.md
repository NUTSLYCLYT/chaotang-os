# 全项目架构

```text
chaotang-os/
  .harness/          全项目工程 harness
  frontend/          朝堂 OS Web 体验线
    .harness/        前端工程 harness
    harness/         前端侧评测/支持资产
  backend/           jiqun 后端蜂群/运行线
    harness/         后端运行/评测 harness 包
  docs/              跨项目产品与运行文档
```

## 运行方向

```text
浏览器 / Next.js UI
  -> 类型化前端适配器
  -> 后端服务契约
  -> 后端 flow engine / 蜂群 / provider
  -> 后端 harness 与测试验证运行质量
  -> 前端发布门禁验证用户可见行为
```

## Harness 方向

```text
根 .harness
  -> 索引并验证 frontend/.harness
  -> 委托 frontend/scripts/harness-doctor.mjs
  -> 索引 backend/harness 包与 backend/harness/manifest.json
  -> 委托 backend/scripts/harness_doctor.py
  -> 定义跨线所有权与证据规则
```

根 `.harness` 不是运行时。它是协调与验证层，用来防止前端、后端、文档和评测 harness 相互漂移。

## 当前事实源

- 根级项目事实源：`.harness/manifest/project-harness.json`。
- 前端工程 harness 事实源：`frontend/.harness/` 与 `frontend/scripts/harness-doctor.mjs`。
- 后端运行/评测 harness 事实源：`backend/harness/manifest.json` 与 `backend/scripts/harness_doctor.py`。
- 所有当前工作入口以 `chaotang-os/` 下的根级、前端、后端三层结构为准。
