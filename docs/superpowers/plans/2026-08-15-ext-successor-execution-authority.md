# ext successor execution authority 治理内核施工计划

## 0. 计划身份与当前结论

- task：`EXT-GOV-AUTH-V1-20260815`
- namespace：`execution-authority.ext.v1`
- contract drafting parent：`c1581a22375aec53787d01ed29d0f2200adeca4c`
- future implementation base：本合同推送后的远端提交 D，由用户在 D 存在后以完整 SHA exact approve；
  禁止本文预填移动 `HEAD` 或让未来实现提交批准自身。
- 当前 verdict：`BLOCKED`。本计划只能冻结未来施工，不授权其自身，也不授权户部产品代码。
- 恢复条件：用户再次精确批准任务文件中的 9 条 pathspec；独立安全复核无 P0/P1；仓外 signer、atomic
  checkpoint 和 Gitee required check 的管理员证据可验证。

## 1. 信任边界

```text
Repository G (schema / consumer / tests, default STOP)
       │ verifies only
       ▼
External S (short-lived signed grant + atomic nonce/sequence checkpoint)
       │ exact base + exact paths
       ▼
Candidate C (single parent, clean immutable commit/tree/diff)
       │ fresh-clone verification
       ▼
External A (signed candidate attestation + acceptance digests)
       │ required check enforced by platform admin
       ▼
Future product task may become Ready
```

仓库不能创建生产 S/A，worker 不能读取私钥，候选不能配置自己的 required check 为已满足。Gitee 页面、
分支保护 API 或管理员导出的规则摘要才是平台强制状态的事实源。

## 2. 威胁与必需控制

| 威胁 | 攻击方式 | 必需控制 | 失败结果 |
| --- | --- | --- | --- |
| 自授权 | 同一提交新增 schema、grant 和“批准” | S/A 只能由仓外 key 签名；key commitment 在宿主 | `STOP/SIGNATURE_INVALID` |
| 路径扩权 | glob、目录、大小写漂移、`..` | exact sorted file list + digest + realpath/lstat | `STOP/PATH_SCOPE_INVALID` |
| 移动引用 | 使用 branch/HEAD/tag | 仅 40 位 commit + tree + parent，fresh clone 重算 | `STOP/CANDIDATE_IDENTITY_INVALID` |
| 重放 | 重用 nonce 或回滚 sequence | 仓外 atomic consume/checkpoint | `STOP/REPLAY_DETECTED` |
| 时钟回拨 | 修改本机时间复活 grant | checkpoint 时间/sequence；本机时间只作附加检查 | `STOP/TIME_AUTHORITY_UNAVAILABLE` |
| TOCTOU | 校验后替换 grant/key | 固定路径逐段 lstat、owner/mode、单次读取、digest 后使用 bytes | `STOP/TRUST_FILE_UNSAFE` |
| 测试 key 漂白 | 把 fixture key 当生产 key | 测试只临时生成；无私钥入库；生产 key id 不接受 test prefix | `STOP/TRUST_ROOT_INVALID` |
| CI 冒充平台门 | workflow 文件存在但分支未强制 | 管理员规则 identity/digest + 外部 attestation | `STOP/REQUIRED_CHECK_UNVERIFIED` |
| 候选偷换 | C 后再改文件或 evidence wrapper 自称 C | C/A 分栏；A parent 精确 C；产品变化必须新 C 重跑 | `STOP/ATTESTATION_MISMATCH` |

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

`--status` 只报告门状态；`--check` 验证外部对象但不授权；`--authorize` 必须消费完整链。缺任一外部条件
固定 exit 2，不能用 development flag、environment override 或 `--force` 放宽。

### Task 3：宿主文件与 Git 候选验证

生产路径固定为宿主管理配置，不接受 CLI/env 覆盖。候选路径为：trust root
`/etc/chaotang-os/execution-authority-ext/trust-root.json`，grant/attestation 分别为
`/run/chaotang-os/execution-authority-ext/{grant,attestation}.json`，atomic checkpoint endpoint 为
`/run/chaotang-os/execution-authority-ext/checkpoint.sock`。这些路径必须由平台管理员随 task/base/pathspec 一并
精确批准；未批准时实现层保持 `HOST_PATHS_UNCONFIGURED`，不能猜 `/tmp` 或仓库相对路径。

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
```

网络/Unix socket/受管文件中的哪一种由平台管理员单独选择并威胁复核；没有受信 adapter 时 consumer 永远
`EXTERNAL_CHECKPOINT_UNAVAILABLE`。

### Task 5：CI job 与 Gitee required check

`.github/workflows/harness.yml` 只能增加 repo-side 验证 job：schema/tests、default STOP、fresh-clone candidate
recompute、negative fixtures。它本身不证明 Gitee 强制执行。

平台管理员必须另行：

1. 配置 Gitee 保护分支；
2. 把 exact check name 设为 required；
3. 禁止普通 writer 修改/绕过该规则；
4. 提供规则 identity、摘要、时间、actor 和验证截图/API 脱敏输出；
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
- C：未来户部产品候选，只有在 S 有效后才允许从新 Ready 任务产生。
- A：外部 signer 对 C 与验收摘要的 attestation；仓库 evidence wrapper 只能引用 A，不能签 A。

每个阶段记录 commit/tree/parent、name-status-z digest、命令/退出码、Node/Git 版本、lockfile digest、审查
verdict、外部规则 identity。任何代码或配置变化产生新候选并从第 1 轮重跑。

## 5. 回滚与停止条件

- G 可整体 revert，root v1/v2 和产品行为不受影响。
- trust key 撤销、checkpoint 不可达、required check 未强制、grant 过期/已消费、工作树脏或 path 漂移时立即
  STOP；不得降级为本地签名或聊天确认。
- 发现私钥、真实凭据、生产数据或外部写入时终止任务，先处置泄露/副作用，再保留脱敏事故证据。
- 需要新增任何路径时先更新本任务并重新获得 exact approval；禁止用目录通配扩权。

## 6. 本阶段交付口径

当前只允许交付本任务与计划，结论是 `CONDITIONAL PASS / GOVERNANCE CONTRACT READY`。下一步必须由用户
再次明确批准 task id、base 和 9 条 exact pathspec，并指定独立平台管理员；在此之前 consumer/schema/CI
实现不开始，户部 RichMemorial 产品任务继续 `Blocked`。
