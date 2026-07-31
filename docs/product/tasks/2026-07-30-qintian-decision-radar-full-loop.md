# 任务：钦天监决策雷达完整闭环

## Status

Ready

## Product Definition

- 用户确认：2026-07-30，使用多 Agent 把已规划的钦天监终态全部实现。
- 前置切片：`2026-07-30-qintian-decision-radar.md` 已完成页面事实投影，本任务补齐正式推演、触发器复核、独立问策和转拟旨。
- 用户问题：当前右栏仍不能绑定所查看的具体奏折/回奏，也没有真实、可追溯、可复核的正式判断闭环。
- 产品目标：让钦天监回答“现在怎么看、什么会改变判断、何时复核”，同时永远不取得执行权。
- 非目标：自动外网监控、自动判定外部事实、伪造概率、自动重跑模型、自动下旨、自动调查、写入史馆第三种档案类型。

## Acceptance Criteria

- [x] 当前草稿、当前回奏、归档回奏均有不可混淆的上下文引用；切换上下文后旧响应不能覆盖新视图。
- [x] 用户可显式发起正式推演；结果固定包含乐观、基准、悲观三情景、置信依据、关键假设、证据时间、反事实、最坏情形、触发器、复核日期和人工签字要求。
- [x] 未经批准的校准方法不显示概率；provider 不可用时明确显示不可用，不伪装实时预测。
- [x] 到期触发器显示原判断、新观察和是否失效；保持、失效、请求重演、交丞相均追加复核留痕。
- [x] 钦天监有独立问策记录和输入；与丞相消息不串线；fallback 来源明确。
- [x] “转拟旨/交丞相”只预填草稿或咨询上下文，不直接调用下旨执行入口。
- [x] 所有后端数据按认证 owner 隔离；浏览器不能提交 owner；跨 owner 读取按不存在处理。
- [x] 正式数据使用独立 SQLite 事务持久化；不写史馆、不触发锦衣卫、不调用外网。

## Delivery Constraints

- 必须遵循 ADR 0027、ADR 0028 和 ADR 0034。
- 后端采用当前 `backend/app` 架构；浏览器只访问同源 Next BFF。
- 每个生产行为先有失败测试；模型测试使用 fake provider，禁止真实网络调用。
- 当前授权仅包含实现和验证，不包含暂存、提交、推送、PR 或部署。

## Affected Modules

- 模块：钦天监后端辅助域、认证 BFF 与严格跨端契约、上书房右栏决策雷达、架构与产品治理
- 允许路径：`backend/app/qintianjian/**`、`backend/app/api/qintianjian.py`、`backend/app/main.py`、`backend/tests/test_qintianjian_api.py`、`frontend/src/app/api/qintianjian/**`、`frontend/src/app/study/qintian*`、`frontend/src/features/study-visual/**`、`frontend/src/features/court-visuals/CourtQuickDock.tsx`、`frontend/src/lib/backendClient.ts`、`frontend/src/lib/backendClient.qintian.test.ts`、`ARCHITECTURE.md`、`docs/decisions/0034-qintianjian-advisory-domain.md`、本任务及对应设计/计划文档
- 依赖模块：ADR 0027 认证 owner、ADR 0028 唯一执行链、史馆 owner-scoped 回奏读取、现有丞相拟旨输入

## Technical Plan

1. 冻结跨端契约与来源边界。
2. 用独立 SQLite 实现 owner-scoped forecast、scenario、assumption、trigger、review 与幂等写入。
3. 实现认证咨询、正式推演、pending trigger 和追加式 review API。
4. 实现同源 BFF、严格运行时解析和脱敏错误映射。
5. 将正式推演、到期复核、独立问策和转拟旨接入 `/study` 右栏。
6. 执行后端、前端、harness 全量验证和多 Agent 复审。

## Implementation Report

- 改动摘要：新增 owner-scoped 钦天监 SQLite、正式三情景推演、可证伪触发器、逐触发器追加复核、非持久化问策、认证 BFF、严格前端解析和完整右栏交互。右栏视觉进一步与丞相统一为 38% 工作区 + 62% 对话区；正式推演默认折叠，问策使用张衡/陛下头像气泡和贴底输入框。
- 自审：旧 ext 仅吸收语义；未迁移 mock、JSONL、Turso、外部市场查询或史馆第三种档案。独立审查发现并修复回奏来源、概率门禁、跨上下文触发器、复核粒度和幂等并发问题。
- 验证：补齐本 worktree 后端开发依赖后，前后端、构建与 harness 均由主 Agent 在最终代码状态下全量复跑通过。
- 实际使用的 skill：`using-superpowers`、`brainstorming`、`using-git-worktrees`、`writing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`record-decision`、`codex-engineering-workflow`、`verification-before-completion`。
- 验证命令与结果：
  - `frontend: npm test`：PASS，437/437。
  - `frontend: npm run typecheck`：PASS。
  - `frontend: npm run lint`：PASS。
  - `frontend: npm run build`：PASS。
  - `backend: python -m pytest -q`：PASS，2018 passed、1 skipped、0 failed。
  - `backend: python -m ruff check .`：PASS。
  - `node scripts/check_harness.mjs`：PASS，72 个基线文件。
  - `node scripts/check_harness.mjs --self-test`：PASS，44 项。
  - `node .agents/hooks/check-harness.mjs --self-test`：PASS，3 项。
  - `node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test`：PASS，25 项。
- 未运行项与原因：无。
- 剩余风险：真实 provider 和生产部署未运行；正式推演会在 provider 缺失时 fail closed。概率校准、自动外部信号采集仍明确不在本任务范围。

## Acceptance Review

- 验收结果：PASS；仓库规定的后端、前端与 harness 测试全部零失败。
- 验收证据：2018 项后端测试、437 项前端测试、前端生产构建、全量 Ruff、严格 BFF 契约测试、三套 harness self-test、独立审查及 P1/P2 返工证据；并在 `127.0.0.1:3010/study#qintian` 完成真实页面视觉验收。
- 未通过项：无。
