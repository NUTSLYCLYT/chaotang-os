# 任务：ext successor execution authority 治理内核

> 本任务遵循 `docs/decisions/0028-decree-evidence-flow-governance-baseline.md`，不改变下旨、军机处、
> 锦衣卫、史馆或成果确认业务流。

## Status

Blocked

- Governance kernel implementation：Ready for frozen-candidate verification
- Platform activation：Blocked（外部 signer/checkpoint/PLATFORM proof/required check 尚不存在）
- Product authority：Blocked（本 namespace 永不授予产品施工权）

## Product Definition

- 用户确认：用户于 2026-08-15 明确同意“产品减法 + 质量闭环”会审结论，要求立即执行、完成后上传
  Gitee 收口并进入下一阶段。这授权本轮收口和本治理合同编制，但不等于仓外 signer、Gitee required
  check、单次 nonce/checkpoint 或未来 exact implementation candidate 已经存在。
- 问题：`ext-dev` 没有受管 execution-authority consumer；根 v1 按设计永久 `STOP`，根 v2 只回答
  R0 work package。聊天确认、仓内 manifest 或同一提交中的批准文件都不能安全激活户部产品施工。
- 目标用户：需要在 Gitee `ext-dev` 上批准、施工、复核和验收高风险产品变更的项目所有者、平台管理员
  与独立审查者。
- 目标：冻结独立 namespace `execution-authority.ext.v1` 的 exact task/base/pathspec、closed schema、
  默认 STOP consumer、外部信任根、平台 required check 与回滚协议；本 consumer 只验收本次治理候选 G，
  即使返回 GO 也不授予户部产品施工权。未来产品必须另建独立 namespace、合同和 exact approval。
- 非目标：不修改或重钉 root v1/v2；不创建私钥、批准 grant、生产 GO 或自授权 manifest；不修改
  RichMemorial、史馆、会计、前端页面/API、46 RuntimeSkill、军机处或锦衣卫产品运行代码；不调用
  网络/provider/生产数据或外部副作用。

## Frozen Identity

- task id：`EXT-GOV-AUTH-V1-20260815`
- namespace：`execution-authority.ext.v1`
- contract drafting parent：`c1581a22375aec53787d01ed29d0f2200adeca4c`
- implementation base：`017d3d34d0a56257fbbcdbd86cd6f1f6d9d0bcdd`；用户于 2026-08-15 在该远端
  不可变提交存在后，精确批准 task id、9 条 pathspec、4 个宿主路径和全部非目标。治理实现必须是它的
  单父后代，且不能批准自身。
- implementation base tree：`a05b69964fde283e243c11a312059706b6d3b2f3`。
- non-goals digest：`sha256:4e0f74b806f32aef89def53653bdab0988ae1a450136f507753cd10204a6d548`。
- repository identity：`gitee.com/msxn/chaotang-os`
- target branch：`ext-dev`，但所有签名字段必须使用 immutable commit/tree，不得使用分支名或 `HEAD`。
- grant domain：`chaotang-ext-authority-grant-v1\0`
- attestation domain：`chaotang-ext-authority-attestation-v1\0`
- checkpoint domain：`chaotang-ext-authority-checkpoint-v1\0`
- platform proof domain：`chaotang-ext-authority-platform-proof-v1\0`
- signature algorithm：Ed25519；canonical bytes：RFC 8785 JSON UTF-8，不做 NFC/NFD 归一化。
- proposed host trust-root path：`/etc/chaotang-os/execution-authority-ext/trust-root.json`
- proposed ephemeral grant path：`/run/chaotang-os/execution-authority-ext/grant.json`
- proposed ephemeral attestation path：`/run/chaotang-os/execution-authority-ext/attestation.json`
- proposed atomic checkpoint endpoint：`/run/chaotang-os/execution-authority-ext/checkpoint.sock`

## Acceptance Criteria

- [x] root `execution-authority.v1` 原文件、摘要和永久 STOP 语义不变；root v2 的 R0 namespace、manifest、
  ledger 和 W06 证据均不复制、不继承、不映射。
- [x] grant、attestation 与 host trust-root 使用三个独立 closed JSON Schema；未知字段、类型混淆、重复
  path、浮动 ref、绝对路径、反斜杠、空段、`.`、`..`、NUL、符号链接或目录条目全部拒绝。
- [x] `allowed_paths` 是大小写精确、UTF-8、斜杠分隔、已排序、无重复的仓库相对文件数组；签名同时绑定
  数组 canonical digest，禁止 glob、目录通配和“必要文件”等开放语义。
- [x] grant 绑定 task/repository/base commit/base tree/holder/lease/fencing/sequence/key/nonce/有效期/
  non-goals digest；attestation 绑定 grant digest、candidate commit/tree/唯一 parent、name-status-z diff、
  lockfile/命令矩阵/轮次/egress/review/evidence digest。
- [x] consumer 仅支持 `--status`、`--check`、`--authorize --task <exact-id>`；未知参数退出 64。
  `--status` 是唯一 read-only 例外：只输出 STOP 且退出 0；`--check/--authorize` 的任何缺失、不一致或
  不可验证状态统一退出 2/`STOP`。只有 authorize 全链满足才允许退出 0/`GO`；该 GO 只表示
  `canAcceptGovernanceCandidate=true`，`canExecuteProductWork` 永远为 false。
- [x] `--authorize` 不能从 CLI、环境变量、仓库文件或 worker 输入选择 grant、公钥、checkpoint 或
  attestation 路径；生产路径由宿主固定并逐路径段拒绝 symlink，校验 owner/mode/regular-file/size 后
  单次读取。
- [x] 私钥不进入 Git、环境变量、worker、日志、测试 fixture 或 artifact；测试只在临时目录中生成一次性
  Ed25519 keypair，仓库不提交可被误认成生产的测试私钥。
- [x] 本机时间不能单独证明时效；sequence、nonce consumption、撤销和时钟回拨必须由仓外原子 checkpoint
  提供。checkpoint 缺失或不可验证时固定 `STOP/EXTERNAL_CHECKPOINT_UNAVAILABLE`。
- [x] candidate 必须是 grant base 的精确单父提交，禁用 replace refs 后重算 commit/tree/parent 与
  `git diff-tree -r -z --name-status`；工作树不干净、越界 path、merge commit 或签名漂移均 STOP。
- [ ] Gitee 管理员必须把独立 required check 设为合并硬门，并记录规则身份/摘要；仓库中的 workflow
  文件或本地测试不能声称平台门已配置。平台状态缺失时固定 `STOP/REQUIRED_CHECK_UNVERIFIED`。
- [x] 本合同已作为独立提交 D 推送；用户的 exact approval 已明确绑定 D 的完整 SHA、task id、9 条
  pathspec、4 个宿主路径和非目标。治理实现 G 必须以 D 为精确单父提交。
- [x] 攻击测试至少覆盖伪签名、错误 domain、过期/未来 grant、重放 nonce、回滚 sequence、撤销 key、
  错 parent/tree/repository/task/holder、path 扩权、symlink/TOCTOU、脏树、移动 ref、自授权提交和错误码
  脱敏。
- [ ] 同一冻结治理候选连续 10 轮通过 schema、consumer tests、Harness/self-tests、secret/conflict/diff
  guards；任一实质变化归零。
- [ ] 最终 Gitee SHA 与本地 exact SHA 一致，且验收报告明确区分“治理内核可验证”与“平台 trust root
  已启用”。后者没有管理员证据时仅 Platform activation 保持 Blocked，不否定本地治理候选的验证结果。

## Delivery Constraints

- 当前允许路径：仅以下经用户精确批准的 implementation exact pathspec；批准不提供外部 signer、checkpoint、
  required check 或产品施工权：
  1. `.github/workflows/harness.yml`
  2. `docs/contracts/execution-authority-ext-attestation.schema.json`
  3. `docs/contracts/execution-authority-ext-grant.schema.json`
  4. `docs/contracts/execution-authority-ext-trust-root.schema.json`
  5. `docs/product/tasks/2026-08-15-ext-successor-execution-authority.md`
  6. `docs/superpowers/plans/2026-08-15-ext-successor-execution-authority.md`
  7. `scripts/execution_authority_ext.mjs`
  8. `scripts/execution_authority_ext.test.mjs`
  9. `scripts/fixtures/execution-authority-ext-canonical-vectors.json`
- 收窄约束：`.github/workflows/harness.yml` 虽在用户批准的 9 条合同清单中，但本治理候选 G 必须保持其
  字节不变，Git verifier 显式拒绝该 path 的 diff；未来 CI 接线须连同六部 readiness/evidence 另立 amendment。
- 兼容性：现有 Harness 133/167、Stop hook 3、product-flow 25、前后端 CI 与 ADR 0028 完整性门保持不变。
- 风险与限制：这是安全关键治理代码；仓外 signer/checkpoint 与 Gitee 分支保护不在仓库写权限内，必须由
  独立管理员完成。任何本地生成的密钥或自签结果都只能是测试证据，不能升级为产品 authority。
- 技能计划：`codex-pro-workflows`、`test-driven-development`、`security-review`、`verification-loop`、
  `code-review`。
- Codex-only：是；禁止 Claude CLI、Claude runner、gstack-claude 和任何绕过 STOP 的 Skill。

## Affected Modules

- 模块：候选 ext execution authority 治理内核；外部 signer、atomic checkpoint、Gitee required check。
- 允许路径：仅 Delivery Constraints 中逐项列出的 9 条 exact pathspec；任何新增路径必须重新批准。
- 依赖模块：Git immutable object model、root-owned `/usr/bin/git`、Node `crypto` Ed25519、RFC 8785
  canonicalizer、现有 Harness CI。
- 所有权：仓库只拥有 schema/consumer/tests；平台管理员拥有 signer/checkpoint/required check 的真实状态。

## Technical Plan

- 架构边界：`D/B（获批合同基线）→ S（外部 grant）→ G（治理候选）→ A（外部 attestation）`。
  仓库不能签 S/A，G 不能携带 grant/key/GO，A 不能声称自身是被测候选；未来产品候选不属于本链。
- 接口与依赖：consumer 默认 STOP；所有生产 trust material 从固定宿主路径和独立 checkpoint 获取。
- 实施顺序：closed schemas/canonical vectors RED → verifier RED/GREEN → Git/path/filesystem 攻击测试 →
  外部 adapter fail-closed → 外部 required check → 10 轮与独立复核；仓内 CI 接线另立 amendment。
- 验证计划：详见配套施工计划；不得以 schema、单测或 workflow 文件替代 Gitee 平台配置证据。
- 技术风险：最大风险是自授权、跨 worktree/TOCTOU、nonce 重放、时钟回拨、测试 key 漂白和把 CI 文件
  冒充 required check。控制是外部 trust root、每次随机 challenge、固定路径、atomic checkpoint、独立
  PLATFORM key、fresh-clone 重算与明确 STOP。

## Implementation Report

- 改动摘要：实现三个 closed schema、RFC 8785 canonical vectors、Ed25519 domain verifier、严格无重复键
  JSON parser、固定宿主路径 loader、Git immutable candidate verifier、随机 challenge checkpoint adapter、
  独立 PLATFORM proof 与默认 STOP CLI。base/tree/non-goals/holder/9 条 pathspec 均为机器精确常量。
- 自审：没有修改产品运行代码、ADR、root v1/v2、宿主 trust path 或外部平台状态；CLI 即使治理 GO 也
  固定 `canExecuteProductWork=false`，内部授权评估不导出。
- 验证：focused Node 11/11；三个 schema 的闭合结构 contract test 通过；另以本机环境提供的 Python
  `jsonschema` 做过一次 Draft 2020-12 meta-check（未锁入 CI，不作为可复现完成证据）；root v1 fresh authorize 为
  exit 2、`STOP / AMENDMENT_APPROVAL_REQUIRED`；Harness 133、self-test 167、Stop hook 3、product-flow 25、
  Git safety guard 3 与 `git diff --check` 全部通过。
- 实际使用的 skill：`codex-pro-workflows`、`diagnosing-bugs`、`test-driven-development`、
  `security-review`、`verification-loop`。
- 验证命令与结果：`node scripts/check_harness.mjs`（133 PASS）；三条 self-test（167/3/25 PASS）；
  `node --test frontend/scripts/git-safety-guards.test.mjs`（3 PASS）；root authority（预期 STOP，exit 2）。
- 未运行项与原因：外部 signer/checkpoint/PLATFORM proof/Gitee required check 不在仓库权限内且尚未配置；
  因 `.github/workflows/harness.yml` 属于六部可信实现指纹，本轮保持其字节不变，仓内 CI 接线等待独立
  readiness/evidence amendment。
- 剩余风险：外部 trust root、原子 checkpoint、Gitee required check 和强制 egress-deny 均未发生；
  本机不能形成真实 GO，产品 authority 始终为 0。
- 独立审查：首审发现 3 Critical/4 Important/2 Minor，二审发现 1 Critical/5 Important/1 Minor；逐项修复后
  三审及最终快速复核均为 `PASS`，最终发现数 0 Critical / 0 Important / 0 Minor。审查全程只读。

## Acceptance Review

- 验收结果：等待冻结提交、连续 10 轮和独立二审后收口；外部激活条件缺失意味着最终上限仍为
  `CONDITIONAL PASS / LOCAL GOVERNANCE KERNEL`。
- 验收证据：focused/schema/Harness/self-tests/guard/diff 当前全绿；root v1 与 ext consumer 均保持 STOP。
  远端 exact SHA 只能在提交推送后由 `git ls-remote` 外部核对，不能由本文自称。
- 未通过项：仓内 CI 接线、外部 trust root/checkpoint/PLATFORM proof/required check 与任何产品 authority。
