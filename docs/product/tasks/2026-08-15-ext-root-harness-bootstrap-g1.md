# 任务：ext Root Harness G1 Bootstrap

> Task ID：EXT-ROOT-HARNESS-BOOTSTRAP-G1-20260815
>
> 本任务当前只冻结 G1 的事实、精确候选路径、授权恢复条件与验收合同。它不授予 G1 实施、
> 产品代码、平台配置、提交、推送或产品 GO。

## Status

Blocked

- Readiness packet：Implemented / PASS，仅允许三份文档。
- G1 implementation：Blocked，缺独立 immutable base、exact external grant 与机器治理 authority。
- Product implementation：Blocked，`execution-authority.ext.v1` 固定
  `canExecuteProductWork=false`。

## Product Definition

- 用户确认：用户于 2026-08-15 同意“产品减法 × 质量闭环”的优先级，要求从 G1 开始升级并继续
  盘点未吸收精华。该确认允许本轮只读勘察和任务包编制；机器 authority 返回 `STOP` 时不扩大为
  Harness 或产品实施权。
- 问题：`ext-dev` 已有成熟产品主链，但根 `AGENTS.md` 仍称仓库只处于最小骨架、没有正式业务代码；
  同时根 `.harness`、`scripts/new-change.mjs` 和 `scripts/harness-doctor.mjs` 不存在。项目实际状态、
  agent 入口和机器清单已经漂移。
- 目标用户：需要让 Codex、Claude Code、前端、后端和项目审查者从同一受管入口工作，并能区分
  “结构检查通过”“三层准备就绪”“产品可施工”的项目所有者。
- 目标：在未来单一、受权候选中建立 `BOOTSTRAP_OBSERVE` 根协调层；诚实登记 frontend 为
  `ABSENT`、backend 为 `PARTIAL`，提供 closed manifest、只读 doctor、change 模板与路径安全
  generator；修正 root AGENTS 与实际项目不一致，同时保持 ADR 0028、现有 ext authority、产品代码
  和 CI 行为不变。
- 非目标：不建立 frontend/.harness 或 backend manifest/doctor；不迁移 root v1/v2、R0、trust、
  runtime、rollout、release、lease、旧 change 历史或任何产品运行时；不新增 Agent、RuntimeSkill、
  页面、MCP、连接器、自动化、OutcomeEvent、RichMemorial 或翰林实现；不产生产品 GO。

## Confirmed Facts

- 编制基线：`origin/ext-dev@1b4f6efd55315e41013563603c22ce9aefe95f43`，tree
  `36fc2fdfb92b9d674c77c80c26ec26c6cbd2327b`。
- 规划 worktree：`codex/ext-root-harness-g1-readiness-20260815`，从上述远端对象创建且初始干净。
- 共享工作区在本轮勘察期间出现未知归属的 RuntimeSkill、锦衣卫、评测与 ADR 未提交改动；它们不被
  读取为批准事实，也不进入本任务候选。
- `node scripts/check_harness.mjs` 在共享脏树失败；这不是 clean `1b4f6efd` 的候选验收。
- `node scripts/execution_authority_ext.mjs --status` 返回
  `STOP / EXTERNAL_AUTHORITY_NOT_EVALUATED`。
- 以本 Task ID 调用 ext consumer 返回 `STOP / TASK_MISMATCH`，exit 2。
- `scripts/execution-authority.mjs`、根 `.harness`、root doctor/new-change、frontend Harness、backend
  manifest/doctor 均不存在。
- 只读参考来源仍冻结为
  `origin/docs/r0-trusted-kernel-amendment-20260720@8bb68fb4c58b889551699a06e9468e87db66361d`；
  其 `.harness` 789 个路径中 749 个是旧 change 历史，来源等级仅 `REFERENCE_ONLY`。

## Assumptions and Validation

- 假设：G1 可以使用独立的外部治理 authority，而不修改现有 ext consumer。验证：未来 authority
  必须在 G1 候选产生前绑定 accepted base、tree、Task ID、25 个 exact paths 与 non-goals，并由
  独立审查证明不会由仓内 change record 或同一候选自授权；否则保持 Blocked。
- 假设：`CLAUDE.md` 需要最小同步以避免双入口漂移。验证：独立审查必须证明其改动仅保持
  `@AGENTS.md` 委托与角色边界；若无需变更，应从最终 pathspec 删除而不是空改。
- 假设：G1 不需要修改 CI。验证：所有 G1 验收先由仓内确定性命令完成；外部 required check 的身份
  和 enforcement 由平台证明，不通过修改 workflow 自报。

## Acceptance Criteria

- [ ] 用户看到并精确批准 immutable implementation base/tree、Task ID、25 个展开路径和非目标。
- [ ] 独立于 G1 候选的治理 authority 对 exact grant 返回允许治理候选；任何聊天批准、任务文件、
  change record、workflow 或本地测试均不能单独产生 GO。
- [ ] `AGENTS.md` 以替换而非叠加方式修正过时事实，最终仍不超过 80 行，并准确描述
  root/frontend/backend 三层所有权；`scripts/check_harness.mjs` 与文件内 self-tests 在同一候选
  同步收敛，所有 REQUIRED literals、adaptive routing hash、ADR 0028、STOP 和 10 轮门禁保持。
- [ ] `ext-project-harness.v1` schema closed；unknown field、重复路径、非法状态和 READY 伪装失败关闭。
- [ ] root manifest 固定 `BOOTSTRAP_OBSERVE`、frontend `ABSENT`、backend `PARTIAL`、
  `observedAuthority.decision=STOP`、`canExecuteProductWork=false`，并把外部治理授权固定表示为
  `governanceGrantState=EXTERNAL_NOT_CONSUMED`；manifest 不消费 A0 grant/receipt。
- [ ] root doctor 的 `--check` 只证明 schema/磁盘一致且可 exit 0；`--status` 返回
  `BOOTSTRAP_OBSERVE`/exit 0；`--ready` 在 G4 前固定 `NOT_READY`/exit 2。
- [ ] doctor 只调用 ext `--status` 并断言 `STOP/product=false`；不调用 `--authorize`、不消费 grant、
  不访问网络、不写文件。
- [ ] `new-change` 只在 `.harness/changes/<exact-id>/` 创建四份模板；traversal、symlink、非法 slug、
  重复 ID 和模板缺失失败关闭。
- [ ] G1 change record 必须晚于外部 exact grant/approval，只做审计；其存在、缺失或篡改不能改变
  authority 或 readiness；只能记录 receipt digest/locator，不保存私钥、grant 或 receipt 正文。
- [ ] root v1/v2、R0、trust/runtime/rollout/history、产品代码、ADR 0028、CI 和现有 ext authority
  字节不变。
- [ ] 同一冻结 G1 候选完成专项、Harness、authority STOP、scope、安全负测和连续 10 轮完整验收。
- [ ] 独立规格/安全审查为 0 Critical / 0 Important；Minor 修复或显式保留。

## Delivery Constraints

- 当前允许路径：
  `docs/product/tasks/2026-08-15-ext-root-harness-bootstrap-g1.md`、
  `docs/superpowers/plans/2026-08-15-ext-root-harness-bootstrap-g1.md`、
  `docs/migrations/2026-08-15-workbuddy-chaotang-essence-gap.md`。
- 当前只允许任务就绪与精华盘点文档；不得实施下述 future pathspec。
- future G1 的 25 个路径必须由新的 immutable base 上的外部 grant 逐项列明，禁止 glob。
- 不读取、覆盖、暂存、stash、提交或清理任何其他 worktree 的未知改动。
- 不提交、不推送、不合并；这些 Git 外部动作需对冻结候选另行授权。
- 不访问真实 provider、生产数据、外部连接器或付费服务。
- 技能计划：`codex-pro-workflows`、`codex-mastery-coach`、`blueprint`、`expert-perspective`；未来
  实施另需 `test-driven-development`、`security-review`、`code-review`、`verification-loop`。
- Codex-only：是；不得启动 Claude CLI、Claude runner 或 gstack-claude。

## Affected Modules

- 模块：当前仅 Root Harness G1 任务就绪、冷启动蓝图和 WorkBuddy/朝堂精华差距清单。
- 允许路径：`docs/product/tasks/2026-08-15-ext-root-harness-bootstrap-g1.md`、
  `docs/superpowers/plans/2026-08-15-ext-root-harness-bootstrap-g1.md`、
  `docs/migrations/2026-08-15-workbuddy-chaotang-essence-gap.md`。
- 依赖模块：已验收的 root convergence 治理包、ADR 0028、现有 ext authority 与
  `scripts/check_harness.mjs`；全部只读。

## Future G1 Exact Pathspec

以下 25 个路径是下一实施任务的完整候选，不是当前允许路径。其中 accepted D base 已存在 5 个
路径：`AGENTS.md`、`CLAUDE.md`、`scripts/check_harness.mjs`、本 task 与本 plan；其余 20 个必须在
base Git tree 中不存在。

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.harness/agents/project-owner.md`
4. `.harness/rules/project-boundaries.md`
5. `.harness/rules/project-workflow.md`
6. `.harness/wiki/architecture.md`
7. `.harness/wiki/harness-inventory.md`
8. `.harness/wiki/verification-matrix.md`
9. `.harness/contracts/project-harness.schema.json`
10. `.harness/manifest/project-harness.json`
11. `.harness/templates/change-template/summary.md`
12. `.harness/templates/change-template/request_analysis/spec.md`
13. `.harness/templates/change-template/request_analysis/tasks.md`
14. `.harness/templates/change-template/ci_result/ci_summary.md`
15. `.harness/changes/chore-ext-root-harness-bootstrap-20260815/summary.md`
16. `.harness/changes/chore-ext-root-harness-bootstrap-20260815/request_analysis/spec.md`
17. `.harness/changes/chore-ext-root-harness-bootstrap-20260815/request_analysis/tasks.md`
18. `.harness/changes/chore-ext-root-harness-bootstrap-20260815/ci_result/ci_summary.md`
19. `scripts/new-change.mjs`
20. `scripts/new-change.test.mjs`
21. `scripts/harness-doctor.mjs`
22. `scripts/harness-doctor.test.mjs`
23. `scripts/check_harness.mjs`
24. `docs/product/tasks/2026-08-15-ext-root-harness-bootstrap-g1.md`
25. `docs/superpowers/plans/2026-08-15-ext-root-harness-bootstrap-g1.md`

若独立审查证明 `CLAUDE.md` 无需改动，应在 grant 形成前将其删除并把 pathspec 改为 24 项；不得
保留空改。任何新增路径都必须停止、更新任务并重新精确批准。

## Technical Plan

- 架构边界：建立仅观察的根协调层；frontend/backend 的缺失或部分状态是合法事实，不是 doctor
  失败，但会让 readiness 固定 NOT_READY。
- 接口与依赖：closed JSON Schema 是 manifest 事实源；doctor 读取 manifest 与磁盘，只调用 ext
  status；change record 不参与任何 authority 计算。
- 实施顺序：外部 authority → RED tests → schema/manifest → check_harness/AGENTS 同候选 →
  generator/doctor → change record → 审查 → 10 轮。
- 验证计划：详见配套施工蓝图；当前只验证三份文档和现有 STOP 基线。
- 技术风险：最大风险是自授权、把结构检查冒充 READY、从脏树复制、把旧 root authority 漂白、
  或为通过 Harness 放宽现有业务门禁。

## Implementation Report

- 改动摘要：仅编制本任务、施工蓝图和精华差距清单；冻结 `20 new + 5 existing` 的 future G1
  pathspec、D0→A0→G1 依赖、doctor 三命令、负测、回滚与遗漏精华路线；G1 实现未开始。
- 自审：当前权限不足以修改 Future G1 pathspec；共享脏树保持不动；所有事实来自 clean
  `origin/ext-dev@1b4f6efd` Git object 与隔离规划 worktree。
- 验证：`check_harness` 133、self-test 167、ext authority tests 11/11；ext status 为
  `STOP/canExecuteProductWork=false`；G1 Task ID authorize 为 `STOP/TASK_MISMATCH`、exit 2；三文件
  scope、whitespace 和冲突标记检查通过。
- 实际使用的 skill：`codex-pro-workflows`、`codex-mastery-coach`、`blueprint`、
  `expert-perspective`。
- 验证命令与结果：`node scripts/check_harness.mjs`、`node scripts/check_harness.mjs --self-test`、
  `node --test scripts/execution_authority_ext.test.mjs`、ext status/authorize 断言与 Git scope 检查均
  exit/result 符合上述预期。
- 未运行项与原因：G1 代码、平台 trust、required check、产品测试和浏览器均未运行；未获授权。
- 剩余风险：G1 authority 不存在，产品 authority 为 STOP，未知共享 worktree 改动归属未确认。

## Acceptance Review

- 验收结果：PASS / READINESS PACKET ONLY。
- 验收证据：独立对抗审查最终 Critical 0 / Important 0 / Minor 0；Harness/self-tests/authority tests、
  STOP/TASK_MISMATCH 与 scope 检查均为当前候选新鲜证据。
- 未通过项：G1 implementation authority、platform trust/required check 和产品 GO 全部 Blocked。
