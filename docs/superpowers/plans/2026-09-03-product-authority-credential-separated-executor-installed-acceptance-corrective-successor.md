# P01 Product Authority Credential-Separated Executor Installed Acceptance Corrective Successor Plan

## Objective

Forward-only 修复 `412282ce…` 在真实安装验收中暴露的两个闭合合同矛盾，使 executor 在不扩大
CapabilityBoundingSet、AmbientCapabilities、网络、路径或 authority 边界的前提下通过 5/5 非生产 real-host acceptance。

## Scope

治理三文件只描述和冻结后续 exact3。产品 candidate 精确为：

1. `deploy/systemd/chaotang-product-verifier@.service`
2. `scripts/reference/chaotang-product-verifier-broker.py`
3. `scripts/reference/test_chaotang_product_verifier_broker.py`

任何第四路径、socket unit、Product Authority、runtime profile、P14、frontend 或业务路径立即 STOP。

## Evidence Baseline

- Base：`412282cea743d41357709aa2ae9a18890ed4c64d / f203716e636f2eda46844c504f26521ffd832624`
- Real-host：`5 tests / 8 failures / 3 errors`
- Details：`sha256:685e15300f9243d351421936e58bc2ad467c3901ce0238bfc9f0f684b6e5cc55`
- Credential事实：acceptance orchestrator allowlist是`0xe6`；unit `NoNewPrivileges=yes` →
  `CapPrm/CapEff=0x66`、`CapBnd=0xe6`、`setresuid EPERM`。exact4 service allowlist是`0xeb`，candidate必须机械证明
  相同失败拓扑为`0x6b/0xeb`且corrected启动为`0xeb/0xeb`。
- Corrected-order实验：acceptance unit exec时NNP关闭，进程立即 `PR_SET_NO_NEW_PRIVS` → `NoNewPrivs=1`、
  `CapPrm/CapEff/CapBnd=0xe6`，随后 `setresgid/setresuid`成功；service candidate必须对其`0xeb`集合形成同型证据。
- Request事实：raw multiline `args` 被现有 closed JSON 以 `JSON_CONTROL_CHARACTER`拒绝。

## TDD Sequence

0. Owner先引用任务ID与最终canonical digest，在一条条件链中分别授权approval commit、approval FF push、exact3实施、
   candidate commit与candidate FF push；同一消息可列全，但遗漏的checkpoint即未授权。
   exact3只能在远端精确等于未来approval commit后开始，candidate parent必须精确等于该approval commit。
   v7 orchestrator必须在exact3 candidate后形成新字节身份，Owner或管理员再精确确认其raw SHA、`0555 root:root`
   mode/owner和唯一command，之后才能单独授权非生产重装/验收；不得预授权未知root executable。
1. 增加静态与可执行进程负向测试，锁定service `0x6b/0xeb`的早置NNP失败与`0xeb/0xeb` corrected状态。
2. 增加 broker entrypoint 顺序测试：所有roles的`main()`首个安全动作在`parse_cli`、socket/stdin read/peek、fork/thread和任何
   attacker parse前执行PR_SET/PR_GET/proc复核；同时证明启动单线程、CapInh/Amb=0。只有`--serve-stdio`
   root supervisor在transport read前要求`eb/eb/eb`；helper按既有role-specific inherited-or-zero集合验证。
   失败时不得监听或读取请求。
3. 增加 installed script编码 RED：raw multiline不得进入header；唯一模板为
   `import base64;b=b'<PAYLOAD>';d=base64.b64decode(b,validate=True);base64.b64encode(d)==b or (_ for _ in ()).throw(ValueError('NON_CANONICAL_BASE64'));len(d)<=65536 or (_ for _ in ()).throw(ValueError('PAYLOAD_TOO_LARGE'));exec(compile(d.decode('utf-8','strict'),'<ctpv-installed-acceptance>','exec'))`。
   payload必须是≤65536字节strict UTF-8的RFC4648 standard padded Base64，且decode后re-encode逐字节相等。
4. 最小实现：service `NoNewPrivileges=no`；broker在任何 mutable input 前设置/验证NNP；test使用上述ASCII launcher且无shell。
5. 运行Packet中每条可复制命令、静态完整矩阵和独立三审；candidate-owned
   `--verify-repository-candidate`只生成diagnostic。candidate commit后必须从immutable approval Task提取并hash复核
   独立verifier，以Packet冻结的`/usr/bin/env -i ... /usr/bin/node`命令运行。该gate从detached HEAD与hash-verified
   raw commit object自动推导身份，并从non-repository cwd用literal remote URL执行`ls-remote`，
   以集合相等和非零退出机械拒绝错误parent、approval非exact3 ADD、candidate非exact3 M/100644、额外/未跟踪路径、
   raw/blob/bundle/full-index diff漂移；只打印Git输出不构成通过。P0–P2为零后才形成candidate identity。
6. candidate普通快进落地后，在新的管理员授权下原子更新非生产安装并重跑 frozen 5项验收。

## Security Invariants

- `NoNewPrivileges=no` 只表示 systemd 不在 exec 前设置；broker必须以`main()`首个可执行安全动作自行设置内核 NNP。
- 不扩大CapabilityBoundingSet/Ambient；只恢复既有`0xeb` bounding内的SETUID/SETGID到fixed root supervisor的
  permitted/effective集合并限于降权，所有child exec前五类capability归零。
- `CapabilityBoundingSet`、Ambient、NoNewPrivs child proof、credential attestation、private network、seccomp、
  path/mode/digest、cgroup与disconnect cleanup均不得放宽。
- Base64只做无控制字符传输，不提供信任；唯一launcher自身必须在compile/exec前完成validate、canonical re-encode
  byte equality、strict UTF-8、size bound且无shell；
  最终argv仍由argsDigest/requestDigest绑定，解码器与payload均是确定性字节。
- 不安装生产凭据，不访问客户数据，不启用或常驻任何服务。

## Verification and Rollback

静态验证按 Packet matrix执行，并机械复核approval/candidate的direct-parent、exact paths、M/100644、raw/blob/diff。
real-host acceptance必须通过Packet冻结的v7 root-owned orchestrator精确命令返回closed canonical JSON。orchestrator
每次用`getrandom(32)`生成raw challenge，编码为canonical unpadded RFC4648 base64url精确43字符；run ID固定为
`ctpv-run-sha256-<raw challenge SHA-256 hex>`。非symlink `0700 root:root`消费目录位于`/run`，issued/consumed记录
为`0600 root:root`、`O_EXCL|O_NOFOLLOW`，绑定当前boot ID和`CLOCK_BOOTTIME`；成功以同目录临时文件、fsync、
atomic rename消费，记录保留到重启。inner receipt按Packet精确字段集和独立inner domain回绑challenge/run与
orchestrator InvocationID、state PASS、testsRun 5、failures/errors 0，并将verified installation manifest v2的
installationCandidateCommit/Tree与synthetic request identity分字段；root-peer单独以unauthenticatedProbe绑定closed
protocol-error digest，并由root orchestrator在unit live时独立绑定cgroup/systemd unit、InvocationID及effective-unit digest；
broker identity保持null，且该unit/InvocationID不得与其余执行重复。精确19项authenticated serviceExecutions逐次绑定
real-gate、timeout/next及八阶段disconnect/next各自由root orchestrator校验的唯一service unit、live
`systemctl show` InvocationID、brokerServiceInstance（必须与InvocationID相等）、request、
receipt/effective-unit digest和outcome，禁止用一次成功概括其他实例。outer envelope按独立outer domain与精确字段集比较fresh challenge、同boot
0..900秒、拒绝issued/consumed重用，并绑定inner stdout digest与pre/post inactive/disabled；
identity不匹配、过期或重放均拒绝。v7 orchestrator字节与raw SHA必须在exact3 candidate冻结后、管理员安装前另行冻结，
`TO_BE_FROZEN...`不得被当作可运行身份。

回滚边界：repository只允许普通 fast-forward；系统安装在独立管理员步骤中保留旧 root-owned摘要与unit副本，
验收后无论成败停止全部 verifier units并保持 disabled。禁止生产部署。
