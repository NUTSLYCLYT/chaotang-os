# 六部能力资产审计（EXT → DEV）

## 审计基线

- 固定来源：`origin/feature-chaotang-ext` 的 commit `939186f0331d9784bc8c4ceee393aeb197230ed0`。
- 目标基线：生成时的 `ext-dev` HEAD，精确 commit 记录在机器清单中。
- 机器事实源：`docs/migrations/2026-08-13-six-ministry-capability-inventory.json`。
- 方法：只读取固定 Git tree/blob；不切换分支。先枚举固定 commit 的完整文件树，再逐文件决定 `included` 或 `excluded`。六部候选覆盖根级 Claude Agent/Skill、Agent 设计、运行 Prompt、部门 Skills、Flow/Registry、后端 Runtime/API/解析器、前端 Office/Loop/Prompt/TS、Golden/Test/Harness。
- 完整性：整棵树每个 blob 都必须得到唯一记录、Git blob ID、SHA-256 digest、`included` 布尔值和非空 `classificationReason`；不存在静默过滤。相同内容按 SHA-256 形成 duplicate group，同时保留每个来源路径。

## 结果

完整扫描固定 commit 的 8,045 个文件：其中六部相关 1,777 项，明确排除但仍逐项保留在清单中的文件 6,268 项，未分类 0 项。清单的 `totalTreeFiles` 与 `git ls-tree -r --name-only <commit>` 文件数相等。

| 所有者 | 数量 |
| --- | ---: |
| 吏部 | 108 |
| 户部 | 344 |
| 礼部 | 105 |
| 兵部 | 194 |
| 刑部 | 564 |
| 工部 | 320 |
| 六部共享/复制工作区 | 142 |

六部包含项新增覆盖根级 `.claude/agents/gongbu-*` 的 7 个工部 Agent：backend bridge、chief engineer、E2E inspector、frontend craftsman、loop smith、quality gate、release scribe。其余包含项继续覆盖嵌套 Skill、Runtime Prompt、配置/Registry、后端 Runtime/API/解析器、前端 Office/Loop/Prompt/TS、Golden/Test/Harness；未命中六部路径语义的文件统一显式标记为 `excluded`，并写明排除原因。

全树检测到 131 个包含重复来源的内容组。最大重复来源仍包括 `backend/agent_design/buildAgent/三省六部体系/` 下复制到不同工作区的通用 Skills。机器清单没有折叠任何路径，避免把“内容去重”误写成“来源不存在”。

## 关键判断

1. **旧控制面不直接迁移。** Agent 身份文件、Prompt、Flow 和工作区 Skill 只提供行为语料，不具备 DEV 的 typed contract、工具权限、租户边界、证据投影和回滚契约。
2. **确定性算法重写蒸馏。** 财务勾稽、现金跑道、预算/付款闸、招聘锚定、任免责任图等值得进入 DEV，但必须适配 RuntimeSkill、EvidenceSufficiency、ReportStatus 和工具审计模型。
3. **Golden/Harness 作为评测资产保留。** 正反例、缺证样例和门禁期望应重基线到 DEV，不把旧测试通过等同于新 Runtime 可用。
4. **前端不作为业务权威。** Office、Loop、路由和展示概念可以保留；财务、劳动关系、任免等业务裁决应由后端 typed Runtime 提供。
5. **重复资产不晋级为重复能力。** 同一 digest 的多路径只形成一个蒸馏候选，但 provenance 保留所有原始路径。

## DEV 映射

吏部优先映射到：

- `analyze-appointment-fit`
- `analyze-compensation-equity`
- `analyze-workforce-coordination`
- `analyze-labor-relations`
- `analyze-hr-policy`
- `analyze-recruitment-pipeline`

户部优先映射到：

- `analyze-accounting-position`
- `analyze-financial-controls`
- `analyze-budget-performance`
- `analyze-financing-options`
- `analyze-investment-case`
- `analyze-pricing-economics`
- `analyze-cash-safety`

礼部、兵部、刑部和工部资产映射到 DEV 已有同部 bureau skills；共享资产映射到 RuntimeSkill registry/executor，而不是恢复旧蜂群控制面。

## 首批迁移建议

1. 户部：数字来源、会计勾稽、数字引用验证及禁止证券交易建议。
2. 户部：会计、出纳、预算三闸组成的无副作用付款预览。
3. 吏部：owner、独立 reviewer、替补和高权限人工确认责任地板。
4. 吏部：招聘 C1–C4 决策锚定、版本化岗位资质清单和显式降级。
5. 户部：现金跑道、应收应付账龄和压力情景。

每项候选先进入离线 Golden/对抗评测，再进入零副作用 Shadow；没有可复现净收益、安全断言和 digest 回滚能力，不晋级 Runtime。

## 已知风险

- `libu` 在 EXT 同时用于礼部历史命名，吏部正式 ID 为 `libu_personnel`；机器清单使用独立 owner `libu_rites` 消歧。
- 多套 Office/roster 互相冲突，不能任选一份成为 DEV 单一事实源。
- EXT 多处以捕获异常后 `return None` 或 fallback 继续运行，可能掩盖真实能力失效；迁移必须输出明确 `degraded`/`failed`。
- Prompt 的固定字数、固定指标要求可能在缺数据时诱发编造；DEV 应优先 `request_evidence`、`abstain` 或人工升级。
- 机器清单中的 `consumptionChain` 是静态仓库证据摘要，不代表已完成生产链路验证；正式晋级仍需真实调用链测试。
