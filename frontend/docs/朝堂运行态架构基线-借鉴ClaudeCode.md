# 朝堂运行态架构基线 · 借鉴 Claude Code（2026-06-28）

> 解决"skill 带不进 app"的根问题。结论:**抄架构,不抄 skill;用 SDK,不 fork 源码。**

## 〇、先纠正一个事实（影响整个策略方向）
- ❌ Claude Code **没有开源**(专有 CLI)。
- ✅ 公开可建的是 **Claude Agent SDK**(`@anthropic-ai/sdk` TS / `anthropic` Python)。
- ⚠️ **Claude Code 的 skill 是 CLI 专属,SDK 上的 agent 加载不了**——这正是"skill 带不进 app"的官方确认。**别再纠结怎么把 skill 塞进产品,塞不进。**

## 一、两个词永久分家（以后讨论先问"你说哪个"）
| | 开发态 skill | 运行态 capability |
|---|---|---|
| 例 | stock-analysis / xiaohongshu-write / 大神视角 | 户部线上真能调的能力 |
| 跑哪 | Claude Code（我的环境） | 部署后的 app/后端 |
| 进 app? | ❌ 永远不能 | ✅ 这才 ship |
| 角色 | **配方/蓝图**(开发时照抄方法) | **盖出来的成品** |

## 二、通用型运行时引擎（借鉴 Claude Code 七模式）

**1 个引擎 × N 份司配置**,不是 N 个 skill。

```
execute(司配置, 任务):
  ① Agent Loop          收集上下文(数据源+规则+记忆) → LLM决策 → 调工具 → 校验 → 循环
  ② 有界声明式工具集     每个司只给 3-5 个工具,启动时声明、带 schema、禁运行时发现
                        户部=[读财报,生成报告]，永不给[付款]；礼部=[读社媒,生成,发布]
  ③ 堆叠式权限门(代码里) 工具级(这司能调这工具吗) + 动作级(高风险?) + 人确认级(签字)
                        ★ 绝不靠 LLM"小心"，gate 写在代码里,每步记审计 ★
  ④ 单一真相源(SSOT)    规则/契约/枚举各一张表,各司 import,禁平行表(防漂移)
  ⑤ 子agent fan-out     会审 = 派多个隔离子agent(各自上下文+工具)，并行后合议
  ⑥ MCP 接外部          外部数据/API 经 MCP 接，别把外部 SDK 直接 import 进 agent
  ⑦ Hooks as middleware 工具执行前后的确定性校验(接地/质门/格式)，非 AI 驱动
```

**司 = 一份配置**:`{ 人设prompt, 数据源, 允许的工具集, 输出schema, 自治等级 }`
- 户部 = 引擎 + {财务人设, Turso财报, [读财报,生成估值报告], 估值schema, L1需人确认}
- 礼部 = 引擎 + {营销人设, 社媒MCP, [读数,生成,发布], 种草schema, L0每步确认}

## 三、本仓已有什么 / 缺什么（好消息:地基对了一半）

| Claude Code 模式 | 本仓已有 | 状态 |
|---|---|---|
| Agent Loop | `core/courtos/orchestrator/decision-loop` + `harness/agent-harness` | ✅ 有 |
| LLM 核心 | `lib/llm/router` callLLM→LiteLLM | ✅ 有 |
| 堆叠权限门 | `harness/human-approval-gate`(L0-L4) + `report-quality-gate` | ✅ 有,正是这模式 |
| SSOT | `lib/contracts/*` + `reality-state` + `primary-store` | ✅ 有,且已立铁律2 |
| 审计台账 | `lib/swarm/decision-ledger` | ✅ 有(户部已用) |
| 有界工具集 | —— | 🔴 **缺**:工具散在各 route，没有统一声明式工具层 |
| 配置化司引擎 | 户部 askHubu 是雏形,但**写死、未抽象** | 🟡 **半**:有一个,没抽成引擎 |
| MCP 外部接入 | —— | 🔴 **缺**:外部数据(行情/社媒)没有标准接入 |

**结论:你不缺地基,缺的是把户部那个雏形抽成「1 引擎 + 有界工具集 + MCP 接入」。**

## 四、两个最致命的坑（Claude Code 团队踩过,别再踩）
1. ❌ **把 skill 当 agent**——skill 是静态提示模板,agent 是有状态执行者。你的"司能力"要建成 `提示+工具束`,不是 .md 文件等运行时发现。
2. ❌ **把权限当"人/提示"问题**——指望 LLM"小心"地写主表/付款,就已经输了。**权限 gate 在代码里,不在 prompt 里。** 这是你代码的责任,不是 Claude 的。

## 五、落地路径（先抽引擎,再接工具,再加司）
1. **从户部 askHubu 抽出 `execute(司配置, 任务)` 引擎**(七模式的 ①③④⑦ 本仓已有,组装即可)。
2. **建有界工具层**:先 2 个真工具——`读数据源`、`生成可下载交付物`(报告.md/.pdf)。
3. **户部跑通 L2**:配置户部 → 产第一份可下载真估值报告(权限 L1 人确认)。
4. **接第一个 MCP 外部源**(如行情)→ 钦天监/户部有真实时输入。
5. **7 强配司各写一份配置**,复用同引擎+工具层。

## 六、一句话
**"替代员工"不是装 200 个 skill 的玄学,是「1 个借鉴 Claude Code 的运行态引擎 + 5 个有界工具 + 一个个接数据源」的工程。** 后者你做得到。

> 卡帕西:最干净的系统把「agent 知道什么(数据/规则)」「能做什么(工具)」「决定什么(调哪个工具)」三者分开。Claude Code 做到了;多数团队糊成"LLM 决定一切",然后纳闷 agent 为什么乱来。
