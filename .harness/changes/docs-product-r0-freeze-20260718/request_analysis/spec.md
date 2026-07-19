# 规格说明：docs-product-r0-freeze-20260718

## 背景

2026-07-18 的产品讨论已经确认长期方向是“用户超级助手 + 动态多 Agent 朝堂”，但仓库当前产品 SSOT 仍把产品本体定义为企业老板决策 OS；收敛指南仍要求 FULL_COURT_V1 全量 L3 后再冻结发布；融合蓝图又保留 `R1 六部覆盖 → R2 合同包` 的旧顺序。三套当前口径会让 ICP、销售承诺、数据责任和工程优先级继续分叉。

本 change 只做产品事实源冻结，不把文档批准误报成代码实现或生产就绪。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 远端目标头在本变更开始时为 `6ee6d8d542127174f4d899f940d4937b6fa2b70f` | `git ls-remote origin refs/heads/feature-chaotang-ext`，2026-07-18 | Project Agent 只读核验；仅为历史起点 | 否 |
| 已确认事实 | 精确候选审查期间目标头前进至 `5d273c3fbe5e02e52b6ab3e8630f6d54a0c78a43`；新增 3 个 P8/P9 前端残留收口提交，与本变更路径不重叠 | `git fetch`、`git merge-tree --write-tree` 与 `git rebase origin/feature-chaotang-ext`，2026-07-18 | Project Agent 核验零冲突后线性重基；必须对重基后 SHA 重跑门禁 | 否 |
| 已确认事实 | 2026-07-19 最新 target 为 `05582e520300e32a5d84e2b38b3822903f75c954`；Gitee PR !3 头 `3c05aae...` 与 target 文件交集为 0，服务端预合并与合并态 root doctor 通过 | `refs/pull/3/MERGE@0ebe7812...`、临时 worktree、`node scripts/harness-doctor.mjs` | 只证明可合并，不替代内容终审或平台审批 | 否 |
| 已确认事实 | PR !3 精确头终审发现产品冻结 DoD 混入未实现跨端条件，以及历史 P0–P9/C0–C2 仍带当前命令语气 | `pr3_exact_head_stopgate`：`3c05aae...` BLOCK；正文/证据修复提交 `b2627be...`；内容 follow-up `ALLOW` | 原三项 blocker 已关闭；`b2627be...` exact review 仅阻断过时的“未提交候选”证据，本证据提交予以纠正 | 最终 PR head 仍须分支外 exact SHA review 后才可合入 |
| 已确认事实 | 本地主工作树 `79b1eaa` 与远端分叉为本地 78 / 远端 3，不适合作为产品冻结基线 | `git rev-list --left-right --count 6ee6d8d...79b1eaa` 与 merge-base `bf7d4cc` | Project Agent 只读核验 | 是，已通过干净远端基线规避 |
| 已确认事实 | 安全恢复分支精确保存本地主线 `79b1eaa` | `refs/heads/safety/pre-convergence-20260718-79b1eaa` | 远端引用核验 | 否 |
| 已确认事实 | 融合 RFC 原提案 hash 为 `475f13ad4eb8a839068787dbab200c85e39ede9713f1477efc33ad0c656d1de2` | 原 design commit `b0e54672` 前验证 | SHA-256 | 否 |
| 已确认事实 | 输入 A/B hash 分别为 `51374f5daf1a66fb0777abd34ada6c72e5b9ea8388e12386ee96228803d5a5b3` / `715a8126ee04de7371f64ed39c39d27a36e3047c28acd99fcf1a472aa41d0813` | `source_inputs/` | SHA-256 | 否 |
| 已确认事实 | 当前运行实现存在门下最大轮次 fail-open、非空伪来源可晋升、direct 回执即完成三类 stop-ship | `backend/src/menxia_veto.py`、`backend/src/swarm_quality_gate.py`、`backend/src/formal_memorial.py`、`backend/web/routers/shangshufang.py` | 前序只读工程会审；本 change 不修代码 | 是，阻塞 R0/R1，不阻塞产品冻结 |
| 假设 | 第一付费 ICP 愿意购买有配额、有人审、可退出的合同共创 | 新 R0/R1 PRD A-01/A-05 | R1 客户发现与真实付款 | 不阻塞 R0 |
| 未知问题 | 文件阈值、支持 taxonomy、人工复核、数据保留、provider 与标注预算尚未冻结 | 新 PRD OQ-02–OQ-10 | 对应 Product/Security/Legal/Ops Owner | 阻塞真实合同，不阻塞产品冻结 |

## 决策与文档流

```text
用户批准的产品方向
  → 融合 RFC（接受后的历史理由）
  → PROJECT_PRODUCT（当前产品字段 SSOT）
  → R0/R1 PRD（本 release 的需求与门）
  → 下一独立 M0–M10 amendment（schema/owner/施工）
  → 实施 change（精确 HEAD、测试、回滚证据）
```

任何下游文档不得反向宣称目录能力已经实现，或用 PRD 冻结证明工程完成。

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| 产品身份、用户、Offer、发布层级 | `PROJECT_PRODUCT.md` | PRD、官网/销售文案、工程 amendment | 当前唯一产品 SSOT；关键词冲突检查 |
| R0/R1 REQ 与验收门 | `product-r0-trusted-kernel/PRD.md` | M0–M10 amendment、测试与 release change | 每条 REQ 有 ID、阶段、失败语义 |
| 设计理由 | 融合 RFC accepted decision record | 决策追溯 | 后续不双写当前产品字段 |
| 41 司目录 | `TARGET_DIRECTORY_V1` 产品定义；运行 registry 待 amendment 指定 | capability 治理 | 目录状态不得冒充实现/生产 |
| 运行 schema 与状态 | 后续 ADR/contracts | 前后端与 worker | 本 change 不修改 |

## 范围

允许修改：

- `docs/README.md`；
- `docs/product/PROJECT_PRODUCT.md`；
- `docs/product/CHAOTANG_CONVERGENCE_GUIDE.md`；
- `docs/product/releases/product-r0-trusted-kernel/PRD.md`；
- 两份 2026-07-18 产品蓝图的状态/权威/发布修订；
- 六份仍引用旧 FULL_COURT/Step 0–12 权威的历史计划顶部状态与失效指针：launch blueprint、full-court loop、V2 backlog、department-agent architecture、single-fact-source、knowledge-memory-flywheel；
- 本 change 记录；
- 已在前置 source-preservation commit 中导入的 14 个产品设计/审计文件。

## 非目标

- 不实现 PRD。
- 不修三项 stop-ship 代码。
- 不修改 M0–M10 排期或偷塞新 schema。
- 不创建另一套 Mission、任务状态或产品事实源。
- 不安装 LangGraph、OpenClaw、Hermes、Humen/Hume。
- 不承诺公众 GA、真实法律意见、自动签约或六部 41 司已上线。
- 不合并本地主工作树的 78 个分叉提交。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 产品愿景广、首发支持窄 | 产品身份写超级助手，R1 只承诺合同纵切 | SSOT + PRD 支持矩阵 |
| 41 司存在于长期版图 | 标 `TARGET_DIRECTORY_V1` 和独立成熟度，不标 active | 关键词与表格 review |
| 世界杯案例很吸引用户 | 只标只读 benchmark，不放 R1 Offer | SSOT + PRD 非目标 |
| PRD 与旧发布顺序冲突 | 显式替换 guide 与 RFC `11.3`，不只加注释 | diff review |
| 历史 source_inputs | 内容和 hash 必须不变 | SHA-256 |
| 产品冻结通过 | 仍不得宣称工程完成或接收真实合同 | 文档状态与红线 |
| 远端主线变化 | 产品分支仍保持线性、可审查；合并前重新对账 | ancestry + ls-remote |

## 风险与回滚边界

- 风险：文档变得自洽但实现仍 fail-open。缓解：所有 stop-ship 写入 SSOT/PRD，并明确下一工程 change。
- 风险：合同切片被误解成永久产品边界。缓解：分开“产品本体、第一 Offer、目录、benchmark”。
- 风险：41 司目录被当作已上线。缓解：统一成熟度枚举和“登记不等于生产”红线。
- 风险：旧 Step 0–12 与 M0–M10 双排期。缓解：guide 明确旧映射只供历史解释，工程只由 M0–M10 + amendment 拥有。
- 风险：产品分支混入本地大分叉。缓解：从远端干净 worktree 起步，并在目标前进后线性重基到 `5d273c3`；安全分支继续精确保留 `79b1eaa`。
- 回滚：本变更全部是文档。保留前置输入包、只撤产品冻结时，从产品分支精确 HEAD 执行 `git revert --no-commit 33dac7b47be09c60f77642b74a4be1afe0e0c673..HEAD` 后提交；整包撤销时执行 `git revert --no-commit 5d273c3fbe5e02e52b6ab3e8630f6d54a0c78a43..HEAD` 后提交。不得 reset/force-push，不涉及数据库、运行数据或外部系统。

## 计划确认记录

- 批准人：项目业主（用户）
- 批准日期：2026-07-18
- 批准范围：同仓 strangler 收敛；产品是超级助手；合同是第一可信/收费纵切；按顺序推进；继续执行产品冻结。
- 明确未批准：新项目重写、运行时代码修改、真实客户数据摄取、第三方安装、自动学习、公众发布、把 41 司或世界杯冒充生产能力。

## 验收标准

- `PROJECT_PRODUCT.md` 明确且唯一地定义产品、第一 Offer、41 司目录、世界杯 benchmark 和 R0→R1→R2→R3+。
- R0/R1 PRD 有用户/JTBD、目标/非目标、REQ ID、状态/失败、成果、数据安全、指标、验收、rollout/rollback。
- guide 的 FULL_COURT 全量 L3 裁决与旧 Step 执行权威被明确替代。
- 仍自称 `IN PROGRESS`、`REVIEWED_GO`、`最终产品形态冻结`、上位施工权威或强制 V2 intake 的旧计划均有显式 `SUPERSEDED/HISTORICAL` 横幅。
- RFC 为 accepted decision record；参考输入不再拥有产品定义或排期。
- immutable source hash 不变；只改 allowlist 路径。
- ancestry 线性且不含本地 78 个分叉提交。
- root harness doctor、Markdown/链接检查与独立 stop-gate 通过。

## 验证计划

1. `git diff --check`、围栏、相对链接、冲突关键词与路径 allowlist。
2. SHA-256 校验融合 RFC 旧值→新值与 A/B source_inputs 不变。
3. `node scripts/harness-doctor.mjs`。
4. `git merge-base`、`git rev-list`、merge commit 与远端引用核验。
5. 提交精确候选后交给独立 agent 只读 stop-gate。
