# EXT Full-Value Convergence V2 总账

## 结论

本文件和同名 JSON 是 Wave 0 的只读收敛总账。它恢复旧 99-ref 台账的可审计方法，但不恢复旧
root Harness、旧 authority 或旧运行时，也不授权任何产品迁移。

Owner 的人类可读确认入口见 `2026-08-21-ext-full-value-owner-decision-brief.md`；该简报只投影本总账
与 Owner proposal，不成为第 13 个 catalog 或第二事实源。

- 目标基线：`origin/ext-dev@8b548215518c2bf0eebbf53d0c087902715c4aa4`
- 目标 tree：`a2e4b9aa3ed56a199881497d9592032ab2270dc1`
- 模式：`READ_ONLY_FREEZE`
- 产品 authority：`STOP / canExecuteProductWork=false`
- 已授权功能迁移：`0`
- 已有规范化能力索引：`31`
- 当前来源语义覆盖：`REVIEW_REQUIRED`
- 尚待语义确认：`189` 个目标外 canonical tree、`567` 个未提交 worktree 项；另有 `1` 个缺失路径 worktree
- 现有能力：`31`；新增复审候选：`7`
- 建议 Packet：`16`，全部 `PROPOSED_NOT_AUTHORIZED`

`sourceCatalogs.itemCount` 的合计为 13,321 次来源观察，不是 13,321 个互不重复的功能。旧分支、文件、
能力族和运行就绪度会交叉描述同一能力，必须按本总账的去重顺序逐包取 canonical donor。

## 冻结来源

| 来源 | 原始项 | 已分级项 | 分组 | 去重事实 | 状态 |
| --- | ---: | ---: | ---: | --- | --- |
| 旧 99-ref V1 | 99 | 99 | 47 能力族 | 98 个不同 tip | FROZEN |
| 旧 108 项 UI 工作树 | 108 | 108 | 3 种处置 | 104 个不同内容哈希 | FROZEN |
| EXT 能力 stocktake | 738 | 738 | 10 类 | 408 个不同 blob | FROZEN |
| 六部全树盘点 | 8,045 | 8,045 | 纳入/排除 | 纳入 1,777，排除 6,268 | FROZEN |
| 六部能力族矩阵 | 1,777 | 1,777 | 23 能力族 | 1,399 个不同 blob，合并 378 个重复项 | FROZEN |
| 全价值能力孤岛 | 31 | 31 | 31 能力 | 规范化能力索引 | FROZEN |
| Runtime readiness | 23 | 23 | active/retired/measured | 22 active、1 retired、0 已测业务成功 | FROZEN |
| 全部 Git refs | 286 | 286 | 5 种拓扑/去重分级 | 226 个 tip、216 个 tree | FROZEN |
| 全部注册 worktree | 567 个状态项 | 0 | 51 个 worktree | 22 dirty、27 clean、1 unavailable、1 个当前治理候选排除 | BLOCKED_UNCOMMITTED |
| Wave 0B 语义复审账 | 756 | 0 confirmed | 22 类资产 | 189 tree + 567 worktree 项，141 项有重复内容哈希 | FROZEN_REVIEW_REQUIRED |
| 能力库存声明来源 | 67 | 67 | 31 个 canonical 能力 | 46 条已冻结、21 条仍阻塞；敏感内容不读取 | FROZEN_REVIEW_REQUIRED |
| Owner 审阅提案 | 824 | 0 confirmed | 69 个互斥批次 | 823 项可观察来源 + 1 个缺失 worktree | FROZEN_REVIEW_REQUIRED |

当前 ref 拓扑分级：

- 4 个 ref 精确等于目标；
- 42 个 ref 已被目标包含；
- 77 个 ref 属于目标外的重复 tip；
- 12 个 ref 是不同 commit tip、相同 tree；
- 151 个 ref 是目标外的独立 tree；
- 目标外共 240 个 ref，按 tree 去重后仍有 189 个 canonical tree 需要语义审查；
- 旧 99 个来源名称全部能在当前 ref 集中找到；本地/远端同名共对应 112 个 ref；
- 其中 97 个来源的当前 tip 与旧账冻结 tip 一致，2 个来源已经发生 tip 漂移，必须重新审查；
- `refs/heads`、`refs/remotes`、`refs/tags`、`refs/archive` 与 `refs/stash` 均在同一快照中。

`FROZEN` 表示来源清单及其明细哈希已经冻结，不表示外部仓库内容自动成为可迁 donor。每个 Packet
仍须重新核对 donor commit/tree/blob。观察器只在 WSL 发行版指针一致，且实际 `HEAD`、tree、branch
与 Git 注册记录三者完全一致时，才接受失效 WSL UNC 路径的原生只读映射；由此补入
`memorial-reply-visual-first` 的 4 份独有未提交文档。剩余 1 个缺失路径 worktree 保持显式阻塞，
不能按“空工作区”处理。快照 v5 同时保留 registered/observed identity、仓级 Git common-dir
唯一锚点，并与 ref 冻结账交叉校验；任一漂移都会失败关闭。

旧 99-ref 的历史处置保持原样：14 `ABSORB_ADAPT`、15 `REBUILD`、31
`SUPERSEDED_VERIFY`、25 `ARCHIVE`、2 `REJECT`、8 `DUPLICATE`、4 `BLOCKED_WIP`。
这只是旧快照的判断，不表示 99 个功能已经迁移。

## Wave 0B 语义复审状态

机器语义账已为 189 个 canonical tree 和 567 个未提交项逐一生成资产类别、能力候选、建议处置、
置信度、规则和原因，结构上不再有未归类项；但 756 项全部保持 `REVIEW_REQUIRED`，确认数仍为 0。
技术去重已识别 51 个 ref alias，以及 141 个处于重复内容哈希组中的 worktree 项。内容相同只证明
技术别名，不自动授权删除或合并路径。

语义校验器会从 ref、worktree、旧 99 与 canonical capability inventory 四份冻结来源重新生成整本
756 项账并逐项比对；删除来源、改写能力、候选 ID 冲突或内部计数“自洽”的伪确认均会失败。
在单独的 owner receipt schema 和有效签收证据落地前，`CONFIRMED` 状态被明确禁止。

## Owner 审阅提案

现已把 756 项主仓语义决定、67 条能力库存声明来源和 1 个缺失路径来源组合为 824 个互斥审阅单元，
按能力、Packet、非产品资产和缺失源分成 69 批。38 个能力（31 canonical + 7 candidates）与 16 个建议 Packet 全部进入
索引。提案状态固定为 `PENDING_OWNER_CONFIRMATION`，精确 digest 为：

`sha256:567832800198fc3cbbb7b504da9128c54107534617d088ec55f1a88a439e96a4`

67 条库存来源经只读观察后，46 条已形成 Git 内容寻址或安全目录内容哈希冻结，21 条仍因脏增量、
敏感运行时、描述性 selector 或声明 pin 漂移而阻塞。为避免把“已提交 commit”误当成整个脏来源，
canonical donor 只接受干净 Git worktree。38 个能力中，32 个已有主仓语义来源或可用 donor；
电池私有知识、Super Brain、情报闭环、Legal Agent、礼部媒体工作台和刑部法律内核 6 个能力只有
阻塞来源。已经没有“只列能力名却完全不列来源”的静默项。
若能力已经进入 Packet，最终建议处置以 Packet 为准，同时保留原库存处置用于审计。

Owner receipt 只能选择确认语义名单原建议、带显式 override 确认或拒绝语义名单；Packet 索引明确
为 `INFORMATIONAL_ONLY_NOT_CONFIRMED`。回执必须逐项决定缺失源继续阻塞还是在提供仓内证据路径、
SHA-256 和理由后排除。回执只有在它作为提案提交的精确单亲子、成为干净的 `origin/ext-dev` 头，
且该提交只新增 100644 回执文件时才可被机器接受。远端头使用固定 Gitee SSH 地址、在仓库外禁用
system/global Git 与用户 SSH 配置，以 BatchMode + StrictHostKeyChecking 查询两次，不信任本地
`origin` 或 remote-tracking ref。无论哪种结果，receipt 都固定
`productAuthorityGranted=false / packetMigrationAuthorized=false`，不能代替后续 M0 approval commit。

在原 31 项能力之外，首轮证据审查形成 7 个新增候选：

| 能力 ID | 候选价值 | 默认处置 |
| --- | --- | --- |
| `claim-evidence-truth-gate` | 跨部门 Claim—Evidence 真实性门 | ABSORB_ADAPT |
| `jinyiwei-evidence-source-adapters` | 锦衣卫真实证据源与失败关闭适配器 | REBUILD |
| `guoli-truth-metrics-read-model` | 国力真值指标读模型 | REBUILD |
| `hanlin-evaluation-read-model` | 翰林评测读模型 | REBUILD |
| `trusted-artifact-delivery` | 可信产物交付与下载 | REBUILD |
| `release-backup-offline-verification-runtime` | 备份、离线发布与验证运行时 | REBUILD |
| `memorial-reply-visual-system` | 奏折与回奏视觉优先御览体系 | BLOCKED_WIP |

其中电池安全、Secure ingest、锦衣卫、国力、翰林、Professional Overlay 和 Companion 均存在
“同功能、不同实现 tree”。它们必须登记为 semantic siblings 并按代码/负测最小 hunk 蒸馏，不能
挑一个分支整树合并。两个旧 99 tip 漂移也已降为 commit-level review，旧 disposition 不会继承到
新增提交。

## 规范化能力候选名单

`ext-dev 状态` 和 `建议处置` 来自 2026-08-14 能力孤岛盘点，是 Packet 前的初步判断，不是产品
验收结果。31 项是当前 canonical capability index；新增 7 项仍只是 review candidates。因为 756
项语义决定尚未由 owner 确认，所以本轮不能声称“完整功能名单已经确认”。

| 能力 ID | 名称 | ext-dev 状态 | 建议处置 |
| --- | --- | --- | --- |
| `dev-trusted-runtime-kernel` | DEV 可信运行内核 | substantive | direct-adapt |
| `ext-six-ministry-design-corpus` | EXT 六部 Agent/Skill/Office 设计语料 | partial | rewrite-distill |
| `pack-battery-rd-kernel` | PACK/电池研发专业内核 | label-only | rewrite-distill |
| `battery-physical-safety-gate` | 电池物理安全失败关闭门 | none | direct-adapt |
| `battery-rd-os-domain-system` | 独立 Battery R&D OS | none | independent-integration |
| `battery-knowledge-store` | 本地电池知识与历史数据 | none | quarantine |
| `professional-agent-overlay` | 十类专业 Agent Overlay | partial | contract-eval-only |
| `tiandao-governance-plane` | 天道 G/G1/E 双平面治理 | partial | rewrite-distill |
| `egb-engineering-action-governance` | EGB 工程行动治理 | none | contract-eval-only |
| `shiguan-trusted-archive` | 史馆可信归档内核 | substantive | direct-adapt |
| `shiguan-outcome-learning` | 史馆结果账与学习闭环 | none | rewrite-distill |
| `courtos-brain-raw-vault` | CourtOS-Brain 历史知识库 | none | quarantine |
| `legacy-flow-runtime` | 旧后端蜂群、Flow 与 Runtime Prompts | superseded | retire |
| `frontend-courtos-second-brain` | 旧前端确定性 CourtOS | none | contract-eval-only |
| `legal-agent-domain-platform` | 独立 Legal Agent 法律领域平台 | none | independent-integration |
| `libu-media-studio` | 礼部五工位影像工作台 | none | independent-integration |
| `intel-demand-vetting-receipt-loop` | 采情牒—核查—回执情报闭环 | none | rewrite-distill |
| `hermes-openclaw-platform` | Hermes/OpenClaw Agent 平台 | none | reference-only |
| `secure-ingest-product-acceptance` | 安全摄入与不可变产品验收 | partial | contract-eval-only |
| `local-companion-runtime` | 本地 Companion 伴侣运行核 | none | contract-eval-only |
| `temporal-decision-intelligence` | 时间化决策智能 | partial | rewrite-distill |
| `hubu-professional-accounting` | 户部专业会计纵切产品 | partial | rewrite-distill |
| `xingbu-deterministic-legal-kernel` | 刑部确定性合同红线与法条核验核 | label-only | rewrite-distill |
| `council-graph-experiment` | Council Graph 稀疏会审实验 | partial | contract-eval-only |
| `legal-verify-core` | 本地确定性 Legal Verify Core | none | rewrite-distill |
| `qintian-prediction-falsification-loop` | 钦天监预测—证伪—校准闭环 | none | contract-eval-only |
| `expert-council-skill-pack` | 大神会审与专家视角 Skill Pack | none | reference-only |
| `shared-design-system` | 共享视觉 Design System | none | reference-only |
| `super-brain-knowledge-memory-sidecar` | Super Brain 知识与记忆摄入侧车 | none | quarantine |
| `historical-ui-concepts` | 历史 UI/产品概念岛 | partial | reference-only |
| `certification-release-evidence` | 认证、发布与审查证据快照 | none | reference-only |

## 建议的首批 Packet 顺序

| 顺序 | Packet | 处置 | 当前状态 |
| ---: | --- | --- | --- |
| 1 | 电池物理安全失败关闭门 | ABSORB_ADAPT | 未授权 |
| 2 | PACK/电池研发确定性内核 | REBUILD | 未授权 |
| 3 | Battery R&D OS 只读适配器 | REBUILD | 未授权 |
| 4 | 史馆 append-only Outcome 账 | REBUILD | 未授权 |
| 5 | 刑部确定性法律/合同分诊核 | REBUILD | 未授权 |
| 6 | 户部专业会计纵切 | REBUILD | 未授权 |
| 7 | 安全摄入产品纵切 | ABSORB_ADAPT | 未授权 |
| 8 | 钦天预测—证伪—校准闭环 | REBUILD | 未授权 |
| 9 | 发布、备份和恢复证据 | SUPERSEDED_VERIFY | 未授权，最后处理 |
| 10 | Claim—Evidence 真实性门 | ABSORB_ADAPT | 未授权 |
| 11 | 锦衣卫真实证据源适配器 | REBUILD | 未授权 |
| 12 | 国力真值指标读模型 | REBUILD | 未授权 |
| 13 | 翰林评测读模型 | REBUILD | 未授权 |
| 14 | 可信产物交付 | REBUILD | 未授权 |
| 15 | 离线发布、备份与恢复运行时 | REBUILD | 未授权 |
| 16 | 奏折与回奏视觉优先御览体系 | BLOCKED_WIP | 只有设计/治理证据 |

上表 Packet 只是价值优先级草案。只有 unresolved 来源完成映射、证明归入这 31 项或新增能力/存档处置，
并由用户确认完整名单后，才能选择一个 Packet。届时每个 Packet 必须重新冻结 exact base/tree、donor ref/tip/hunks、目标路径、非目标、
RED、验证命令、rollback 和独立 review；随后单独取得 product authority。不得把总账的 PASS、聊天
确认或 Packet 顺序解释为功能施工 GO。

## 去重和迁移规则

去重按以下顺序执行：精确 tip → 精确 tree → 内容 SHA-256 → 来源清单声明的重复项 → 人工语义
能力审查。分支名相似、提交信息相似或页面截图相似都不能单独证明重复。

前进路径：`freeze → classify → confirm list → authorize one Packet → RED → minimal adapt/rebuild →
verify → independent review → owner acceptance`。

回退路径：Wave 0 只增加只读脚本和快照，不改变产品或数据；未提交时可移除本隔离工作区的 V2
文件，未来若形成独立治理提交则使用独立 revert。任何 Packet 还必须提供自己的代码/数据回退，
本总账不能替代它。

## 使用

```bash
node scripts/ext-full-value-convergence.mjs --check
node scripts/ext-full-value-convergence.mjs --status
node scripts/ext-full-value-convergence.mjs --catalog legacy-99-ref-ledger
node scripts/ext-full-value-convergence.mjs --capabilities
node scripts/ext-full-value-convergence.mjs --unresolved
node scripts/ext-full-value-convergence.mjs --packet packet-01-battery-safety
node scripts/ext-full-value-convergence.mjs --observe-refs origin/ext-dev
node scripts/ext-full-value-convergence.mjs --observe-worktree /absolute/path/to/worktree
node scripts/ext-full-value-convergence.mjs --observe-worktrees /absolute/path/to/repository
node scripts/ext-full-value-semantics.mjs --check
node scripts/ext-full-value-semantics.mjs --summary
node scripts/ext-full-value-external-sources.mjs --check
node scripts/ext-full-value-external-sources.mjs --live-check
node scripts/ext-full-value-owner-review.mjs --check
node scripts/ext-full-value-owner-review.mjs --summary
node scripts/ext-full-value-convergence.test.mjs
node scripts/ext-full-value-semantics.test.mjs
node scripts/ext-full-value-external-sources.test.mjs
node scripts/ext-full-value-owner-review.test.mjs
EXT_CONVERGENCE_GIT_TESTS=1 EXT_OWNER_RECEIPT_GIT_TESTS=1 EXT_EXTERNAL_SOURCE_LIVE_TESTS=1 \
  node --test scripts/ext-full-value-convergence.test.mjs \
  scripts/ext-full-value-external-sources.test.mjs scripts/ext-full-value-owner-review.test.mjs
```

所有产品观察 CLI 都只读并输出 JSON；测试会在 `/tmp` 创建并清理临时 Git 仓库。检查器没有写入、
合并、提交、推送、部署或产品授权命令。

Owner 决策压缩见 `docs/migrations/2026-08-21-ext-full-value-owner-decision-brief.md`；首包的 donor、
目标边界、RED、验收和回滚草案见
`docs/migrations/2026-08-21-packet-01-battery-safety-contract.draft.md`。两者均为 nonauthorizing
投影，不改变本总账的 `STOP`。
