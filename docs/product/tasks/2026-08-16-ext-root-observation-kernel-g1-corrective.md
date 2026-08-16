# 任务：ext Root Observation Kernel G1 Corrective

> Task ID：`EXT-ROOT-OBSERVATION-KERNEL-G1-CORRECTIVE-20260816`
>
> 本任务是已落地 G1 `57c3906f` 的最小治理纠正，不产生 M0 或产品执行权。

## Status

Implemented

## Product Definition

- 问题一：`validateProjectHarnessSchema` 只检查部分叶子与 object closure，实测会接受顶层未知字段和
  `root.type="string"`，因此 schema 漂移可让 doctor false-green。
- 问题二：`readRepositoryFile` 只 `lstat` 最终路径，实测会跟随仓库内中间目录 symlink 读取仓外文件；
  `observeExtAuthority` 也没有在启动脚本前验证全部仓库相对路径段。
- 问题三：原 G1 文档保留“最终 10 轮待完成”的候选时态，而提交已经落地。该历史文件不在本次允许路径，
  本纠正任务只记录事实并明确最终轮次证据由 Owner 交付报告绑定，不回写冻结候选造成自引用。
- 目标：精确闭合 schema 对象身份，逐段拒绝 repository-relative symlink，并以回归测试永久覆盖两个缺陷。
- 用户价值：让根 doctor 的 `PASS` 真实表示受管 schema 未漂移、受管输入没有通过中间 symlink 逃出仓库。
- 非目标：不改 schema/manifest 内容、AGENTS、Harness 登记、ext authority、产品、M0、前后端、CI 或 ADR 0028。

## User Approval Boundary

2026-08-16，Owner 在看到以下 exact base/tree、Task ID、四路径摘要、十个 non-goal token/摘要、
唯一只读远端观察例外、RED→GREEN、10 轮与 Git 外部动作排除后回复“批准”。

该批准只允许本任务四路径治理纠正和一次固定只读远端 ref 核验；不授权 commit、push、merge、deploy，
不授权 M0 或产品工作。最终候选的 Git 动作必须另行精确请求。

## Frozen Identity and Allowed Paths

- Repository：`gitee.com/msxn/chaotang-os`
- Target branch：`ext-dev`
- Base：`57c3906f483129ba60ef073ca87a0a96ab59f87a`
- Base tree：`c4f3ec1b220832ae8fe319545512f9e64dff40db`
- Branch：`codex/ext-root-observation-kernel-g1-corrective-20260816`
- 允许路径：
  1. `scripts/harness-doctor.mjs`
  2. `scripts/harness-doctor.test.mjs`
  3. `docs/product/tasks/2026-08-16-ext-root-observation-kernel-g1-corrective.md`
  4. `docs/superpowers/plans/2026-08-16-ext-root-observation-kernel-g1-corrective.md`

Canonical path 输入是上述四路径 UTF-8 原文字节，按编号顺序每项后一个 `LF`，不含编号、围栏或空行。

- Algorithm：`SHA-256`
- Digest：`e3026f5ffabe3bde15d9aecc29dadf477e3de86c0d5ccaa80f91f9d27aa7bd5f`

## Canonical Non-goals

以下 token 按显示顺序使用相同 UTF-8/LF 规则摘要；解释文字不进入摘要：

1. `NO_PRODUCT_CODE_OR_BEHAVIOR`
2. `NO_SCHEMA_OR_MANIFEST_CONTENT_CHANGE`
3. `NO_AGENTS_OR_CHECK_HARNESS_CHANGE`
4. `NO_EXECUTION_AUTHORITY_EXT_CHANGE`
5. `NO_FRONTEND_BACKEND_CI_OR_ADR_CHANGE`
6. `NO_M0_OR_PRODUCT_AUTHORITY_IMPLEMENTATION`
7. `NO_PROVIDER_PRODUCTION_SECRET_MATERIAL_OR_UNSCOPED_NETWORK_ACCESS`
8. `NO_COMMIT_PUSH_MERGE_OR_DEPLOY`
9. `NO_STALE_V2_REUSE_OR_CROSS_WORKTREE_COPY`
10. `NO_PARALLEL_WRITER_OR_SHARED_WORKTREE_MUTATION`

- Algorithm：`SHA-256`
- Digest：`48424d7a0e39cffba47a4e51e1a0c2aca81e769d221ef42f50ef8730d96deb98`

唯一网络例外是实施前运行一次
`GIT_TERMINAL_PROMPT=0 git ls-remote --heads origin ext-dev`，且本地 `origin` 必须精确为
`git@gitee.com:msxn/chaotang-os.git`。该查询只观察 ref；不得 fetch/pull/push、调用 API/provider/生产，
不得读取、输出、复制或修改 credential/secret material。

## Acceptance Criteria

- [x] Owner 精确批准 base/tree、Task ID、四路径、path digest、十个 non-goals/digest 与只读网络例外。
- [x] 实施前远端 `ext-dev` 仍精确为 base，隔离 worktree HEAD/tree 干净且正确。
- [x] RED 证明顶层 schema 未知字段与 nested object type 漂移当前会被接受。
- [x] RED 证明中间目录 symlink 可让 file read 和 authority script observation 逃出 repository root。
- [x] GREEN 以 exact canonical schema digest 拒绝任意 schema 对象漂移，同时保留 checked-in schema 通过。
- [x] GREEN 对每个 repository-relative path segment 使用 `lstat`，中间项必须为真实目录、最终项必须匹配预期
  file/directory kind；任一 symlink 均失败关闭，authority 启动前复用同一检查。
- [x] 原有 doctor 8 项扩展为 9 项全绿；Harness 141/170、hook 3、product-flow 25、authority 11/11
  和 STOP/false 语义不回归。
- [x] 最终 scope 精确四路径，schema/manifest、AGENTS/check_harness、ext authority、ADR、frontend/backend/CI 字节不变。
- [x] 最终验收协议要求同一冻结 fingerprint 连续 10 轮；正文冻结后不回写轮次结果，Owner 交付报告必须绑定
  exact fingerprint、逐轮结果和候选身份，避免候选自引用失效。
- [x] 同代理 code/security review 无未关闭 Critical/Important，并明确 `NO INDEPENDENT REVIEW`。
- [ ] commit/push/fast-forward 只在 Owner 查看最终 fingerprint/diff/证据并另行批准后进行。

## Delivery Constraints

- 当前 scope 仅四个 exact paths；出现第五路径、rename、symlink、submodule 或 executable mode 立即停止。
- 只允许本地测试临时目录写入；不得触碰共享脏 worktree、旧 V2 或已有 M0 worktree。
- 除已完成的固定 `ls-remote` 外，禁止网络、provider、生产、secret、Git 外部动作和平台配置变更。
- 产品 authority 必须保持 `STOP / canExecuteProductWork=false`；doctor `--ready` 必须继续 exit 2。
- base/remote 漂移、RED 原因错误、范围扩大、测试失败或候选变化都会使已有最终轮次失效。

## Affected Modules

- 模块：Root observation schema identity validation 与 repository-relative safe reads。
- 允许路径：`scripts/harness-doctor.mjs`、`scripts/harness-doctor.test.mjs`、
  `docs/product/tasks/2026-08-16-ext-root-observation-kernel-g1-corrective.md`、
  `docs/superpowers/plans/2026-08-16-ext-root-observation-kernel-g1-corrective.md`。
- 只读依赖：原 G1 task/plan、schema/manifest、ADR 0028、ext authority 与现有 Harness。

## Technical Plan

- 先在现有专项测试加入 schema 漂移与中间 symlink 负例，确认失败原因精确命中两个已复现缺陷。
- GREEN 只增加 schema canonical digest identity 与 repository-relative segment walk；不重构 CLI 或 authority。
- 专项 GREEN 后运行 Harness/authority/STOP/scope 回归；冻结文档和代码后计算 candidate fingerprint 并执行 10 轮。
- 回滚：landing 前废弃此隔离候选；landing 后只能另立受审 revert，禁止 reset/force。

## Implementation Report

- 改动：schema 校验增加 checked-in schema 的 RFC 8785 canonical SHA-256 identity；路径检查从只看最终节点改为
  repository-relative 逐段 `lstat`，并在启动 ext authority 前复用相同检查。schema/manifest 与 authority 字节未改。
- RED：新增专项后为 `6 pass / 3 fail`。失败精确为中间 symlink 仓外读取、伪 authority 脚本被执行、schema
  顶层未知字段被接受；同一 schema test 内的 nested `root.type="string"` 也处于未拒绝状态。
- GREEN：最小实现后专项 `9/9`；doctor `--check=PASS`、`--status=OBSERVE`、`--ready=NOT_READY/exit 2`。
- 首轮回归：Harness `141`、self-test `170`、hook `3`、product-flow `25`、ext authority `11/11`；
  authority status 仍为 `STOP/EXTERNAL_AUTHORITY_NOT_EVALUATED`、product false。
- 安全定向：`__proto__` 保持 own property、未污染 prototype 且被 closed manifest 拒绝；schema extra/type drift
  均返回 `SCHEMA_CONTRACT_INVALID`；final/intermediate symlink 负例均通过。
- 自审：按 Standards/Spec/Security 三轴检查 exact diff；未发现未关闭 Critical/Important。由于无额外 reviewer
  额度，该结论是同代理自审，不是 independent review。
- 残余风险：逐段 `lstat` 与随后的 read/spawn 之间仍存在同 UID/OS 对手可利用的 TOCTOU 窗口；本 G1
  非授权观察核只防仓库路径误配与静态 symlink，不宣称提供 `openat`/宿主 daemon 级对抗保证。
- 历史说明：旧 V2 候选绑定旧 base 且与已落地 G1 重叠，已作废，不复制或合并其实现。
- 审查模式：`SOLO_OWNER / NO INDEPENDENT REVIEW`。

## Acceptance Review

- 当前结论：`IMPLEMENTED / FINAL ACCEPTANCE EXTERNAL / GOVERNANCE CORRECTIVE ONLY / NO INDEPENDENT REVIEW`。
- 最终接受协议：对本文件不再变更后的 exact fingerprint 连续执行 10 轮完整矩阵；结果只进入 Owner
  交付报告，不回写候选。任何失败或文件变化都会使轮次归零。
- 产品 authority：`STOP / canExecuteProductWork=false`。
- Git 外部动作：`NOT AUTHORIZED`。
