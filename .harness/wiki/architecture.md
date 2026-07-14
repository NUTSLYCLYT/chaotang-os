# 全项目架构

```text
chaotang-os/
  .harness/          全项目工程 harness
  frontend/          朝堂 OS Web 体验线
    .harness/        前端工程 harness
  backend/           jiqun 后端蜂群/运行线
    harness/         后端运行/评测 harness 包
    resources/       版本化运行输入（seed/profile）
    var/             统一可变运行态（不入 Git）
  docs/              跨项目产品、计划与历史状态文档
    plans/           经批准的跨线蓝图
    status/archive/  带日期的非当前状态快照
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

## 唯一业务运行主线

```text
Shangshufang confirm
  -> ChancellorRouteDecision
  -> OutboxEvent
  -> outbox worker
  -> swarm/department candidate reports
  -> CourtReview candidate memorial
  -> quality + provenance gate
  -> FinalMemorial
  -> EmperorDecision
  -> ShiguanArchive
```

`DecreeExecutionEvent` 是这条主线的结构化事件账本，记录路由、入队、领取、回奏、质量裁决、正式奏折和人工裁决。前端状态与按钮必须从后端读模型派生，不能自行补造 LIVE 状态。

工程多 Agent control-plane 只管理 Git 工作区里的任务、租约、资源锁和发布证据；它不管理朝堂业务中的 `DecisionTask`、部门派单或蜂群运行。两者同名的 task/lease 属于不同边界，没有隐式转换关系。

## 当前事实源

- 根级项目事实源：`.harness/manifest/project-harness.json`。
- 前端工程 harness 事实源：`frontend/.harness/` 与 `frontend/scripts/harness-doctor.mjs`。
- 后端运行/评测 harness 事实源：`backend/harness/manifest.json` 与 `backend/scripts/harness_doctor.py`。
- 所有当前工作入口以 `chaotang-os/` 下的根级、前端、后端三层结构为准。
- `courtos-brain/` 是等待安全独立化的历史 subtree，不构成第四层入口；删除门禁见 `.harness/wiki/courtos-brain-extraction.md`。
