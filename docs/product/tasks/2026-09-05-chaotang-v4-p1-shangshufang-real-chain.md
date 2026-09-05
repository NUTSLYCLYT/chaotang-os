# 朝堂 V4 P1：上书房“先复述、后拟旨”真实确认门

任务 ID：`CHAOTANG-V4-P1-SHANGSHUFANG-REAL-CHAIN-20260905`

冻结基线：`origin/ext-dev@0e99b954727fab776503266df4f83209685cd2a7`

冻结 tree：`07328649481653ef6f00f1ae28b7fe0f9afb5e15`

V5 Scope Digest：`sha256:e8beaa39680859856b15fde82799d65cbc772254b37274ce423169dcc86624b3`

前置 V4 Scope Digest：`sha256:ed80f114753e0ce95c64b0fd4a6ac1835b330f49adfef1da72f70a2e352c5f06`（基线 Harness 阻塞，未提交）

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_EXACT_DIGEST_CONFIRMATION`。approval JSON 中的 `APPROVED_FOR_ONE_CHILD` 是未来独立治理提交中的机器契约值，不是当前授权。

## Status

Draft

`NON_AUTHORIZING / READY_FOR_OWNER_EXACT_DIGEST_CONFIRMATION`

最新基线已经修正 Single Product Export Truth A1 的标准章节与 approval base；根 Harness、Doctor 与 product-authority regression 均恢复通过。

## Product Definition

只在现有 `/study` 上书房补一个强制且真实的产品门：**丞相先复述当前目标，用户确认这一份精确理解后，才允许生成拟旨。**

本包不重做 First Decree Cockpit，不增加第二套任务、档案、身份、权限、Agent 或状态事实源。既有拟旨版本、正式下旨、幂等提交、提交未知恢复、任务轮询、结果、成果和最近回奏均为回归不变量。大殿、军机处 V4 A1 `SceneBoard` 与 Single Product Export Truth A1 同样被冻结。

用户闭环：

```text
说出想得到的结果
→ 请丞相复述（仅咨询，不建任务）
→ 展示当前理解卡
→ 确认理解并生成拟旨（同一主动作）
→ 预览既有拟旨契约
→ 确认下旨并进入既有异步任务主链
→ 读取既有真实状态、结果或失败
```

智能版与定制版共享同一 owner、确认快照、draft version/fingerprint、job 和 API；只改变披露深度，不形成第二状态机。

确认快照包含 `ownerId`、仅去除首尾空白的 `normalizedOriginalGoal`、现有咨询响应 trim 后的 `exactLatestChancellorRestatement`、`consultationGeneration` 与 `contextGeneration`。浏览器不得语义改写复述。

owner、目标、context generation、最新复述变化，或者较新的咨询开始/完成时，旧确认立即失效。咨询和拟旨回包只有在 owner、request/generation 与 source snapshot 仍匹配时才能更新 UI。

`studyIntentConfirmation.ts` 是类型化已确认输入的唯一工厂；`requestChancellorDraft` 只接受该类型化输入。拟旨只能读取不可变确认快照，并向现有拟旨入口发送原始目标和用户已确认的丞相理解。

页面业务 CTA：

| 阶段 | 唯一允许的高亮业务 CTA |
|---|---|
| `EMPTY` | `请丞相复述` |
| `DAILY_MEMORIAL_REVIEW_ONLY` | `确认上奏并归档为奏折` |
| `CONSULTING` | 无 |
| `UNDERSTANDING_READY` | `确认理解 · 生成拟旨` |
| `CONFIRMED_AND_DRAFTING` | 无 |
| `DRAFT_READY` | `确认下旨 · 开始办理` |
| `QUEUED_OR_RUNNING` | 无 |
| `SUCCEEDED` | `查看成果`，或已展开时无 |
| `FAILED_OR_CANCELLED` | `查看原因与下一步` |

`FirstDecreeWelcome`、quick-dock 与 daily memorial 控件必须服从全页阶段白名单，不能形成绕过确认的第二高亮入口。`SUBMISSION_UNKNOWN` 沿既有幂等查单/恢复路径处理；失败/取消不得伪装归档；成功不得推断公开响应不存在的 `replyId`。

智能/定制切换是 `DevStudyWorkspace` 内的本地非持久化展示状态，默认智能版；切换不得调用 API、改变 owner/task/version/fingerprint/job、重置确认或改变按钮后果。

## Acceptance Criteria

- [ ] 治理提交是冻结基线的直接单亲子，只含 manifest、Task、Plan 三条路径。
- [ ] Owner 确认 manifest canonical digest 并单独授权三文件治理提交后才允许落地。
- [ ] `product-authority --authorize --task CHAOTANG-V4-P1-SHANGSHUFANG-REAL-CHAIN-20260905` 返回 GO 后才允许产品字节。
- [ ] 首次用户 5 秒内知道正在与丞相确认目标；未确认最新精确复述不能拟旨或下旨。
- [ ] owner、目标、context 或复述变化立即失效；stale consult/draft/401 不能污染新 owner/source 的 UI、存储或跳转。
- [ ] 拟旨请求只使用不可变确认快照并精确绑定原目标与已确认复述。
- [ ] 智能/定制共享同一状态和 API；全页主动阶段至多一个高亮业务动作。
- [ ] 既有版本/指纹、幂等提交、恢复、轮询、成果、最近回奏、认证和 source label 保持通过。
- [ ] exact candidate H 浏览器证据覆盖 `/study`，并包含 `/dadian`、`/junjichu/scene-board` 双视口截图与 console 无新增错误。
- [ ] 中文 IME、键盘焦点、对比度、减少动画、背景失效、无权限和服务失败可用。
- [ ] 独立 Frontend/TypeScript 与 UX Review 无未关闭 P0/P1/P2。

## Delivery Constraints

- 不改后端、BFF、数据库、身份、权限、史馆、军机处、大殿、SceneBoard、Single Product Export Truth A1 或共享全局样式。
- 不新增三策、史馆裁决、public lineage、pause/resume、全局任务列表、附件、蜂群 API、任务账本或持久草稿。
- 不安装依赖，不连接 provider，不使用客户/生产数据，不触发外部副作用。
- 不提交、推送、合并、部署或替换运行服务，除非 Owner 后续逐项授权。

## Affected Modules

- 模块：上书房咨询—精确理解确认—既有拟旨入口的前端阶段控制，以及 `DevStudyWorkspace`/`studyTaskCockpit` 展示投影。

- 允许路径：approval manifest 中按字典序冻结的 11 条精确前端文件，2 ADD + 9 MODIFY；不得扩大到目录通配、BFF、后端或第 12 条产品路径。

## Technical Plan

详细 RED 测试、状态算法、实施顺序、完整验证命令与退出条件见：

`docs/superpowers/plans/2026-09-05-chaotang-v4-p1-shangshufang-real-chain.md`

未来获得 machine GO 后，exact candidate H 才可使用合成 fixture 验证 `/study` 全状态、1350×768/1600×900、IME、键盘/焦点、reduced-motion、无背景，并验证同一 H 的 `/dadian` 与 `/junjichu/scene-board` 无回归；不得触发真实模型或真实下旨。

## Implementation Report

当前只完成治理候选编制。未修改产品代码，未创建产品 candidate H，未提交、未推送、未合并、未部署，也未使用真实客户数据或触发外部副作用。

## Acceptance Review

当前结论：`READY_FOR_OWNER_EXACT_DIGEST_CONFIRMATION / PRODUCT_NOT_AUTHORIZED`。任何基线漂移、路径扩大、摘要变化或 machine STOP 都使候选失效。
