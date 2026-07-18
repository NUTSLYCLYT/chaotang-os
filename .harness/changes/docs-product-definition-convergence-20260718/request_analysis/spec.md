# 规格说明：docs-product-definition-convergence-20260718

## 背景

用户要求比较并融合两份 2026-07-18 候选架构，形成更好、更全面、可用于产品定型的单一方案，并说明产品定型前仍需完成的工作。用户随后明确：产品本体是协调多 Agent 集群完成复杂任务的“用户超级助手”，世界杯只是代表案例，长期目标覆盖六部全部专属司。候选 A 位于干净独立工作树，候选 B 只存在于含 merge 冲突的主工作区。为保护用户现有冲突现场，本 change 只在干净工作树写入。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 当前产品事实源冻结 B2B 企业老板、合同审查首发与 5/3/1/1 扩张门 | `docs/product/PROJECT_PRODUCT.md` | 2026-07-18 主代理只读核对 | 是，禁止静默转为消费全域首发 |
| 已确认事实 | 业主把产品本体定为用户超级助手 + 动态多-Agent 朝堂，世界杯为案例、六部全部司为长期目标 | 2026-07-18 用户明确指示 | 本 change 记录；产品 SSOT 待整套方案批准后原子更新 | 是，产品定义不得再退回合同工具 |
| 已确认事实 | 候选 A 强在任务交付、证据/成果/授权、知识飞轮、Agent 预算和 UX | 固化快照 SHA-256 `51374f5daf1a66fb0777abd34ada6c72e5b9ea8388e12386ee96228803d5a5b3` | 全文读取 + 产品/红队会审 | 否 |
| 已确认事实 | 候选 B 强在问策/办事/守望、DeliverableContract、完成度八门和 MCP 信任层，但混入易过时 Git 现场与数量目标 | 最终固化快照 SHA-256 `715a8126ee04de7371f64ed39c39d27a36e3047c28acd99fcf1a472aa41d0813` | 初读后检测到协作者更新，重新全文读取并封存 | 否 |
| 已确认事实 | 当前 canonical 链已存在，不能新建第二套 Mission 状态库或第二 `FinalMemorial` | `DecisionTask → route → outbox → CourtReview → FinalMemorial → EmperorDecision → ShiguanArchive` | 仓库能力审计 | 是 |
| 已确认事实 | 六部身份与六部 adapter 骨架存在，但详细 41 司主要是前端设计 registry，后端 taxonomy/si_registry/实际 engine 命名漂移 | `backend/harness/chaotang_department_protocol/departments.yaml`、六份 `frontend/config/*office.registry.yaml`、`backend/config/si_registry.yaml`、`backend/src/real_department_engines.py` | 2026-07-18 仓库只读能力审计 | 是，不能宣称全部诸司已生产可用 |
| 已确认事实 | 部分执行会退回通用 LLM/规则；direct 不执行真实 swarm，工部不创建真实外部工单，户部付款仅 preview | `backend/src/swarm_execution_loop.py`、`backend/src/execution/outbox_worker.py`、`backend/src/real_department_engines.py`、`backend/src/hubu_payment_preview.py` | 2026-07-18 仓库只读能力审计 | 是，发布能力必须按两轴认证且禁止裸 fallback |
| 已确认事实 | 主工作区仍有 4 个 AA 冲突与范围外运行时代码改动 | `git status --short`，2026-07-18 | 只读 Git 核对 | 是，必须先形成干净 integration HEAD |
| 推测 | 未来个人/旅行版可能形成订阅与专案包 | 尚无真实付款/留存证据 | 只作为产品假设 | 否，不进入首发承诺 |
| 未知问题 | “Humen”准确产品身份 | 用户尚未提供链接 | 选型前由业主确认 | 否，不阻塞核心定型 |

## 数据流与调用链

候选 A/B 固化快照 + 当前产品事实源 + M0–M10 计划 → 比较矩阵 → 冲突裁决 → 融合 Decision/RFC → 业主批准并原子更新产品 SSOT → 专项 contract/ADR。当前 change 不改变运行时数据流。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 产品定位/ICP/商业化 | 当前 `PROJECT_PRODUCT.md`；融合稿提出变更 | 产品、销售、设计、工程 | 只有业主批准后才更新事实源 |
| `MissionContractV1` | 未来丞相规划服务 | 路由、完成门、成果服务 | 提案；合并 GoalBrief/DeliverableContract；确认事实由独立 Decision 写入 |
| `RequiredCapabilitySetV1` | 未来 Capability Requirement Service | 稀疏规划、门下、拒答 | 提案；hard requirement 不可由候选 Agent 自降级 |
| `ActivationPlanV1` | 未来 Sparse Activation Planner | 门下、计划确认、dispatcher | 提案；active/零权限 standby/envelope 分离，每项绑定 requirement 与允许理由 |
| 统一协议栈 | 各 canonical service | 前后端与 harness | 提案；每对象需 schema/owner/writer/upcaster |
| 三类 Decision | 未来 Decision Service | 计划、正式奏折、现实动作 | MissionConfirmation/MemorialDecision/ActionApproval 必须绑定不同摘要 |
| `EvidenceCompletionAssessmentV1` / `DeliveryAssessmentV1` | 成文前 quality stage / 成文后 delivery gate | 御史、成文门、UI | C1–C7 后才能成文；C8 只控制 DELIVERED |
| `OutcomeReceiptV1` | 只读 projection | UI/评测 | `ArchiveOutcomeEvent` 只由认证 Outcome Service 写入 |

## 范围

- 两份方案比较、冲突和去留。
- 超级助手产品层级、核心用户/GTM ICP、JTBD、体验、角色与非目标。
- 六部 41 司目标 taxonomy、能力实现/权限双轴和当前覆盖事实边界。
- RequiredCapabilitySet、稀疏激活、最小权限、消融与路由验收。
- 唯一主链、协议映射、正交状态、质量门、授权与恢复。
- 能力/Agent/MCP/第三方、知识飞轮不变量。
- benchmark portfolio、专业包、商业模式、GTM、产品/专业包指标和 R0–R5 发布门。
- 产品定型前的产品、工程、数据、安全、运营和文档工作清单。

## 非目标

- 不改写 `docs/product/PROJECT_PRODUCT.md`；等待业主对融合稿明确批准。
- 不修改前端、后端、数据库、MCP、provider 或生产配置。
- 不解决主工作区 merge 冲突或吸收范围外运行时代码。
- 不安装 OpenClaw/Hermes/Humen/Hume，不启用飞轮、支付或预订。
- 不把文档中的目标协议宣称为已实现。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 业主方向与当前产品 SSOT 冲突 | 产品本体按超级助手设计；合同保留为首个收费专业包；整套方案批准后原子更新 SSOT | 定型稿 0/2/8/9/12 节 |
| “全六部”被误读为每单全员运行 | 目录全覆盖、单次最小安全激活，未激活能力零数据/权限 | 定型稿 3/4/5/6/11 节 |
| 角色/Prompt 被误读为生产能力 | 两轴成熟度、CapabilityCard、黄金任务与自动降级 | 定型稿 6/8/11 节 |
| A/B 协议重复 | 统一 MissionContract、三类 Decision 与单一对象映射 | 定型稿 4 节 |
| 质量/审批/执行混成一个状态 | 拆正交状态和用户派生阶段 | 定型稿 4.4 节 |
| 主工作区冲突 | 主工作区只读，融合稿写入干净 worktree | Git status + changed file scope |
| 未获业主最终批准 | 状态保持 PROPOSED_FOR_PRODUCT_FREEZE | 文档首部与完成定义 |

## 风险与回滚边界

- 风险：第三份文档继续增加事实源；通过明确当前 SSOT、输入关系、批准后 supersession 和专项 ADR 拆分避免。
- 风险：宏大愿景冲掉现有付费楔子，或首包证据被错误复用给新包；通过 `1+1+6+N`、Solution Pack 和包含候选包自身 release gate 的五项 AND 门冻结。
- 风险：41 司固定全员运行造成成本、相关错误与数据暴露；通过最小安全激活、硬上限、消融和 capability token 避免。
- 风险：目标协议被误读成已实现；所有运行时对象均标提案，现状问题进入 stop-ship。
- 回滚：删除新增融合稿与 change，撤销 README/输入 A 关系说明；不影响运行时和主工作区。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-18
- 批准范围：比较两份文档并制作一份更全面融合方案，为产品定型做准备；产品方向明确为用户超级助手 + 动态多-Agent 朝堂，六部全部司为长期目标。
- 明确未批准：更新产品事实源、实施运行时代码、解决 Git 冲突、安装第三方或执行真实动作。

## 验收标准

1. 明确比较 A/B、业主超级助手方向、当前产品 SSOT 与仓库能力事实，不静默改变收费市场或夸大当前覆盖。
2. 统一入口、契约、三类决定、状态、质量门、Agent/MCP/知识和外部组件边界。
3. 提出 41 司目标 taxonomy、能力双轴、稀疏激活、最小权限与版本化 benchmark portfolio。
4. 冻结候选核心用户/GTM ICP、合同专用裁决/UX、offer、产品/专业包北极星和量化验收。
5. 原样保留既有 `M0 → M1 → M2 → M5 → M6 → M3 → M4 → M7 → M8 → M9 → M10`，新增候选契约等待正式 amendment。
6. 根 Harness Doctor、完整新增文件 whitespace/结构检查通过。

## 验证计划

- 使用临时 Git index 将所有新增/修改文件纳入 `git diff --cached --check`。
- 检查 Markdown code fence 成对、章节结构连续、无 merge 标记。
- 运行 `node scripts/harness-doctor.mjs`。
- 核对工作区改动只落在 docs 与根级 change。
