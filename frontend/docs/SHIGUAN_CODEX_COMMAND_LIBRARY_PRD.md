# 史馆借鉴 · Codex 命令库 PRD

> 状态：accepted draft  
> 目标：让史馆不只归档业务任务，也归档“如何指挥 Codex 完成任务”的高价值协作经验。
> 上位系统：`docs/SELF_EVOLVING_COURT_SYSTEM.md`

## 1. 为什么要做

朝堂的飞轮不是“页面越来越多”，而是“每次任务之后，下一次更会派活”。

Codex 命令库要沉淀三类资产：

- 好命令：能稳定让 agent 交付的输入格式。
- 好验收：能判断任务是否真的完成的证据清单。
- 好教训：能避免下次误伤、跑偏、伪装 mock 的规则。
- 好反目标：明确本次优化不允许牺牲的底线，防止系统在错误方向上自我强化。
- 好模型策略：明确哪些任务用高推理，哪些任务用 cheap/fast，哪些必须人工裁决。

## 2. 最小闭环

```text
用户给 Codex 下命令
  -> Codex 执行并验证
  -> 史馆记录目标 / 上下文 / 禁区 / 模型策略 / 验收 / 证据 / 结果
  -> 太史令抽取 lessons / playbook / tags
  -> 下一次相似任务自动召回 3 条历史命令
```

## 3. UI 落点

当前先落在 `/scribe`：

- 首页新增“Codex 命令库”卡片。
- 新增 `Codex` tab，展示黄金命令模板、归档字段和复盘问题。
- 后续接 `/api/scribe/lessons` 时，把 Codex 协作案也写入 lesson store。

## 4. 数据模型

复用史馆 lesson 思路，新增协作案字段：

```ts
interface CodexCommandCase {
  id: string;
  title: string;
  intent: string;
  contextFiles: string[];
  constraints: string[];
  antiGoals: string[];
  modelPolicy: {
    mode: 'auto' | 'cheap' | 'fast' | 'high_reasoning' | 'vision_review' | 'manual';
    riskLevel: 'low' | 'medium' | 'high' | 'one_way';
    requiredCaps: string[];
    allowFallback: boolean;
    humanGate: { required: boolean; reason?: string };
  };
  acceptance: string[];
  actions: string[];
  evidence: Array<{ type: 'command' | 'screenshot' | 'link'; value: string; result?: string }>;
  outcome: 'success' | 'mixed' | 'failed';
  userValue?: string;
  lessons: string[];
  contraCheck: Array<{ antiGoal: string; status: 'held' | 'violated' | 'unknown'; evidence: string }>;
  routingDecision?: {
    selectedModel: string;
    requiredCaps: string[];
    estimatedCostUsd?: number;
    fallbackUsed: boolean;
    reason: string;
  };
  playbook: string;
  tags: string[];
  createdAt: string;
}
```

## 5. 验收

- `/scribe` 首页能看到“Codex 命令库”入口。
- `Codex` tab 能复制使用黄金命令格式。
- README 指向 `docs/CODEX_COMMAND_LIBRARY.md`。
- 后续任何重大 Codex 任务都能按该格式归档。
- 重大任务必须记录 `modelPolicy`；如果用了 fallback，必须明示。
- 用户说“脑雾 / 找回上下文 / 先确认主线”时，系统优先执行脑雾恢复协议。
- 用户给具体可执行命令时，系统不打扰，直接执行；只有输入过短、空泛、脑雾、全做、上线、高风险或缺少验收时，才触发轻量提示词引导。
- 触发引导时，必须先说明“基于哪些上下文判断”，再给“更好的说法 + 四个重点”：要做什么 / 不做什么 / 怎么算完成 / 下一步先做什么。
- 上线、架构、安全、金融等高风险任务，才展开为目标 / 用户 / 成功指标 / 禁区 / 验收 / 证据。

## 6. 不做

- 不先做数据库迁移。
- 不先做自动抓取 Codex 对话。
- 不把未验证的命令模板标成“最佳实践”。
- 不把“全做”解释为无边界扩张；必须先拆 P0/P1/P2。

先让人会用，再让系统自动化。
