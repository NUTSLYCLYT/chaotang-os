# Product Authority Credential-Separated Executor Layered Network and Attestation Corrective Successor Plan

任务：`PRODUCT-AUTHORITY-CREDENTIAL-SEPARATED-EXECUTOR-LAYERED-NETWORK-ATTESTATION-CORRECTIVE-SUCCESSOR-20260902`

基线：`58c68a23a66071bc50edd7f567f98f814e71a29f`

基线 tree：`f9895bb1d6bd1c6a929fbeb9d59881b1dc4cc7ad`

状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## 1. Objective

以 forward-only successor 修复 predecessor exact4 的四项审查阻断：分层网络、ProtectProc-compatible credential
attestation、移除 root `CAP_SYS_ADMIN`、以及全 authenticated lifecycle断连取消。保留唯一
`product-authority.m0.v1`，保持 future product scope精确四路径；不安装、不部署。

## 2. Frozen Facts

- `origin/ext-dev`、本地 base与tree精确为 `58c68a23… / f9895bb1…`。
- predecessor治理提交保持历史证据；其 exact4 产品尝试已因 scope contradiction和独立审查 NO-GO停止。
- stopped donor是四条未提交`ADD / 100644`；历史字段插入顺序`JSON.stringify` bundle为
  `sha256:388437c1a37372582189af2368e098580b50a530946d67987bcb9c1d502acd52`，同一records的RFC 8785 canonical bundle为
  `sha256:d6259df26cca3c706b27671676d0b438a95cbb9203918ef0f20af173a5fa6f8e`；两者不得混称或互换。
- donor没有 candidate、verification、review、authority或可提交身份；不得在原工作区继续修改。

## 3. Governance Scope

approvalCommitPaths精确为本轮 Task、Packet、Plan。future candidatePaths精确为：

1. `deploy/systemd/chaotang-product-verifier.socket`
2. `deploy/systemd/chaotang-product-verifier@.service`
3. `scripts/reference/chaotang-product-verifier-broker.py`
4. `scripts/reference/test_chaotang_product_verifier_broker.py`

结构保持 `4 ADD / ALL 100644`。第五路径、现有 authority、exact2、P14、Harness或系统状态修改均 STOP。

## 4. Phase A — Freeze Corrective Governance

1. strict JSON、重复键、Task contract、路径、模式、差异、内部一致性与完整 Harness。
2. 计算 Packet RFC 8785 canonical digest、三文件 raw SHA与三文件 bundle。
3. 独立 Governance、Python、Security Review；任一 P0–P2立即 STOP。
4. 只有Owner确认最终摘要后，才允许一次本地approval commit。该commit必须是`58c68a23…`直接单亲子，只含精确三条
   `ADD / 100644`；提交前后复核live remote、commit/tree/parent、路径/模式/raw/canonical/bundle。push需再次独立授权。

## 5. Phase B — Rematerialize And TDD Correct Exact4

1. 三文件approval普通快进落地且Owner另行确认本protected-path implementation scope后，在新隔离工作区从donor
   byte-for-byte重物化四文件，不继承旧证据。仓库没有`governance-repair.packet.v1` machine runner，不得伪造machine GO。
2. 先写 RED：
   - pre-filter launcher进入并证明private netns；root/ingest AF_INET/AF_INET6拒绝；worker private-loopback成功；宿主
     TCP和abstract AF_UNIX不可达；
   - ProtectProc下helper逐消息`SCM_CREDENTIALS`与`SCM_RIGHTS` procfs task/status FD闭合；伪造/replay/PID漂移失败；
   - initial/host namespace broker及后代无`CAP_SYS_ADMIN`；private userns bootstrap在untrusted exec前能力归零；
     setuid/file-cap/writable profile替换失败；
   - ingest、parse、decompress、graph、materialize、copy、worker、receipt各阶段断连清理与下一连接。
3. GREEN只允许四路径：
   - service `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6`、`IPAddressDeny=any`、`IPAddressAllow=localhost`；
     supervisor读取request前预建并以NSFS_MAGIC/NS_GET_NSTYPE/NS_GET_USERNS及host namespace对比核验private launcher，
     再加载no-new-socket/no-addressed-send seccomp；launcher关闭accepted socket/dup并使用精确FD表，ingest使用更严
     no-socket filter，worker只从launcher创建；
   - controller固定`SO_PEERCRED`；helper固定SO_PASSCRED/SCM_CREDENTIALS并传递kernel procfs FDs，父进程在barrier前验证；
   - initial/host capability bounding set删除`CAP_SYS_ADMIN`；只允许fresh child userns bootstrap短暂namespaced capability，
     untrusted exec前归零；不可用则环境STOP；
   - root supervisor作为唯一非阻塞event loop，以pidfd监督所有heavy stage；合法SHUT_WR/`POLLRDHUP`不取消，完整
     `POLLHUP`/ERR/NVAL、写失败、deadline或liveness丢失才清理整个control-group。
4. 重跑原协议、sealed pack、object closure、runtime profile、FD、syscall、resource、timeout、receipt、nonce和lineage
   全部负向测试；不得为了新纠偏放宽旧边界。
5. static matrix与三审全绿后冻结raw/blob/mode/bytes/bundle/diff/evidence；等待candidate commit授权。

## 6. Phase C — Administrator Installation And Real-Host Acceptance

repository candidate落地不等于安装授权。Owner/Admin另行确认exact commit、unit/broker/test raw/blob、runtime profile和
installation manifest后，才可创建用户/组并安装root-owned bytes。真实 acceptance必须验证：

- effective systemd address family/IP policy与capability sets；
- root/ingest无IP socket、worker仅private loopback、宿主listener与abstract AF_UNIX不可达；
- ProtectProc credential证明、FD和`/proc/root`边界；
- 全阶段disconnect、timeout、crash、setsid/double-fork清理和next connection；
- Python/Node线程正常，namespace clone及新旧mount API失败。

未得到typed installed evidence时状态保持 `ENVIRONMENT_PREREQUISITE_UNAVAILABLE`，阻断exact2与P14。

## 7. Phase D — Resume Exact2, P14 And RC

installed acceptance通过后，基于届时最新ext-dev分别新签：

1. credential-separated Product Authority exact2；
2. P14 exact30 successor；
3. 全矩阵、真实浏览器链与可回滚 Release Candidate。

每条均使用独立machine authority与candidate verification。不得恢复任何旧one-child authority，不部署生产。

## 8. Verification And Review

治理阶段：strict JSON、duplicate-key、`productTaskErrors=[]`、精确路径/模式/差异、Packet canonical、三raw、bundle、
Harness与独立 Governance/Python/Security Review。

产品静态阶段：broker unittest、unit contract、Harness/self-test、Doctor/tests、V2 check/tests、diff check和三审。

真实阶段：同一frozen test blob的 `--installed-acceptance`。静态unit scan与mock不能冒充真实credential/network/cgroup证据。

## 9. Rollback

- 本三文件未commit/push时删除新治理工作区即可停止；不得删除历史或donor。
- corrected exact4落地但未安装时无运行时副作用。
- 安装后回滚必须先停止socket、证明service inactive且cgroup为空、保存evidence，再由管理员移除installed bytes。
- exact2/P14未落地前保持fail closed；禁止回退同UID或host-network执行。

## 10. Stop Conditions

remote drift；approval非`58c68a23…`直接单亲exact-three；第五路径；donor漂移；第二authority/runtime/ledger；initial/host
namespace需要或恢复`CAP_SYS_ADMIN`；pre-filter private launcher未证明；root/ingest host network可达；worker宿主网络可达或
private loopback不可用；credential自报或可重放；合法request half-close被误杀；任一authenticated阶段无disconnect取消；
真实安装证据不可用；验证失败；独立审查任一P0–P2。

## 11. Current Authorization Boundary

当前只编制、校验与独立审查三文件治理草案。不得修改donor、运行product authority、创建candidate、commit/push、安装、
Pilot、Release或生产部署。
