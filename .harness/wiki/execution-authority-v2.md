# 执行权威 v2（R0-W01 范围授权）

`execution-authority.v2` 是 `R0-TRUSTED-KERNEL-AMENDMENT-01` 修正案批准 R0-W01 之后新建的
独立授权闸门。**它不修改、不重钉、不依赖 `execution-authority.v1` 的任何字节**——v1 的 schema、
manifest、resolver、CLI、wiki 全部保持原样，永远输出 `STOP`。v2 是另一套独立的
schema/manifest/resolver/CLI/tests，专门回答一个更窄的问题：

> 当前这个具体的 work package，是否已经拿到批准证据、且轮到它了？

## 命令语义

- `node scripts/execution-authority-v2.mjs --status`：只显示当前 `activeWorkPackage`，退出码 0，
  不构成授权。
- `node scripts/execution-authority-v2.mjs --check`：只证明 manifest/schema 结构合法，退出码 0，
  **不评估 `--work-package`**，不得当成"可以开工"。
- `node scripts/execution-authority-v2.mjs --authorize --work-package <R0-Wxx> [--real-customer-data]`：
  唯一真正的开工查询。批准返回 `decision:'GO'`，退出码 **0**；任何 STOP 情形退出码 **2**。

> 这与 v1 的退出码惯例相反：v1 因为永远没有 GO 路径，`--authorize` 永远退出 2。v2 需要一条真正
> 的成功路径供自动化 `&&` 串联，因此改为 0=GO / 2=STOP。PR 里已显式标注，不是笔误。

不识别的参数一律退出 64（`UNSUPPORTED_COMMAND`），与 v1 一致。

## reason code 枚举

| reason | 含义 |
| --- | --- |
| `INVALID_EXECUTION_AUTHORITY` | manifest/schema 结构或字段格式不合法 |
| `AMENDMENT_DIGEST_DRIFT` | manifest 的 `approvedSourceDigest` 与 `amendmentGovernance` 记录的不一致，或治理状态不是 `APPROVED_FOR_W01` |
| `EFFECTIVE_BASE_MISMATCH` | manifest 的 `effectiveBase.sha` 与治理记录的基线不一致 |
| `REVIEW_NOT_GO` | 批准证据里的三路 review verdict 不是 `GO` |
| `WORK_PACKAGE_ARGUMENT_REQUIRED` | `--authorize` 未传 `--work-package` |
| `UNKNOWN_WORK_PACKAGE_FORMAT` | 传入的包 ID 不匹配 `^R0-W0[0-9]$`（挡旧编号如 `P12`/`PKT-04`/`S3`） |
| `MULTIPLE_ACTIVE_WORK_PACKAGES` | ledger 里同时有两个以上 `ACTIVE` 条目（结构性拒绝，属于致命错误分支） |
| `BLOCKED_DEPENDENCY` | 请求的包，其前驱包在 ledger 里还没到 `MERGED_AND_VERIFIED` |
| `WORK_PACKAGE_MISMATCH` | 请求的包前驱已满足，但它不是当前 `activeWorkPackage` |
| `NO_ACTIVE_WORK_PACKAGE` | 回滚态或**静默收口态**：`activeWorkPackage` 为 null，ledger 无 `ACTIVE` 条目 |
| `PROFESSIONAL_REASSIGNMENT_REQUIRED` | 请求 W08/W09 或标记 `--real-customer-data`，但 security/legal/release 三角色仍是默认 owner |
| `APPROVED_WORK_PACKAGE` | 全部条件通过，`decision:'GO'` |

## ledger / 依赖链模型

`workPackageLedger` 只记录已经发生过的包，不预铺 W02-W09 的占位状态（YAGNI：那些包的真实前置
条件现在不存在，占位只会制造未来忘记同步的机会）。每个后续 packet 落地时，在**同一次变更**里把
自己的前驱条目改成 `MERGED_AND_VERIFIED`、追加自己的 `ACTIVE` 条目——这与
`amendmentGovernance` 状态跃迁必须原子发生的纪律完全一致。

依赖顺序是固定常量 `EXPECTED_R0_WORK_PACKAGE_SEQUENCE`（`R0-W00` 到 `R0-W09`），不在 manifest
里重复声明。

**"包完成"不自动推导"下一包获批"**：某个包合入并复验为 `MERGED_AND_VERIFIED` 后，`activeWorkPackage`
必须先落回 `null`（静默收口态），不能在同一次变更里顺带把下一个包标成 `ACTIVE`。收口和下一包
激活是两个独立的、各自需要具名批准证据的治理事件（amendment §10："任何笼统的'继续'不能替代对
未来 exact digest/base 的批准证据"这条纪律，同样适用于"包与包之间的推进"，不只是"进入修正案"
这一次）。静默收口态下，重新请求刚收口的包、或请求任何后续包，一律 `NO_ACTIVE_WORK_PACKAGE`。

## 专业负责人重新指定门（运行时强制）

`R0-TRUSTED-KERNEL-AMENDMENT-01` §4 曾把这条要求记成"声明式前置，尚未运行时强制"。v2 落地后，
这条门**已经是运行时强制**：请求 `R0-W08`/`R0-W09` 或显式传 `--real-customer-data` 时，只要
`security`/`legal`/`release` 三个角色的指派仍等于 `professionalReassignment.defaultOwner`
（当前是 `lyt`），一律 `STOP/PROFESSIONAL_REASSIGNMENT_REQUIRED`。这条分支目前无法构造出"通过"
的真实 fixture——这是设计使然，不是覆盖率缺口。

## v1 与 v2 共存说明

`AGENTS.md`、`.harness/agents/project-owner.md` 与 `.harness/rules/project-workflow.md` 是 v1
`governedDocuments`，并在独立受控摘要重钉中明确了两步程序：先用 v1 `--check` 验证最底层失效关闭
护栏完整性，再用 v2 `--authorize --work-package <R0-Wxx>` 作唯一的范围化产品施工决定。v1 永远 STOP，
v2 才回答“这个具体 work package 现在是否被授权”。

当前本地 EXT 已完成 W06 静默收口：`activeWorkPackage=null`，W06 ledger 为
`MERGED_AND_VERIFIED`。因此 W06 与 W07 都必须返回 `STOP / NO_ACTIVE_WORK_PACKAGE`；这不表示 W07
已批准或已激活。

## Active Packet 证据 profile

历史 W06 证据保持原路径、排除项和命令集合，不允许被 W07 复用。W07 使用独立 profile：

- `refs/heads/feature-chaotang-ext` 必须精确指向获批 candidate H，并在 exact packet Git
  验证前后两次解析为同一 commit；
- review package 必须以原始 `Buffer` 逐字节等于固定 EXT review base
  `55caf0d176cd6a1bbb833ffd1872ea3f1d8a46ca..candidateH` 的 hardened Git diff；
- owner approval、activation intent、review package 与 Codex final review 必须位于 W07 change root；
- W07 review 路径使用 `codex_review/exact-h-final.md`，历史 Claude 路径不冒充 Codex；
- candidate commit、tree、review base、分支 ref、changed paths、digest 和 W07 验证命令必须同时匹配。

任何未知 work package profile、W06 证据复用、伪造但内部自洽的 diff、ref 在验证期间移动或
candidate/tree
漂移都会使 loader 返回 `INVALID_EXECUTION_AUTHORITY`。

## 独立审查人范围化修订

根修正案中的 `independentReviewer` 是历史默认审查人，不允许直接改写。审查人不可用时，只能在
`amendmentGovernance.reviewerReassignment` 登记一个失效关闭的范围化 overlay。当前支持的 overlay
仅限 `R0-W07`，且必须同时绑定：

- exact candidate H 与 tree；
- review package 路径及 SHA-256；
- 两个 `FRESH_NO_FORK_CONTEXT`、`writeAccess=DENIED` 的 Codex Independent QA 审查；
- 两次审查均为 `GO`，且未解决 HIGH/MEDIUM 均为 0；
- Product Owner exact-H approval 路径及 SHA-256。

overlay 的证据文件会逐级拒绝符号链接，按原始字节校验 digest，并解析 machine-readable evidence。
所有 governed authority input 的读取和 SHA-256 校验全程保持 `Buffer`；review package 的 Git diff
相等性比较也使用原始 Buffer。只有解析 JSON/evidence 或提取 changed paths 时才将副本解码为文本，
文本解码结果不参与 digest 或字节相等性判定。
base H、candidate H、tree、exact Git diff、两份 review、owner approval 必须互相绑定；路径和 digest
不得复用。v2 loader 本身执行这些检查，不能依赖另行运行 doctor。writer session 不得充当 review
session。W07 激活必须是 overlay 静默注册之后的独立提交；注册父状态不得已经出现任何 W07 ledger
条目，因此 `MERGED_AND_VERIFIED` 或 `ROLLED_BACK` 的 W07 不能重新变回 ACTIVE。从该激活提交到
当前 `HEAD` 的第一父
历史必须连续保持同一 overlay 与 W07 ACTIVE；中途收口后恢复旧字节属于重放并会被拒绝。W07 ledger
进入 `MERGED_AND_VERIFIED` 后 overlay 失效并回落到历史 reviewer。任何字段、
文件、digest、Git identity 或审查结果不一致时，active W07 execution authority 必须 STOP。
缺失、无效或尚未生效的 W07 overlay 不改变 W06：W06 继续使用历史 reviewer 和原 evidence
contract。overlay 只替换 ACTIVE W07 的 evidence reviewer 身份，不激活 work package，也不修改 v1/v2 的
执行权限边界；W07 激活仍需独立的 atomic activation candidate。

工作树证据读取先以 `O_NOFOLLOW` 打开文件句柄，再通过 Linux `/proc/self/fd/<fd>` 验证已打开对象的
真实路径等于仓内预期路径，并从同一句柄读取。平台不支持该绑定、目标被替换或目标逃逸时一律
fail closed，不能退回到 `lstat` 后重新按路径读取。

激活历史验证要求完整的 non-shallow repository，并在开始时将 `HEAD^{commit}` 解析为单一对象；所有
activation discovery、first-parent traversal 和 HEAD blob comparison 都使用该对象，返回前再次解析
并拒绝 HEAD movement。reviewed candidate 必须是 registration parent 的第一父祖先。第一父链定义
activation event 的唯一集成顺序；历史审计本身不使用 `--first-parent` 或 manifest pathspec，而是枚举
reviewed base 到 registration parent、activation event 到 HEAD 之间所有可达 commit，包括 merge 的
第二父历史。每份 authority manifest 都必须通过完整 v2 manifest validator。曾出现 W07 ledger、
manifest 缺失、JSON 不可解析或结构无效都不能通过删除记录或 ours merge 来重置。
activation event 本身必须恰好一个父提交；merge commit 不能充当激活事件。

authority Git 子进程不通过继承的 `PATH` 选择可执行文件；Linux 权威运行环境固定使用
`/usr/bin/git`，该系统路径是仓库外信任根。缺少该可执行文件时必须 fail closed。所有 `GIT_*`
覆盖仍会从子进程环境移除，并禁用 system/global Git config 与 replacement objects。
当前 authority commit 契约只接受 40 位 SHA-1 object identity；Git 成功返回其他长度或格式的
object identity 时必须记录 `unsupported object identity` 并返回
`INVALID_EXECUTION_AUTHORITY`，不能退回读取 mutable working-tree authority facts。
无法取得受支持的 pinned commit 时，manifest、schema、amendment governance 与所有 evidence
reader 必须直接返回 `null`；记录错误但继续解析 working-tree 字节不算 fail closed。

ACTIVE W07 loader 在读取证据前采样 `HEAD` 与 `refs/heads/feature-chaotang-ext`，并在全部异步
evidence、activation intent 和 history 验证完成后再次解析二者。最终采样不一致时，authorization
输入携带错误并 fail closed。
受控 `HEAD` 与本地 `feature-chaotang-ext` ref 不回滚属于经 Product Owner 批准的
threat-model-B 仓外前提；恶意 ref 回退归类为宿主/仓库控制面失陷，不宣称由当前可达 Git 历史自行
发现。单次授权期间的 ref movement、从可信当前 ref 可达的历史不连续和 evidence drift 仍必须
fail closed。
同步 `executionAuthorityV2CommandResult` 不具备 W07 Git 重验能力，因此不能直接返回 W07 GO。
canonical CLI 从自身 module path 推导唯一 repository root，await 一次 fresh
`loadExecutionAuthorityV2`，然后立即调用同步 result mapper；两者之间没有其他 await 或
caller-supplied loaded object。library 的正向结果仅为 `ELIGIBLE`，只有该 executable CLI
可以把经过最终 HEAD/EXT ref 与 governed-file 检查的资格转换为 `GO`。

v2 loader 还会直接读取 `manifest.amendment.path` 的原始字节并校验
`approvedSourceDigest`，不能只比较 manifest 与 governance 中互相引用的 digest 字段。所有 governed
file 必须是单链接 regular file；`stat.nlink !== 1` 时拒绝，避免仓外 hardlink alias 改写同一 inode。
