# 朝堂 OS 工部开发团队

这套团队是开发侧 agent 编队，不是产品前台角色。它帮助我们开发朝堂，不让普通用户看到内部工程分工。

## 已创建的项目级 agents

- `gongbu-chief-engineer`：总工程师，拆架构、定融合点、控范围。
- `gongbu-frontend-craftsman`：前端匠，负责暗金驾驶舱、原界面融合、交互落地。
- `gongbu-loop-smith`：Loop/数据契约工程师，负责 registry、adapter、sourceLabel、quality gate。
- `gongbu-backend-bridge`：前后端桥接，负责 jiqun API、上传、蜂群结果、史馆归档合同。
- `gongbu-quality-gate`：质门/御史台，负责风险、缺证、冲突、人工确认、测试审查。
- `gongbu-e2e-inspector`：浏览器验收，负责本地页面和关键路径截图检查。
- `gongbu-release-scribe`：发布史官，负责变更摘要、测试结果、PR/commit 文案、经验沉淀。

## 怎么调用

在 Claude Code 里可以直接说：

```text
Use gongbu-chief-engineer to plan how to fuse attachment upload into the existing Shangshufang page.
Then use gongbu-frontend-craftsman and gongbu-loop-smith to implement it.
Finally use gongbu-quality-gate to review sourceLabel, risks, evidence gaps, conflicts, and tests.
```

也可以中文说：

```text
调用工部团队，把附件上传融合到上书房底部操作台。
不要新增页面，不暴露统一 Loop。
完成后跑 typecheck 和 core tests，再让质门审查。
```

## 高手用法

小任务只叫一个人：

```text
Use gongbu-frontend-craftsman to polish the Memorial scroll risk section.
```

中任务叫三个人：

```text
Use gongbu-chief-engineer to pick the fusion point.
Use gongbu-frontend-craftsman to implement UI.
Use gongbu-quality-gate to review.
```

大任务叫全队：

```text
Use the Gongbu team to implement the Estate secret-edict handoff into Junjichu.
Keep unified loop internal. Fuse the result into existing screens.
Run pnpm exec tsc --noEmit and pnpm test:core.
```

## 朝堂开发默认流程

1. 总工程师定目标、边界、融合位置。
2. Loop 工程师补 registry/adapter/schema/test。
3. 前端匠把能力接入原界面。
4. 后端桥接确认 API 合同和 fallback/sourceLabel。
5. E2E 检查页面是否可用、可读、不露底层日志。
6. 质门审查 source、风险、缺证、冲突、人工确认。
7. 发布史官记录变更和测试。

## 铁律

- 新能力优先融合到原页面。
- 不新增可见统一 Loop 页面。
- 不让用户管理 agent 或蜂群。
- sourceLabel、缺证、风险、冲突、后令不能丢。
- 高风险不能绕过人工确认。
- 完成前至少跑 `pnpm exec tsc --noEmit` 和 `pnpm test:core`。
