# 任务：户部黄金旨意与富奏折闭环

> 所有任务必须阅读并遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`；若任务与该基线冲突，必须标记为 `Blocked`，不得自行变更流程。

## Status

Blocked

## Product Definition

- 用户确认：用户于 2026-08-15 要求按已讨论的下一阶段方案启动过夜长任务，优先收敛优秀能力精华，并把质量与安全设为硬门。
- 问题：当前 46 个 RuntimeSkill、Evidence Spine、会计成果、史馆归档和人工确认分别存在，但 22 个活动能力族仍有 `businessSuccessMeasuredFamilies=0`；用户还没有一条可从下旨走到结构化富回奏、成果确认、史馆重放和 outcome 的可测黄金闭环。
- 目标用户：通过上书房下达经营分析旨意并需要可核验结论、风险、证据、成果和后续结果的已认证决策者。
- 目标：只用现有户部会计司和可信证据脊柱，完成一个 owner-scoped、provider-free、network-free、external-side-effect-free 的黄金旨意；允许在隔离临时目录写本地测试数据库和成果。成功办理时仍按 ADR 0028 自动形成唯一史馆 `REPLY` 并尝试生成 closed-schema 富投影，rich 失败时降级为 text-only `REPLY`；Excel `ArtifactState.PUBLISHED` 只表示归档后本地受控下载可用，不是对外发布，WorkProduct 人工决策轴在 receipt 前保持 `PENDING` 且 UI 不得称已确认；确认回执和脱敏合成 outcome 均以追加记录关联且不改写回奏原文。
- 非目标：不迁移军机处、史馆或锦衣卫运行时；不新增第 47 个 RuntimeSkill、第二 Registry、FlowEngine、OpenClaw/Hermes、任意 HTML、自动发布、付款、记账、通知、生产写入、真实公网、真实 provider 或真实客户数据；不修改 ADR 0028。

## Acceptance Criteria

- [ ] 当前永久 `STOP` 的 execution-authority v1 不被修改、重钉或伪装成 `GO`；根仓已占用的 `execution-authority.v2` 仅回答 R0 work package，不得导入其 W06 manifest/批准证据来授权本 ext 任务。另一个独立治理任务必须为本任务设计不冲突的 successor authority（名称/版本由该治理任务冻结），并在独立用户精确批准、安全复核和不可自授权的提交/签名链完成后，才可新建产品实施任务。
- [ ] `RichMemorialEnvelope v1` 是 closed schema；只允许 `heading`、`paragraph`、`fact_callout`、`metric`、`table`、`chart`、`risk`、`conflict`、`missing_evidence`、`decision`、`next_action` 和 `artifact_link`。
- [ ] 旧 text-only 回奏保持字节语义兼容；无富块时仍可完整、可访问、可打印地展示和召回。
- [ ] 黄金旨意只能由已认证 owner 发起，owner/route/skill/evidence/authority 全部由服务端重载；浏览器不能提交 owner、tenant、verified、approved、tool、URL 或本地路径。
- [ ] 户部数字、表格和 `ChartSpec` 只来自已采用的会计事实与确定性计算；模型文本不能创建或修改事实值。
- [ ] 富回奏不得把未确认成果显示为已确认；自动归档、本地受控成果可用、人工确认和外部行动是四条独立状态轴，`ArtifactState.PUBLISHED` 不表示对外发布，确认不得授权付款、过账或其他外部副作用。
- [ ] 一次成功旨意自动形成且最多形成一条最终史馆 `REPLY`，不等待成果确认；Rich manifest 是该 `REPLY` 的官方不可变展示快照，保存重放所需 blocks 与引用元数据，但不复制 artifact 二进制、外部源正文或另一套可变业务事实。
- [ ] 富投影 schema/digest 失败只使 rich projection `DEGRADED`：核心旨意仍按 ADR 0028 自动归档 text-only `REPLY`，不得保存未验证 rich blocks，也不得重试出第二条 `REPLY`；核心身份、路由、证据或 archive 完整性失败仍按既有规则使旨意失败。
- [ ] 同一归档在史馆召回时重放相同 manifest digest；前端 renderer 升级不能改变历史块的含义。same-owner 引用不可用时仍显示已存快照并标记不可用，跨 owner 404，归档 digest 腐坏时脱敏失败且不渲染。
- [ ] 本期只用脱敏合成 fixture 验证 outcome 在 owner/run/decree/archive 绑定下 append，不能更新、删除、回填为历史时点已知事实，也不能直接晋级 RuntimeSkill；不得据此改变 `businessSuccessMeasuredFamilies=0`。
- [ ] 跨 owner、字段走私、重复确认、旧回执、篡改 digest、XSS、SSRF、路径穿越、恶意链接、超大 payload、缺引用图表和证据/示意混淆均失败关闭。
- [ ] 真实浏览器完成“登录→下旨→查看富奏折→确认→史馆召回”，并验证键盘、移动端、空数据、加载和失败状态；前端 mock 不作为后端成功证据。
- [ ] 全链路观测能回答 owner、decree/run、route、skill、evidence、artifact、confirmation、archive、outcome 与稳定失败码，且日志不含凭据或原始敏感财务内容。
- [ ] 候选版本通过专项、后端全量、前端 lint/typecheck/test/build、integration、Harness、无副作用与安全负测。
- [ ] 正式浏览器/集成轮次由独立于应用进程的宿主/CI egress-deny 只允许 loopback；若平台不能提供并记录该强制策略，本项必须为 `UNVERIFIED`，产品不得 `PASS`。
- [ ] 同一冻结候选指纹连续完整通过 10 轮；任一失败或代码、配置、命令矩阵变化后从第 1 轮重新计数。

## Delivery Constraints

- 范围：当前只允许治理调查、任务契约、测试基线与证据修复；本任务不实施 successor authority，也不实施产品。未来只有在独立治理任务完成、用户对 exact scope 再批准且新机器权威放行后，才能另建 Ready 的户部纵切任务。
- 兼容性：保持 ADR 0028、46 个 RuntimeSkill 唯一注册表、四节点 LangGraph、单/多部路由、恰好三条建议、owner-only/tenant-null、唯一 `REPLY` 与现有 Excel 下载/确认行为。
- 风险与限制：工作区根目录另有大量未提交改动，不得读取为批准事实、现行架构或提交内容；clean `ext-dev` 的 `frontend/AGENTS.md` 与 ADR 0028 以既有同源 Next BFF 为现行事实源。只有未来拟吸收另一分支的 no-BFF 提案时才需独立治理裁定；本任务不能提前采用该未批准观察。真实网络、provider、生产数据和外部行动继续禁用；任何身份、引用、状态或 digest 不可信时失败关闭。
- 技能计划：`codex-pro-workflows`、仓库 `codex-engineering-workflow`、`test-driven-development`、`security-review`、`playwright`、`code-review`、`verification-loop`。
- Codex-only：是；禁止 Claude CLI、Claude runner、gstack-claude，以及任何用第三方 Skill 绕过执行权威的行为。

## Affected Modules

- 模块：当前仅“治理差距与富奏折候选设计”；未来候选模块“富奏折合同与投影器”将复用会计 WorkProduct/Confirmation、六部 Evidence Spine、史馆归档/召回和上书房展示。
- 允许路径：当前仅 `docs/product/tasks/2026-08-15-hubu-golden-decree-rich-memorial.md` 与 `docs/superpowers/plans/2026-08-15-hubu-golden-decree-rich-memorial.md`。未来产品实施不得继承本文件的权限；必须在只读调用链/数据模型勘察后，由独立 successor-authority change 与新的 Ready 任务逐文件列出 schema、migration、API、后端、前端和测试路径，禁止 `/**`、“必要 API”或其他开放式通配。
- 依赖模块：`CurrentUser`、`DecreeJob`、户部会计确定性内核、Evidence Spine、`WorkProductEnvelope`、`ConfirmationReceipt`、史馆 `REPLY`、RuntimeSkill registry。

## Technical Plan

- 架构边界：采用“一个事实脊柱、一个富奏折投影、一个确认点、一条史馆记录、一条 outcome 账本”；富奏折只解释和呈现已有事实，不成为新的 authority 或运行时。
- 接口与依赖：closed JSON Schema 是跨语言事实源；后端生成 manifest 与 digest，前端只渲染已验证 block；媒体和任意 HTML 不进入本期 MVP。
- 实施顺序：当前仅治理差距调查与 successor-authority 草案；未来另批任务才可按 schema 与攻击测试 → 后端确定性投影 → 自动归档/独立确认/合成 outcome → 类型化前端 renderer → 真实浏览器与安全负测 → 10 轮验收推进。
- 验证计划：详见 `docs/superpowers/plans/2026-08-15-hubu-golden-decree-rich-memorial.md`；每步先 RED、再最小 GREEN，最后在 exact candidate 上跑完整矩阵。
- 技术风险：最大风险是把 preview/confirmation/archive 当成外部授权、把前端状态当事实、把图表数据从模型文本生成、以及在脏根工作树中误合并。对应控制为服务端重载、正交状态轴、确定性 ChartSpec、隔离 worktree 和白名单 pathspec。

## Implementation Report

- 改动摘要：产品实现未开始。预备治理阶段已在隔离分支吸收 `origin/dev` 的自包含主流程验收修复；后续只读对账还识别并阻断了将 root v2/W06 脏树 GO 误用为 ext 授权的路径，已收敛为两阶段外部签名 successor-authority 草案；未改产品运行代码。
- 自审：军机处、史馆、锦衣卫、46 个 RuntimeSkill 与旧 EXT Flow 均不迁移；新边界仅是富奏折投影。
- 验证：预备合并 `34248ae2df2da7496f63934291e62dc8a5f68fb7` 的父提交为 `2e6fea337a50c316e748b7e65f03da52905e3394` 和 `2d29614137391c699615c0d84370db42ae217813`；吸收源为 `5f2a6e9f3e402313ada0f4477795da3e193feec1` 与 `e1c2dd42144e14914f5d0ec3905d26d404695b12`。专项 `110 passed, 1 skipped`，后端全量 `4006 passed, 4 skipped`，Ruff/compileall 和 Harness 133/167/3/25 通过。
- 根脏树只读诊断（不是候选验收）：v2 authority nodetest `27/27`、v1 `9/9`、amendment `10/10`、人工确认/史馆租户隔离聚焦后端 `66/66` 通过；根 `harness-doctor` 仍为 `1 error / 1 warning`（缺 W06 integrity-remediation `summary.md`，且未登记 `r0_w08_contract_quality`）。根工作树没有本地虚拟环境，66 项使用系统 Python 仅证明当前差异自洽，不证明 lock/candidate 可复现。
- 实际使用的 skill：`codex-pro-workflows`、`codex-mastery-coach`、仓库 `codex-engineering-workflow`、`expert-perspective`、`blueprint`、`security-review`、`resolving-merge-conflicts`。
- 验证命令与结果：见本轮提交与最终验收记录；上述结果仅证明测试/治理吸收，不证明本任务产品闭环完成。
- 未运行项与原因：successor authority、产品实现、真实浏览器闭环、真实数据、网络、provider、生产写入和外部副作用均未运行；机器权威 v1 当前且按设计永久为 `STOP`。根仓已有 v2 的未提交 manifest 对 W06 返回 `GO`，但该范围仅为 R0 ArtifactManifest/PDF/DOCX/JSON，批准基线 `8feae838...` 不是当前根 HEAD `b20e2c78...` 的祖先，且证据路径依赖未跟踪文件；该脏树结果明确不授权本任务。验证只使用隔离临时数据库写入。
- 剩余风险：根级三层 Harness 尚未在 `ext-dev` 收敛，执行权威尚未绑定本任务 exact HEAD，产品业务成功仍为 0/22。

## Acceptance Review

- 验收结果：`CONDITIONAL PASS`，仅覆盖用户目标中“执行权威 STOP 时只交付获准治理/证据修复与可执行任务契约”的备选分支。产品任务状态仍为 `Blocked`，不得外推为户部闭环 PASS。
- 被测治理父提交 P：`63c902d295eaa17a8659d8621b3af6a9b5bb3cff`；其 `backend` tree 为 `f7fb76192ee7f7afddfd5cf1aa72eccba693522e`，与全量后端验证时的 `70b25d48...:backend` 完全一致。本段是只含验收记录的 evidence wrapper，不宣称自身重跑了产品测试。

### STOP 备选交付矩阵

| 要求 | 当前证据 | 判定 |
| --- | --- | --- |
| 安全同步并上传已有合格成果 | Gitee `ext-dev` 与 P 同步；`origin/ext-dev...ext-dev = 0/0`；无 force push | `PASS` |
| 收入主流程验收精华 | merge `34248ae2...` 只引入 5 个后端验收/运行器文件和 4 个证据文档；修复 ignored evidence 假绿与进程/端口回收 | `PASS` |
| 可执行任务契约与施工蓝图 | 本文件 + `docs/superpowers/plans/2026-08-15-hubu-golden-decree-rich-memorial.md`；含 Task 0–7、精确非目标、候选 pathspec、验收命令与回滚边界 | `PASS` |
| v1 不被伪激活 | 根 `node scripts/execution-authority.mjs --authorize` 返回 `STOP / AMENDMENT_APPROVAL_REQUIRED`，exit 2 | `PASS` |
| 不误用 root v2/W06 授权 | root v2 只对 `R0-W06` 返回 GO；W06 范围仅 ArtifactManifest/PDF/DOCX/JSON，其脏 manifest、非祖先 base 和未跟踪证据明确列为不受信 | `PASS` |
| successor authority 安全设计 | 独立 namespace 候选、G→S→C→A、外部 Ed25519 trust root、nonce/sequence/fencing、精确路径、fresh-clone 重算和 fail-closed CLI 均已冻结为草案 | `PASS`（设计） |
| 不迁移或建第二运行时 | 从初始 ext 同步点到 P 的改动仅 5 个后端验收文件和 6 个文档；无军机处/史馆/锦衣卫运行时迁移，无第 47 个 RuntimeSkill | `PASS` |
| 当前候选治理验证 | Harness `133/167/3/25`，冲突标记、凭据泄漏和 whitespace 守卫通过 | `PASS` |
| 平台 trust root / required check | ext 分支尚无受管根 Harness、外部 signer 和 required check | `BLOCKED_EXTERNAL` |

### 产品 Acceptance Criteria 审计

| AC 范围 | 当前权威证据 | 状态 |
| --- | --- | --- |
| successor authority 实现与 exact-scope GO | 只有设计草案；无受信 signer/required check | `BLOCKED` |
| RichMemorial schema、确定性投影、text-only 降级 | 仓库中只有蓝图，无 schema/compiler/runtime 文件 | `NOT_STARTED` |
| 唯一 REPLY、确认状态轴、史馆 rich snapshot | 只有 ADR 0028 旧 text-only 基线；无本任务 rich manifest 持久化 | `NOT_STARTED` |
| owner/租户、digest、安全负例 | 根脏树聚焦 `66/66` 只是另一分支的诊断证据，不是 ext 产品候选 | `UNVERIFIED` |
| append-only synthetic Outcome | `businessSuccessMeasuredFamilies=0`；无本任务 outcome ledger/fixture | `NOT_STARTED` |
| 真实浏览器正反闭环 | `frontend/node_modules` 不存在，无候选 build、Playwright、API/DB 绑定证据 | `UNVERIFIED` |
| 宿主强制 egress-deny | 无平台 policy identity/rules digest | `UNVERIFIED` |
| exact candidate 完整矩阵与 10 轮 | 产品候选不存在；`0/10` | `NOT_STARTED` |

### 当前命令证据

| 命令 | 退出/结果 | 证明范围 |
| --- | --- | --- |
| `git ls-remote --heads origin refs/heads/ext-dev` | exit 0，P 在验收时为远端 exact SHA | Gitee 上传；最终 evidence-wrapper SHA 由推送后另行反查 |
| `git rev-list --left-right --count origin/ext-dev...ext-dev` | `0 0` | 验收时本地/远端同步 |
| 四条 Harness/self-test | `133 / 167 / 3 / 25`，全部 exit 0 | ext 治理基线与失败探针 |
| `node scripts/execution-authority.mjs --authorize`（root） | exit 2，`STOP` | 产品施工不得开始 |
| `node scripts/harness-doctor.mjs`（root） | exit 1，`1 error / 1 warning` | 根治理仍未收口；不得宣称根 PASS |
| `rg --files ... | rg 'rich[_-]memorial...'` | 仅命中 3 份任务/迁移/施工蓝图文档，无 schema/compiler/runtime 文件 | 产品实现未存在 |

### 评分与恢复条件

- 当前授权范围内的 STOP 备选交付：`9.4/10`。扣分来自根 doctor 仍红、环境不可候选内复现、以及平台 trust root 缺失。
- 户部黄金旨意产品完成度：`0/10`（未实施，不是对代码质量的评分）。
- 恢复条件：新的独立治理任务冻结 namespace/schema/pathspec，用户对 exact scope 独立批准，仓外 signer/required check 可验证，且 successor CLI 在干净 exact base 对本 task id 返回 `GO`。然后另建 `Ready` 产品任务，从 Task 1 的 RED 测试开始。
