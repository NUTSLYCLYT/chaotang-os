# 朝堂 V4 P1 上书房真实确认门实施计划

任务 ID：`CHAOTANG-V4-P1-SHANGSHUFANG-REAL-CHAIN-20260905`

状态：`DRAFT / NON_AUTHORIZING`

## Goal

在现有 `/study` 和唯一 decree-job 主链上补齐“丞相先复述、用户确认精确复述后才能拟旨”的强制门；确认内容必须真实进入拟旨输入，不能只是视觉确认。

## Baseline

- Base：`0e99b954727fab776503266df4f83209685cd2a7`
- Tree：`07328649481653ef6f00f1ae28b7fe0f9afb5e15`
- V5 Scope Digest：`e8beaa39680859856b15fde82799d65cbc772254b37274ce423169dcc86624b3`
- 根 Harness：`PASS`（159 个基线文件）
- Root Doctor：`PASS / STRUCTURE_VALID_NON_AUTHORIZING`
- Product Authority：`STOP / APPROVAL_NOT_SELECTED`
- First Decree Cockpit、军机处 SceneBoard 与 Single Product Export Truth A1 均为冻结回归面。

## Plan

1. Owner 确认 approval manifest canonical digest，并另行授权只含三条治理路径的 commit；否则停止。
2. 从远端 exact approval commit 建立干净单亲子产品候选，运行 scoped `product-authority --authorize`；非 GO 停止。
3. 先新增 RED：冻结 outer-trim、exact restatement、owner/context/generation 失效、确定性组合文本，以及类型化已确认输入唯一 draft boundary。
4. 在 `StudyClient.test.ts` 用可控 deferred Promise 锁定 owner 切换、目标/上下文在途修改、新咨询覆盖旧咨询、旧 draft 与旧 401；断言旧回包不能改变 messages、pending、error、confirmation、draft、localStorage 或 redirect。
5. 在 `chancellorDraft.test.ts` 锁定 `requestChancellorDraft` 只接受确认模块工厂的类型化输入，并精确发送不可变确认快照组合文本。
6. 最小实现纯函数确认投影与类型化输入工厂；使用 request/generation identity 和 owner ref 管理失效，不写业务存储；较新咨询在开始时立即使旧确认失效。
7. 确认按钮冻结快照并立即调用现有 `requestChancellorDraft`，保留现有 draft version/fingerprint authority。
8. `DevStudyWorkspace` 增加理解卡与默认智能版的本地 selector；定制版只展开同源 props。按完整阶段 CTA 白名单压制或重路由 `FirstDecreeWelcome`、quick-dock 与 daily memorial 控件。
9. `studyTaskCockpit` 只做动作/披露投影，不改 decree job；等待态零主动作，主动阶段至多一个。
10. 运行既有 `decreeStatus.test.ts` 与 `studySubmission.test.ts`，证明提交未知查单、轮询、失败/取消和结果映射未改变。
11. 执行 manifest 全部 11 项命令；失败先找根因，不放宽合同。
12. 仅在 machine GO 后的 exact H 使用受控合成 fixture 做 `/study`、`/dadian` 和 `/junjichu/scene-board` 双视口浏览器门。
13. 完成独立 Frontend/TypeScript、UX 与冻结边界审查；存在 P0/P1/P2 即 NO-GO。
14. 全部通过后计算 candidate H/tree/diff/evidence digest，提交 Owner 第二次确认；不自行 commit/push/merge/deploy。

## State Projection

```text
EMPTY
  → CONSULTING
  → UNDERSTANDING_READY
  → CONFIRMED_AND_DRAFTING
  → DRAFT_READY
  → SUBMISSION_UNKNOWN | QUEUED | RUNNING
  → SUCCEEDED | FAILED | CANCELLED
```

- `SUBMISSION_UNKNOWN`：走现有幂等 lookup/recovery，禁止盲目重提。
- `SUCCEEDED`：只显示公开响应已有结果，不推断 `replyId` 或同 lineage。
- `FAILED/CANCELLED`：进入原因与恢复，不进入 archive。
- 归档后裁决与公开 lineage 是后续独立任务。

## Confirmation Algorithm Contract

```text
normalizedGoal = trimOuterWhitespace(currentGoal)
snapshot = {
  ownerId,
  normalizedGoal,
  exactRestatement,
  consultationGeneration,
  contextGeneration
}

valid only if every current field still equals snapshot

draftInput =
  "[用户原始目标]\n" + snapshot.normalizedGoal +
  "\n\n[用户已确认的丞相理解]\n" + snapshot.exactRestatement
```

不进行浏览器语义改写。咨询和拟旨回包只有在 owner、request/generation 与 source snapshot 仍匹配时才能更新 UI。

## Verification

- focused：确认、Draft、StudyClient、Workspace、Cockpit，以及既有 `decreeStatus`、`studySubmission` 回归；
- full frontend：test、lint、typecheck、build；
- root：product-authority regression、Harness、doctor、V2 convergence、diff check；
- browser：exact H、合成 fixture、1350×768/1600×900、全状态、IME、焦点、对比度、reduced-motion、无背景，以及 `/dadian`、`/junjichu/scene-board` 截图和 console。

## Non-goals

- 不改后端、BFF、数据库、Agent、权限、史馆、军机处、大殿、SceneBoard、Single Product Export Truth A1、全局壳或共享全局样式。
- 不实现三策、史馆裁决、public lineage、pause/resume、change request、全局任务列表、附件或蜂群 API。
- 不安装依赖，不访问真实 provider，不使用生产或客户数据。
- 不提交、推送、合并、部署或替换运行服务，除非 Owner 后续逐项明确授权。

## Exit

本治理候选终点是：三文件 closed-schema 有效、根 Harness 通过、独立治理审查通过，并把新的 manifest canonical digest 提交 Owner 确认。它本身不授权产品实施或任何 Git/外部动作。
