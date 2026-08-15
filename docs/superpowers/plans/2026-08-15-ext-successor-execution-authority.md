# ext successor execution authority 治理内核施工计划

## 0. 计划身份与当前结论

- task：`EXT-GOV-AUTH-V1-20260815`
- namespace：`execution-authority.ext.v1`
- contract drafting parent：`c1581a22375aec53787d01ed29d0f2200adeca4c`
- implementation base：`017d3d34d0a56257fbbcdbd86cd6f1f6d9d0bcdd`；用户已在该远端提交存在后以
  完整 SHA exact approve，且批准覆盖 task id、9 条 pathspec、4 个宿主路径和全部非目标。
- 当前 verdict：`IN PROGRESS / GOVERNANCE KERNEL ONLY`。批准只激活治理内核施工，不授权户部产品代码，
  也不代表仓外 signer、atomic checkpoint 或 Gitee required check 已存在。
- 完成条件：独立安全复核无 P0/P1；冻结候选的本地验证全绿。仓外 signer、atomic checkpoint 和 Gitee
  required check 缺失时，本任务最多只能 `CONDITIONAL PASS`，consumer 必须保持 STOP。

## 1. 信任边界

```text
Repository K (schema / consumer / tests, default STOP)
       │ verifies only
       ▼
External S (short-lived signed grant + atomic nonce/sequence checkpoint)
       │ exact base + exact paths
       ▼
Governance candidate G (single parent, clean immutable commit/tree/diff)
       │ fresh-clone verification
       ▼
External A (signed candidate attestation + acceptance digests)
       │ required check enforced by platform admin
       ▼
Governance candidate may be accepted; product authority remains false
```

仓库不能创建生产 S/A，worker 不能读取私钥，候选不能配置自己的 required check 为已满足。Gitee 页面、
分支保护 API 或管理员导出的规则摘要才是平台强制状态的事实源。

## 2. 威胁与必需控制

| 威胁 | 攻击方式 | 必需控制 | 失败结果 |
| --- | --- | --- | --- |
| 自授权 | 同一提交新增 schema、grant 和“批准” | S/A 只能由仓外 key 签名；key commitment 在宿主 | `STOP/SIGNATURE_INVALID` |
| 路径扩权 | glob、目录、大小写漂移、`..` | exact sorted file list + digest + realpath/lstat | `STOP/PATH_SCOPE_INVALID` |
| 移动引用 | 使用 branch/HEAD/tag | 仅 40 位 commit + tree + parent，fresh clone 重算 | `STOP/CANDIDATE_IDENTITY_INVALID` |
| 重放 | 重用 nonce、旧 receipt 或回滚 sequence | 仓外 atomic consume + 每请求随机 challenge 绑定 candidate | `STOP/REPLAY_DETECTED` |
| 时钟回拨 | 修改本机时间复活 grant | checkpoint 时间/sequence；本机时间只作附加检查 | `STOP/TIME_AUTHORITY_UNAVAILABLE` |
| TOCTOU | 校验后替换 grant/key | 固定路径逐段 lstat、owner/mode、单次读取、digest 后使用 bytes | `STOP/TRUST_FILE_UNSAFE` |
| 测试 key 漂白 | 把 fixture key 当生产 key | 测试只临时生成；无私钥入库；生产 key id 不接受 test prefix | `STOP/TRUST_ROOT_INVALID` |
| CI 冒充平台门 | workflow 文件存在但分支未强制 | 管理员规则 identity/digest + 外部 attestation | `STOP/REQUIRED_CHECK_UNVERIFIED` |
| 候选偷换 | G 后再改文件或 evidence wrapper 自称 G | G/A 分栏；A 精确绑定 G；任何变化必须新 G 重跑 | `STOP/ATTESTATION_MISMATCH` |

## 3. 施工顺序

### Task 0：冻结 RED baseline

1. 运行 root v1 并记录 `STOP / AMENDMENT_APPROVAL_REQUIRED`。
2. 在 `ext-dev` 证明 consumer/schema 文件不存在，当前任何 authorize 命令都不能返回 GO。
3. 固定 base commit/tree、remote identity、工作树 clean 与 exact path list digest。
4. 写第一组失败测试：缺 trust root、未知参数、自报路径、仓库内 key/grant、移动 ref、脏树。

退出：测试因缺实现而 RED；不是依赖/语法错误。

### Task 1：三个 closed schema 与 canonical vectors

实现 grant、attestation、trust-root schema；`additionalProperties=false`，字段/长度/枚举/格式上限全部冻结。

canonical vectors 至少覆盖：对象 UTF-16 键顺序、数组顺序、显式 null、布尔、整数/小数、`-0`、Unicode
composed/decomposed 原 code points、转义、多字节字符串。RFC 8785 路径不得自行 NFC/NFD。

验证：schema 正反例；Node 独立计算每项固定 canonical bytes/digest；未知 JSON number/NaN/Infinity 拒绝。

### Task 2：默认 STOP consumer

实现纯函数边界：

- RFC 8785 canonicalizer；
- domain-separated Ed25519 verify；
- exact object shape 与稳定错误排序；
- CLI parser：`--status`、`--check`、`--authorize --task`；
- 所有异常统一脱敏 JSON 输出，不回显 payload、key、路径正文或签名字节。

`--status` 是唯一 read-only 例外，只报告 STOP 并 exit 0；`--check` 验证外部对象但不授权；`--authorize`
必须消费完整链。check/authorize 缺任一外部条件固定 exit 2，不能用 development flag、environment
override 或 `--force` 放宽。

### Task 3：宿主文件与 Git 候选验证

生产路径固定为宿主管理配置，不接受 CLI/env 覆盖。候选路径为：trust root
`/etc/chaotang-os/execution-authority-ext/trust-root.json`，grant/attestation 分别为
`/run/chaotang-os/execution-authority-ext/{grant,attestation}.json`，atomic checkpoint endpoint 为
`/run/chaotang-os/execution-authority-ext/checkpoint.sock`。四个路径已随 task/base/pathspec 获得路径级批准，
但平台尚未 provision；缺失时分别 fail-closed 为 trust/grant/attestation/checkpoint unavailable。批准路径本身
不提供任何文件内容或 authority，也不能猜 `/tmp`、仓库相对路径或环境覆盖。

文件 loader：每个父段和最终节点 `lstat`，拒绝 symlink；最终必须 regular file、受管 owner、非 group/world
writable、受限大小；单次读取 bytes 后再 parse/hash/verify。

Git verifier：清除/拒绝 replace refs，禁止 shallow evidence；读取 HEAD/commit/tree/parent；只接受单 parent；
以 `git diff-tree -r -z --name-status base candidate` 重算 exact path/status digest，并与 grant/attestation 比较。

### Task 4：外部 checkpoint 与 attestation adapter

先定义 adapter 接口和 fail-closed tests，不在仓库实现假 checkpoint。平台实现必须提供原子操作：

```text
verify key status + min sequence
verify lease/fencing/holder
verify nonce unused
consume nonce atomically
return signed checkpoint receipt
bind fresh consumer challenge + candidate commit/tree
```

平台 adapter 只允许已批准的固定 Unix socket；没有受信 adapter 时 consumer 永远
`EXTERNAL_CHECKPOINT_UNAVAILABLE`，旧 receipt 因 challenge 不匹配必须拒绝。

### Task 5：外部 required check 与 CI 指纹冲突

预检确认 `.github/workflows/harness.yml` 已被六部 Runtime readiness 的可信实现指纹覆盖；本轮修改该文件会
让现有 Harness 失败，而修复 readiness/evidence/review 需要超出本次 9 条 exact pathspec。为保持既有证据
真实，本候选必须让 workflow 字节不变。治理专项测试先由外部 required check 在 fresh clone 中显式执行；
未来如要接入仓内 CI，必须另立 amendment，同时精确批准六部 readiness、复审和对应验证路径。

平台管理员必须另行（不得只由 attestation signer 自报）：

1. 配置 Gitee 保护分支；
2. 把 exact check name 设为 required；
3. 禁止普通 writer 修改/绕过该规则；
4. 使用独立 `PLATFORM` key 签署绑定 repository、`ext-dev`、candidate SHA、check name/result、规则
   revision/identity/digest 和 observed time 的 proof；
5. 演示失败 check 不能合并、成功 check 仍需有效 S/A。

### Task 6：独立审查与攻击验证

- Standards：仓库规则、Node 风格、稳定 CLI/错误、测试隔离。
- Spec：逐条核对 task AC 与 exact pathspec。
- Security：key custody、自授权、TOCTOU、replay、time rollback、path traversal、secret/logging。

P0/P1 必须为 0；P2 修复或由用户显式接受。审查者不得提交产品或批准文件。

### Task 7：冻结候选与 10 轮

每轮在同一 commit/tree 上运行：

```bash
node --test scripts/execution_authority_ext.test.mjs
node scripts/execution_authority_ext.mjs --status
node scripts/execution_authority_ext.mjs --authorize --task EXT-GOV-AUTH-V1-20260815
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
node --test frontend/scripts/git-safety-guards.test.mjs
git diff --check
```

在外部 trust root 未配置阶段，authorize 的期望结果必须是 exit 2/STOP；不能为了让命令“全绿”把期望改成
GO。平台配置完成后的 GO 轮次必须在 fresh clone、强制 egress policy 和独立 required check 环境另跑。

## 4. 证据与提交链

- D：只含本任务/计划的远端合同提交，父提交为 contract drafting parent。
- B：用户在 D 存在后精确批准的 implementation base；当前设计要求 B 精确等于 D。
- G：只含治理内核实现，父提交为 B；不能含 grant/key/GO manifest。
- A：外部 signer 对 G 与验收摘要的 attestation；仓库 evidence wrapper 只能引用 A，不能签 A。
- P：未来户部产品候选不属于本 namespace；必须另建 product authority、任务、base/pathspec 与 exact
  approval，绝不能复用本任务 GO。

每个阶段记录 commit/tree/parent、name-status-z digest、命令/退出码、Node/Git 版本、lockfile digest、审查
verdict、外部规则 identity。任何代码或配置变化产生新候选并从第 1 轮重跑。

## 5. 回滚与停止条件

- G 可整体 revert，root v1/v2 和产品行为不受影响。
- trust key 撤销、checkpoint 不可达、required check 未强制、grant 过期/已消费、工作树脏或 path 漂移时立即
  STOP；不得降级为本地签名或聊天确认。
- 发现私钥、真实凭据、生产数据或外部写入时终止任务，先处置泄露/副作用，再保留脱敏事故证据。
- 需要新增任何路径时先更新本任务并重新获得 exact approval；禁止用目录通配扩权。

## 6. 本阶段交付口径

当前只允许在获批的 9 条 exact pathspec 内交付默认 STOP 的治理内核。户部 RichMemorial 产品任务继续
`Blocked`；只有独立平台管理员真实配置 signer/checkpoint/required check 并形成可验证外部证据后，才能
先验收治理候选；之后仍须另立独立 product authority 与产品任务申请施工权。
