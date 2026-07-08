# 朝堂自进化研发系统 · v0.1

> 目标：打造一套能持续开发朝堂项目、优化蜂群能力、提升输出质量的受控自进化系统。
> 原则：自动化可以扩大执行力，但不能绕过验收、成本、安全和人的最终裁决。

## 1. 一句话

```text
朝堂自进化 = 史馆记忆 + 蜂群评测 + 模型路由 + Codex 执行 + 严口径闸门 + 反目标约束 + 人类裁决 的闭环。
```

它不是“让 AI 自己随便改代码”，而是：

1. 史馆召回相似经验。
2. 丞相把目标压成可验收命令。
3. 模型判官按风险、复杂度、上下文、成本和可验证性选择模型档位。
4. Codex / 蜂群执行最短真闭环。
5. 工部/门下用测试、截图、评测、成本、安全闸验收。
6. 门下检查反目标：本次优化不允许牺牲真实性、成本上限、安全边界、用户可裁决性。
7. 史馆归档协作案，抽取 lesson / playbook / tags。
8. 下一次任务自动召回，改进命令和评测。

## 2. 系统分层

| 层 | 名称 | 责任 | 当前资产 |
|---|---|---|---|
| L0 | 史馆记忆层 | 记录任务、证据、复盘、命令模板 | `/api/scribe/lessons`、`lesson-store`、Codex 命令库 |
| L1 | 任务压缩层 | 把模糊目标转为目标/上下文/禁区/验收 | `docs/CODEX_COMMAND_LIBRARY.md` |
| L2 | 执行层 | Codex 改代码，蜂群跑业务输出 | 当前 Codex + `/api/court/orchestrate*` |
| L3 | 评测层 | 判断输出好不好、准不准、稳不稳 | `tests/swarm-eval`、`gate.mjs`、Playwright |
| L4 | 反目标层 | 检查优化不能牺牲的底线 | 本文 §6 反目标清单 |
| L5 | 裁决层 | 人类决定采纳/打回/扩大自动化范围 | 史馆归档 + 老板御批 |
| L6 | 优化层 | 把失败模式变成新规则、prompt、测试、模板 | lesson extractor + command playbook |
| L7 | 模型治理层 | 自动选择模型档位，记录理由，允许人工覆盖 | `src/lib/llm/router.ts`、`src/lib/llm/registry.ts` |

## 3. 闭环协议

每一次自进化任务必须经过 9 步：

```text
1. Intake   立案：用户目标 + 史馆召回 3 条相似案
2. Plan     拟旨：生成 Codex 命令，明确禁区和验收
3. Route    分模：选择 cheap / fast / reasoning / long_context / vision / manual_review
4. Execute  执行：Codex 改代码 / 蜂群产出
5. Verify   验收：tsc / build / E2E / 截图 / swarm-eval gate
6. Contra   反目标：列出本次优化不准牺牲的东西，并检查是否被破坏
7. Review   会审：列出收益、风险、失败路径、成本
8. Archive  归档：写入 Codex 协作案 + lesson
9. Improve  进化：生成下一条 playbook / test / guardrail
```

缺任一步，不允许标记为“系统学会了”。

## 4. 自动化等级

| 等级 | 名称 | 自动化范围 | 人类介入 |
|---|---|---|---|
| A0 | 人工驾驶 | 用户直接命令 Codex | 全程人工 |
| A1 | 史馆辅助 | 自动召回相似案、推荐命令模板 | 人类确认命令 |
| A2 | 半自动执行 | 系统生成任务卡，Codex 执行，自动跑验证 | 人类确认 merge/deploy |
| A3 | 受控自修复 | 低风险 bug/文档/测试可自动改、自动归档 | 人类审核 diff |
| A4 | 自主优化 | 蜂群根据评测低分自动提出 prompt/test/code 改进 | 人类只裁决放行 |
| A5 | 全自动生产变更 | 不建议当前做 | 禁止 |

当前朝堂应做到 **A2**，局部文档/测试/低风险 UI 可试 **A3**。

## 5. 三条进化飞轮

### 5.1 研发飞轮

```text
失败 build / E2E / 截图问题
  -> 史馆归档失败模式
  -> 生成 guardrail / checklist
  -> 下次 Codex 命令自动带上禁区
  -> 返工减少
```

指标：

- 首次通过率
- 平均返工次数
- build 失败类型分布
- 截图视觉问题复发率

### 5.2 蜂群能力飞轮

```text
真实问题题库
  -> 蜂群输出
  -> judge / gate 严口径评分
  -> 找低分维度：accuracy / traceability / actionability
  -> 改 prompt / 数据源 / merge 策略
  -> 再跑同题和变体题
```

指标：

- accuracy ≥ 4 通过率
- 数字接地 100% 通过率
- deep vs single 协作增益
- 卡死率 / 503 率 / P95 延迟
- 成本 / 有用输出

### 5.3 产品价值飞轮

```text
老板真实问题
  -> 真奏折
  -> 采纳 / 打回 / 追问
  -> 史馆记录用户价值
  -> 下一次建议引用历史偏好和证据
```

指标：

- “这帮我了”次数
- 采纳率
- 打回原因
- 史馆引用率
- 从问题到可裁奏折耗时

## 6. 反目标清单

每一次自动优化都必须带 `antiGoals`。没有反目标，不允许进入执行或归档为“可复用经验”。

默认反目标：

```yaml
antiGoals:
  - 不牺牲真实性：mock/fallback 不得伪装成真模型或真数据
  - 不牺牲安全：不得绕过鉴权、租户隔离、预算闸、人工裁决
  - 不牺牲可裁决性：输出必须让用户能采纳、打回、追问，而不是替用户黑箱决定
  - 不牺牲可观测性：必须留下输入、输出、diff、验证结果、成本或失败原因
  - 不牺牲可回滚性：高风险变更必须能回滚或被人工拦截
  - 不牺牲端口纪律：不得占用 3001，不得用 dev 顶掉 3050
```

反目标检查三问：

1. 这个改进如果成功，会不会让系统在错误方向上更自信？
2. 它优化了哪个指标，又牺牲了哪个更高优先级指标？
3. 如果它错了，史馆能否回放证据并阻止下次复用？

## 7. 模型路由守则

不要用“最新/最贵/最强”当默认策略。模型选择必须按任务本身，而不是按品牌崇拜。

核心原则：

1. **高推理模型只用在刀刃上**：问题定义、架构取舍、harness 设计、安全/成本/鉴权、最终复核。
2. **便宜快模型处理低风险批量活**：摘要、标签、测试数据、简单文案、低风险文档补全。
3. **视觉任务必须要看图**：UI/UX/美工验收需要 vision 或 Playwright 截图证据，不能只听文字自评。
4. **单向门必须人工介入**：生产部署、删数据、改鉴权、放开预算、自动执行权限，不允许模型自行最终拍板。
5. **路由理由必须入史馆**：每次自动路由记录 selectedModel、requiredCaps、riskLevel、reason、costEstimate、fallback 状态。
6. **fallback 必须降级标注**：不能把 scripted/mock/fallback 包装成 live model 结论。

推荐路由矩阵：

| 任务类型 | 默认档位 | 必备能力 | 人工介入 |
|---|---|---|---|
| 任务分诊、标签、归档摘要 | cheap / fast | `cheap`, `fast`, `json_mode` | 不需要 |
| 长文档召回和压缩 | long_context + cheap | `long_context`, `json_mode` | 重要文档抽样看 |
| UI 文案、低风险页面补料 | cheap / fast | `chinese_native` | PR 级人工看 diff |
| UI/UX/美工验收 | vision + reasoning | `vision`, `reasoning` | 必须看截图 |
| harness 工程、状态机、模型治理 | top reasoning | `reasoning`, `tool_use`, `long_context` | 必须人工确认方案 |
| 鉴权、安全、预算、租户隔离 | top reasoning + adversarial review | `reasoning`, `tool_use` | 必须人工裁决 |
| 生产发布、删除数据、放开自动执行 | 不自动执行 | `reasoning` 只做建议 | 必须人工批准 |

模型策略字段：

```yaml
modelPolicy:
  mode: auto | cheap | fast | high_reasoning | vision_review | manual
  riskLevel: low | medium | high | one_way
  requiredCaps:
    - reasoning
    - tool_use
  maxCostUsd: 0.50
  allowFallback: false
  humanGate:
    required: true
    reason: 涉及 harness 架构和自进化方向，错误会被系统放大
```

当前代码已接入只读观察：`src/lib/llm/router.ts` 仍按 `LlmIntent.requires / prefers / maxCostUsd / triage` 做真实模型选择；`src/lib/llm/model-governor.ts` 生成 `riskLevel / humanGate / allowFallback / routingReason` 判词，并写入 telemetry。它不会改变真实路由结果，只负责暴露影响点。

升到“接管路由”前的准入条件：

1. 至少连续观察 30 条真实调用。
2. `fallbackPolicyViolations = 0`。
3. high / one_way 任务全部有 humanGate 记录。
4. 史馆能回放 selectedModel、riskLevel、warnings 和成本。
5. 人工确认没有把 cheap 模型推到高风险拍板位置。

日常看板只看三个数，避免被指标海淹没：

1. `violated`：模型治理底线是否被破坏。
2. `fallbackPolicyViolations`：禁止 fallback 的任务是否发生降级。
3. `humanGateRequired`：有多少调用需要人工复核。

这三个数已在 `/settings` 的 Model Governor 面板展示。它是只读面板，不改变路由。

## 8. 最小可行系统

第一版只做 4 件事：

1. **Codex 协作案归档**
   - 每次任务结束写一条 YAML/JSON 协作案。
   - 字段沿用 `docs/CODEX_COMMAND_LIBRARY.md`。

2. **史馆召回**
   - 新任务开始前，按 tags / 文件 / 页面召回 3 条相似协作案。
   - 先手工或文件检索，后续接 API。

3. **严口径验证包**
   - 工程任务：`tsc`、`build`、必要截图。
   - 蜂群任务：`tests/swarm-eval/gate.mjs`。
   - 安全/成本任务：鉴权、预算、限流检查。

4. **进化建议生成**
   - 每次归档输出一条 `next_playbook`。
   - 若失败，输出一条新 guardrail。
   - 每条建议必须带 `antiGoals` 和 `contraCheck`。

## 9. 数据结构

```ts
interface EvolutionCase {
  id: string;
  kind: 'codex_dev' | 'swarm_eval' | 'product_decision' | 'ops_incident';
  title: string;
  objective: string;
  context: {
    files: string[];
    docs: string[];
    relatedCases: string[];
  };
  constraints: string[];
  antiGoals: string[];
  modelPolicy: {
    mode: 'auto' | 'cheap' | 'fast' | 'high_reasoning' | 'vision_review' | 'manual';
    riskLevel: 'low' | 'medium' | 'high' | 'one_way';
    requiredCaps: string[];
    maxCostUsd?: number;
    allowFallback: boolean;
    humanGate: {
      required: boolean;
      reason?: string;
    };
  };
  acceptance: string[];
  actions: string[];
  evidence: Array<{
    type: 'command' | 'screenshot' | 'scorecard' | 'log' | 'user_quote';
    value: string;
    result?: 'passed' | 'failed' | 'mixed';
  }>;
  metrics: Record<string, number | string | boolean>;
  outcome: 'success' | 'mixed' | 'failed';
  lessons: string[];
  guardrails: string[];
  contraCheck: Array<{
    antiGoal: string;
    status: 'held' | 'violated' | 'unknown';
    evidence: string;
  }>;
  nextPlaybook: string;
  tags: string[];
  createdAt: string;
}
```

## 10. 系统守则

1. 没有验收，不算完成。
2. 没有证据，不进史馆。
3. 没有用户价值，不算进化。
4. mock / fallback 必须明示。
5. 自动化等级只能逐级升，不能跳。
6. 生产、鉴权、成本、数据删除属于单向门，必须人工裁决。
7. 任何“自我优化”都必须能回放输入、输出、diff、测试结果。
8. 没有反目标，不准执行；反目标被破坏，不准复用。
9. 没有模型路由理由，不准把输出当作可复用经验。
10. 高风险任务不允许 fallback 冒充 live，也不允许 cheap 模型独立拍板。

## 11. 第一批任务卡

```yaml
- id: EVO-01-codex-case-store
  title: Codex 协作案本地归档
  priority: P0
  do: 新增 evolution case JSONL store + API 写入/读取
  acceptance:
    - 可写入一条协作案
    - 每条协作案必须包含 antiGoals
    - /scribe Codex tab 可读取最近 5 条
    - tsc/build 通过

- id: EVO-02-similar-case-recall
  title: 任务开始前召回相似协作案
  priority: P0
  do: 按 tags/files/objective 简单打分召回 3 条
  acceptance:
    - 给定 objective 返回相似案
    - 返回 lessons/guardrails/nextPlaybook

- id: EVO-03-validation-runner
  title: 验证包统一 runner
  priority: P1
  do: 封装 tsc/build/e2e/swarm gate 的结果为 evidence
  acceptance:
    - 失败时记录命令、退出码、摘要
    - 成功时能进入协作案 evidence

- id: EVO-04-swarm-improvement-loop
  title: 蜂群输出低分自动生成改进案
  priority: P1
  do: 读取 scorecard/gate 失败项，生成 prompt/data/test 改进建议
  acceptance:
    - 对 accuracy<4 的 case 生成具体修复建议
    - 每条建议带反目标和反目标检查
    - 不自动改生产 prompt，先入史馆候审

- id: EVO-05-model-governor
  title: 模型治理器接入自进化闭环
  priority: P0
  do: 给协作案和 LLM Router 增加 riskLevel / humanGate / allowFallback / routingReason，并在设置页展示红黄绿看板
  acceptance:
    - harness 工程类任务自动标记 high 或 one_way
    - high/one_way 任务必须人工确认后才允许执行或采纳
    - fallback 输出在 UI 和史馆里明确标注
    - 每次路由留下 selectedModel、requiredCaps、costEstimate、reason
    - /settings 展示 violated、fallbackPolicyViolations、humanGateRequired
    - tsc/build 通过
```

## 12. 结论

可以做，而且朝堂已经有 60% 基础。

不要从“全自动改代码”开始。先做 **A2：史馆辅助 + 半自动执行 + 严口径验收 + 自动归档**。
当连续 30 条协作案证明返工减少、输出质量提高，再开放 A3。
