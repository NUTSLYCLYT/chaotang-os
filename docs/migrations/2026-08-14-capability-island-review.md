# ext-dev 全域能力孤岛盘点与融合判定

## 结论

历史资产不是“一个 EXP 仓”，而是至少 31 个不同性质的能力岛。ext-dev 已经拥有最重要的统一运行底座，但仍存在三种常被误写成“已经吸收”的情况：

1. **只吸收了名字**：PACK 研发和电池 Stage Gate 已映射到工部通用技能，但算法、事实库、安全门和专项测试没有进入。
2. **只吸收了合同骨架**：天道、专业 Agent Overlay、结果学习已经有相近的 authority、WorkProduct、Confirmation、RuntimeSkill 组件，但没有形成完整可信闭环。
3. **新内核已替代旧实现**：旧 FlowEngine、前端 CourtOS 第二大脑、重复 Prompt/Skill 不应再迁入；只提取其中的专业方法、确定性算法和失败样例。

人工治理清单 v0 见 `docs/migrations/2026-08-14-capability-island-inventory.json`。它直接核对了当前 228 个 refs、183 棵唯一 tree、6 个注册 worktree 和相关独立仓，但尚未为每个来源生成 commit/blob/digest 锁，因此不能冒充可复现的机器资产账。该清单不授权 Runtime 晋级、外部副作用或历史数据导入。

## “吸收完整”的统一标准

一个能力必须同时具备以下六项，才能标成完整吸收：

1. 输入/输出契约；
2. 专业方法或确定性算法；
3. 权限、责任人与作用域；
4. 可重载的证据来源、版本与摘要；
5. 缺失、冲突、拒绝、停止与升级语义；
6. 正向、负向和真实调用链测试。

只有 Prompt、角色名、capability ID 或前端页面，不算吸收能力。

## 能力岛总览

| 能力岛 | EXT | ext-dev | 核心价值 | 冗余/冲突 | 建议 |
| --- | --- | --- | --- | --- | --- |
| DEV 可信 Runtime 内核 | 无 | 实质完成 | 46 个权威注册项、权限、报告、审计 | 尚未获生产晋级；与旧 Flow/前端执行冲突 | 保持唯一运行注册表 |
| EXT 六部设计语料 | 完整但混杂 | 部分 | 六部方法、跨部质量门、失败样例 | 重复 skills、roster、旧 authority | 按能力蒸馏重写 |
| PACK/电池研发 | 实质完整 | 仅标签 | 18 节点研发、Stage Gate、确定性计算 | 旧引擎、旧数据、历史质量不合格 | 第一优先重建 |
| 电池物理安全门 | 有加固版本 | 未吸收 | P0/P1 黑分类与“必须人签”信号 | 旧链未证明审批队列真正消费并阻断；不能由模型降级 | 第一优先适配并补人签闭环 |
| Battery R&D OS | 独立系统 | 未接入 | 当前项目/样品/实验/分析/失效/阶段门产品 | 与旧 PACK 流重叠 | 保持独立，接只读证据适配器 |
| 电池知识与历史数据 | 分散 | 未吸收 | 标准、datasheet、测试、BOM、竞品 | 来源/时效/许可/敏感性未知 | 隔离清洗后使用 |
| 十类专业 Agent Overlay | 部分来自 EXT | 部分 | 专业工作产品契约 | 与现有 Runtime/Tiandao 重叠 | 只吸收合同与评测 |
| 天道 G/G1/E | 设计较完整 | 零件化吸收 | 准入、影子、行动授权链 | 与 EGB/现有 authority 重叠 | 合并成一个治理控制面 |
| EGB 工程行动治理 | 独立分支 | 未吸收 | 工程行动与 shadow 负测 | 与天道 E/G1 高度重复 | 合并蒸馏，不并存 |
| 史馆可信归档 | 部分 | 实质完成 | owner 隔离、证据快照、召回 | 不等于结果真相 | 保留扩展 |
| 史馆结果与学习 | 多处旧实现 | 未吸收 | append-only outcome、失败闭环、晋级证据 | 错误结果会污染学习 | 第二优先可信重写 |
| CourtOS-Brain | 历史归档 | 未吸收 | 知识生命周期方法、小量白名单精华 | Concept/Entity 两类约 99.6% 为 stub；私人/CoT/vendor/备份；最新版 492 项中 305 路径为旧审计后新增 | 不搬库；最新版另做增量白名单审计 |
| 旧后端蜂群/Flow | 完整旧链 | 已被替代 | 领域过程与算法语料 | 第二运行时、静默 fallback | 退役引擎，只抽 DNA |
| 旧前端 CourtOS | 完整旧链 | 未吸收 | 只读 view-model、诚实标签 | 前端事实源、第二大脑 | 只取展示方法 |
| Legal Agent 法律平台 | 独立产品 | 未接入 | 法律红蓝对抗、CLI/API/worker、专业 pack | 高风险结论、分享/webhook、私密材料 | 独立系统，只接受控证据/工作产品 |
| 礼部五工位影像台 | 独立产品 | 未接入 | 分镜→选帧→视频→装配→终检的产物门 | GPU/云副作用、回调与鉴权边界 | 独立系统，吸收 gate/ledger 合同 |
| 采情牒情报闭环 | 离线工具 | 未接入 | 需求→采集→核查→回执/命中率 | 专业真 feed 未建，seed 非事实源 | 蒸馏需求单、vet 和诚实无料语义 |
| Hermes/OpenClaw 平台 | 外部平台/旧依赖 | 未吸收 | gateway、memory、skill、cron、sandbox | 自进化、广权限、个人记忆 | 仅参考工程模式 |
| 安全摄入/W08 验收 | 历史专项线 | 部分 | 文件安全负测、exact-source、不可变验收 | 旧路径和产品身份 | 提取契约和负测 |
| Companion 伴侣运行核 | 独立历史分支 | 未吸收 | 会话/角色隔离、sealed reply、delivery fencing、记忆不自晋级 | 个人记忆不能混入史馆/六部 | 产品需要时单独恢复；先取安全 DNA |
| 时间化决策智能 | EXT+设计线 | 部分 | 决策到结算的时间轴、反泄漏、覆盖率与 Brier | 与史馆 outcome/truth ledger 重叠 | 扩展现有钦天监+史馆，不另建账 |
| 户部专业会计纵切 | Overlay | 部分 | 期末关账、管理复盘、扩张决策与数值工作产品 | 与户部 Runtime/会计报告/store 重叠 | 蒸馏纵切方法，不搬专用 graph/store |
| 刑部确定性法律核 | EXT | 仅标签 | 合同红线、法条核验、法律 red-team | 与法律侧车和重复 prompts 重叠 | 加法域/版本/人工复核后重写 |
| Council Graph 实验 | Overlay | 部分 | 独立意见、稀疏会审、确定性合议、observer | 与现有军机处/LangGraph 重叠 | 只吸收模型、排序与负测 |
| Legal Verify Core | 本地确定性工具 | 未吸收 | 条款切分、真值标签、法条依据门 | 租房规则不可泛化，非 Git 来源 | 冻结来源后蒸馏核验模式 |
| 钦天预测证伪闭环 | 历史原型 | 未吸收 | 预测、证伪条件、反向信号、人工结算、命中率 | 正则曾误判，旧账本非权威 | 并入时间智能与 outcome，先取负测 |
| 大神会审 Skill Pack | 环境技能 | 项目未内建 | 专家审阅镜头、会审组织 | 全局 skills 已有，persona 不得授予权限 | 不复制进项目，仅作为工程工具 |
| 共享 Design System | 独立组件库 | 未吸收 | tokens、React 组件、主题和测试 | 与前端现有 token 事实源冲突 | 只做视觉基线/评测参考 |
| Super Brain 知识记忆侧车 | 本地可运行原型 | 未吸收 | 摄入、检索、分层记忆、Obsidian/OpenClaw/研究链 | 非 Git、身份不等于 owner、写入/派生记忆会污染证据 | 隔离；只蒸馏摄入方法与负测 |
| UI/产品概念岛 | 历史静态站/attic | 部分 | 视觉语言、奏折交互 | mock 数据、版本重复 | 只作设计参考 |
| 认证/发布证据 | 历史快照 | 不属于运行时 | 回归与 provenance | 过期环境，不可复用证明 | 只索引，不复制 |

## 最值得融合的能力

### P1：立刻进入下一阶段

1. **电池物理安全门**：历史实现已能产生 black/必须人签信号，但未证明审批队列端到端消费。新实现必须先于模型运行，危险未知即 HOLD，并补齐真实人工签署阻断链。
2. **PACK 确定性工程核**：优先迁移电芯库接口、sizing、成本校验、跨模块一致性和负向测试。
3. **Battery R&D OS 只读证据接口**：朝堂负责决策编排，专业系统继续负责项目、样品、实验和报告事实。
4. **修正六部资产矩阵**：旧清单虽然枚举了 EXT 全树，却把 PACK 核心标成 out-of-scope；必须新增专业能力族并重新计算 readiness。

### P2：在证据主干稳定后

1. 史馆 append-only outcome ledger、失败回填和时间新鲜度；
2. 天道 G/G1 与 EGB shadow 合并；E 只保留不可执行合同和负向测试；
3. 电芯测试、供应商寻源、储能售后、法律红蓝对抗、礼部五工位媒体门等专业方法；
4. CourtOS-Brain 的 Source→Version→Chunk→Citation 方法与严格白名单知识。

### P3：最后吸收

1. 前端只读 view-model 与诚实状态标签；
2. secure ingest/W08 的文件安全负测；
3. 历史 UI 设计语言和产品验收模式。

## 明确不应吸收的内容

- 旧 `flow_engine`、双 registry、旧 API 和最高 150 次模型调用的大单体流；
- 复制到多个部门的通用 skills、OpenClaw/Hermes 安装器和自进化指针；
- 前端的决策账本、业务计算和“第二大脑”；
- CourtOS-Brain 全库、Obsidian vendor、备份、个人笔记、CoT 与运维日志；
- 未核实的历史 BOM、报价、供应商、真实报告、运行 ledger 和派生向量；
- certification/release 仓的旧测试输出作为 ext-dev 的当前成功证明；
- 已冻结的 Battery Exchange mock 产品，除非另行重启产品范围。

## 主要冗余

1. **运行时冗余**：旧 FlowEngine、前端 CourtOS、DEV RuntimeSkill 三套运行语义；只保留 DEV。
2. **治理冗余**：天道 E、EGB Engineering Action、当前 WorkProduct/Confirmation；合并为一套 digest-bound mandate。
3. **知识冗余**：三份 CourtOS-Brain、IMA/本地 battery knowledge、电芯库和 Battery R&D OS 数据；必须按来源、版本、许可去重。
4. **角色冗余**：EXT 的 chief/bridge/craftsman/quality/e2e 与 DEV 的 architect/module/test 角色重叠；提炼职责，不增相同岗位。
5. **前端 roster 冗余**：同一部门存在 6、7、8、9 席不同 roster；不能任选一个成为权威。

## 主要冲突

1. **authority 冲突**：Prompt、客户端 DTO、前端 store、旧工具声明都不能授予权限。
2. **事实源冲突**：PACK 参数只能由受信数据/专业系统投影；兵部、礼部和模型不得修改工程事实。
3. **安全冲突**：电池 P0/P1 结论不能被多数表决、缓存、降级 fallback 或用户模式覆盖。
4. **身份/租户冲突**：owner 只能来自服务端认证；当前没有真实 tenant authority，不能把 owner 冒充 tenant。
5. **学习污染**：历史日志、模型自评和未经认证的 outcome 不能进入史馆学习闭环。
6. **命名冲突**：电池 PACK 研发与“任务 evidence pack/audit loop”必须使用不同名称；吏部 `libu_personnel` 与旧礼部 `libu` 也必须继续消歧。

## 最佳融合设计

采用“专业系统 + 朝堂治理”的联邦结构：

```text
Battery R&D OS / Legal Agent / Libu Studio / Intel
              │  owner-scoped read-only evidence adapter
              ▼
        统一 Evidence Spine
              │
  deterministic domain core + physical safety gate
              │
              ▼
  现有 46 RuntimeSkills（唯一生产 registry）
              │
       Tiandao G admission
       Tiandao G1 shadow
       E remains disabled
              │
              ▼
 WorkProduct → human confirmation → Shiguan archive
              │
        authenticated outcome ledger
```

这种结构保留原设计的专业深度，同时防止旧仓、专业产品和知识库变成第四条运行主线。

## 下一步冻结顺序

1. 为本人工治理清单 v0 补机器生成器和确定性测试，锁定来源 ref/path/blob 与明确排除项；
2. 修复现有六部 inventory/matrix 对 PACK 的漏分；
3. 建电池安全黑门和 PACK 纯确定性核心；
4. 接 Battery R&D OS 只读证据适配器；
5. 补 Stage Gate/WorkProduct/Confirmation/史馆 outcome；
6. 完成对抗测试与独立安全审查后，才讨论 candidate/shadow。
