# Amendment Draft：智能体组织操作系统 V1 · 军机处专项骨架

## 状态

`DRAFT_ONLY`。本文件不是产品施工授权。

## 一、背景

当前主线已有：

- 上书房下旨、丞相路由、六部办理、军机处会审、锦衣卫证据、史馆归档主链。
- Scene Pack V1：五个高价值场景入口、统一 `SceneRun`、军机处 Scene Board 和 `BoardMission`。
- 六部/司级 Runtime Skill registry、工具策略和证据脊柱。

缺口是：用户提出一个目标后，还没有通用“设立专项 / 组建项目组 / 责任矩阵 / 验收标准 / 任务推进”的项目组织层。

## 二、目标

建立一个不成为第二事实源的军机处专项骨架：

用户目标或 SceneRun 结果
→ 军机处设立专项
→ 丞相生成项目纲领
→ 推荐参战部门和临时角色
→ 生成任务卡、责任矩阵、验收标准
→ 用户确认后进入执行跟踪

## 三、必须复用的主链

- 丞相：目标澄清、项目纲领、主办/会办/候命/不召理由。
- 军机处：专项状态、任务卡、责任矩阵、进度和阻塞。
- 六部：长期业务责任归属。
- Scene Pack：从既有场景结果创建专项。
- 锦衣卫：仅作为证据核验需求的承接方，不新增任意外网触发入口。
- 史馆：本轮只预留归档引用，不实现正式 SceneRun 归档。

## 四、数据契约候选

### `ProjectOrganization`

```json
{
  "projectId": "string",
  "sourceType": "manual_goal|scene_run",
  "sourceId": "string|null",
  "tenantId": "string",
  "ownerUserId": "string",
  "title": "string",
  "objective": "string",
  "userValue": "string",
  "status": "draft|active|awaiting_input|blocked|completed|archived",
  "riskGrade": "low|medium|high",
  "successCriteria": ["string"],
  "nonGoals": ["string"],
  "requiredInputs": ["string"],
  "members": [
    {
      "dept": "string",
      "office": "string|null",
      "role": "LEAD|COOPERATE|STANDBY|ABSTAINED",
      "reason": "string",
      "responsibility": "string",
      "deliverable": "string",
      "qualityGate": "string"
    }
  ],
  "missions": [
    {
      "title": "string",
      "ownerDept": "string",
      "stage": "todo|in_progress|awaiting_input|blocked|done",
      "acceptanceCriteria": ["string"],
      "nextMilestone": "string"
    }
  ],
  "evidenceRefs": [],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

## 五、API 候选

- `GET /api/v1/court/project-organizations`
- `GET /api/v1/court/project-organizations/{project_id}`
- `POST /api/v1/court/project-organizations`
  - 入参：`objective`、可选 `sourceRunId`、`demo`
  - 行为：创建 `draft` 专项，生成项目纲领、成员投影和任务卡
- `PATCH /api/v1/court/project-organizations/{project_id}`
  - 仅允许安全状态流转和下一步文案更新
- `POST /api/v1/court/project-organizations/from-scene-run/{run_id}`
  - 从当前用户拥有的 SceneRun 创建专项

前端 BFF 使用同源 `/api/court/project-organizations/**`，不得暴露后端地址或 session。

## 六、前端候选

### 军机处

- 在 `/junjichu` 增加“设立专项”入口。
- 在 `/junjichu/project-organizations` 增加专项列表。
- 在 `/junjichu/project-organizations/[projectId]` 展示：
  - 当前做什么
  - 谁负责
  - 缺什么
  - 下一步点哪里
  - 项目组成员和不召理由
  - 任务卡和验收标准

### Scene Pack

- 在场景结果页增加“设立军机处专项”按钮。
- 只传 `runId`，后端按 owner/tenant 重载 SceneRun，不接受客户端伪造项目事实。

## 七、安全边界

- 不新增外部 provider 调用。
- 不生成真实工程执行提示词。
- 不读取密钥、环境变量或用户隐私。
- 不提交、推送、部署。
- 不自动发送客户消息、报价、合同或投标文件。
- 所有 demo 数据必须带 `demo=true`。
- 缺目标、缺 SceneRun 或 owner 不匹配时必须失败关闭。

## 八、验收建议

- 后端测试：
  - 创建 manual goal 专项。
  - 从 owned SceneRun 创建专项。
  - 跨 owner SceneRun 返回 404。
  - 缺目标返回 422。
  - 状态流转只允许安全枚举。
- 前端测试：
  - `/junjichu` 可见“设立专项”入口。
  - Scene Pack 结果可进入专项创建入口。
  - 专项详情显示目标、成员、任务卡、验收标准。
- 构建门禁：
  - backend ruff + targeted pytest。
  - frontend typecheck + lint + build + node:test。
  - root harness check + harness doctor。

## 九、施工授权前置

施工前必须由 Owner 明确批准：

- exact amendment digest；
- exact base；
- exact allowed paths；
- exact verification commands；
- 是否允许创建单一治理 commit；
- 是否允许后续 fast-forward push。
