# 任务：ext-dev 比例治理重置与当前阶段收敛

> Task ID：`EXT-PROPORTIONAL-GOVERNANCE-RESET-S0-20260816`
>
> 所有后续工作继续遵守 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`。
> 本任务只收口适合当前小团队、单仓库和单产品主线的治理设计。D0 已独立落地；本任务获准在连续
> 10 轮验证后提交并 fast-forward 推送当前两份 Markdown，但不实施 G1、不创建机器 authority、
> 不修改产品，也不授权 merge、deploy 或产品 GO。

## Status

Implemented

- 当前性质：`DESIGN PACKET / OWNER ACCEPTED FOR S0 FREEZE`。
- 当前方案：`3-10-1-1`（三层门禁、十路径 G1、一个真实 Owner、一条首要产品纵切）。
- 当前结论：现有 D0/A0/E0/长时蓝图的安全原则正确，但控制强度与当前组织规模、平台能力和变更风险不成比例。
- 本任务的两份 Markdown 是 successor 设计，不修改或漂白既有冻结包；旧包继续作为历史证据。
- 用户已精确接受 `3-10-1-1` successor contract；旧 E0P-D/A0 保留为高对抗环境历史参考，不再作为当前阶段的统一前置。
  后续 G1、M0 和每个产品切片仍须各自 exact task、权限和验证，不能复用本次批准。
- 产品 authority 仍为 `STOP / canExecuteProductWork=false`。

## User Approval Boundary

用户于 2026-08-16 明确同意：

> 按顶尖大神会审结论，整体调整设计并指定一个适合当前阶段的方案。

用户于 2026-08-16 进一步精确确认：

> 确认采用 3-10-1-1；以 origin/ext-dev@a86e69dd4 为新基线，只更新这两份 S0 文档，完成连续 10 轮验证后，
> 允许提交并 fast-forward 推送到 Gitee ext-dev；暂不实施 G1、M0 和产品功能。

该确认授权当前两份 Markdown 的收口、连续 10 轮验证、单次提交及对 `origin/ext-dev` 的 fast-forward 推送。
它不是 G1 路径批准、机器 grant、产品任务确认、merge 或 deploy 授权。

用户随后澄清当前没有额外模型/Agent 额度，不能依赖三个独立 authority 角色或 sub-agent reviewer。
本设计据此采用单 Owner 模式；该修订是硬资源约束，不把 Codex、脚本或同一人的多个会话伪装成独立主体。

## Frozen Identity

- Historical pre-D0 baseline：`origin/ext-dev@1b4f6efd55315e41013563603c22ce9aefe95f43`
- Historical pre-D0 tree：`36fc2fdfb92b9d674c77c80c26ec26c6cbd2327b`
- Canonical remote baseline / landed D0：`origin/ext-dev@a86e69dd41e7dcd476807d401c316a91483bffc8`
- Canonical remote tree / D0 tree：`ae745b3b56486f2d0eef1be5489bb141b5a1d4a9`
- Design worktree base：`a86e69dd41e7dcd476807d401c316a91483bffc8`
- Current exact allowed paths：
  1. `docs/product/tasks/2026-08-16-ext-dev-proportional-governance-reset.md`
  2. `docs/superpowers/plans/2026-08-16-ext-dev-proportional-governance-reset.md`

若 remote `ext-dev` 在本次提交前离开 `a86e69dd41e7dcd476807d401c316a91483bffc8`、D0 tree、两路径或用户目标发生变化，
本次 fast-forward 授权立即失效；不得 rebase、force 或把当前验证外推到新候选。

## Product Definition

- 问题：朝堂 OS 的真实目标是把 `ext-dev` 收敛为唯一产品主线并逐功能创造价值，但此前路线为了修正根入口，先设计了
  12 个独立角色、HSM/KMS、双 nonce、可信时钟、两阶段平台策略和 25 路径 G1；结果是治理本身成为主产品，
  D0 虽已落地，后续产品仍会被不成比例的治理成本阻断。
- 目标用户：当前仓库唯一 Owner、Codex 实施者，以及之后使用户部、史馆、电池/PACK、
  集群、庄园和翰林能力的真实用户。
- 目标：把治理改为风险成比例、威胁模型诚实、机器可验证、当前团队能够真实执行的三层体系；先修正根入口，
  再建立最小机器 authority，随后只打穿一条户部 RichMemorial 用户纵切。
- 非目标：不降低 ADR 0028、owner isolation、exact base/tree/path、单一事实源、Outcome append-only、
  旧代码不整体迁入、真实外部副作用需另授权等底线；不把文档批准伪装成产品 GO。

## First-principles Decision

### Basic facts

1. `origin/ext-dev` 已有真实前后端产品和大量测试，根 `AGENTS.md` 的“仍无正式业务代码”描述已经错误。
2. D0 是 `1b4f6efd5` 的单亲子，精确新增三份 Markdown，完成 Harness、authority STOP、scope、独立审查和连续 10 轮验证后，
   已于 2026-08-16 fast-forward 落地为 `origin/ext-dev@a86e69dd4`。
3. 当前 Gitee 匿名接口不能证明私有仓库身份、保护规则、required check 或管理员 bypass；公开平台能力也不能证明本仓配置。
4. 托管平台所有者和本机 OS owner 本质上属于信任根；若威胁模型要求它们绝对不可绕过，就必须使用不同的组织和基础设施，
   不能靠仓内协议宣称已经解决。
5. 当前团队没有 12 个可真正分离的主体、runner、credential 和服务账户；把同一人改名为多个角色不增加安全性。

### Root cause

我们把三类风险混成一个最高门禁：文档归档、治理核变更和产品执行使用同一套近似零信任控制。这样既没有消除平台所有者风险，
又阻断了可验证、可回滚的低风险改动。

### Leverage point

先建立风险分层和明确的信任声明，再用最小 G1 修正根入口。该动作会同时降低 agent 误路由、重复治理、产品开工延迟和审查成本。

## Proportional Governance Model

| 层级 | 适用范围 | 必要门禁 | 不允许证明什么 |
| --- | --- | --- | --- |
| `D` 文档比例门 | task/plan/ADR 说明、无执行代码 | exact base/tree/path、isolated worktree、secret/whitespace/scope、独立只读审查、精确 Git 动作批准、落地后 SHA/tree 复核 | 不证明机器 GO、产品质量或平台绝对不可绕过 |
| `G` 治理核增强门 | AGENTS、Harness、authority、migration/tooling guard | Ready exact task、机器可执行负测、候选不可自授权、authority/trust 路径排除、完整 Harness、连续 10 轮、独立安全审查 | 不产生业务执行权；结构 READY 不等于产品 GO |
| `P` 产品高保证门 | API、数据库、Outcome、证据、文件、浏览器、外部 adapter | exact product grant、RED→GREEN、owner/permission/digest 负测、专项+全量+集成、必要浏览器、同候选连续 10 轮、独立验收 | 测试绿不证明真实业务成功；synthetic 不得冒充真实 Outcome |

当前根规则和用户长时目标仍要求实施计划在同一冻结候选连续通过 10 轮；本任务不静默修改该要求。未来若要让普通文档只做
一轮加 Owner review，必须另行精确批准并修改根规则及其自测。

## Current-fit Architecture

方案代号固定为 `3-10-1-1`：三个风险层级、十路径最小 G1、一个真实 authority Owner、一次只交付一条用户纵切。

### 1. Trust model

- 明确信任当前唯一 Owner 和 Gitee 平台管理员能执行管理动作；通过阶段分离、机器负测、exact SHA、10 轮和外部留痕降低误操作风险。
- 不声称能够在同一 SaaS 内密码学证明平台所有者永远不能改规则；对此要求更高时，迁移到独立受管 merge gate 或第二见证平台。
- Codex 是实施者，不是第二 authority；确定性脚本是验证机制，不是第三 authority。没有独立额度时只允许“Codex 自审 + 机器证据 + Owner 最终接受”，
  不声称获得 independent review。需要对抗恶意 Owner/OS/Gitee admin 的任务保持 Blocked，直到真实独立资源出现。

### 2. Minimal G1 kernel

未来 G1 只允许十个路径，目标是修正根入口并提供 closed、只读、不可冒充产品 READY 的观察核：

1. `AGENTS.md`
2. `.harness/agents/project-owner.md`
3. `.harness/rules/project-boundaries.md`
4. `.harness/contracts/project-harness.schema.json`
5. `.harness/manifest/project-harness.json`
6. `scripts/harness-doctor.mjs`
7. `scripts/harness-doctor.test.mjs`
8. `scripts/check_harness.mjs`
9. `docs/product/tasks/<future-exact-g1-task>.md`
10. `docs/superpowers/plans/<future-exact-g1-plan>.md`

`CLAUDE.md` 当前已经委托 `@AGENTS.md`，默认不改。workflow/wiki/verification matrix、四模板、`new-change`、change record 全部后移到 G2；
只有真实使用证明需要时才加入，禁止为了清单完整一次性恢复旧 root Harness。

G1 仍属于实质治理修复。现有 `execution_authority_ext.v1` 对其保持 `STOP/TASK_MISMATCH`；只有用户在未来 task 中逐项批准
真实 base/tree、十个真实路径、非目标与验证矩阵后，才能依据根规则的“另行明确批准治理修复”边界施工。该例外不进入产品任务，
不改变 `canExecuteProductWork=false`，也不能被复用于 G2 或 M0。

### 3. Solo-owner machine authority

产品施工前仍必须建立 successor machine authority，但威胁模型只承诺防止：聊天批准误读、陈旧 base、路径扩大、任务错配、
未确认 approval manifest、未跑验证和非 fast-forward 候选；不承诺抵御已经控制 Owner 会话、OS owner 或 Gitee owner 的攻击者。

future authority 只有一个真实决策主体：当前用户 Owner。

- Owner：确认 exact task、base/tree、ordered paths、non-goals、验证矩阵和最终 candidate SHA，并单独批准 Git 外部动作；
- Codex：只按已确认 task 实施、运行验证和生成候选，不拥有批准权；
- deterministic gate：只机械核验 manifest、Git identity、scope、tests 和候选关系，不作业务决定，也不算 authority 角色。

适合当前阶段的 machine authority 不依赖额外模型额度或 HSM：使用一个 closed approval manifest，记录 repository、task、request base/tree、
ordered paths、non-goals、验证矩阵摘要和状态。manifest 必须在单独的治理批准 commit 中先于产品候选落地；产品候选只能是该批准 commit 的单亲子，
且不得修改 manifest、consumer 或 Harness。consumer 机械验证 parent manifest、exact diff、task 和状态后才输出 product GO。

Owner 对 approval manifest 的 exact digest 和后续 candidate SHA 分别作两次明确确认；这是一人阶段分离，不是多人独立性。该模式只防误读聊天、
陈旧 base、路径扩大、自授权同提交和遗漏验证，不防控制 Owner 会话、OS/Gitee admin 或同一用户凭据的恶意攻击。出现后一类威胁时必须恢复外部签名/HSM 路线。

### 4. Product sequence

唯一价值主线固定为：

```text
RichMemorial 户部单纵切
  → 电芯/价格证据登记
  → 电池 P0/P1 安全门
  → PACK sizing
  → BOM/成本门
  → Stage Gate
  → authenticated OutcomeEvent
  → jiqun 只读匹配解释
  → 庄园 AssetReadModel
  → 翰林离线评测与 PromotionProposal
```

不新增独立 Agent、旧 Flow runtime、庄园 writer、交易所、通用连接器或第二 Outcome ledger。

## Long-running Program: Goals, Results and Value

| 阶段 | 目标 | 完成后的可观察结果 | 业务与工程价值 |
| --- | --- | --- | --- |
| `S0` 比例治理重置 | 冻结 `3-10-1-1` 与真实信任边界 | 两份设计文档在 Gitee `ext-dev` 可追溯，产品 authority 仍为 STOP | 降低小团队治理成本，防止把文档 PASS 冒充产品 GO |
| `G1` 最小根观察核 | 用十路径修正根入口和项目边界 | agent 能正确识别 frontend/backend/root Harness，`--ready` 固定 NOT_READY | 减少误路由和重复治理，为后续工作提供可信入口 |
| `M0` 单 Owner 机器权威 | 建立一次一候选的 approval manifest 与 consumer | 聊天批准、陈旧基线、越界路径和自授权候选被机械拒绝 | 让产品开工既可执行又可审计，不依赖虚构的多角色体系 |
| `H1` 户部 RichMemorial | 打通第一条真实用户纵切 | 户部下旨后得到唯一 REPLY、证据化表格/图表、owner-scoped XLSX，并能人工确认和史馆召回 | 用户第一次获得可审、可下载、可追溯的真实决策成果 |
| `B0` 电芯/价格证据 | 建立版本化 `CellSpec` / `PriceObservation` | 每条数据具备 source、as-of、license、owner、hash，过期或未知数据不可用 | 消除伪型号、伪价格和不可复核输入 |
| `B1` 电池安全门 | 对热失控、火灾、爆炸风险 fail closed | P0/P1 风险缺证时固定 HOLD，必须人工签核 | 防止模型在高风险安全问题上自行降级或放行 |
| `B2` PACK sizing | 建立确定性串并联、电流和热计算 | 相同输入得到可重放结果，UNKNOWN 不伪装 PASS | 把方案从语言建议升级为可复核工程计算 |
| `B3` BOM/成本门 | 用证据输入重算物料和成本 | 形成可审报价，拒绝 agent 自填 target 与无来源价格 | 提高预算、报价和采购决策可信度 |
| `B4` Stage Gate | 绑定 FMEA、制造和测试证据 | 缺证固定 HOLD，Stage Gate 不能由 LLM 单独 GO | 形成安全、成本、制造共同约束的立项判断 |
| `O1` 史馆 Outcome | 建立唯一 authenticated append-only OutcomeEvent | 真实业务结果按 owner、digest、时间和来源追加记录 | 区分“生成了报告”与“产生了业务效果”，建立学习事实源 |
| `J1` 集群匹配 | 对冻结能力、证据与 Outcome 做只读匹配 | 输出候选、score、evidence、reason，但不授权执行 | 让任务分配基于真实表现而不是人设或自述 |
| `Z1` 庄园读模型 | 汇总 owner-scoped 资产快照 | 资产具备 owner/source/version/hash/as-of，无假总值或写回 | 用户可看到可信、可解释的资源与成果全景 |
| `E1` 翰林评测 | 用冻结数据集离线评估能力 | 缺链输出 `NO_DATA/UNUSABLE`，只生成 PromotionProposal | 建立可控的能力进化闭环，避免自动晋生产 |
| `V1` 总验收 | 验证整条价值链并完成 Gitee 收口 | 从旨意、证据、决策、产物、确认到 Outcome 可端到端重放 | 朝堂 OS 从“多 Agent 展示”变成可衡量、可审计的决策操作系统 |

## Acceptance Criteria

- [x] 两份文档精确绑定 D0 base/tree 和当前两路径，其他 worktree 与冻结包字节不变。
- [x] 明确区分 `D/G/P` 三层门禁，任何较低层结论都不能外推较高层权限。
- [x] 明确信任 Gitee/OS owner 的现实边界，不再要求本仓证明 SaaS owner 绝对不可绕过，也不把截图/口头承诺当机器证据。
- [x] G1 从 25 路径缩成十路径最小核；其余内容进入 G2 backlog，默认不作为产品前置。
- [x] RichMemorial 是第一产品纵切；电池/PACK、Outcome、jiqun、庄园、翰林保持严格顺序和单一事实源。
- [x] ADR 0028、现有 `execution_authority_ext.v1`、产品、CI、数据库、Gitee 和 host 状态不变。
- [x] D0 已精确落地；当前任务只授权两文档在 10 轮后的 commit/fast-forward push，不授权 G1、future authority、产品、merge 或 deploy。
- [x] 用户已接受 exact successor contract；该接受只替代不成比例的统一前置，不撤销各阶段独立权限或产品 STOP。
- [x] 最终两文档通过 scope、whitespace、冲突标记、一致性和现有 Harness/authority STOP 验证；按当前根规则冻结后完成 10 轮。
- [x] successor machine authority 只有一个真实 Owner；Codex 和 deterministic gate 不得被描述为额外 authority，approval manifest 与产品候选必须分成父子两次确认。
- [x] 当前无额外模型额度时使用主会话自审、机器证据和 Owner 接受；所有报告明确 `NO INDEPENDENT REVIEW`，不得伪造 0 Critical/Important 独立结论。

## Delivery Constraints

- 范围：仅 Frozen Identity 列出的两份新 Markdown。
- 兼容性：不修改 D0/A0/E0/长时任务、ADR 0028、root/frontend/backend Harness、产品和任何历史分支。
- 外部副作用：仅允许验证完成后创建一个精确两路径提交并 fast-forward 推送到 `origin/ext-dev`；禁止 merge、force、branch protection、
  token/API 管理调用、host provisioning 和真实 provider。
- 停止条件：出现第三路径、remote/base 漂移、非 fast-forward、需要降低 ADR 0028/owner/digest/Outcome 底线或需要读取 secret 时停止。
- 技能计划：`expert-perspective`、`complex-problem-first-principles`、`blueprint`、`security-review`；`using-superpowers` 当前目录不可用，使用已安装的
  `blueprint` 与项目 Codex 工作流作等价回退；验证阶段使用 `verification-loop` 的等价本地步骤。
- Codex-only：是；不启动 Claude CLI、Claude runner 或 gstack-claude。

## Affected Modules

- 模块：项目级比例治理 successor 设计。
- 允许路径：两份 Frozen Identity 文档。
- 依赖模块：ADR 0028、D0 readiness、A0/E0 设计、长时能力蓝图，全部只读。

## Technical Plan

- 架构边界：本任务只定义风险等级、信任模型、最小 G1 和产品次序；具体实现由后继 exact task 冻结。
- 接口与依赖：`D/G/P` 是治理分类，不是运行时状态机，不新增数据库、API 或第二 authority。
- 实施顺序：更新冻结身份与长时价值图 → 自审 → 现有 Harness/STOP/scope 验证 → 连续 10 轮 → 两路径提交 →
  fast-forward 推送 → 远端 SHA/tree 复核；G1 另立 exact task。
- 验证计划：见配套 blueprint 的命令矩阵。
- 技术风险：最大风险是把本设计当成 D0/G1/product authority，或在“简化”名义下静默移除产品高风险门。

## Implementation Report

- 改动摘要：在 D0 隔离 successor worktree 新增本任务和配套 blueprint；建立 D/G/P 三层比例门、十路径 G1 最小核、
  单 Owner M0 威胁模型，以及 H1→B0–B4→O1→J1→Z1→E1 单纵切顺序；未修改任何冻结包或产品。
- 自审：修复三项高风险歧义：新设计在用户 exact successor approval 前不能自行替代旧 E0P-D/A0；G1 必须是用户另行逐项批准的
  单次治理修复，不能借 ext authority STOP 获得产品权限；没有额外额度时只承认一个 Owner，不把 Codex/脚本伪装成 authority。
- 验证：初轮 Harness `133/167`、hook `3`、product-flow `25`、ext authority tests `11/11`；status 为
  `STOP/EXTERNAL_AUTHORITY_NOT_EVALUATED`、product false；scope 精确两份未跟踪 Markdown，无 trailing whitespace、CR 或 conflict marker。
- 实际使用的 skill：`expert-perspective`、`complex-problem-first-principles`、`blueprint`、`security-review`、
  `codex-pro-workflows`、`codex-mastery-coach`。
- 验证命令与结果：配套 blueprint §12 的 S0 matrix 初轮全部符合预期；最终正文冻结后连续 10 轮的证据只保留在交付会话，
  不为记录结果再次修改候选。
- 未运行项与原因：未运行独立 sub-agent review；用户确认当前没有额外模型/Agent 额度。G1/M0/product/browser 仍不在本任务权限内。
- 剩余风险：当前只有 S0 文档 commit/fast-forward push 获授权；G1/M0/product 仍须逐阶段 exact task 与独立批准。

## Acceptance Review

- 验收结果：`PASS / SOLO-OWNER DESIGN PACKET ONLY / NO INDEPENDENT REVIEW`。
- 验收证据：Harness/authority/scope/whitespace 与冻结候选连续 10 轮一致；主会话自对抗审查已关闭“自废旧门禁”、
  “G1 绕过 STOP”和“预先声称未知 candidate SHA 已获批准”三项歧义。逐轮证据保留在交付会话，不回写候选。
- 未实施项：当前明确没有 independent review；G1、M0 与产品实现尚未授权。
