# WorkBuddy → 朝堂/Codex 精华吸收差距清单

> 来源：用户提供的四份本地 WorkBuddy 配方/手册，2026-08-15 只读检查。
>
> 本文只吸收方法，不采信材料中的“已实装、ACTIVE、技能数量、效率倍数、模型参数、访问量或企业
> 案例数字”为朝堂事实。未进行外部一手来源核验。

## 1. 总裁决

朝堂已吸收 WorkBuddy 最重要的工程纪律，缺口不在专家、页面、技能或连接器数量，而在三个地方：

1. root agent 入口仍与真实仓库漂移；
2. 一条户部配方尚未打穿富回奏、确认、史馆和 outcome；
3. 测试证据尚未转化为真实价值结果。

因此只吸收“工作操作系统”和价值闭环方法，不复制 WorkBuddy 的配置文件、技能市场、专家中心、
连接器面板或自动外发能力。

## 2. Classification

### ADOPTED

| 精华 | 朝堂事实源 | 保持方式 |
| --- | --- | --- |
| 技能懒加载 | ADR 0043、`docs/codex-engineering-workflow.md` | 按任务画像选最小流程；缺 skill 不自动安装、不作为 CI 依赖 |
| 单写者 + 有限专家 | `docs/product-collaboration.md`、ADR 0003/0004 | 只读架构、顺序模块写、独立测试；禁止共享工作区并行写 |
| 受控司级工具/证据链的连接器最小权限 | ADR 0018、0037、0042 | 当前受控路径使用固定 registry、network default off、模型只提案、Policy/Executor/Result Gate；不外推为全仓统一连接器治理已完成 |
| 失败复盘沉淀 | `.agents/skills/record-failure/SKILL.md`、`docs/failures/` | 根因、预防、检测和证据进入 durable surface，不依赖聊天记忆 |
| 任务合同与验收 | `docs/product/tasks/TEMPLATE.md`、Harness | Draft→Ready→实施→验收；外部动作单独授权；完成要新鲜证据 |
| 用户确认与成果分离 | WorkProduct/Confirmation | 下载、归档、人工确认、外部授权四轴分离 |

### PARTIAL

| 精华 | 已有部分 | 最小补法 | 不要做 |
| --- | --- | --- | --- |
| Ask / Plan / Craft | Direct/Matt/Superpowers；Draft/Ready 状态 | Ask=只读调查；Plan=Draft 合同；Craft=Ready+machine GO，写入现有工程工作流 | 新建模式状态机或页面 |
| 指令配方 | task template 已有目标、非目标、路径、风险、AC | 补事实基线、交付格式、外部副作用、停止条件；Harness 检查模板 | 新配方 Agent/Skill 市场 |
| 三层记忆 | AGENTS/ADR、task、Shiguan | 保持工程规则/变更证据/业务档案分层；结果用 OutcomeEvent | SOUL/IDENTITY/USER/MEMORY 第四事实源 |
| 自动化复盘 | 每日奏报受控 CLI、待审、人工确认；record-failure | 先做只读价值周报，只消费认证数据 | 自动发布、发消息、付款、合并或晋级 |
| 成本路由 | provider attempt budget fail closed | 真实 provider 获权后记录 task budget、model/provider、latency/cost、降级原因 | 搬用未经验证的夜间折扣/价格 |
| 结构化旨意 | Evidence Spine 已有目标、材料、时间、语言及服务端重载 | 在现有 `/study` 收敛一个户部经营测算模板 | 五域页面、通用指令商城 |
| 史馆复盘 | 唯一 REPLY、owner 隔离、证据快照与召回 | append-only authenticated OutcomeEvent | 把可变 ReviewStatus 当 outcome |

### MISSING

1. **Root Harness 实态入口**：根 AGENTS 仍称最小骨架，root/frontend/backend Harness 未收敛。
2. **RichMemorial runtime**：closed schema、compiler、deterministic renderer 和历史 digest 重放尚未实现。
3. **OutcomeEvent**：没有 owner/run/decree/archive 绑定的 append-only 结果账本。
4. **价值指标读模型**：没有只消费认证 outcome/confirmation/archive 的周复盘。
5. **Hanlin offline evaluator**：冻结 dataset、baseline/candidate 和 PromotionProposal 只有蓝图。
6. **成本可观测**：没有可归因到 task/run 的真实 provider 成本、延迟与降级报告。

### REJECT

- 复制 `SOUL.md`、`IDENTITY.md`、`USER.md`、`STYLE.md` 或 `MEMORY.md` 到仓库；
- 复制 `mcp.ready.json`、通用 filesystem/browser 权限或默认启用连接器；
- 自动安装/同步海量第三方 Skill，或把用户级 Skill 变成 CI 依赖；
- 新增“大神中心”、专家团页面、第五运行主线、第 47 个 RuntimeSkill 或第二 Registry；
- 多个有写权限 Agent 并行修改同一 worktree；
- 用聊天、自动化日志、change record、模型自评或测试全绿生成 authority；
- 自动 CRM 写入、邮件/企微发送、付款、发布、部署、合并或生产操作；
- 把 `ArtifactState.PUBLISHED`、下载成功、人工确认、ReviewStatus 或 synthetic fixture 称为真实业务成功；
- 迁入旧 Hanlin `--yolo`/Hermes、旧 FlowEngine 或旧史馆运行时。

## 3. 朝堂九要素任务配方

WorkBuddy 的五要素适合普通办公；朝堂/Codex 的工程任务必须扩展为九要素：

```text
模式：只读调查 / 任务设计 / 授权施工
目标与交付物：
事实基线与 commit/tree：
允许路径：
明确非目标：
authority / task id：
验收标准与证明命令：
允许的外部副作用与回滚：
交付格式与停止条件：
```

映射规则：

- 只读调查 = Ask：允许读取和结论，不写状态；
- 任务设计 = Plan：允许获批文档，不代表产品 GO；
- 授权施工 = Craft：只有 `Ready + exact pathspec + machine GO` 才可写实现；
- 状态变化、提交、推送、合并、发布和外部动作仍需各自授权。

这套语义应在 G1 后通过现有 `docs/codex-engineering-workflow.md`、项目 skill、task template 与
`scripts/check_harness.mjs` 收敛，不创建新的配方 Skill 或运行服务。

## 4. Product Essence Roadmap

### P0：Root Harness G1

- 修正 root AGENTS 过时事实；
- 建 closed manifest、doctor、change generator；
- frontend `ABSENT`、backend `PARTIAL`；
- `--ready` 固定 NOT_READY；
- 不动产品。

### P1：户部经营测算配方

只在现有 `/study` 输入中表达目标、期间、材料引用、问题、输出格式和风险约束。复用 Evidence Spine、
会计确定性内核和 WorkProduct；owner/route/skill/evidence 全部服务端重载。

退出条件：精确产品 authority GO；所有数字回溯到 adopted facts；URL/path/tool/owner 注入失败关闭。

### P2：RichMemorial + Confirmation 可见化

- 只做 `metric/table/chart` 和必要文本块；
- 图表只来自确定性事实；
- rich 失败丢弃全部 rich blocks，以同一幂等键保留一条 text-only REPLY；
- 在现有成果区显示归档、可下载、人工确认、外部授权四轴；不新增页面。

### P3：OutcomeEvent

先用脱敏 synthetic fixture 证明 append-only、owner/run/decree/archive binding、不可更新/删除/回填。
`businessSuccessMeasuredFamilies` 保持 0。真实 outcome 的来源、真实性、保留期和隐私另立任务。

### P4：Value Review and Hanlin

- 周报只消费 authenticated outcome、confirmation、archive 和 evidence；
- 指标沿用既有八项，不新增同义体系；
- Hanlin 无 UI、无网络、无生产工具，只读冻结 dataset；
- 唯一输出 PromotionProposal，不能写 Prompt/Skill/Registry/史馆或自动晋级。

## 5. Existing Metrics Are Enough

继续使用能力蓝图已冻结的指标：

1. `evidence_coverage`；
2. `unsupported_claim_rate`，安全目标 0；
3. `human_revision_rate`；
4. `confirmation_rate`；
5. `archive_replay_digest_match`，目标 100%；
6. `outcome_completeness`；
7. `decision_lead_time`；
8. `candidate_delta`，且安全指标不得回退。

内部测试、synthetic outcome、模型自评分、文档/技能/Agent 数量不计入业务成功。

## 6. Current Priority Verdict

| 阶段 | 当前状态 | 是否值得现在做 |
| --- | --- | --- |
| G1 readiness packet | In Progress | 是，当前唯一安全写入 |
| G1 Root Bootstrap | Blocked / TASK_MISMATCH | 获独立 exact authority 后做 |
| 户部经营测算配方 | Blocked / product authority false | 否 |
| RichMemorial | Not started | P1 后做 |
| OutcomeEvent | Not started | P2 后做 |
| Value weekly review | No authenticated outcome | 暂缓 |
| Hanlin evaluator | No usable dataset | 暂缓 |
| CRM/外部连接器/自动外发 | Explicit non-goal | 不做 |

最终裁决：**优先吸收规则、权限和结果闭环；拒绝吸收数量、噱头和自动外部执行。**
