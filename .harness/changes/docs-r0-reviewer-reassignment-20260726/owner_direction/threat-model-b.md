# Product Owner Direction: Reviewer Reassignment Threat Model B

| Field | Value |
| --- | --- |
| Direction | `APPROVED` |
| Approver | `lyt` |
| Date | `2026-07-26` |
| Scope | `R0-W07 reviewer reassignment governance only` |
| Authority effect | `NONE` |

## Approved Boundary

The Product Owner approved threat-model option B in the coordinating session:

> 批准

This approval responds to the immediately preceding option B request. For this
narrow amendment:

- Codex platform-generated session notifications are the trust root for review
  session identity and isolation.
- Product Owner approval in the coordinating session is the trust root for
  owner identity and intent.
- Repository validation protects against accidental substitution, stale or
  duplicated evidence, scope expansion, digest drift, and unauthorized W07
  activation.
- The contract does not claim resistance to a malicious maintainer with full
  repository write access who can replace code and every evidence artifact.

## Not Approved

This direction is not exact-H candidate approval, does not register a reviewer
overlay, and does not activate R0-W07.

## Startup Trust Root Extension

The Product Owner subsequently approved the clean process-launch boundary:

> 批准方案 A：将干净的 Codex/终端 Node 启动环境及 OS loader 环境定义为 R0-W07 threat-model-B 外部信任根；宿主启动环境被恶意控制不属于仓内 authority 保证范围。批准据此生成第 20 候选并进行两轮 Codex 独立只读审查；不 push、不部署、不迁移数据库、不操作 3050。

For R0-W07 reviewer-reassignment governance:

- a clean Codex/terminal Node startup environment and the host OS loader
  environment are external prerequisites;
- repository checks begin after that trusted process startup;
- malicious control of the host, loader, or pre-start environment is outside
  the repository authority guarantee;
- the authority implementation must still fail closed for repository, Git,
  governed-byte, evidence, and identity drift inside its declared boundary.

This extension authorizes preparation and two fresh read-only reviews of a
twentieth candidate only. It is not exact-H approval and has no activation
effect.

## Git Ref Non-Rollback Extension

The Product Owner subsequently approved the controlled-ref boundary:

> 批准方案 A2：将受控 Git HEAD 与 feature-chaotang-ext ref 不回滚定义为 R0-W07 threat-model-B 外部前提；恶意 ref 回退属于宿主/仓库控制面失陷，不属于仓内 authority 保证范围。批准显式拒绝四个 legacy noncanonical review identity，并生成下一候选；不 push、不部署、不迁移数据库、不操作 3050。

For R0-W07 reviewer-reassignment governance:

- controlled `HEAD` and `refs/heads/feature-chaotang-ext` non-rollback are
  external host/repository-control-plane prerequisites;
- malicious ref rollback is outside the repository authority guarantee;
- ordinary ref movement during one authorization attempt, history
  discontinuity reachable from the trusted current ref, governed-byte drift,
  and evidence drift must still fail closed;
- the four recorded `/root/...` legacy review aliases are explicitly denied
  and cannot be used as current canonical review identities.

This extension authorizes a successor candidate and two fresh read-only
reviews only. It is not exact-H approval and has no activation effect.

## Isolated Authorization Extension

The Product Owner subsequently approved the isolated-worktree boundary:

> 批准方案 A3：R0-W07 authority 必须在受控 isolated worktree 中执行，授权开始至结果返回期间不存在并发外部 writer；恶意或不合作进程并发修改 governed files、HEAD 或 feature-chaotang-ext ref 属于宿主/工作区隔离失陷，不属于仓内 authority 保证范围。批准据此更新 threat-model-B、生成下一非授权候选并进行两轮 Codex 独立只读审查；不构成 exact-H 批准，不注册 overlay，不激活 W07，不 push、不部署、不迁移数据库、不操作 3050。

For R0-W07 reviewer-reassignment governance:

- authorization must run in a controlled isolated worktree;
- from authorization start until result return, no concurrent external writer
  may mutate governed files, `HEAD`, or the local EXT ref;
- a malicious or uncooperative process violating that isolation is a
  host/workspace-control failure outside the repository authority guarantee;
- repository checks still validate the pinned commit, governed bytes, evidence,
  identities, history, and observed drift within the isolated attempt.

This extension authorizes one successor non-authorizing candidate and two fresh
read-only reviews only. It is not exact-H approval and has no activation
effect.

`NO_PUSH / NOT_DEPLOYED / NO_DB_MIGRATION / NO_LISTENER_3050_TAKEOVER`
