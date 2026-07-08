# CourtOS P0 上线最小开发任务队列

本文件目的：把 CourtOS 从当前状态推进到 P0 可上线的最小工程队列，供 Claude Code / Codex 分批执行、验证、提交。

优先级：P0。所有任务只服务一条主线：上书房今日预案 -> 丞相筛选/待补证/已办 -> 交军机处会审 -> 生成合法奏折 -> 老板裁决 -> 高风险确认门 -> 史馆归档 -> 下次引用旧案。

## 1. 一句话结论

当前不再扩页面、扩角色、扩概念；先用最小任务把 P0 裁决闭环从前端入口、后端契约、风险确认、史馆归档、测试门禁五处收口到可演示、可验证、可回滚。

## 2. 本阶段不做什么

- 不做完整 ERP / OA / CRM。
- 不做所有六部深度功能。
- 不新增未落地的后端正式蜂群。
- 不把 `bingbu_sales_acquisition` 重新加入正式 registry。
- 不把 AI 盒子、GPU 服务器、Kubernetes 作为 P0。
- 不把 VAM 核心逻辑并入前端主线。
- 不把演示增强混入 P0 功能提交。
- 不绕过 sourceLabel / evidence / audit trail。
- 不允许高风险裁决静默通过。
- 不把 mock / fallback 包装成真实生产能力。
- 不用 `git add .`，不混提交运行产物、缓存、日志、`.env`、`data/`、`events/`、`reports/`。

## 3. 总任务看板

### A. 文档与边界

#### Task ID：A-01

- 标题：锁定 P0 上线边界与执行队列
- 目标：维护本文件为唯一的 P0 开发任务入口，避免任务继续发散。
- 涉及文件：`docs/courtos_launch/13_CLAUDE_CODE_CODEX_QUEUE.md`
- 是否允许改代码：否
- 预计改动：只更新任务状态、任务顺序、验收结论。
- 验收标准：每个任务都有目标、文件、验证命令、风险、是否可独立提交。
- 验证命令：`git diff -- docs/courtos_launch/13_CLAUDE_CODE_CODEX_QUEUE.md`
- 风险：如果任务描述过宽，会导致 Codex / Claude Code 自动扩大 diff。
- 是否可独立提交：是

#### Task ID：A-02

- 标题：冻结前后端路径与角色映射基线
- 目标：确认前端角色、后端 17 蜂群、flow、配置文件的 P0 映射关系，后续开发以此为准。
- 涉及文件：`docs/courtos_launch/05_ROLE_AGENT_MAPPING.md`
- 是否允许改代码：否
- 预计改动：补齐 landed / partial / missing、P0 必需标记、下一步任务。
- 验收标准：丞相、军机处、史官、刑部、工部、户部、礼部、兵部、锦衣卫、钦天监、太医署均有明确状态；未落地角色不得伪装成已落地。
- 验证命令：`git diff -- docs/courtos_launch/05_ROLE_AGENT_MAPPING.md`
- 风险：前端 11 朝堂角色与后端 17 formal swarms 混淆。
- 是否可独立提交：是

### B. 前端脏文件分拣

#### Task ID：B-01

- 标题：前端未提交改动二次只读分拣
- 目标：在开发前重新确认 dirty files，避免把 VAM、部门学习、资产、文档和 P0 代码混提交。
- 涉及文件：前端主仓当前 `git status --short` 输出中的全部文件。
- 是否允许改代码：否
- 预计改动：无，只输出分拣报告。
- 验收标准：每个脏文件被归入 P0 必需、P0 相关可后置、演示增强、暂缓、不应进入本轮、风险文件。
- 验证命令：`git status --short`、`git diff --stat`、`git diff --name-only`
- 风险：现有脏文件多，最容易产生混提交。
- 是否可独立提交：否，报告不提交代码。

#### Task ID：B-02

- 标题：制定前端最小提交切片
- 目标：把前端 P0 改动拆成可审查、可回滚的小提交。
- 涉及文件：由 B-01 确认的 P0 必需文件。
- 是否允许改代码：否
- 预计改动：只写提交计划，不执行 `git add` / `git commit`。
- 验收标准：每个提交只解决一个主题，并说明目的、文件、验证方式、风险。
- 验证命令：`git diff --stat`、`git diff -- <planned-file>`
- 风险：如果切片过大，后续 review 和回滚会失控。
- 是否可独立提交：否

### C. 前端 P0 链路

#### Task ID：C-01

- 标题：冻结 P0 路由映射，不新增页面
- 目标：优先复用现有路由支撑 P0，避免 `/court`、`/memorials` 等新旧命名继续扩散。
- 涉及文件：`src/app/intro/page.tsx`、`src/app/(dashboard)/study/page.tsx`、`src/app/dadian/page.tsx`、`src/app/(dashboard)/grand-council/page.tsx`、`src/app/(dashboard)/reports/page.tsx`、`src/app/(dashboard)/archive/page.tsx`
- 是否允许改代码：否
- 预计改动：输出路由映射说明：`/intro`、`/court-briefing`、`/dadian`、`/grand-council`、`/reports`、`/archive` 作为 P0 演示主线。
- 验收标准：P0 每个环节都有唯一推荐入口；不新增替代页面。
- 验证命令：`find src/app -maxdepth 4 -type f -name page.tsx | sort`
- 风险：页面命名不统一会造成演示路径混乱。
- 是否可独立提交：否

#### Task ID：C-02

- 标题：上书房事项状态补齐
- 目标：让上书房事项明确支持待裁决、待补证、已办三类状态，并能进入下一环节。
- 涉及文件：`src/app/(dashboard)/study/page.tsx`、`src/app/(dashboard)/court-briefing/page.tsx`、相关 briefing / study 组件。
- 是否允许改代码：是
- 预计改动：补齐状态展示、筛选入口、跳转参数；不新增大页面。
- 验收标准：用户能从一个事项看到状态，并进入军机处或奏折链路。
- 验证命令：`pnpm exec tsc --noEmit`；必要时运行相关前端测试。
- 风险：如果直接重做页面，会污染已有上书房 live edit 改动。
- 是否可独立提交：是

#### Task ID：C-03

- 标题：军机处会审入口与 caseId 串联
- 目标：从上书房 / 大殿事项进入军机处时保留同一个决策事项上下文。
- 涉及文件：`src/app/(dashboard)/grand-council/page.tsx`、`src/app/api/court/junjichu/review/route.ts`、相关 council 组件。
- 是否允许改代码：是
- 预计改动：统一 caseId / runId / memorialId 传递，补齐空状态与错误状态。
- 验收标准：一个事项能进入军机处并显示会审结果或明确 fallback。
- 验证命令：`pnpm exec tsc --noEmit`
- 风险：前端 mock 与后端真实契约不一致。
- 是否可独立提交：是

#### Task ID：C-04

- 标题：奏折详情补齐裁决前关键信息
- 目标：奏折详情必须在老板裁决前展示结论、依据、sourceLabel、evidence、风险等级。
- 涉及文件：`src/features/reports/components/memorial-detail-panel.tsx`、相关 reports contract / store。
- 是否允许改代码：是
- 预计改动：补齐字段展示和 unknown / missing evidence 的待补证提示。
- 验收标准：没有 sourceLabel / evidence 的奏折不能被当作完整裁决依据。
- 验证命令：`pnpm exec tsc --noEmit`
- 风险：如果字段来自多个后端命名，需要先做兼容映射，不能硬编码假数据。
- 是否可独立提交：是

### D. 后端 API Contract

#### Task ID：D-01

- 标题：后端 P0 API 响应样本审计
- 目标：只读确认现有 briefing、memorial、review、archive、swarm-runs 返回结构，作为前端对齐依据。
- 涉及文件：`/home/ubuntu/fe/fengQun/jiqun_ai_fresh/web/routers/chaotang.py`、`src/shangshufang_loop.py`、`src/db/models.py`、`src/chaotang_api.py`、`web/routers/swarm_runs.py`
- 是否允许改代码：否
- 预计改动：无，只输出 response shape 表。
- 验收标准：DecisionCase、BriefingItem、Memorial、ImperialDecision、RiskGate、ArchiveRecord、EvidenceSource、AgentFlowRun 的当前来源清楚。
- 验证命令：`rg "briefing|memorial|archive|source_label|evidence|audit|risk" web src tests -n`
- 风险：只看路由不看模型会漏掉归档字段。
- 是否可独立提交：否

#### Task ID：D-02

- 标题：定义 P0 DTO / Contract 最小文件
- 目标：在后端集中定义 P0 裁决闭环所需 DTO，减少前后端字段漂移。
- 涉及文件：后端新增或更新一个 contract / schema 文件，由 D-01 确认具体位置。
- 是否允许改代码：是
- 预计改动：定义 DecisionCase、BriefingItem、ChiefMinisterReview、CouncilReview、Memorial、ImperialDecision、RiskGate、ArchiveRecord、EvidenceSource、AgentFlowRun。
- 验收标准：字段包含 id、title、summary、status、riskLevel、sourceLabel、evidence、audit、archiveId、relatedPastCases 等 P0 必需信息。
- 验证命令：`.venv/bin/python -m pytest <contract-related-tests> -q`
- 风险：不能直接大改数据库 schema；先以契约层和映射层收口。
- 是否可独立提交：是

#### Task ID：D-03

- 标题：统一 sourceLabel / evidence / audit 字段映射
- 目标：把后端 `source_label`、`sourceLabel`、`sourceMode` 等命名统一映射给前端使用。
- 涉及文件：由 D-01 确认的后端契约/序列化层，必要时前端 contract 文件。
- 是否允许改代码：是
- 预计改动：增加兼容 mapper，不伪造真实来源。
- 验收标准：unknown 来源只能进入待补证，不能直接进入最终裁决。
- 验证命令：后端相关 pytest；前端 `pnpm exec tsc --noEmit`
- 风险：字段统一如果改到存储层，可能扩大迁移风险。
- 是否可独立提交：是

### E. 风险门与归档

#### Task ID：E-01

- 标题：奏折批准前高风险确认门
- 目标：高风险奏折点击批准前必须出现二次确认，并提供退回补证 / 交刑部复核 / 再议等路径。
- 涉及文件：`src/features/reports/components/memorial-detail-panel.tsx`、`src/core/courtos/harness/human-approval-gate.ts`
- 是否允许改代码：是
- 预计改动：复用现有 human approval gate 语义，在 UI 层接入确认门。
- 验收标准：金额、合同、对外发布、人事、删除、客户承诺、法律、生产部署、付款、权限类风险不能静默批准。
- 验证命令：`pnpm exec tsc --noEmit`；相关组件/交互测试。
- 风险：确认门只做视觉提示但不阻断 approve，会形成假门禁。
- 是否可独立提交：是

#### Task ID：E-02

- 标题：史馆归档与旧案引用最小展示
- 目标：裁决后能在史馆查到归档，并在同类事项中展示 relatedPastCases。
- 涉及文件：`src/core/courtos/archive/archive-store.ts`、`src/app/(dashboard)/archive/page.tsx`、相关 reports / archive 组件。
- 是否允许改代码：是
- 预计改动：串联 `saveCourtArchive`、`findSimilarCourtArchives`，补齐旧案引用展示。
- 验收标准：一次裁决可产生 archiveId；史馆可查；下次同类事项显示旧案提示。
- 验证命令：`pnpm exec tsc --noEmit`；相关 store test。
- 风险：归档如果只写本地 mock，要明确 demo / fallback 标签。
- 是否可独立提交：是

### F. 测试与 smoke

#### Task ID：F-01

- 标题：前端 P0 链路测试补齐
- 目标：覆盖从事项到奏折、风险确认、归档入口的最小浏览器级或组件级验证。
- 涉及文件：前端 e2e / test 目录，具体由现有测试框架决定。
- 是否允许改代码：是，仅测试代码。
- 预计改动：新增或更新最小测试，不引入新依赖。
- 验收标准：测试覆盖正常状态、待补证状态、高风险确认、归档入口。
- 验证命令：现有前端测试命令；至少 `pnpm exec tsc --noEmit`
- 风险：脆弱截图测试会增加维护成本，优先行为断言。
- 是否可独立提交：是

#### Task ID：F-02

- 标题：后端 Contract / smoke 安全验证
- 目标：增加不触发真实蜂群的 contract smoke，验证 case -> memorial -> review -> archive search 语义。
- 涉及文件：后端 tests / smoke 相关文件，不能改 registry / golden case，除非单独确认。
- 是否允许改代码：是，仅测试或安全 smoke。
- 预计改动：补 contract-level dry-run 测试。
- 验收标准：不调用真实外部服务，不触发真实蜂群运行，失败返回非 0。
- 验证命令：`.venv/bin/python scripts/validate_flows.py`、`.venv/bin/python scripts/validate_registry_sync.py`、`.venv/bin/python scripts/commit_closeout_check.py`、相关 pytest。
- 风险：误把 smoke 变成真实业务执行。
- 是否可独立提交：是

#### Task ID：F-03

- 标题：上线门禁命令清单复跑
- 目标：在 P0 代码提交前复跑前后端门禁命令并输出结果。
- 涉及文件：无。
- 是否允许改代码：否
- 预计改动：无，只运行安全验证命令。
- 验收标准：验证命令通过；失败时只报告日志，不自动修复。
- 验证命令：前端 `pnpm exec tsc --noEmit`、后端 validate / pytest / closeout check。
- 风险：验收阶段自动修复会扩大 diff。
- 是否可独立提交：否

### G. 部署与运维

#### Task ID：G-01

- 标题：MVP 内测部署前置清单
- 目标：确认内测服务器、域名、HTTPS、数据库、备份、日志、监控、回滚的最小要求。
- 涉及文件：`docs/courtos_launch/08_DEPLOYMENT_SERVER_PLAN.md`、`docs/courtos_launch/12_QA_RELEASE_GATE.md`
- 是否允许改代码：否
- 预计改动：补部署 checklist，不改生产配置。
- 验收标准：不引入 Kubernetes，不强上 GPU，不把 AI 盒子列为 P0。
- 验证命令：`git diff -- docs/courtos_launch/08_DEPLOYMENT_SERVER_PLAN.md docs/courtos_launch/12_QA_RELEASE_GATE.md`
- 风险：提前复杂化基础设施会拖慢上线。
- 是否可独立提交：是

#### Task ID：G-02

- 标题：发布回滚与数据备份演练方案
- 目标：上线前明确失败回滚、数据库备份、日志定位路径。
- 涉及文件：`docs/courtos_launch/12_QA_RELEASE_GATE.md`
- 是否允许改代码：否
- 预计改动：补回滚命令、备份频率、监控指标。
- 验收标准：出现发布失败时能在 10 分钟内决定回滚路径。
- 验证命令：`git diff -- docs/courtos_launch/12_QA_RELEASE_GATE.md`
- 风险：没有回滚方案就上线会放大发布事故。
- 是否可独立提交：是

### H. 运营与演示

#### Task ID：H-01

- 标题：三分钟 P0 演示脚本
- 目标：把演示限制为一条老板裁决闭环，不展示所有页面。
- 涉及文件：`docs/courtos_launch/11_DEMO_AND_PRESENTATION_PLAN.md`
- 是否允许改代码：否
- 预计改动：补 3 分钟 demo 讲解、路径、演示数据、失败兜底。
- 验收标准：企业老板 3 分钟内看懂价值：下旨、会审、奏折、裁决、归档。
- 验证命令：`git diff -- docs/courtos_launch/11_DEMO_AND_PRESENTATION_PLAN.md`
- 风险：展示太多角色和页面会稀释主价值。
- 是否可独立提交：是

#### Task ID：H-02

- 标题：内测运营与信任材料清单
- 目标：准备内测邀请、反馈表、FAQ、数据安全说明、用户协议/隐私政策准备项。
- 涉及文件：`docs/courtos_launch/10_OPERATIONS_GROWTH_PLAN.md`
- 是否允许改代码：否
- 预计改动：补运营物料 checklist 和第一批客户反馈问题。
- 验收标准：可以直接邀请第一批共创客户，不因信任材料缺失卡住。
- 验证命令：`git diff -- docs/courtos_launch/10_OPERATIONS_GROWTH_PLAN.md`
- 风险：没有数据安全说明会影响企业客户试用。
- 是否可独立提交：是

## 4. 执行规则

- 每轮只执行一个 Task ID，除非任务明确是只读报告。
- 开发任务必须先读相关文件，再给最小改动方案，再 patch。
- 验收阶段失败只报告日志和最小修复建议，不自动修复。
- 前端和后端不跨仓混提交。
- 文档、代码、测试、部署配置不混提交。
- 每次提交前必须运行对应验证命令，并确认 `git status --short` 没有额外文件。

## 5. 第一批只允许执行的 5 个任务

第一批目标是先把混提交风险和契约漂移风险压住，再进入第一个最小代码任务。

1. `B-01`：前端未提交改动二次只读分拣。
2. `B-02`：制定前端最小提交切片。
3. `C-01`：冻结 P0 路由映射，不新增页面。
4. `D-01`：后端 P0 API 响应样本审计。
5. `E-01`：奏折批准前高风险确认门。

其中 `B-01`、`B-02`、`C-01`、`D-01` 不允许改代码；`E-01` 是第一批唯一允许进入代码修改的任务，且只允许围绕奏折批准前高风险确认门做最小改动。
