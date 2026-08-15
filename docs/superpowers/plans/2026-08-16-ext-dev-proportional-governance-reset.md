# ext-dev Proportional Governance Reset Blueprint

> Task：`EXT-PROPORTIONAL-GOVERNANCE-RESET-S0-20260816`
>
> 本蓝图只规划当前阶段。它授权当前两份 S0 文档在连续 10 轮验证后提交并 fast-forward 推送到 Gitee `ext-dev`，
> 但不授权 G1、机器 authority、产品实现、merge 或 deploy。

## 1. Frozen Context

- Historical pre-D0：`1b4f6efd55315e41013563603c22ce9aefe95f43` / tree `36fc2fdfb92b9d674c77c80c26ec26c6cbd2327b`
- Remote product line / landed D0：`origin/ext-dev@a86e69dd41e7dcd476807d401c316a91483bffc8`
- Remote tree / D0 tree：`ae745b3b56486f2d0eef1be5489bb141b5a1d4a9`
- Current decision：`S0 OWNER ACCEPTED / EXACT DOCS-ONLY FAST-FORWARD AFTER 10 ROUNDS`
- ADR 0028：unchanged and binding
- Product authority：`STOP / canExecuteProductWork=false`

本任务在 D0 的隔离 successor worktree 编制两份 Markdown。共享脏工作区、本地 `ext-dev` ahead commits、旧 EXT、A0/E0 原始证据和用户 secret
都不是本任务输入。

## 2. Design Principles

当前方案代号：`3-10-1-1`（3 gates / 10-path G1 / 1 Owner / 1 vertical slice）。

1. 风险成比例：文档、治理核和产品不能使用同一成本的门禁。
2. 威胁模型诚实：承认 Gitee owner、OS owner 和私钥持有人是信任根；若不接受，必须换独立平台，而不是增加仓内角色名称。
3. 先修入口：错误的 root AGENTS 会持续污染所有 agent 决策，优先级高于补 Wiki 和模板。
4. 一次一纵切：先户部 RichMemorial，再电池/PACK，再 Outcome 和读模型。
5. 单一事实源：DecreeJob/RuntimeSkill/Evidence Spine/WorkProduct/Shiguan 是复用骨架；不得引入第二 Flow、第二 archive 或第二 Outcome ledger。
6. 低层 PASS 不外推：docs PASS ≠ governance READY ≠ product GO ≠ business value。

用户已精确接受本 successor 方案。旧 E0P-D/A0 保留为高对抗环境参考，不再作为当前小团队所有变更的统一前置；
该接受不解除产品 STOP，也不授权 G1/M0/H1，后续每一阶段仍须独立 exact task。

当前资源约束固定为 `SOLO_OWNER / NO EXTRA AGENT QUOTA`。只有用户是 authority；Codex 是实施者，脚本是机械验证器，二者都不能被计作第二或第三 authority。

## 3. Dependency Graph

```text
S0 proportional-governance design (current; two docs)
  ↓ self-adversarial review + 10-round freeze
S0L exact docs-only fast-forward (authorized)
  ↓ post-remote SHA/tree verification + new exact G1 task
G1 minimal root observation kernel (10 paths)
  ↓ governance tests + 10 rounds + Owner acceptance
M0 solo-owner product authority successor
  ↓ exact signed product grant becomes machine-verifiable
H1 Hubu RichMemorial vertical slice
  ↓ user confirmation + deterministic replay
B0 CellSpec / PriceObservation evidence registry
  ↓
B1 Battery P0/P1 safety gate
  ↓
B2 PACK deterministic sizing
  ↓
B3 BOM / cost gate
  ↓
B4 Stage Gate + FMEA/HOLD
  ↓
O1 authenticated append-only OutcomeEvent
  ↓
J1 jiqun read-only matching explanation
  ↓
Z1 Zhuangyuan AssetReadModel
  ↓
E1 Hanlin offline evaluation + PromotionProposal
  ↓
V1 full acceptance, value review and Gitee closure
```

写入步骤保持串行；只读来源考古可以并行，但不能并行修改同一任务、schema 或工作区。

## 4. Gate Matrix

| Gate | Inputs | Required proof | Exit | Rollback |
| --- | --- | --- | --- | --- |
| `D` | exact docs-only commit | base/tree/path、secret/scope、自审、当前规则要求的 10 轮、Owner exact Git approval | remote exact target SHA/tree | 停止；若未 landing 直接废弃，若已 landing 用新的受审 revert commit |
| `G` | Ready governance task | RED safety tests、closed schema、self-authorization negative tests、Harness、10 rounds、Owner acceptance | governance behavior exact；product false | revert exact governance commit；恢复 previous root entry |
| `P` | Ready product task + approved parent manifest | RED→GREEN、owner/digest/permission、full regression、integration/browser、10 rounds、Owner exact candidate acceptance | exact candidate eligible for one merge | no force/reset；new revert/fix task and immutable evidence |

旧 A0 的 12-role/HSM/dual-checkpoint 设计保留为未来高对抗环境参考，不作为当前 G1 或首个产品切片的前置。

## 5. Step S0：Freeze the Reset Design

### Context Brief

当前任务只解决设计失衡。用户已批准当前两文档在连续 10 轮后形成一个提交并 fast-forward 推送到 Gitee `ext-dev`；
没有批准任何 G1、M0、产品、merge 或 deploy 动作。

### Exact Paths

1. `docs/product/tasks/2026-08-16-ext-dev-proportional-governance-reset.md`
2. `docs/superpowers/plans/2026-08-16-ext-dev-proportional-governance-reset.md`

### Work

1. 写明事实、根因、硬约束、信任边界和非目标。
2. 冻结 D/G/P 三层门禁。
3. 把 G1 缩成十路径最小核。
4. 定义 M0 的单 Owner approval-manifest gate，而不实现协议。
5. 冻结 H1→B0–B4→O1→J1→Z1→E1 顺序。
6. 自审后执行现有 Harness、authority STOP、scope、whitespace 和 10 轮。
7. 当前没有额外模型/Agent 额度，主会话只做自对抗审查并明确 `NO INDEPENDENT REVIEW`；Owner 负责最终接受，不虚构独立 reviewer。

### Exit

两文档冻结、10 轮完整、无其他改动；结论只能是 `PASS / DESIGN PACKET ONLY`。

## 6. Step S0L：Proportional S0 Landing

### Context Brief

D0 已由 `1b4f6efd5` fast-forward 落地为 `origin/ext-dev@a86e69dd4`。当前步骤只落地以 D0 为父提交的两份 S0 文档。

### Required Inputs

- remote head/tree 新鲜且精确为 `a86e69dd4/ae745b3b`；
- S0 diff 精确为当前两份 Markdown，无第三路径；
- 当前 S0 在同一冻结 fingerprint 完成 Harness、authority STOP、scope 与连续 10 轮；
- 用户已对父提交 `a86e69dd4`、当前两路径、连续 10 轮条件和由该流程生成的单亲子候选给出 `FAST_FORWARD_ONLY` 批准；
- 执行前后各读取 remote head/tree；执行者不得推本地脏 `ext-dev`。

### Deliberate Trust Choice

当前模式把 Gitee owner/admin 作为显式信任根，不要求 Gitee 自己证明 owner 永远不能改规则。安全保证是“最终 remote SHA/tree 必须等于已验证 S0，
否则停止”，不是“平台管理员密码学上无能力绕过”。如果用户不接受该信任选择，则 S0L 保持 Blocked，并迁移到独立受管 merge gate。

### Stop/Recovery

remote 移动、出现第三路径、tree 不同或需要 merge/rebase/squash/force 时立即停止并重新冻结 successor task；不得复用当前验证。

## 7. Step G1：Minimal Root Observation Kernel

### Context Brief

G1 只修正根入口和提供只读观察核；不恢复旧 root control plane，不产生 product GO。

现有 `execution_authority_ext.v1` 对 G1 固定 `STOP/TASK_MISMATCH`。G1 只能在 future exact task 中，由用户依据根规则对治理修复逐项批准
base/tree、十个真实路径、non-goals 和验证矩阵后施工；这不是产品机器 GO，也不得把同一批准复用于 G2/M0/H1。

### Future Exact Pathspec

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

最终 path 必须在 future Ready task 中写成真实文件名并重算 digest，不能使用上面的 placeholder 直接施工。

### RED

- AGENTS 继续声称无业务代码时失败；
- schema unknown/duplicate/非法 path/state 失败；
- `--check` 被冒充 `--ready` 失败；
- frontend/backend 缺失或 PARTIAL 被伪装 READY 失败；
- doctor 调用 authorize、网络或写文件失败；
- 任意 product true、旧 root authority、trust/runtime/rollout/history 被登记失败。

### GREEN

- root AGENTS 准确描述真实产品与三层所有权；
- manifest closed 且只表示 `BOOTSTRAP_OBSERVE`；
- doctor `--check` 验结构、`--status` 报观察状态、`--ready` 固定 NOT_READY；
- current ext authority 仍 STOP/product false。

### Deferred G2

project-workflow、architecture/inventory/verification wiki、模板、`new-change`、change record 都不属于 G1 exit。只有使用需求和独立任务证明价值后才加入。

## 8. Step M0：Solo-owner Product Authority

### Threat Model

防止普通 agent/implementer 把聊天、任务文档、陈旧 base、扩大路径或未验证候选解释为 product GO。明确不防已经控制 Owner 会话、OS/Gitee owner
或整个 runner 的攻击者；更强威胁需独立人员、平台和签名方案。

### Minimum Contract

- fresh exact work request：repository、task、request base/tree、ordered paths、non-goals 和验证矩阵；
- Owner 对 closed approval manifest 的 exact digest 作第一次明确确认；
- manifest 在单独治理批准 commit 中先落地，记录 `APPROVED_FOR_ONE_CHILD`，不能与产品实现同提交；
- product candidate 只能是 approval commit 的单亲子，且不得修改 manifest、consumer、Harness 或 authority；
- consumer 机械验证 parent manifest、task、exact diff、candidate relationship 和验证证据后输出 closed GO/STOP；
- Owner 对冻结 candidate SHA/tree 作第二次明确接受，再单独批准一次 fast-forward；
- 合并后重新读取 remote SHA/tree。Codex 和 consumer 都不是 authority。

### Required Security Review

在 M0 exact task 中冻结 approval manifest schema、父子提交状态机、并发、撤销、logging 和 platform check integration。
当前设计不实现 manifest/consumer，也不能成为 product GO。未来若恢复额外额度或威胁升级，再以新版本加入外部签名和独立 reviewer。

## 9. Step H1：Hubu RichMemorial First

### User Slice

```text
登录 → 户部下旨 → 真实路由/证据 → 唯一 REPLY
→ deterministic metric/table/chart projection
→ owner-scoped XLSX/WorkProduct 下载
→ 人工确认 → 史馆按 digest 召回
```

### Invariants

- ADR 0028 一旨一 REPLY 不变；rich 失败降级 text-only `DEGRADED`，不阻断核心回奏；
- 模型不计算数字、不写 HTML/SVG、不产生外部副作用；
- PUBLISHED 仅表示本地 owner-scoped 下载可用，不等于确认或外部发布；
- synthetic fixture 只验证结构，不记真实业务成功。

### Proof

closed schema/digest cross-language vectors、backend pytest/ruff、frontend lint/typecheck/test/build、HTTP integration、受控真实浏览器、同候选 10 轮、独立验收。

## 10. Steps B0–B4：Battery/PACK

每个功能独立 Ready task、独立候选、独立 10 轮：

- B0：versioned `CellSpec` / `PriceObservation`，source/as-of/license/owner/hash；未知或过期不得引用。
- B1：P0/P1 热失控/火灾/爆炸 fail closed，强制人工签核，模型不能降级。
- B2：确定性串并联、电流、热和 assumptions；UNKNOWN 不装 PASS，领域参数需专家签名 fixture。
- B3：BOM/成本重算、伪型号/伪价格/agent 自填 target 拒绝；只形成待审报价。
- B4：FMEA/制造/测试证据缺失固定 HOLD；Stage Gate 不能由 LLM 单独 GO。

不恢复旧 16-agent Flow、LiteLLM/IMA、旧 jiqun service、静态价格真值或交易所。

## 11. Steps O1/J1/Z1/E1

- O1：在史馆域建立唯一 authenticated append-only OutcomeEvent；ReviewStatus、artifact publish、confirmation 不是 business outcome。
- J1：只读消费 RuntimeSkill/Evidence/Outcome 冻结快照，输出候选、score、evidence 和 reason；不授权执行。
- Z1：只读 AssetReadModel，所有资产有 owner/source/version/hash/as-of；无 seed、假总值或写回。
- E1：冻结 dataset 的离线 evaluator；缺链 `NO_DATA/UNUSABLE`，唯一输出 PromotionProposal，不能自动晋生产。

## 12. Verification Matrix

### S0 current packet

```bash
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
node --test scripts/execution_authority_ext.test.mjs
node scripts/execution_authority_ext.mjs --status
git status --short
git diff --check
git diff --name-only a86e69dd41e7dcd476807d401c316a91483bffc8 --
```

S0 每轮必须断言：Harness 计数稳定；authority STOP/product false；scope 恰为两文档；fingerprint 不变；无 conflict markers。任何正文修改后重新从 1/10 计数。

### Future product slices

每个切片冻结 base/task/path/fixture/lock/command matrix；RED 证明缺行为，GREEN 最小实现，专项+全量+集成+必要 browser，连续 10 轮后不再改 candidate。

## 13. Plan Mutation Protocol

- remote `ext-dev` 在 S0L 前移动：当前 fast-forward 授权失效，重新冻结 successor task；禁止 rebase/force。
- G1 需要第 11 路径：停止，更新 future task/path digest 并重新精确批准。
- M0 threat model 升级到恶意 Owner/OS/Gitee admin：停止单 Owner 方案，恢复独立人员/平台/签名路线；不能局部拼接旧 A0。
- 产品范围扩大：拆新 task，不把多个功能塞进同一候选。
- 10 轮中任一失败或候选变化：从 1/10 重算。
- 真实 provider、生产数据、外部写或付费服务：单独授权。

## 14. Current Verdict

```text
S0 design                    = PASS / OWNER ACCEPTED / 10 CLEAN ROUNDS
D0 landing                  = COMPLETE / origin/ext-dev@a86e69dd4
S0L landing                 = AUTHORIZED AFTER 10 CLEAN ROUNDS
G1 minimal kernel           = NOT AUTHORIZED
M0 solo-owner authority     = ABSENT / DESIGN ONLY
Product work                = BLOCKED / canExecuteProductWork=false
Overall                     = DESIGN ONLY
```
