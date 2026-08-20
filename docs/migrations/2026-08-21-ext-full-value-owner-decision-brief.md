# EXT Full-Value Convergence V2 — Owner 决策简报

## 决策状态

本简报是 `2026-08-20-ext-full-value-owner-review.v1.json` 的人类可读投影，不是新的事实源，
不修改提案，也不授予产品执行权。

- 唯一目标：`origin/ext-dev@8b548215518c2bf0eebbf53d0c087902715c4aa4`
- Owner 提案：824 个互斥审阅单元、69 批、38 项能力、16 个建议 Packet
- 提案 digest：`sha256:567832800198fc3cbbb7b504da9128c54107534617d088ec55f1a88a439e96a4`
- 当前状态：`PENDING_OWNER_CONFIRMATION`
- 产品 authority：`STOP / canExecuteProductWork=false`
- 已授权迁移：0

## Owner 本轮需要确认什么

建议决定为：

1. `CONFIRM_SEMANTIC_LIST_AS_PROPOSED`：确认 823 个可观察来源单元按提案分级。
2. `KEEP_BLOCKED`：缺失的 `ctc-ext-20260812` worktree 继续阻塞，不推断其历史未提交内容为空。
3. 不设置 override；需要修改某项处置时，改用
   `CONFIRM_SEMANTIC_LIST_WITH_EXPLICIT_OVERRIDES` 并逐项列出 review unit。
4. 名单回执固定 `productAuthorityGranted=false`、`packetMigrationAuthorized=false`；
   16 个 Packet 仍须分别取得 M0 产品执行权。

Owner 确认不代表：迁功能、合并分支、删除工作区、归档用户资产、发布或部署。

## 38 项能力的建议边界

### 吸收并适配（7）

| 能力 | 当前证据 | 决策含义 |
| --- | --- | --- |
| 电池物理安全失败关闭门 `battery-physical-safety-gate` | SOURCE_MAPPED | 蒸馏确定性安全门，不整分支合并 |
| 通用 Claim—Evidence 真实性门 `claim-evidence-truth-gate` | SOURCE_MAPPED | 作为跨域真实性合同吸收 |
| DEV 可信运行内核 `dev-trusted-runtime-kernel` | ext-dev 已 substantive | 保留主线，只吸收缺失增量 |
| 独立 Legal Agent 法律领域平台 `legal-agent-domain-platform` | SOURCE_BLOCKED | 价值保留；donor 解阻前不得施工 |
| 礼部五工位影像工作台 `libu-media-studio` | SOURCE_BLOCKED | 价值保留；脏外部仓先单独冻结 |
| 安全摄入与不可变产品验收 `secure-ingest-product-acceptance` | SOURCE_MAPPED | 从合同/评测证据适配成产品纵切 |
| 史馆可信归档内核 `shiguan-trusted-archive` | ext-dev 已 substantive | 证明覆盖并补缺，不复制第二史馆 |

### 重建到统一架构（16）

| 能力 | 当前证据 | 决策含义 |
| --- | --- | --- |
| 独立 Battery R&D OS `battery-rd-os-domain-system` | SOURCE_MAPPED | 保留外部事实源，仅建只读适配器 |
| EXT 六部 Agent/Skill/Office 设计语料 `ext-six-ministry-design-corpus` | SOURCE_MAPPED | 蒸馏合同/方法，不迁旧控制面 |
| 国力真值指标读模型 `guoli-truth-metrics-read-model` | SOURCE_MAPPED | 统一 truth-ledger 后重建 |
| 翰林评测读模型 `hanlin-evaluation-read-model` | SOURCE_MAPPED | 统一 owner/sourceLabel 后重建 |
| 户部专业会计纵切产品 `hubu-professional-accounting` | SOURCE_MAPPED | 对齐现有 Excel 证据链与 UI |
| 采情牒—核查—回执情报闭环 `intel-demand-vetting-receipt-loop` | SOURCE_BLOCKED | 价值保留；脏仓冻结后再建 |
| 锦衣卫真实证据源适配器 `jinyiwei-evidence-source-adapters` | SOURCE_MAPPED | 合并语义 sibling，保留失败关闭 |
| 本地确定性 Legal Verify Core `legal-verify-core` | SOURCE_MAPPED | 作为确定性库重建，不建独立平台 |
| PACK/电池研发专业内核 `pack-battery-rd-kernel` | SOURCE_MAPPED | 重建专业确定性内核 |
| 钦天监预测—证伪—校准闭环 `qintian-prediction-falsification-loop` | SOURCE_MAPPED | 以不可变 outcome 证据重建 |
| 备份、离线发布与验证运行时 `release-backup-offline-verification-runtime` | SOURCE_MAPPED | 解决候选测试冲突后重建 |
| 史馆结果账与学习闭环 `shiguan-outcome-learning` | SOURCE_MAPPED | append-only 结果账并入现有史馆 |
| 时间化决策智能 `temporal-decision-intelligence` | SOURCE_MAPPED | 蒸馏到现有读模型/证据链 |
| 天道 G/G1/E 双平面治理 `tiandao-governance-plane` | SOURCE_MAPPED | 只保留必要治理合同，不建第二 authority |
| 可信产物交付与下载 `trusted-artifact-delivery` | SOURCE_MAPPED | 按当前前后端边界重建 |
| 刑部确定性合同红线与法条核验核 `xingbu-deterministic-legal-kernel` | SOURCE_BLOCKED | selector 精确绑定前不得施工 |

### 证明已覆盖或仅保留参考（10）

| 能力 | 保留边界 |
| --- | --- |
| 认证、发布与审查证据快照 `certification-release-evidence` | 只作最终发布证明 |
| Council Graph 稀疏会审实验 `council-graph-experiment` | 只提取已验证的会审合同 |
| EGB 工程行动治理 `egb-engineering-action-governance` | 仅保留治理参考 |
| 大神会审与专家视角 Skill Pack `expert-council-skill-pack` | 保留 Skill，不复制产品运行时 |
| 旧前端确定性 CourtOS `frontend-courtos-second-brain` | 只提取交互/合同，不恢复旧入口 |
| Hermes/OpenClaw Agent 平台 `hermes-openclaw-platform` | 仅作平台参考 |
| 历史 UI/产品概念岛 `historical-ui-concepts` | 只提取经确认的设计原则 |
| 本地 Companion 伴侣运行核 `local-companion-runtime` | 只保留合同和负测参考 |
| 十类专业 Agent Overlay `professional-agent-overlay` | 只保留角色合同与评测 |
| 共享视觉 Design System `shared-design-system` | 只蒸馏 token/组件原则 |

这些来源只提取仍缺失的合同、负测或设计原则；不得恢复旧页面入口、旧运行平台或第二控制面。

### 继续阻塞（4）

- 本地电池知识与历史数据 `battery-knowledge-store`：敏感运行时内容，不读取、不复制。
- CourtOS-Brain 历史知识库 `courtos-brain-raw-vault`：只作受控历史来源，不成为主运行时。
- 奏折与回奏视觉优先御览体系 `memorial-reply-visual-system`：目前只有 4 份未提交设计/治理文档，没有产品基线。
- Super Brain 知识与记忆摄入侧车 `super-brain-knowledge-memory-sidecar`：敏感运行时内容，不读取、不复制。

### 拒绝（1）

- 旧后端蜂群、Flow 与 Runtime Prompts `legacy-flow-runtime`：已被 ext-dev 运行链替代；不得恢复旧 runtime。

## 6 项来源阻塞能力

| 能力 | 阻塞原因 | 解阻条件 |
| --- | --- | --- |
| 电池知识库 | 敏感内容 + 未解析声明 | 保持隔离；未来只允许获批的只读适配 |
| 情报核查回执闭环 | 外部 Git 工作区有未提交内容 | 单独内容寻址冻结并取得 owner 决定 |
| Legal Agent | 两个外部 Git 工作区均有未提交内容 | 分别冻结、去重，再确定只读适配边界 |
| 礼部媒体工作台 | 外部 Git 工作区有未提交内容 | 冻结 donor 后重新做前端/后端归属审查 |
| Super Brain 侧车 | 敏感运行时内容 | 不复制；未来只定义最小安全接口 |
| 刑部确定性法律内核 | Git selector 未精确解析 | 固定 exact commit/tree/path 后重审 |

来源阻塞不等于能力被拒绝；它只表示当前不能拿该来源施工。

## 16 个 Packet 的建议依赖图

以下是施工依赖提案，不改变原提案 priority，也不构成 authority。

| Packet | 能力 | 建议前置 | 当前门 |
| --- | --- | --- | --- |
| `packet-01-battery-safety` | 电池安全门 | 无 Packet 前置 | 固定 donor hunks、RED 与 backend 路径 |
| `packet-02-pack-kernel` | PACK 专业内核 | P01 | 定义确定性内核边界 |
| `packet-03-battery-rd-adapter` | Battery R&D 只读适配器 | P01、P02 | 外部系统继续拥有事实权 |
| `packet-04-shiguan-outcomes` | 史馆 Outcome 闭环 | 现有史馆内核、P10、P14 | append-only、owner、浏览器验收 |
| `packet-05-xingbu-legal-kernel` | 刑部法律内核 | P10；来源先解阻 | exact selector 与签署失败关闭 |
| `packet-06-hubu-accounting` | 户部会计纵切 | P07、P14 | Excel 真源、人工确认与 UI 对齐 |
| `packet-07-secure-ingest` | 安全摄入产品纵切 | 无 Packet 前置 | 从合同/评测扩展成产品路径 |
| `packet-08-temporal-falsification` | 钦天预测—证伪闭环 | P04、P10 | outcome 真值与浏览器证伪 |
| `packet-09-release-evidence` | 发布与恢复证据 | 所有获批功能 Packet | 只做最终证明，不提前包装发布 |
| `packet-10-claim-evidence-gate` | Claim—Evidence 门 | 无 Packet 前置 | 负测、跨域合同、M0 authority |
| `packet-11-jinyiwei-source-adapters` | 锦衣卫证据源适配器 | P10 | credential、来源失败与 sourceLabel |
| `packet-12-guoli-truth-read-model` | 国力真值读模型 | P10、P11 | 单一 truth-ledger 合同 |
| `packet-13-hanlin-evaluation-read-model` | 翰林评测读模型 | P04、P10、P11 | measured acceptance 与 sourceLabel |
| `packet-14-trusted-artifact-delivery` | 可信产物交付 | P07 | 适配当前 app 边界与下载权限 |
| `packet-15-offline-release-recovery` | 离线发布、备份和恢复 | P09、P14 | 解决 RC1 测试冲突并取得发布 authority |
| `packet-16-memorial-visual-system` | 奏折视觉体系 | 设计确认；暂无代码 Packet | 先形成浏览器基线和产品合同 |

建议施工波次：

1. 基础真实性与安全：P01、P07、P10。
2. 专业内核与证据交付：P02、P06、P11、P14。
3. 领域适配与结果闭环：P03、P04、P05（解阻后）、P08。
4. 读模型：P12、P13。
5. 发布恢复：P09、P15。
6. P16 保持设计态，直到单独产品确认。

## 名单确认后的机器签收路径

为保持可回滚和可审计，签收分为两个纯治理提交：

1. Proposal commit：只加入 V2 总账、快照、验证器、测试和本简报。
2. Receipt commit：Proposal 的单亲子，只新增 `100644`
   `docs/migrations/2026-08-20-ext-full-value-owner-receipt.v2.json`。

Receipt 成为 Gitee `ext-dev` 精确头后，验证器会前后两次查询固定 SSH 远端。即使名单签收通过，
产品 authority 仍为 STOP。任何 Packet 必须另建精确 M0 approval，包含 base、donor、目标路径、
RED、验证矩阵和 rollback。

## 建议的 Owner 确认文字

> 我确认提案 `sha256:567832800198fc3cbbb7b504da9128c54107534617d088ec55f1a88a439e96a4`
> 的语义名单按原建议签收；`ctc-ext-20260812` 继续 KEEP_BLOCKED；不设置 override；本次确认不授予
> 产品或 Packet 执行权。我另行授权将两个纯治理提交推送到 `origin/ext-dev`。
