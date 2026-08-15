# ext Root Harness G1 Bootstrap Construction Blueprint

> Task：`EXT-ROOT-HARNESS-BOOTSTRAP-G1-20260815`
>
> 当前交付是 cold-start 施工蓝图，不是施工授权。任何步骤的文档、测试或 change record 都不能
> 自行产生 GO。

## 1. Frozen Context

- Design base：`origin/ext-dev@1b4f6efd55315e41013563603c22ce9aefe95f43`
- Design tree：`36fc2fdfb92b9d674c77c80c26ec26c6cbd2327b`
- Reference only：`8bb68fb4c58b889551699a06e9468e87db66361d`
- Reference `.harness` tree：`db8541f13840ea4b397317f0f5982888bcb5e095`
- Current authority：`STOP / EXTERNAL_AUTHORITY_NOT_EVALUATED`
- G1 task check：`STOP / TASK_MISMATCH`，exit 2
- Root authority CLI：absent
- Current root/front/backend Harness：root absent、frontend absent、backend partial
- Product authority：false

本轮共享 worktree 出现未知 RuntimeSkill、锦衣卫、评测和 ADR 改动；它不是 G1 来源。未来实施只从
用户验收后的 remote immutable commit 建立新 worktree，任何磁盘 copy 均禁止。

## 2. Dependency Graph

```text
D0 Readiness packet（当前三文档）
  ↓ 用户精确验收并形成 immutable D commit
A0 Independent governance authority / external grant
  ↓ exact D commit/tree + task + 25 paths + non-goals
G1 Root BOOTSTRAP_OBSERVE candidate
  ├─ G2 Frontend Harness（独立任务）
  └─ G3 Backend Harness（独立任务）
       ↓
G4 Root delegation READY（独立任务）
  ↓
P1 Product successor authority（独立平台/产品任务）
  ↓
户部黄金纵切 → OutcomeEvent → Hanlin offline eval
```

D0、A0、G1 不能在同一提交中完成。A0 必须先于 G1 candidate 与 G1 change record，且不能由 G1
仓内文件生成或批准。

## 3. Step D0：Readiness Packet

### Context Brief

用户已批准按推荐优先级启动升级，但机器门仍 STOP。Codex 可完成任务就绪、来源调查和精华差距
盘点，不能开始 Root Harness 或产品实现。

### Allowed Paths

1. `docs/product/tasks/2026-08-15-ext-root-harness-bootstrap-g1.md`
2. `docs/superpowers/plans/2026-08-15-ext-root-harness-bootstrap-g1.md`
3. `docs/migrations/2026-08-15-workbuddy-chaotang-essence-gap.md`

### Work

1. 固定 base/tree、reference tuple、authority 和缺失状态。
2. 将 WorkBuddy 精华分类为 ADOPTED/PARTIAL/MISSING/REJECT。
3. 展开 G1 exact 25 paths，禁止 glob。
4. 固定 G1 doctor 三命令语义、负测、回滚与停止条件。
5. 独立对抗审查；修复所有 Critical/Important。
6. 冻结三文档候选并完成 scope、Harness、STOP 与 Git 检查。

### Exit

- 三文档以当前 Task ID 互相引用且无权限矛盾；
- 用户可一次看清 future G1 的目标、25 个路径、非目标和恢复条件；
- reviewer 为 0 Critical / 0 Important；
- G1 implementation 仍 Blocked。

## 4. Step A0：Independent Governance Authority

### Context Brief

`execution-authority.ext.v1` 只验证既有 `EXT-GOV-AUTH-V1-20260815` 候选，且固定不授权产品；以 G1
Task ID 调用会 `TASK_MISMATCH`。G1 不能修改该 consumer 来给自己授权，也不能迁入 root v1/v2。

### Required External Inputs

- 用户在 D immutable commit 形成后对 exact base/tree/task/pathspec/non-goals 的独立批准；
- 仓外受管 signer 与 root-owned public trust；
- single-use challenge/checkpoint、短时 receipt、candidate/grant digest binding；
- 平台管理员证明 repository、branch、candidate、check name/result、rule revision 与 enforcement；
- 独立安全审查和撤销/轮换协议。

### Non-goals

- 不允许 D 或 G1 candidate 自签；
- 不把 workflow、change record、测试全绿或聊天文本当 required check；
- 不修改 ext consumer、root v1/v2 或产品 authority；
- 不在本计划内创建 key、grant、receipt、socket 或平台规则。

### Exit

机器可对 frozen G1 request 返回“可接受治理候选”，同时产品权限明确为 false。缺任一外部条件均
STOP；本地模拟只能证明协议，不能算平台激活。

## 5. Step G1-A：RED Contract and Baseline

### Context Brief

在新的、干净、以 accepted D 为父的 worktree 中启动。任何共享脏树文件均不得复制。

### Work

1. 逐项用 `git cat-file -e <accepted-D>:<path>` 断言 20 个新增路径在 base 不存在；同时断言
   `AGENTS.md`、`CLAUDE.md`、`scripts/check_harness.mjs`、本 task 与本 plan 共 5 个既有路径存在。
   若在 grant 前删除 `CLAUDE.md`，pathspec 变为 24、既有路径变为 4，新增数仍为 20。
2. 冻结 `scripts/check_harness.mjs` 对 root AGENTS 的当前 REQUIRED_FILES、长度、固定文本、ADR 0028、
   adaptive routing 与内嵌 self-tests。
3. 写 failing tests：schema closure、manifest/disk mismatch、doctor 三命令、generator 路径安全。
4. 证明旧 source doctor 原样复制会依赖 40+ legacy 路径并失败。

### Exit

RED 只因 G1 能力缺失而失败；不是语法、fixture、环境或脏树导致。

## 6. Step G1-B：Closed Manifest

### Files

- `.harness/contracts/project-harness.schema.json`
- `.harness/manifest/project-harness.json`
- `scripts/harness-doctor.test.mjs`

### Contract

```text
schemaVersion = ext-project-harness.v1
status = BOOTSTRAP_OBSERVE
root.status = READY_FOR_OBSERVE
frontend.status = ABSENT
frontend.entrypoint = frontend/AGENTS.md
frontend.doctor = null
backend.status = PARTIAL
backend.entrypoint = backend/AGENTS.md
backend.harnessRoot = backend/harness
backend.manifest = null
backend.doctor = null
observedAuthority.namespace = execution-authority.ext.v1
observedAuthority.decision = STOP
observedAuthority.canExecuteProductWork = false
governanceGrantState = EXTERNAL_NOT_CONSUMED
```

unknown keys、重复/大小写漂移路径、未来 schema、READY 伪装和非空缺失 doctor 均拒绝。
`observedAuthority` 只是 ext STOP 状态的观察投影，不是 A0/G1 grant authority；
`governanceGrantState` 是固定输出而非本地输入，不能被仓内 grant 文件、环境变量或 change record 改写。

## 7. Step G1-C：Root Entry and Boundaries

### Files

- `AGENTS.md`
- `CLAUDE.md`（仅在审查证明必须时）
- `.harness/agents/project-owner.md`
- `.harness/rules/project-boundaries.md`
- `.harness/rules/project-workflow.md`
- `.harness/wiki/architecture.md`
- `.harness/wiki/harness-inventory.md`
- `.harness/wiki/verification-matrix.md`
- `scripts/check_harness.mjs`

### Work

1. 先更新 check_harness 合同和文件内 self-tests，再更新 AGENTS。
2. 以替换而非叠加方式删除“只有最小骨架/无正式业务代码”的过时事实；最终
   `wc -l AGENTS.md` 必须不超过 80，并保留 check_harness 的所有 REQUIRED literals、adaptive
   routing hash、ADR 0028、STOP 与 10 轮门禁。
3. 固定三层所有权：root 协调；frontend 体验；backend 运行/评测。
4. 明确 `.claude/` 只配置 agent 调用，不成为第四产品事实源。
5. 明确 Ask=只读调查、Plan=Draft/合同、Craft=Ready+machine GO；只作为工作语义映射，不新建模式
   状态机或产品 UI。
6. 保持 ADR 0028、Codex/Claude 单写者协议、自适应 skill 路由和 10 轮门禁。

### Stop Conditions

- 需要改 ADR 0028、frontend/backend 产品行为或 CI；
- 需要复制旧 R0/authority/change history；
- 为通过 Harness 删除安全文本或降低测试强度；
- CLAUDE 无实质变化却仍被纳入 diff。

## 8. Step G1-D：Generator, Doctor and Audit Record

### Files

- 四份 change templates
- 四份 G1 change record
- `scripts/new-change.mjs`
- `scripts/new-change.test.mjs`
- `scripts/harness-doctor.mjs`
- `scripts/harness-doctor.test.mjs`

### Generator Invariants

- 只接受 closed type/slug；
- 只写 `.harness/changes/<derived-id>/` 四文件；
- parent chain 每段拒绝 symlink；
- 重复目标、模板缺失、dot segment、绝对路径、大小写碰撞均 fail closed；
- 不调用 shell、网络、Git 写或外部程序。

### Doctor Interface

| 命令 | 成功语义 | G1 结果 |
| --- | --- | --- |
| `--check` | schema、路径、内容与磁盘一致 | exit 0 |
| `--status` | 当前治理状态，不代表 readiness | `BOOTSTRAP_OBSERVE`, exit 0 |
| `--ready` | 三层与平台是否可施工 | `NOT_READY`, exit 2 |

doctor 只能执行 ext `--status`，使用固定 Node 绝对路径或当前进程，不用 shell；清理环境并限制 timeout/
output。change record 在外部 grant 已存在后生成，只记录 source/base/pathspec/verification 与外部
receipt digest/locator，不保存私钥、grant 或 receipt 正文，也不进入 manifest readiness 或 authority 输入。
A0 receipt 只由仓外治理方验证和保存；root doctor 不读取本地 grant/receipt。

## 9. Step G1-E：Review, Verification and Rollback

### Focused Commands

```text
node --test scripts/new-change.test.mjs
node --test scripts/harness-doctor.test.mjs
node scripts/harness-doctor.mjs --check
node scripts/harness-doctor.mjs --status
node scripts/harness-doctor.mjs --ready
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
node --test scripts/execution_authority_ext.test.mjs
node scripts/execution_authority_ext.mjs --status
git diff --check
git status --porcelain=v1
```

`--ready` 的 expected exit 是 2；ext status 的 expected decision 是 STOP/product=false。验证 wrapper 必须
分别断言预期非零，不能吞掉意外 READY/GO。

### Adversarial Tests

- unknown schema/key、duplicate JSON key、path traversal/case drift/NUL；
- symlink parent 与检查后交换；
- PATH/NODE_OPTIONS/GIT_*/shell/env 污染；
- timeout、输出洪泛、子命令缺失；
- `--check` 成功被调用方误作 READY；
- frontend/backend 缺失被伪装为 READY；
- root v1/v2、R0、scoped authority、trust/runtime/rollout 被登记；
- change record 被当 grant，或删除 record 后 authority/readiness 改变；
- 伪造本地 grant/receipt、修改 receipt locator，或将 `governanceGrantState` 改成仓内可写输入；
- `--check=0` 或 `--status=BOOTSTRAP_OBSERVE` 被误当 A0 governance GO 或产品 GO；
- AGENTS 适配删除 ADR 0028、STOP、adaptive routing 或 10 轮门禁；
- `wc -l AGENTS.md` 超过 80，或 `check_harness --self-test` 未覆盖更新后的 root 入口；
- 任何产品路径、CI、ext authority 字节变化。

### Freeze

同一 commit/tree 连续执行 10 个完整轮次；任一失败或候选/命令矩阵变化均清零。独立 security/spec
review 必须 0 Critical / 0 Important。

### Rollback

G1 必须是单一可 revert 提交。revert 后回到 accepted D；没有数据库、runtime、trust、key 或外部状态
需要迁移。若平台 grant 已签发，先由外部治理方撤销/过期，不在仓库伪造撤销。

## 10. Unabsorbed Essence Roadmap

G1 只收敛 agent 操作系统，不吸收产品功能。后续独立任务顺序：

1. 工程语义：在既有工作流与 task template 中补事实基线、交付格式、外部副作用、停止条件；不新建
   配方 Skill/页面。
2. 户部配方：复用 Evidence Spine 和现有 `/study`，只做一个经营测算输入模板。
3. RichMemorial：确定性 `metric/table/chart`，同一 REPLY rich 失败 text-only 降级。
4. Confirmation 可见化：归档、可下载、人工确认、外部授权四轴分开。
5. OutcomeEvent：先 synthetic 证明 append-only，真实 outcome 另批。
6. Value review：只消费认证档案/确认/outcome，输出周报建议，不反向授权。
7. Hanlin：无 UI、只读冻结数据、只出 PromotionProposal。
8. Provider cost：真实 provider 获权后才在现有 budget/telemetry 增加 latency/cost/降级原因。

## 11. Plan Mutation Protocol

- 路径新增：停止，更新 task/grant，重新精确批准。
- base 变化：新建 D revision，不静默重钉。
- source ref 移动：保留 frozen SHA，只记 observation。
- CLAUDE 无需修改：在 grant 前缩小 pathspec 为 24 项（4 existing + 20 new）；grant 后不得以
  “无改动”替换已签范围。
- 外部 authority 不可用：保持 Blocked，只允许只读调查和获批文档。
- 共享工作区继续变化：不诊断、不合并、不清理；始终使用新隔离 worktree。
- 任一步要求产品代码、真实外部副作用或 authority 扩权：拆成独立任务。

## 12. Current Verdict

- D0 readiness：PASS / READINESS PACKET ONLY。
- A0 independent authority：ABSENT / BLOCKED_EXTERNAL。
- G1 implementation：BLOCKED / TASK_MISMATCH。
- G2–G4 三层收敛：NOT STARTED。
- Product implementation：FAIL / NOT AUTHORIZED。
