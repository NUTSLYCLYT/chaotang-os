# 上书房下旨双轨实现方案

## 目标

把「下旨」明确拆成两套业务路径：

1. **简单任务单**：由丞相判定后，直接交给一个明确 Agent 或单一部门办理。
2. **复杂任务 / 集群任务**：进入军机处，组织多部门或蜂群集群会审，再形成可裁决奏折。

前端只负责表达用户动作和展示丞相判定结果；任务复杂度、承办路径和是否启用集群由**丞相**判断。工程实现上，丞相判断运行在后端，前端不自行分流。

## 当前不一致

当前普通下旨主链基本是：

```text
用户输入
→ draft-edict
→ confirm-edict
→ 军机处会审
→ 后端蜂群
→ 回奏 / 圣裁
```

也就是说，现在主链默认偏向「复杂任务」。代码里虽然已有 `direct / junjichu`、`shallow / standard / deep` 等设计，但没有接入上书房正式下旨接口。

需要补齐的是：`draft-edict` 先产出丞相的任务类型判断，`confirm-edict` 按丞相判断执行不同路径。

## 双轨定义

### A. 简单任务单

适用场景：

- 单一部门即可处理。
- 不涉及付款、合同、报价、股权、对外承诺、高风险经营决策。
- 不需要多部门冲突判断。
- 用户目标明确，输入证据足够或结果只要求草案/摘要/初步建议。

典型例子：

- 「帮我整理一份客户拜访纪要」
- 「把这段话改成正式通知」
- 「让户部看一下这笔预算是否超标」
- 「让工部给这个交付计划出一版初判」

执行路径：

```text
用户下旨
→ 丞相拟旨
→ 丞相判定 route.mode = direct
→ 指定 target_agent / department
→ 生成简单任务单
→ 单 Agent 执行
→ 回执展示
→ 可归档 / 可转复杂会审
```

页面输出格式：

```text
所议
承办 Agent
任务判断
处理结果
证据 / 输入来源
风险与限制
下一步
质门
追溯
```

### B. 复杂任务 / 集群任务

适用场景：

- 多部门共同判断。
- 涉及合同、付款、报价、股权、融资、对外承诺、重大资源投入。
- 存在证据缺口或风险边界不明。
- 涉及部门冲突，例如户部保利润、兵部抢市场、刑部控风险。
- 需要形成可供老板裁决的奏折。

典型例子：

- 「客户要求 300 万正式报价，付款条件未定，要不要发」
- 「为了冲季度营收，要不要压价清库存」
- 「这个合作要不要签排他协议」
- 「是否启动一个跨部门新项目」

执行路径：

```text
用户下旨
→ 丞相拟旨
→ 丞相判定 route.mode = cluster
→ 军机处立案
→ 推荐参审部门 / 蜂群
→ 六部或相关 Agent 分奏
→ 御史台 / 质门检查
→ 军机处总回报
→ 圣旨正文 / 奏折展示
→ 皇上裁决：准奏 / 补证 / 复核 / 驳回 / 归档
```

页面输出格式：

```text
所议
军机处总回报
各司汇报
丞相分析
决策建议
风险与缺证
行动建议
质门
来源 / 追溯
```

## 丞相判定契约建议

`POST /api/court/shangshufang/draft-edict` 返回新增 `route`：

```ts
type DecreeRouteMode = 'direct' | 'cluster';

interface DecreeRoute {
  mode: DecreeRouteMode;
  decidedBy: 'chancellor';
  reason: string;
  reviewDepth: 'shallow' | 'deep';
  targetAgent?: string;
  targetDepartment?: string;
  departments: string[];
  swarmRequired: boolean;
  humanSignoffRequired: boolean;
  riskFlags: string[];
  evidenceGaps: string[];
}
```

示例：

```json
{
  "task_id": "task_xxx",
  "status": "awaiting_emperor_confirm",
  "draft_edict": {},
  "route": {
    "mode": "direct",
    "decidedBy": "chancellor",
    "reason": "单一部门可处理，未命中高风险词，证据缺口较少",
    "reviewDepth": "shallow",
    "targetAgent": "hubu_finance_agent",
    "targetDepartment": "户部",
    "departments": ["户部"],
    "swarmRequired": false,
    "humanSignoffRequired": false,
    "riskFlags": [],
    "evidenceGaps": []
  },
  "eval_result": {}
}
```

`POST /api/court/shangshufang/confirm-edict` 按 `route.mode` 分流：

```text
direct  → create_direct_task → run_single_agent → direct_receipt
cluster → create_junjichu_review → run_swarm_execution_loop → memorial
```

## 丞相判定规则

判定权归丞相。规则不是前端按钮规则，而是丞相拟旨时的判断准绳。丞相要输出两件事：

1. 此事走 `direct` 还是 `cluster`。
2. 为什么这么走，以及谁承办。

### 直接判为复杂任务

命中以下任一条件，走 `cluster`：

- 关键词：合同、签约、付款、融资、报价、股权、排他、赔偿、对外承诺、裁员、投资、预算超限。
- 推荐部门数量大于等于 2。
- 存在高风险 `risk_flags`。
- 存在关键证据缺口 `unknown_gaps`。
- 用户明确说：会审、军机处、六部、各部门、群臣、集群、蜂群。

### 可判为简单任务

同时满足以下条件，走 `direct`：

- 推荐部门数量等于 1。
- 没有高风险 `risk_flags`。
- 没有关键证据缺口，或缺口不影响生成初步结果。
- 输出目标明确，且可由单一 Agent 完成。

### 保守策略

不确定时走 `cluster`，但页面必须说明：

```text
因证据边界或风险类型不明，系统按复杂任务进入军机处会审。
```

## 前端展示策略

前端不自行判断复杂度，只读丞相返回的 `route.mode`。

### 拟旨预览页

必须展示：

```text
案号
原问
丞相拟旨
丞相判定：简单任务单 / 复杂集群任务
判定原因
承办方
风险与缺证
来源
批示按钮
```

### 简单任务回执页

使用 `EdictView`：

```ts
{
  title: '任务回执',
  seal: 'chancellor',
  rows: [
    { label: '所议', body: originalQuestion },
    { label: '承办', body: targetAgent },
    { label: '处理结果', body: result },
    { label: '风险与限制', body: riskText },
    { label: '下一步', body: nextAction },
    { label: '质门', body: qualityGate },
    { label: '追溯', body: traceText }
  ]
}
```

### 复杂任务奏折页

继续使用当前 `confirmedEdictToView()` 的结构，但补齐 `route.mode = cluster`、`reviewDepth` 和 `swarmRequired`。

## 建议落地顺序

### 第 1 步：只加丞相判定，不改执行

在 `draft_edict()` 后增加：

```text
chancellor_decide_route(edict) -> route
```

先返回 `route.mode`，前端只展示，不改变执行。

验收：

- 简单输入返回 `direct`。
- 高风险输入返回 `cluster`。
- 页面能看到丞相判定原因。

### 第 2 步：前端拟旨页展示路线

在 `DecreeDraftPreview` 保存 `route`。

拟旨页增加：

```text
丞相判定：简单任务单 / 复杂集群任务
承办路径：户部 / 军机处
原因：...
```

### 第 3 步：confirm-edict 真分流

后端 `confirm-edict`：

```text
if route.mode == 'direct':
    run_direct_agent_task()
else:
    run_junjichu_cluster_task()
```

### 第 4 步：补简单任务回执页

新增 `directReceiptToView()`，格式和复杂奏折并列。

### 第 5 步：清理 polish-edict

普通圣旨不再用 `/polish-edict`。

保留用途：

- 密旨草稿
- 纯文案润色

或者废弃，统一由 `/draft-edict` 负责拟旨。

## 不建议做的事

- 不建议前端根据按钮或关键词自己分流。
- 不建议把“丞相判断”写成一个没有角色语义的通用路由器；用户看到的应该是丞相判断，代码上可以是后端纯函数。
- 不建议简单任务也强行生成军机处奏折。
- 不建议复杂任务绕过质门直接给执行结果。
- 不建议 `/polish-edict` 创建一套和 `/draft-edict` 平行的草案体系。

## 最终用户体验

用户看到的是两种清晰反馈：

简单任务：

```text
丞相判定：此事可由户部直接承办。
原因：单一财务核查，无合同/付款/对外承诺风险。
批示后生成任务单，不开军机处。
```

复杂任务：

```text
丞相判定：此事需军机处会审。
原因：涉及报价、付款条件和对外承诺，需户部、刑部、兵部共同分奏。
批示后进入军机处集群任务。
```
