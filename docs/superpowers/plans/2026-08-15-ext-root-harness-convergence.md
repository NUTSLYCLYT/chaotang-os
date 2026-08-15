# ext 根 Harness 收敛施工蓝图

> Blueprint ID：EXT-ROOT-HARNESS-CONVERGENCE-20260815
>
> 状态：GOVERNANCE BLUEPRINT ONLY / PRODUCT EXECUTION STOP
>
> 本文把未来收敛拆成可独立批准、执行、回滚和验收的治理任务。它不授权任何步骤施工。

## 0. 冻结身份与总裁决

### 编制基线

- base commit：2ef0bb4689517b7a05578f18091e841ec37eca2a
- base tree：6b1f5335382721d85093095fc1834fef7b000ed0
- current ext authority：execution-authority.ext.v1
- authority status：STOP
- product permission：canExecuteProductWork=false

### 只读参考来源

- remote ref：origin/docs/r0-trusted-kernel-amendment-20260720
- source commit：8bb68fb4c58b889551699a06e9468e87db66361d
- source tree：d71b15e402abdf347f48e006fb8257d5738e7b34
- source .harness tree：db8541f13840ea4b397317f0f5982888bcb5e095
- classification：REFERENCE_ONLY

禁止对 source 执行 merge、cherry-pick、checkout-path 或目录复制。每个未来文件只能：

1. 由 ext 当前事实重新编写；或
2. 在任务中列出 source blob、目标 path、逐字兼容理由和 hash，获得精确批准后单文件采用。

默认处理是 EXCLUDE，不是 ADOPT。

### 最终架构目标

~~~
ext-native root .harness
  ├─ 只登记项目所有权、当前能力与跨线 change
  ├─ 只读调用 ext 自己的 authority 状态
  ├─ 委托 frontend 工程 Harness（建成后）
  └─ 委托 backend Harness manifest/doctor（建成后）

frontend/.harness
  └─ 只拥有 Next.js/BFF/UI 工程护栏

backend/harness
  └─ 只拥有 FastAPI/agent/evaluation 运行与评测护栏
~~~

根层永不承载产品业务逻辑、数据库运行态、Prompt、provider、史馆、翰林或 release trust。

## 1. 不变量

所有后续任务都必须保持：

1. ADR 0028 字节和语义不变：下旨唯一入口、单部/多部路由、受控锦衣卫、成功旨意恰好一条 REPLY。
2. scripts/execution_authority_ext.mjs 及其现有 schema/test/fixture/task/plan 不被重命名、重钉或映射。
3. ext consumer 即使未来能接受治理候选，也保持 canExecuteProductWork=false。
4. root v1/v2、R0 ledger、旧 amendment、旧 owner/review evidence 全部不迁。
5. .harness/changes 旧 749 个路径、trust、runtime、policy、rollout、baseline 全部不迁。
6. 主工作区磁盘内容不是来源；只允许读取 exact Git object。
7. 第一版 root manifest 必须诚实表达 frontend Harness 与 backend doctor 的缺失，不能把 PARTIAL 写成 READY。
8. change record、计划、测试全绿或聊天批准都不能产生产品 GO。
9. Gitee workflow 文件不能证明 required check 已被平台强制。
10. 不创建第四内容主线，不把根 .claude、个人 skill 或旧 vault 当业务事实源。

## 2. 依赖图

~~~
G0 当前治理包（本任务，仅文档）
  ↓
G1 Root Bootstrap / BOOTSTRAP_OBSERVE
  ├───────────────┐
  ↓               ↓
G2 Frontend       G3 Backend
Engineering       Harness Manifest + Doctor
Harness
  └───────┬───────┘
          ↓
G4 Root Delegation + Change Record Enforcement
          ↓
G5 Platform Required Check / External Attestation
          ↓
独立 Product Authority 设计
          ↓
户部 Phase A 产品任务
~~~

G2 与 G3 可在 G1 冻结后并行调查，但写入必须使用不同 worktree、互斥路径和独立任务；G4 必须等待
两者都形成已验收的 immutable commit。G5 是平台任务，不由仓库文件自证。

## 3. Step G0：冻结事实、来源和排除清单

### Context Brief

ext 候选已经包含较成熟的产品主链、133-file Harness 检查和独立治理 consumer，但没有统一根 Harness。
参考来源包含三层架构方法，也包含大量旧状态。此步骤的价值是防止未来实现者把“有文件”误当“适合迁入”。

### 本步任务

1. 冻结 base/source commit、tree、.harness tree、远端可达性和 ancestry。
2. 冻结 source core blob IDs。
3. 对所有 source path family 分类：REWRITE、COPY_CANDIDATE、EXCLUDE、DEFER。
4. 记录当前 ext 缺失与已有事实。
5. 输出 G1–G5 蓝图与每步停止条件。

### 本步允许路径

仅当前任务合同登记的三份 docs 文件。

### 验证

~~~
node scripts/check_harness.mjs
node scripts/execution_authority_ext.mjs --status
node scripts/execution_authority_ext.mjs --authorize --task EXT-GOV-AUTH-V1-20260815
git diff --check
git diff --name-only 2ef0bb4689517b7a05578f18091e841ec37eca2a...HEAD
~~~

authorize 期望 STOP/exit 2；将其改成 GO 不是通过。

### 退出

- 三文档完整；
- 独立审查 0 Critical / 0 Important；
- 10 轮同一候选全通过；
- 本地冻结候选一致；若用户随后明确授权提交/推送，再验证本地与远端提交一致；
- G1 仍为 Blocked。

### 回滚

整体 revert 本文档提交；不影响产品与 authority。

## 4. Step G1：Root Bootstrap / BOOTSTRAP_OBSERVE

### Context Brief

本步建立最小根协调层，但不假装 frontend/backend 两条子 Harness 已建成。root doctor 只证明清单诚实、
边界未漂移、change 模板可用和 ext authority 仍 STOP；它不证明产品质量或子线完成。

### 新任务前置

- G0 已在 Gitee 形成 immutable accepted commit。
- 用户在该 commit 存在后批准新的 task id、exact base/tree/pathspec 与非目标。
- 独立治理 authority 明确允许 G1；不得复用本次文档批准。
- G1 的外部 exact grant/approval 必须先于 G1 change record 存在；change record 只记录已获授权的
  工作，不能成为 authority 输入、触发 doctor READY 或反向生成批准。
- reference source 仍固定 8bb68fb4...；若远端 ref 移动，只更新观察记录，不改变 frozen source SHA。

### Provisional Paths

下列只是下一任务的候选清单，必须在 G1 合同中逐项精确批准：

- AGENTS.md
- CLAUDE.md
- .harness/agents/project-owner.md
- .harness/rules/project-boundaries.md
- .harness/rules/project-workflow.md
- .harness/wiki/architecture.md
- .harness/wiki/harness-inventory.md
- .harness/wiki/verification-matrix.md
- .harness/contracts/project-harness.schema.json
- .harness/manifest/project-harness.json
- .harness/templates/change-template/summary.md
- .harness/templates/change-template/request_analysis/spec.md
- .harness/templates/change-template/request_analysis/tasks.md
- .harness/templates/change-template/ci_result/ci_summary.md
- .harness/changes/chore-ext-root-harness-bootstrap-20260815/summary.md
- .harness/changes/chore-ext-root-harness-bootstrap-20260815/request_analysis/spec.md
- .harness/changes/chore-ext-root-harness-bootstrap-20260815/request_analysis/tasks.md
- .harness/changes/chore-ext-root-harness-bootstrap-20260815/ci_result/ci_summary.md
- scripts/new-change.mjs
- scripts/new-change.test.mjs
- scripts/harness-doctor.mjs
- scripts/harness-doctor.test.mjs
- scripts/check_harness.mjs
- docs/product/tasks/<exact-G1-task>.md
- docs/superpowers/plans/<exact-G1-plan>.md

不允许目录 glob 出现在机器 authority；最终 grant 必须列出展开后的文件数组。

### Root Manifest v1 最小语义

建议 closed schema，未知字段拒绝。manifest 至少包含：

| 字段 | G1 值 | 含义 |
| --- | --- | --- |
| schemaVersion | ext-project-harness.v1 | 新 namespace，不继承旧 project-harness |
| status | BOOTSTRAP_OBSERVE | 只协调，不授权 |
| root | READY_FOR_OBSERVE | root 文档/doctor/template 可验证 |
| frontend.status | ABSENT | frontend/.harness 尚不存在 |
| frontend.entrypoint | frontend/AGENTS.md | 当前真实入口 |
| frontend.doctor | null | 不伪造命令 |
| backend.status | PARTIAL | backend/harness 有候选资产，无 manifest/doctor |
| backend.entrypoint | backend/AGENTS.md | 当前真实入口 |
| backend.harnessRoot | backend/harness | 当前目录 |
| backend.manifest | null | 当前缺失 |
| backend.doctor | null | 当前缺失 |
| authority.namespace | execution-authority.ext.v1 | 只登记现有治理 consumer |
| authority.canExecuteProductWork | false | 机器和文档双重固定 |

G1 doctor 的结构检查通过只表示这些声明与仓库事实一致。建议固定三个不可混用的接口：`--check`
校验结构并可 exit 0，`--status` 返回 `BOOTSTRAP_OBSERVE`/exit 0，`--ready` 在 G4 前固定返回
`NOT_READY`/exit 2。ABSENT/PARTIAL 不应让结构检查红，但必须让任何三层完成或产品 readiness
查询返回 NOT_READY；调用方不得用 `--check` 的成功冒充 readiness。

### 实施顺序

1. RED：测试证明 G1 文件不存在；旧 source doctor 直接搬入会因 40+ legacy 依赖失败。
2. 冻结当前 `scripts/check_harness.mjs` 对 `AGENTS.md` 的内容/行数约束与文件内 self-test 基线；仓库
   没有独立 `scripts/check_harness.test.mjs`，不得虚构该路径。
3. 定义 closed project-harness schema 与正反 fixture。
4. 写 ext-native owner/boundaries/workflow/wiki，引用 ADR 0028 与当前 AGENTS。
5. 在同一候选中更新 `scripts/check_harness.mjs` 的 AGENTS 合同与文件内 self-tests，再更新 AGENTS；
   只能做适配三层根入口所需的最小改动，不得放宽 ADR 0028、authority STOP 或 10 轮门禁。
6. 写 manifest，显式记录 ABSENT/PARTIAL。
7. 写 new-change 与测试：路径安全、重复 change、模板缺失、非法 slug、symlink、越界全部失败。
8. 写 root doctor 与测试：只读、无网络、无子进程 shell 注入、稳定错误；只运行 ext status，不消费 grant。
9. 在 G1 外部 exact grant/approval 已存在后，用 generator 创建 G1 自身 change record 并补齐来源、
   差异和验证。该记录只做审计，不参与 authority 或 readiness 计算。
10. 独立安全与规格审查。
11. 冻结候选，10 轮验证。

### 验收

- project manifest 严格闭合并与 disk/Git tree 一致；
- frontend ABSENT、backend PARTIAL 被诚实保留；
- root doctor 不导入旧 source authority/control-plane；
- new-change 只能在 .harness/changes 下写固定四文件模板；
- ext status 仍 STOP，authorize 仍 TRUST_ROOT_UNAVAILABLE 或更新后的合法外部 STOP；
- `scripts/check_harness.mjs` 全量检查和文件内 `--self-test` 均通过，AGENTS 适配未广泛放宽原有基线；
- ADR 0028、产品代码、现有 authority、CI 字节不变；
- G1 change record 的存在、缺失或内容变化均不能改变 authority/readiness；它不能把
  `BOOTSTRAP_OBSERVE` 提升为 READY；
- source exclusion guard 对旧 v1/v2、trust/runtime/rollout/history 路径失败关闭。

### 回滚

整体 revert G1 单提交。因为没有子线依赖和运行态，回滚后恢复 G0 基线。

### 停止条件

- 需要迁入任何 trust/key/runtime；
- doctor 只有复制旧 project-harness 才能通过；
- 需要把 frontend/backend 缺失写成 READY；
- 需要修改产品代码或 ADR 0028；
- exact path 超出批准。

## 5. Step G2：Frontend Engineering Harness

### Context Brief

当前 frontend 事实源是 frontend/AGENTS.md、package.json、Next.js/BFF 源码和既有 node tests，
不是参考来源的 pnpm/旧页面/旧发布门。G2 只建立工程护栏，不重做 UI。

### 前置

- G1 accepted，root manifest 显示 frontend.status=ABSENT。
- 新 G2 task 对 exact G1 commit/tree 和路径获批。
- 读取当前 frontend/AGENTS.md 与 package.json，命令以实际 npm scripts 为准。

### Provisional Scope

- frontend/.harness/agents/frontend-owner.md
- frontend/.harness/rules/frontend-boundaries.md
- frontend/.harness/manifest.json
- frontend/.harness/templates/change-template/...（展开 exact paths）
- frontend/scripts/harness-doctor.mjs
- frontend/scripts/harness-doctor.test.mjs
- frontend/scripts/new-change.mjs
- frontend/scripts/new-change.test.mjs
- 现有 frontend/AGENTS.md 的最小入口接线
- G2 自身 frontend change record
- G2 task/plan

不得复制参考来源中的 pnpm 命令、旧 e2e、release/prod 脚本、页面状态或历史 change。

### 验收

- manifest 只列当前存在的 npm 命令与路径；
- doctor 不访问网络、不启动 provider、不生成 build/runtime 状态；
- same-origin BFF、owner session、ADR 0028 边界被静态/契约检查而非重新实现；
- G1 root manifest 仍由后续 G4 更新，本步不跨写根文件；
- 10 轮 frontend doctor + 实际 lint/type/test/build（按任务风险）全绿。

### 回滚

revert G2；root 继续诚实显示 frontend ABSENT。

## 6. Step G3：Backend Harness Manifest + Doctor

### Context Brief

当前 backend/harness 只有 capability_candidates，共 62 个 tracked paths；没有统一 manifest/doctor。
G3 只登记实际资产和 owning tests，不导入参考来源中旧 commercial-loop、true-loop、Prompt 或 provider 状态。

### 前置

- G1 accepted，root manifest 显示 backend.status=PARTIAL。
- 新 G3 task 对 exact base/tree/pathspec 获批。
- 读取 backend/AGENTS.md、现有 capability candidate contracts 和实际 pytest/Node 命令。

### Provisional Scope

- backend/harness/manifest.json
- backend/harness/manifest.schema.json
- backend/harness/README.md
- backend/harness/_shared/naming-conventions.md（仅确有第二个重复命名需求时）
- backend/scripts/harness_doctor.py
- backend/tests/test_harness_doctor.py
- backend/tests/test_harness_manifest.py
- backend/AGENTS.md 的最小入口接线
- G3 backend change record
- G3 task/plan

### 验收

- 62 个现有 path 全被明确分类，不遗漏、不把 candidate 写成 active；
- authority-manifest 与 capsule 状态按当前文件读取，不从旧 source 注入；
- doctor 使用临时目录测试，拒绝 symlink/path traversal/未知 manifest 字段；
- 不调用 provider、网络、生产数据或模型；
- 不修改 RuntimeSkill registry、史馆、军机处、锦衣卫或工作成果；
- 10 轮 backend focused/full tests、ruff 与 doctor（按真实 AGENTS 命令）全绿。

### 回滚

revert G3；root 继续显示 backend PARTIAL。

## 7. Step G4：Root Delegation 与跨线记录强制

### Context Brief

只有 G2/G3 均已 accepted，root 才能把 ABSENT/PARTIAL 升为 READY，并安全委托各线 doctor。
升级是状态变更，不能与子线首次实现混在同一候选。

### 前置

- G2/G3 accepted commits 及其 10 轮证据已冻结。
- 新 G4 task 精确绑定 integration base、两个子线 commit/digest 与 allowed paths。
- root change record 用 G1 new-change 创建。

### Provisional Scope

- .harness/manifest/project-harness.json
- .harness/wiki/harness-inventory.md
- .harness/wiki/verification-matrix.md
- scripts/harness-doctor.mjs
- scripts/harness-doctor.test.mjs
- AGENTS.md（只更新真实启动顺序）
- G4 root change record
- G4 task/plan

### 状态转换

| Layer | Before | After 条件 |
| --- | --- | --- |
| root | READY_FOR_OBSERVE | READY |
| frontend | ABSENT | READY，仅当 manifest+doctor+证据存在 |
| backend | PARTIAL | READY，仅当 manifest+doctor+证据存在 |
| authority | STOP | 仍 STOP |
| product readiness | NOT_READY | 仍 NOT_READY；需独立 product authority |

### 验收

- root doctor 委托两个 doctor，保留 stdout/stderr 上限、timeout 与稳定错误；
- 任一子 doctor 缺失/失败，root doctor 失败关闭；
- 根 change record 记录事实源与验证命令；
- reference source 不再是运行依赖；
- authority STOP 与 canExecuteProductWork=false 不变；
- 10 轮 root+frontend+backend+现有 Harness/authority/Git guards 全绿。

### 回滚

revert G4 仅回到 BOOTSTRAP_OBSERVE；G2/G3 可保留但不被根标成 READY。

## 8. Step G5：平台强制与外部证据

### Context Brief

仓库内全绿不能证明 Gitee required check、外部 signer 或 atomic checkpoint 已部署。
G5 由独立平台管理员拥有，不由实现提交者自签。

### 必需外部证据

- repository/branch identity；
- exact candidate SHA/tree；
- required check 名称、规则 revision/identity/digest；
- 失败 check 不能合并的演示；
- 独立 PLATFORM key 的签名 proof；
- signer/checkpoint 的 key custody、nonce/sequence/revocation 证明；
- 平台无能力时状态 UNVERIFIED，不得降级成本地文件。

### 非目标

G5 不自动产生 product authority。它最多证明根治理候选和治理流程可被平台强制。

## 9. Product Authority 交接

根三层 Harness 全部 READY 后，下一步仍不是户部产品施工，而是独立设计 product authority：

- 新 namespace；
- exact product task/base/tree/pathspec/non-goals；
- 外部 grant/checkpoint/attestation/platform proof；
- canExecuteProductWork 只能对 exact candidate 为真；
- 不复用 execution-authority.ext.v1 的治理 GO；
- 不复活 root v1/v2 或 R0 ledger。

只有该机器门返回 GO，才可把户部 Decision Verification Phase A 从 Blocked 改为 Ready。

## 10. 最终验收矩阵

每个未来步骤必须在同一冻结 commit/tree 上连续完成至少 10 个完整轮次。命令必须来自该候选的
AGENTS、manifest 和 task，不能提前写死不存在的工具。

G1 的最低矩阵建议：

~~~
node --test scripts/new-change.test.mjs
node --test scripts/harness-doctor.test.mjs
node scripts/harness-doctor.mjs
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
node --test scripts/execution_authority_ext.test.mjs
node scripts/execution_authority_ext.mjs --status
node scripts/execution_authority_ext.mjs --authorize --task EXT-GOV-AUTH-V1-20260815
git diff --check
git status --porcelain=v1
~~~

authorize 的 expected result 是 STOP/exit 2，直到外部链真实存在。验证 wrapper 必须断言这个预期，
不能因非零退出把合法 STOP 隐藏，也不能吞掉意外 GO。

## 11. 对抗测试目录

每个实现任务至少覆盖：

- 参考来源 ref 移动但 frozen SHA 不变；
- 主工作区脏文件与 Git object 内容不同；
- source path symlink/submodule/特殊 mode；
- source 中出现私钥、trust、runtime、rollout、approval history；
- manifest 把缺失层冒充 READY；
- unknown field、duplicate path、大小写漂移、dot segment、NUL；
- new-change path traversal、重复 ID、symlink parent、模板缺失；
- doctor shell/env/GIT_* 污染、超时、输出洪泛、子 doctor 失败；
- root v1/v2 或 scoped authority 被误登记；
- ext consumer 被误当 product authority；
- workflow 文件被误当 required-check 证明；
- G1 change record 被误当 grant、authority 输入或 readiness 触发器；
- 删除 G1 change record 后 authority 决策发生变化；
- AGENTS 适配通过删除强制字符串或弱化 baseline 绕过 ADR 0028、authority STOP 或 10 轮门禁；
- 任一实质变化后旧 10 轮证据被误复用。

## 12. Plan Mutation Protocol

- 新增路径：停止当前步骤，更新 task/pathspec，重新 exact approve。
- source commit 变化：保留原 SHA，新建 source observation；禁止静默重钉。
- 任务拆分：允许缩小范围；每个新任务有独立 base/pathspec/verification。
- 任务合并：默认禁止，除非新的独立审批覆盖合并后的完整风险。
- 并行步骤：只允许 G2/G3 调查并行；写入必须路径互斥且不共享 task/status 文件。
- 跳过步骤：若跳过 G2 或 G3，G4 不得把对应层写成 READY。
- 放弃：保留本蓝图和证据，revert 未验收候选，不迁移运行态。

## 13. 反模式

- 整体 cherry-pick 8bb 或 b20。
- 复制 749 个旧 change 作为“历史连续性”。
- 把 public key、local trust 或空 runtime registry 漂白成安全 bootstrap。
- 迁入 root v1/v2 后改名为 ext authority。
- 为让 doctor 变绿而创建不存在的 frontend/backend事实。
- 在同一提交同时建 root、frontend、backend、authority 和产品功能。
- 用文档 PASS 冒充产品 PASS。
- 用本地测试、workflow 或 signer 自报冒充 Gitee required check。

## 14. 当前 Verdict

- G0 文档编制：PASS / GOVERNANCE DESIGN ONLY。
- G1–G5：BLOCKED / NOT AUTHORIZED。
- 根三层 Harness：NOT CONVERGED。
- 产品 authority：ABSENT。
- 户部产品施工：FAIL / STOP。
