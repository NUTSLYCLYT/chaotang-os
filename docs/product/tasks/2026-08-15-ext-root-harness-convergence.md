# 任务：ext 根 Harness 收敛治理包

> Task ID：EXT-ROOT-HARNESS-CONVERGENCE-20260815
>
> 本任务是治理调查、任务合同与施工蓝图，不是根 Harness 迁移本身，不授予产品代码、生产配置、
> Gitee 分支保护或任何 execution authority 的 GO。

## Status

Implemented

- 任务类型：GOVERNANCE DESIGN ONLY。
- 本轮文档编制：已由用户批准。
- 根 Harness 实施：Blocked，等待独立 exact task/base/tree/pathspec 与机器/治理权限。
- 平台激活：Blocked，外部 signer、checkpoint、PLATFORM proof、required check 均未验证。
- 产品实施：Blocked；现有 ext consumer 固定 canExecuteProductWork=false。

## Product Definition

### 用户批准

用户于 2026-08-15 在看到以下完整边界后回复“批准”：

> 批准以 2ef0bb4689517b7a05578f18091e841ec37eca2a 为只读基线，先编制 ext 根 Harness
> 收敛治理任务；不得复制主工作区脏改，不修改产品代码，不授予产品 GO。

该批准只覆盖本任务登记的三份治理文档。它不批准后续 Harness 文件写入、旧树 cherry-pick、
前后端 Harness 新建、authority 变更、提交合并或平台配置。

### 问题

当前 ext 候选没有根 .harness、scripts/new-change.mjs 或 scripts/harness-doctor.mjs；也没有
frontend/.harness、backend/harness/manifest.json 或 backend/scripts/harness_doctor.py。
但项目级入口协议要求三层 Harness、跨线 change record 和根级 doctor。

另一个本地工作区虽然包含根 Harness，却位于不同分支且有大量用户改动，不能作为复制来源。
远端 clean Git object 8bb68fb4c58b889551699a06e9468e87db66361d 与用户给出的三层入口文本一致，
但它的 .harness 有 789 个路径，其中 749 个是旧 change 历史，并绑定旧 R0、旧执行权威、
旧运行主线、trust、rollout 和 control-plane 状态。整体迁入会制造伪事实和第二执行权威。

### 目标

在不修改产品和 authority 的前提下，冻结：

1. ext 基线与只读参考来源的不可变身份；
2. 可吸收的治理方法与必须排除的历史/运行态/信任材料；
3. ext-native 最小根协调层的分阶段施工顺序；
4. 每阶段独立 task/base/pathspec、验证、回滚和停止条件；
5. 根 Harness 完成后，户部产品任务仍必须另建 product authority 的边界。

### 非目标

- 不创建或修改 .harness、frontend/.harness 或 backend/harness 中的任何文件。
- 不修改 AGENTS.md、CLAUDE.md、ADR 0028、ARCHITECTURE.md 或产品代码。
- 不修改 scripts/check_harness.mjs、任何 hook、CI workflow 或现有测试基线。
- 不修改 scripts/execution_authority_ext.mjs、其 schema、fixture、test、task 或 plan。
- 不复制 root v1/v2、R0 ledger、amendment、approval/review evidence 或历史 changes。
- 不复制 trust、runtime、policy、rollout、release、lease、worktree registry 或私钥/公钥状态。
- 不读取或复制主工作区未提交内容。
- 不创建外部 signer/checkpoint、Gitee required check、分支保护、产品 GO 或生产状态。
- 不迁移军机处、史馆、锦衣卫、翰林、RuntimeSkill、Prompt、页面或数据库。

## Frozen Identity

### 编制基线

- repository：gitee.com/msxn/chaotang-os
- branch：codex/ext-root-harness-convergence-20260815
- base commit：2ef0bb4689517b7a05578f18091e841ec37eca2a
- base tree：6b1f5335382721d85093095fc1834fef7b000ed0
- base parent：017d3d34d0a56257fbbcdbd86cd6f1f6d9d0bcdd
- base remote evidence：origin/codex/ext-successor-authority-v1-20260815 指向同一 SHA

### 唯一冻结的只读参考来源

- ref：origin/docs/r0-trusted-kernel-amendment-20260720
- commit：8bb68fb4c58b889551699a06e9468e87db66361d
- commit tree：d71b15e402abdf347f48e006fb8257d5738e7b34
- .harness tree：db8541f13840ea4b397317f0f5982888bcb5e095
- remote evidence：Gitee ls-remote 与本地 remote ref 同 SHA
- trust level：REFERENCE_ONLY

REFERENCE_ONLY 只证明对象远端可达、不可变且可审计；没有签名、保护分支或 required-check 证据，
不能把该提交的批准、状态、运行证据或 authority 带入 ext。

### 明确不采信的来源

- 本地 docs/r0-trusted-kernel-amendment-20260720@b20e2c78...：比远端 ahead 7，未推送，
  且后续提交混入 backend、安全和 CLAUDE 变更。
- 当前主工作区磁盘内容：大量 tracked/untracked 用户改动，只能保留，不能读取后复制。
- origin/dev、origin/ext-dev：均没有根 .harness。
- origin/master：仅旧 15-path 骨架且没有当前 authority。
- origin/harness-dev 与各 scoped authority 分支：含未被本任务批准的专用 authority、旧实现和状态。

## Confirmed Facts

| 事实 | 新鲜证据 |
| --- | --- |
| ext base 无根 .harness | test -d .harness → exit 1 |
| ext base 无 new-change/root doctor | 两个 test -f 均 exit 1 |
| ext base 无 frontend/.harness | test -d frontend/.harness → exit 1 |
| ext base 的 backend/harness 只有 capability candidate 资产 | git ls-tree；62 个 tracked paths |
| ext base 无 backend manifest/doctor | 两个 test -f 均 exit 1 |
| 当前 check_harness 有效 | node scripts/check_harness.mjs → 133 基线文件，exit 0 |
| ext status 仍 STOP | EXTERNAL_AUTHORITY_NOT_EVALUATED，exit 0 |
| ext authorize 仍 STOP | TRUST_ROOT_UNAVAILABLE，exit 2 |
| ext consumer 永不授予产品施工 | canExecuteProductWork=false |
| 参考来源有 789 个 .harness 路径 | git ls-tree -r ... .harness；其中 changes 749 |
| base 与参考来源均不是对方祖先 | 两个 merge-base --is-ancestor 均 exit 1 |
| 共同祖先存在但不能推导批准 | merge base 7d46de3107e8b055ad77af1389461aba3b172745 |

## Acceptance Criteria

- [x] 基线 commit/tree/parent 与远端身份已冻结。
- [x] 只读参考 ref/commit/tree/.harness tree 已冻结，并标记 REFERENCE_ONLY。
- [x] 主工作区脏改、本地 ahead 7、旧分支和旧 authority 均明确排除。
- [x] 差异清单完整列出 adopt/rewrite/exclude/defer 四类，并给 exact path 或 path family。
- [x] 施工蓝图把根 bootstrap、前端 Harness、后端 Harness、根委托收口拆成独立任务。
- [x] 每一步有 cold-start context、依赖、exact provisional paths、验证、回滚和停止条件。
- [x] 计划明确 root v1/v2、R0、trust/runtime/rollout/history 永不由本计划迁入。
- [x] 计划明确首个 root manifest 必须诚实标注缺失层为 ABSENT/PARTIAL，不伪造三层完成。
- [x] 计划明确所有未来实施均需新 exact approval，不复用本次“编制”批准。
- [x] 同一冻结文档候选连续 10 轮通过文档、scope、authority STOP、Harness 与 Git 检查。
- [x] 独立对抗审查为 0 Critical / 0 Important；Minor 修复或显式保留。
- [ ] 如用户随后明确授权提交/推送：提交只包含本任务允许的三份文档，且远端 SHA 与本地 SHA
  一致；未授权时本项记为 NOT AUTHORIZED，不影响本地治理文档验收。

## Delivery Constraints

### 本轮唯一允许路径

1. docs/product/tasks/2026-08-15-ext-root-harness-convergence.md
2. docs/superpowers/plans/2026-08-15-ext-root-harness-convergence.md
3. docs/migrations/2026-08-15-ext-root-harness-convergence-inventory.md

任何新增路径都必须停止、更新合同并重新获得精确批准。文档中出现的未来路径只是 proposed scope，
不是本轮允许路径。

### 写入边界

- 只能从 clean Git object 读取来源；禁止从其他 working tree 复制。
- 禁止 git checkout/cherry-pick/merge 参考来源。
- 禁止生成或提交真实 runtime、trust、key、grant、attestation、checkpoint 或平台 proof。
- 禁止调用 provider、生产服务、浏览器业务流或真实数据。
- 本轮只允许工作树中的三份治理文档写入。提交、推送、远端分支创建和远端 SHA 核验均需用户对
  本轮冻结候选另行明确授权；此前其他任务的上传请求不得自动继承。

## Affected Modules

- 模块：ext 根 Harness 收敛的产品治理任务、施工蓝图、迁移来源/差异清单。
- 允许路径：`docs/product/tasks/2026-08-15-ext-root-harness-convergence.md`、
  `docs/superpowers/plans/2026-08-15-ext-root-harness-convergence.md`、
  `docs/migrations/2026-08-15-ext-root-harness-convergence-inventory.md`。
- 未来但未获授权：根协调 Harness、frontend 工程 Harness、backend Harness manifest/doctor。
- 不受影响：所有产品运行模块、数据库、页面、API、RuntimeSkill、ADR 0028 与现有 authority。

## Technical Plan

1. 用 Git objects 固定 base/source 身份和缺失基线。
2. 将参考来源逐类标为 REWRITE、EXCLUDE、DEFER；默认 EXCLUDE。
3. 设计 ext-native BOOTSTRAP_OBSERVE 根 manifest，不把不存在的 frontend/backend doctor 写成 READY。
4. 把未来施工拆成串行 Root Bootstrap，之后可并行 Frontend/Backend Harness，最后 Root Delegation。
5. 每个步骤使用独立 task/base/pathspec/approval；任一步变化不自动激活下一步。
6. 独立审查后冻结本轮三文档并执行 10 轮验收；只有获得新的明确授权后才可提交或推送三路径。

## Skill Plan

- codex-pro-workflows：准入、authority、证据闭环。
- blueprint：多阶段 cold-start 施工蓝图与对抗审查。
- git-github-core-workflow：隔离 worktree、精确提交与 Gitee 分支推送。
- codex-engineering-workflow：仓库级风险路由与 10 轮门禁。
- verification-loop：最终冻结候选的新鲜验证。

缺失降级：

- using-superpowers：仓库要求但当前目录与已安装目录均缺失；使用现有 Codex 工作流等价执行。
- using-git-worktrees：当前 skill catalog 缺失；使用已审查的安全 Git 工作流，不修改既有 worktree。

## Implementation Report

本轮只在隔离 worktree 编制了三份获批治理文档：任务合同、分阶段施工蓝图、来源与差异清单。
所有来源材料均通过冻结 Git object 读取；没有读取或复制主工作区未提交内容，也没有创建根、前端或
后端 Harness 文件。蓝图将后续工作拆成 G1 Root Bootstrap、G2 Frontend Harness、G3 Backend
Harness、G4 Root Delegation、G5 Platform Gate，且每步都要求新的 exact approval。

独立对抗审查最终结果为 Critical 0 / Important 0 / Minor 0。冻结候选连续 10 轮通过 133-file
Harness、Harness self-tests、stop hook、product-flow runner、11 项 ext authority tests、source/tree/
scope/whitespace 检查，并在每轮确认 `--status` 和 `--authorize` 都是 STOP、
`canExecuteProductWork=false`。任务文档验收记录写回后，完整 10 轮必须从第 1 轮重新执行。

本轮未提交、未推送、未创建远端分支；这些动作仍为 NOT AUTHORIZED。

## Acceptance Review

当前结论：PASS / GOVERNANCE DESIGN ONLY。

- 本轮治理包：PASS；三份文档的范围、来源、分期、停止条件和防自授权边界已验收。
- 根 Harness 实施：BLOCKED / NOT STARTED。
- 产品施工与真实业务价值：FAIL / NOT AUTHORIZED / NOT PROVEN。
- 提交、推送与远端 SHA：NOT AUTHORIZED / NOT VERIFIED。
