# 朝堂 OS 知识管理与进化内核参考 Harness

日期：2026-06-01

核心判断：朝堂 OS 不应做成普通 Obsidian、Notion 或 Wiki 克隆。最适合我们的方向是“经营记忆内核”：把每天的建议、预算、立项、执行、证据、复盘和下一次打法沉淀成可检索、可调用、可进化的企业大脑。

## 1. 本次下载的 GitHub 参考库

下载目录：

```txt
/home/ubuntu/workspace/github-reference-repos/knowledge-management
```

已下载：

| 项目 | GitHub | 当前星标 | 对朝堂 OS 的价值 |
| --- | --- | ---: | --- |
| AppFlowy | https://github.com/appflowy-io/AppFlowy | 71.5k | AI workspace、项目/wiki/团队协作，可参考产品完整度和本地优先协作体验 |
| AFFiNE | https://github.com/toeverything/AFFiNE | 68.9k | 文档 + 白板 + 表格，可参考“经营地图”和可视化规划 |
| SiYuan | https://github.com/siyuan-note/siyuan | 44.2k | 块级引用、双链、SQL 查询嵌入，最适合参考史馆证据块模型 |
| Logseq | https://github.com/logseq/logseq | 43.2k | 大纲、日记、双链、图谱，最适合参考每日经营日志和反向链接 |
| Outline | https://github.com/outline/outline | 38.7k | 团队知识库、权限、协作，可参考企业级史馆 |
| Wiki.js | https://github.com/requarks/wiki | 28.4k | 现代 wiki，可参考组织知识门户，不宜作为核心形态 |
| Docmost | https://github.com/docmost/docmost | 20.5k | Confluence/Notion 替代，可参考空间、评论、历史和权限 |
| BookStack | https://github.com/BookStackApp/BookStack | 18.8k | Books/chapters/pages 层级，适合作为制度手册参考 |
| Foam | https://github.com/foambubble/foam | 17.2k | Markdown + VS Code 知识库，可参考轻量导入导出 |
| Zettlr | https://github.com/Zettlr/Zettlr | 13.1k | 写作工作台，适合长文档和出版流，不是主参考 |
| EvoMap Evolver | https://github.com/EvoMap/evolver | 7.6k | 自进化 Agent 引擎，最适合参考“打法基因”和演化审计 |
| SilverBullet | https://github.com/silverbulletmd/silverbullet | 5.3k | 可编程 Markdown 知识库，可参考个人自动化和查询 |
| TriliumNext Notes | https://github.com/TriliumNext/Notes | 2.9k | 个人知识库，可参考层级笔记和本地使用 |

未成功下载：

| 项目 | 原因 |
| --- | --- |
| swarmclawai/swarmvault | Git clone 时 TLS handshake 失败，暂不作为当前决策依据 |

## 2. 顶层选择

### 第一梯队：直接影响朝堂 OS 产品结构

1. SiYuan：学习“块级证据”

朝堂 OS 的史馆不只是页面归档，而是把每次判断拆成可以引用的 EvidenceBlock。比如一次“户部预算审批”要能引用预算表、ROI、风险、用户反馈、构建结果、截图和最终复盘。SiYuan 的块级引用与查询思想非常适合这个方向。

2. Logseq：学习“每日经营日志 + 双链”

朝堂 OS 每天都要回答：今天最该做什么，为什么现在做，证据是什么，做完后反哺什么。Logseq 的 daily journal、outline 和 backlink 思路适合转化为“日史”。但我们不要照搬笔记流，要把它产品化成经营动作流。

3. Outline / Docmost：学习“团队知识库”

世界 500 强企业财团界面必须有权限、历史、评论、空间、搜索和组织结构。Outline 和 Docmost 适合作为史馆企业级体验参考：让老板、员工、AI 窗口都能围绕同一个案卷协作。

4. AFFiNE / AppFlowy：学习“文档 + 画布 + 数据库”

朝堂 OS 需要一张经营地图，不只是列表。军机处、工部、户部、史馆之间的链路，可以在画布上表现为经营系统图；任务、预算、证据、复盘则进入结构化表格。

5. EvoMap Evolver：学习“系统自进化”

EvoMap 不应作为知识库 UI 参考，而应作为朝堂 OS 的进化层参考。我们的目标是让史馆复盘沉淀为 EvolutionGene：什么打法有效，什么失败，什么条件下下次自动推荐。

### 第二梯队：只吸收局部能力

BookStack 和 Wiki.js 适合参考制度手册、部门手册、企业知识门户；Foam、SilverBullet、Zettlr、TriliumNext 适合参考 Markdown、本地化、个人写作和轻量自动化。

## 3. 不要照抄什么

不要做通用 Obsidian 克隆。用户真正要的不是“多一个笔记软件”，而是“每天告诉我该做什么、为什么、谁去做、花多少钱、怎么验收、做完沉淀什么”。

不要把图谱当核心卖点。图谱只是表达关系的视图，真正值钱的是从证据到决策到复盘再到下次建议的闭环。

不要让用户先管理 Markdown。顶级产品应先捕获经营动作，再自动沉淀知识。Markdown、导出、双链、搜索是底层能力，不是第一屏主体验。

不要只做资料库。资料库不会自动赚钱；经营闭环才会。每条知识都必须能回到“预算、执行、验收、复盘、再建议”。

## 4. 朝堂 OS 推荐知识架构

```txt
史馆 Knowledge Kernel
  EvidenceBlock       证据块：截图、链接、预算、日志、口述、构建结果、客户反馈
  DecisionRecord      决策记录：谁建议、谁审批、为什么、反对意见是什么
  ExecutionCase       执行案卷：目标、任务、负责人、状态、预算、验收
  Retrospective       复盘：结果、评分、收益、风险、下次建议
  KnowledgeNode       知识节点：项目、客户、部门、功能、风险、打法
  KnowledgeEdge       关系边：导致、依赖、引用、复用、阻塞、反哺
  EvolutionGene       进化基因：经过验证的打法、模板、检查项和失败教训
```

比喻：普通 wiki 像图书馆，资料放进去后等人找；朝堂 OS 的史馆要像军机档案房加参谋部，昨天的战报会自动变成今天的作战建议。

## 5. 史馆产品形态

### 日史

每天自动生成一页经营日志：今日主线、风险、机会、待裁决事项、建议召集部门、昨日复盘影响。

### 案卷

每个经营动作都是一个案卷：从上书房建议开始，经过户部预算、军机处立项、工部交付，最后进入史馆归档。

### 证据库

所有判断必须挂证据。证据可以来自用户输入、页面截图、构建结果、预算表、客户材料、外部情报或 AI 分析。

### 关系图谱

图谱用于解释“为什么推荐这个动作”。例如：户部预算不足 -> 工部任务延期 -> 军机处优先级调整 -> 史馆记录风险。

### 打法基因库

把成功经验变成可复用模板：PRD 模板、验收标准、预算测算、风险检查、AI 窗口分工、发布复盘。

### 检索 API

上书房、户部、军机处、工部都应能调用史馆：查历史相似案卷、查失败原因、查预算口径、查可复用任务卡。

## 6. 最适合我们的落地路线

### P0：先做知识内核，不先做复杂 UI

目标：让现有经营闭环产生结构化知识对象。

验收标准：

- `BuildRetrospective` 可以转成 `KnowledgeCase`
- `DepartmentBuildTask` 可以转成 `KnowledgeCase`
- 每条案卷包含目标、部门、证据、建议、关系和可复用经验
- 上书房每日建议后续可以读取这些案卷

### P1：史馆“经营记忆内核”面板

目标：让用户在史馆看到案卷、证据、关系和下次建议。

验收标准：

- 支持按部门、状态、风险、日期筛选案卷
- 每条案卷展示证据链和复盘评分
- 可以一键复用为工部建设任务或军机处命令

### P2：进化基因库

目标：让系统从复盘中提炼打法。

验收标准：

- 成功案卷可沉淀为 `EvolutionGene`
- 失败案卷可沉淀为反模式和风险检查
- 新任务创建时自动匹配相似基因和警告

## 7. 给四个 AI 窗口的任务分配

Claude Opus 窗口 1：产品与信息架构

- 阅读本 harness
- 输出史馆“经营记忆内核”页面结构
- 重点定义用户第一眼看到什么、如何理解价值、如何从案卷复用任务

Claude Opus 窗口 2：状态机与领域模型审查

- 审查 `KnowledgeCase`、`EvidenceBlock`、`EvolutionGene`
- 找出缺字段、边界条件、与上书房/户部/军机处/工部的契约问题

Codex 窗口 1：工程实现

- 新增 `knowledge-kernel.ts`
- 把现有 `BuildRetrospective` 和 `DepartmentBuildTask` 转成知识案卷
- 保持纯函数和 mock 数据，不引入后端依赖

Codex 窗口 2：集成与验证

- 在史馆或经营信号中接入案卷摘要
- 跑 `npm run build`
- 输出风险清单和下一步 PRD 需求

次级模型：材料整理

- 整理竞品表格
- 提炼文案
- 写验收清单
- 不负责架构裁断和核心代码

## 8. 当前最终建议

朝堂 OS 最该吸收的是：

1. SiYuan 的块级证据
2. Logseq 的日史和双链
3. Outline/Docmost 的企业协作
4. AFFiNE/AppFlowy 的画布和数据库
5. EvoMap 的进化基因

最不该做的是：把产品变成“古风皮肤的 Notion/Obsidian”。我们要做的是“能每天推动老板赚钱和组织执行的经营 OS”。

