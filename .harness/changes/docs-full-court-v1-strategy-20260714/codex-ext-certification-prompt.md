# Codex 提示词：EXT 主线三证认证（整段发给 Codex）

> 依据：用户 2026-07-14 裁决——EXT 必须同时拿到 `EXT_MAINLINE_COMPLETE`、
> `EXT_FULL_COURT_RUNNABLE`、`EXT_MIGRATION_SOURCE_READY` 三张证书，才能作为
> 向 feature-chaotang-release 逐能力迁移的母仓。代码很多 ≠ 主线完整 ≠ 全部跑通 ≠ 可以上线。
> 本提示词已按本仓实况锚定 SHA、复用已有证据、吸收 P0 的 runner 教训。
> 若用户希望认证锚定其他 SHA，改第一节 EXT_BASE_SHA 后再发。
> （2026-07-15 恢复说明：原件在并行工作区清理中丢失，本文件从审查者上下文
> 原样恢复。执行状态：按 2026-07-14 23:28 优先级裁决**冻结**，absorption
> P0–P9 完成后启动。届时 EXT_BASE_SHA 应更新为当时 ext HEAD。）

```text
你现在是"朝堂 OS EXT 主线完整性、全功能可运行性和 Agent 价值认证负责人"。

本任务目标：判定 feature-chaotang-ext 是否具备：

1. EXT_MAINLINE_COMPLETE   —— 语义和架构已收敛为唯一主线
2. EXT_FULL_COURT_RUNNABLE —— 所有正式能力可独立运行并组合跑完全链
3. EXT_MIGRATION_SOURCE_READY —— 可作为逐能力迁移母仓

同时对全部 Agent 给出可证据化的作用与价值分类。

本任务不是重构任务。不得修改产品代码。不得开始收敛实现。不得迁移代码。

==================================================
一、固定参数（启动前人工确认/更新 SHA）
==================================================

SOURCE_REPO=/home/ubuntu/Projects/chaotang-os
SOURCE_BRANCH=feature-chaotang-ext
EXT_BASE_SHA=<启动时人工填写完整 40 位 SHA（原锚 a2bdcdd47bfbb239d9d0e3b65e41497e3ec14cc7 已过期）>
EXT_TREE_SHA=<对应 tree SHA>
CERT_REPO=/home/ubuntu/Projects/chaotang-ext-certification
EVIDENCE_ROOT=/home/ubuntu/Projects/chaotang-ext-certification-evidence

启动自检（任一失败输出 CERTIFICATION_NO_GO+原因并停止）：

1. `git -C $SOURCE_REPO cat-file -t $EXT_BASE_SHA` 必须是 commit；
2. `git -C $SOURCE_REPO rev-parse $EXT_BASE_SHA^{tree}` 必须等于 EXT_TREE_SHA；
3. 若 EXT_BASE_SHA 已不是 ext HEAD（ext 在认证期间可能前进），照常认证该
   固定快照，并在报告 Identity 节记录当时 HEAD 差距；不得偷偷改用新 HEAD。

CERT_REPO 不存在则从固定 SHA 创建完全独立 clone（detached，非 worktree，
避免与主仓共享 index）；已存在则验证 HEAD==EXT_BASE_SHA、tree==EXT_TREE_SHA、
`git status --porcelain` 为空，任一不符 → CERTIFICATION_NO_GO。

==================================================
二、安全规则（违反任一条即整体作废）
==================================================

- 不在 SOURCE_REPO 内开发；不 reset/clean/stash/丢弃任何未知修改。
- 不 push 任何分支。
- 不连接生产数据库；严禁读写
  /home/ubuntu/Projects/chaotang-os/backend/var/data/fengqun.db
  （真实控制面 DB；P0 已建三元指纹基线，认证结束后须再次核对 hash 一致）。
- 所有临时 DB、缓存、日志、node_modules 只能位于 CERT_REPO 与 EVIDENCE_ROOT。
- 不使用真实客户数据；不调用未经批准的收费 Provider；合成数据可用但必须标注。
- 不输出任何秘密值；不修改测试制造通过；不把 MOCK/DEMO/FALLBACK 解释为 LIVE。
- 单写入者：本任务运行期间不启动其他写入型 Agent；与 FULL_COURT absorption
  战役互不触碰——认证只读固定快照，absorption 改的是活分支，二者天然隔离，
  但你不得因认证发现顺手去改 absorption 的范围。
- 所有证据文件必须绑定 EXT_BASE_SHA + 命令 + cwd + 退出码 + 起止时间。

==================================================
三、已有证据必须复用（不重做已做过的功）
==================================================

以下文件是已完成并经 Claude 审查的证据，直接作为输入并交叉核对，
不得无视也不得照抄结论不验证：

1. .harness/changes/docs-full-court-v1-strategy-20260714/census.md
   —— 74 项 capability registry（注意：经审查有 5 项缺口 CEN-01..05，
   见 census-review.md；庄园/御座/平台族/通知需补齐或显式排除）。
2. .harness/changes/docs-full-court-v1-strategy-20260714/mainline-absorption-review.md
   —— 重复实现地图与 canonical 裁决候选。
3. .harness/changes/chore-absorption-baseline-20260714/baseline.md
   —— P0 基线：KPI 口径、已知 7 个前端失败、runner capability 根因。
4. absorption P1+ 各 Packet 的 change 目录与 packet-reviews/（认证启动时最新态）。

P0 已确认的 runner 教训（认证环境必须先做 capability preflight）：
- 受限 profile 下 socketpair 被禁（EPERM），FastAPI TestClient 与 tsx 会
  无限 hang——这不是仓库缺陷。跑任何 TestClient/tsx 前先执行：
  `python3 -c 'import socket; a,b=socket.socketpair(); a.send(b"x")'`
  失败则该套件标 NOT_RUN_RUNNER_CAPABILITY，换正常/授权 profile 重跑。
- 一切测试命令必须有界超时（timeout 300s 起），超时如实记录退出码 124。
- 无选择后端全量 pytest 在生产路径 tripwire 齐备前为
  NOT_RUN_SAFETY_BLOCKED；用批准代表套件 + collect-only 口径替代。

已知红灯基线（复核而非惊讶）：前端 test:node 7 个基线失败（其中 4+个引用已
退役 BFF 的死测试）、lint script MISSING、
test_chancellor_chat_streams_single_agent_reply 依赖真实 LLM 断言。
（认证启动时以最新 Packet 证据中的基线清单为准。）

==================================================
四、认证一：功能宇宙盘点（C1）
==================================================

以 census.md（含 CEN-01..05 修正后版本）为底，增量扫描：

- frontend 所有 page、feature、adapter、store、mock、fallback；
- backend 所有 router、domain service、agent、flow、worker、provider；
- 所有 prompt、agent_design、flow yaml；
- 所有数据模型、迁移、事件；
- 所有测试、E2E、脚本和部署资产。

对每项输出（沿用 census 字段并补）：capabilityId、agentId、名称、
类型（AGENT / DETERMINISTIC_SERVICE / QUALITY_GATE / HUMAN_ROLE / METRIC）、
用户价值、触发条件、前后端入口、API、数据对象、事件、Prompt/Flow、
输入/输出/失败契约、sourceLabel、Feature Flag、测试、L0–L6、
production reachable、Mock/Fallback 依赖、是否接入 DecisionTask 主链、
canonical owner 候选、重复实现、安全/租户风险、UNKNOWN 标记。

通过条件：
生产可达页面未登记数 = 0；生产可达 API 未登记数 = 0；Agent 未登记数 = 0；
正式数据对象 owner 不明确数 = 0；无法判断作用的活代码数 = 0
（历史/测试/归档代码可存在但必须标识）。

==================================================
五、认证二：七个唯一（C2）
==================================================

逐项检查并给文件+运行证据：

1. 唯一产品生命周期：DecisionTask → ChancellorRouteDecision → OutboxEvent
   → DecreeExecutionEvent → DepartmentMemorial → CourtReview → FinalMemorial
   → EmperorDecision → ShiguanArchive；绕链生成正式结果的都是旁路。
2. 唯一业务状态机：前端只消费后端读模型，不得自推状态。
3. 唯一能力注册表：一个 capabilityId/agentId/departmentId/owner/
   输入契约/输出契约/Feature Flag。
4. 唯一数据 owner（含生产 Schema 权威=Alembic）。
5. 唯一 API owner：后端为正式业务 API 权威；frontend/src/app/api/** 不得复活。
6. 唯一失败语义：成功/缺证/告病/超时/不支持/权限拒绝/人工复核/部分完成；
   失败不得变成"暂无风险/未发现问题/任务已完成"。
7. 唯一发布身份：测试/报告/构建/迁移/截图/Trace 绑定
   commit SHA、tree SHA、lockfile hash、migration revision、schema version、
   prompt version、quality rule version、artifact hash。

已知重复清单（mainline-absorption-review §一/三，注意 absorption 各 Packet
已消解的部分按最新证据核销）作为起点逐项裁决：
KEEP / ADAPT / REBUILD / SHADOW / RETIRE。只提出裁决，不改代码。

通过条件：正式重复 departmentId/capabilityId/状态机/迁移权威/
FinalMemorial owner/用户租户权威 全部 = 0（SHADOW/RETIRE 判决可计为
"裁决已定待执行"，需在 Blocking gaps 列明由哪个 absorption Packet 承接）。

==================================================
六、认证三：Agent 护照（C3）+ 类别裁决
==================================================

为每个 Agent 输出护照：agentId、agentClass、业务问题、独有职责、
明确不负责的内容、trigger、inputContract、outputContract、failureContract、
tools、readPermissions、writePermissions、forbiddenActions、tenantBoundary、
sourceLabelPolicy、featureFlag、SLO、costBudget、goldenCases、negativeCases、
recoveryCases、valueHypothesis、baselineWithoutAgent、ablationPlan。

类别裁决基准（不要把所有模块都叫 Agent）：
丞相=推理编排 Agent；军机处=确定性控制服务；六部=专业判断 Agent；
锦衣卫=证据 Agent/检索服务（禁止直接给业务结论）；
御史=确定性规则门优先（禁止改写后放行）；翰林=离线评测系统（禁改生产）；
钦天监=Shadow 预测 Agent（样本不足 NO_DATA/null）；史馆=确定性归档服务；
圣裁=人类角色；国力=指标系统。
确定性 CRUD/状态转换/派单/幂等/硬规则/归档被做成 Agent 的
→ 建议降级 DETERMINISTIC_SERVICE。没有护照的 Agent 不得进入正式主链。

==================================================
七、认证四：实际运行矩阵（C4，在 CERT_REPO 隔离执行）
==================================================

先跑（全部有界超时+capability preflight）：
三层 harness doctor；tsc --noEmit；frontend lint（MISSING 记 FAIL）；
real production build；frontend node/core tests；backend Ruff；
backend 代表契约套件；pytest collect-only；对 hang 测试逐文件定位；
临时数据库；不用生产 Provider。

对每个正式 Agent/服务至少测试十场景：
正常输入 / 缺少证据 / 不支持任务 / Provider 失败 / 权限拒绝 / 跨租户 /
重复事件 / 进程重启 / Feature Flag 关闭 / SHADOW 不晋升 LIVE。

每项记录：命令、cwd、SHA、起止时间、退出码、日志、数据库影响、输出对象、
状态转换、Trace，结论只能 PASS / FAIL / NOT_RUN / INSUFFICIENT_EVIDENCE。
测试不存在不得判 PASS——记 NOT_RUN(NO_TEST) 并入 Blocking gaps。

==================================================
八、认证五：完整 Decision Trace（C5/C6/C7，合成数据）
==================================================

D0：咨询 → 丞相代答 → 证据 → 不生成正式奏折。
D1：下旨 → 拟票 → 朱批 → 路由 → 派单 → 单部回奏 → 御史 → FinalMemorial
    → 人工圣裁 → 史馆。
D2：下旨 → 会办 → 多部回奏 → 冲突显式呈现 → 告病/缺席视角 → 丞相倾向
    → 御史 → 圣裁 → 归档。

另验：必需部门告病、非必需部门告病、补证、局部问话、再议、驳回、
Provider 超时、Worker 重试、页面刷新、正式奏折唯一、史馆版本保留、
跨租户负向访问。

判定标准不是接口 200，而是：正确对象写入、状态正确、证据正确、失败正确、
无越权副作用。环境不能安全运行的场景标 NOT_RUN，不得伪造通过。

==================================================
九、认证六：Agent 价值评估（C9，消融）
==================================================

每个 Agent 设计 A（无该 Agent 基线）/ B（启用）/ C（SHADOW）三次运行，
比较：决策质量、独有问题覆盖、EvidenceAnchor 覆盖、误报、人工改判、
用户可行动性、延迟、Token/API 成本、失败率、恢复能力。

安全硬门（一票 NO-GO，不参与加权）：跨租户违规=0、高风险无证据晋升=0、
MOCK/FALLBACK 晋升 LIVE=0、未授权不可逆动作=0、静默失败=0。

通过安全门后评分：决策质量增量 30 / 独有问题覆盖 20 / 证据完整性 15 /
稳定性与恢复 15 / 用户可行动性 10 / 成本延迟 10。
分类：CORE / SUPPORT / SHADOW / REBUILD / RETIRE / INSUFFICIENT_EVIDENCE。
80–100 CORE；60–79 SUPPORT；40–59 SHADOW；<40 RETIRE 或降级。

消融需要真实模型调用；未获批准的收费调用一律不做——此时该 Agent 只能
标 INSUFFICIENT_EVIDENCE，不得仅凭代码或 Prompt 给 CORE，
不得用输出长度或调用次数冒充价值。

==================================================
十、最终报告（先落盘，后发 token）
==================================================

报告与全部证据写入 EVIDENCE_ROOT，主报告固定路径：

EVIDENCE_ROOT/EXT_MAINLINE_CERTIFICATION_REPORT.md

并在 SOURCE_REPO 的
.harness/changes/docs-full-court-v1-strategy-20260714/ext-certification/
放一份副本（这是 SOURCE_REPO 内唯一允许的写入路径）。

报告结构：
1. Identity（EXT_BASE_SHA、tree SHA、branch、CERT_REPO、worktree cleanliness、
   evidence root、认证期间 ext HEAD 漂移记录）
2. Certification verdicts（只能用：EXT_MAINLINE_COMPLETE/EXT_MAINLINE_NO_GO、
   EXT_FULL_COURT_RUNNABLE/EXT_RUNTIME_NO_GO、
   EXT_MIGRATION_SOURCE_READY/EXT_MIGRATION_NO_GO、
   EXT_RELEASE_READY/EXT_RELEASE_NO_GO）
3. Seven uniqueness verdict（逐项 PASS/FAIL/UNKNOWN+证据）
4. Capability registry（含成熟度）
5. Agent registry and passports
6. Runtime matrix（逐 Agent 逐场景 PASS/FAIL/NOT_RUN）
7. Decision Trace results（D0/D1/D2+失败恢复）
8. Agent value ledger（分类+证据+评分+消融状态+是否允许进正式结果）
9. Duplicate fact sources（KEEP/ADAPT/REBUILD/SHADOW/RETIRE）
10. Blocking gaps（按依赖顺序，注明由哪个 absorption Packet/新 Packet 承接）
11. Migration readiness（直接迁移包/须 Adapter/须重建/只许 Shadow/应退役）
12. First ten Task Packets（Task ID/Goal/Dependencies/In+Out scope/
    Acceptance/Verification/Rollback）
13. Claude review packet（生成可直接交给全新 Claude Code 会话的只读审查
    提示词，含本次全部证据路径与 SHA 绑定）

诚实规则：三证是独立判定，任何一证据不足就对该证 NO_GO；
NOT_RUN/INSUFFICIENT_EVIDENCE 永远不得折算成 PASS；
"功能多"不构成任何一证的通过理由。

报告完整落盘后，聊天最后一行只输出：

CERTIFICATION_READY_FOR_CLAUDE_REVIEW
或
CERTIFICATION_NO_GO(+原因)
```

---

## 使用说明

1. 启动前把 EXT_BASE_SHA/EXT_TREE_SHA 更新为当时 ext HEAD（原锚 `a2bdcdd`
   已被后续提交超越）。ext 若继续前进不影响认证有效性，报告会记录漂移。
2. 认证与 absorption 战役并行不冲突：认证只读固定快照的独立 clone。
   但认证的 Blocking gaps 应尽量映射到 P1–P9 已有 Packet，避免第三套任务
   序列（census 审查 CEN-05 的教训）。
3. Codex 输出 `CERTIFICATION_READY_FOR_CLAUDE_REVIEW` 后，把报告第 13 节
   的审查提示词交给全新 Claude Code 会话做对抗审查；四个 REVIEW 全 GO +
   三证齐才允许开始逐能力迁移 release，永远不整分支合并。
