# Product Authority M0 Credential-Separated Preauthorization Containment Prerequisite Successor Plan

Task: `PRODUCT-AUTHORITY-M0-CREDENTIAL-SEPARATED-PREAUTH-CONTAINMENT-PREREQUISITE-SUCCESSOR-20260915`

Base: `4deb1d937c66957f4d4293ca9106dcec986e38e6 / a52ff85976c4248936615fc90878df5eb06c677c`

Status: `DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Objective

用现有 root-owned credential-separated verifier broker 和 systemd/cgroup v2 取代前序 exact7 的同 UID inline containment，使 approval-controlled controller/verifier 即使 `setsid`、double-fork、关闭 FD3、保留 FD6、leader提前退出或fork storm，也不能逃离一次 preauthorization service instance。`product-authority.m0.v1` 继续是唯一 GO/STOP 决策者。

## Exact Governance Boundary

治理草案只包含 Task、Packet、Plan 三文件。future protected candidate 精确为：

1. `.harness/agents/project-owner.md`
2. `.harness/contracts/product-approval.schema.json`
3. `.harness/rules/project-boundaries.md`
4. `docs/product/tasks/2026-08-16-m0-solo-owner-product-authority.md`
5. `docs/superpowers/plans/2026-08-16-m0-solo-owner-product-authority.md`
6. `scripts/product-authority.mjs`
7. `scripts/product-authority.test.mjs`
8. `scripts/reference/chaotang-product-verifier-broker.py`
9. `scripts/reference/test_chaotang_product_verifier_broker.py`

`exact9` 在本包中只表示上述 future candidate 的九文件 protected-path closure。九条均为 `MODIFY / 100644`。不修改 systemd unit、Harness、Mingshuo exact10、数据库、运行时业务路径或安装脚本。实现若需要第十条路径或 unit 变化立即 STOP。

## Predecessor Disposition

前序 exact7 固定为 `STOP / PROCESS_TREE_CONTAINMENT_INCOMPLETE / UNCOMMITTED_BYTE_EVIDENCE_ONLY / NO_CANDIDATE_IDENTITY / NO_REANCHOR`。七路径 bytes 可在新基线上逐文件复核后选择性作为 donor；任何 authority、candidate、验证、审查或通过身份均不继承。它不能提交或由本 successor 静默消费。

## Architecture

```text
caller (dedicated controller identity)
  -> root-owned SOCK_SEQPACKET socket
  -> root broker / systemd service instance / cgroup v2
       -> unprivileged ingest
       -> isolated worker (user+mount+PID+network namespace)
            -> fixed preauthorization worker
                 -> approval controller + verifier
            -> inner preauthorization receipt
       -> cgroup quiescence + source/profile identity check
  <- outer broker receipt
product-authority.m0.v1
  -> validates outer + inner receipt and live approval/remote state
  -> sole GO/STOP builder
```

Broker不读取产品决策语义，不批准task，不维护authority ledger。它只接收closed request、验证Git对象来源、建立只读source view、执行固定profile、终止整个service cgroup并返回低敏closed receipt。

## Additive Source Protocol

- 保持 `chaotang-product-verifier-request.v1` 与其 candidate verification 行为逐字段兼容。
- 新增 `chaotang-product-verifier-preauthorization-request.v1`，kind 固定 `PRE_AUTHORIZATION_SOURCE`。
- source lineage要求`approval.parent == directBase`，direct base不需是root。传输精确的approval commit object、direct-base commit object、approval root tree、全部递归subtree和blob；base object仅验证parent，不传其tree/parent closure。manifest记录固定`kind,path,mode,oid,type,bytes,rawSha256`并按`kind,path,oid`字典序canonical化；commit无path/mode，tree/blob必须唯一path/mode。少/多/重复/未列对象、type/mode/OID/raw/bytes漂移全部拒绝；严禁candidate字段或approval-as-candidate语义。
- request闭合绑定 task、approval commit/tree、direct base、canonical digest、remote head、source-object manifest、controller/verifier/profile identity、fresh nonce/monotonic TTL和18-case identity。
- receipt闭合绑定request digest、inner receipt digest、service/cgroup identity、执行结果、quiescence与清理证据。未知字段、重复键、非canonical、超限、额外frame或stderr泄漏均拒绝。

## Containment Contract

- root broker永不执行approval-controlled source；worker使用独立非特权UID/GID，不能向root broker发送信号。每次accept后、读取任何request byte或分配worker前，root broker必须以`SO_PEERCRED`验证peer primary UID/GID精确等于root-owned installed manifest中的dedicated controller UID/GID，并把kernel PID、`/proc` starttime、user namespace与cgroup identity绑定本次连接/receipt；supplementary group、proxy/forwarded identity和user-namespace替代均拒绝。
- worker使用PID namespace与`--die-with-parent`，但最终收口依据是systemd service cgroup，不依赖初始PGID或subreaper存活。
- `KillMode=control-group`、`SendSIGKILL=yes`、`OOMPolicy=kill`、Tasks/Memory/CPU/Runtime limits均是冻结运行契约。
- FD ABI固定controller/verifier只见FD3/FD4/FD6且FD5不可见；FD6只指向只读approval source view并绑定mount ID/device/inode/mode/source manifest。执行前后枚举`/proc/self/fd`，拒绝writable duplicate、宿主root/repo、credential和额外FD。
- 常驻socket unit仅负责accept；每条连接绑定唯一per-connection service unit、`SYSTEMD_INVOCATION_ID`和service cgroup path/inode。receipt前该service `cgroup.procs`精确只含root broker PID；reply后由authority核对同一service inactive、同一cgroup empty且无FD6 holder，不得用socket active状态或错误cgroup替代。
- Broker持续poll peer `HUP/ERR/RDHUP`。caller SIGKILL、socket close、read stall、outer deadline、malformed/extra frame或reply write失败都必须幂等stop/cgroup.kill，等到只剩broker再退出；authority做最终inactive/empty复核。不得在peer消失后后台继续。
- setsid、double-fork、FD3 close+FD6 retain、leader early exit、fork storm必须有真实RED和内核级GREEN证据。

## Authority Integration

1. v2 receipt-gated approval由唯一authority生成nonce和单调TTL，建立approval/base/tree/canonical/remote/source expected identity。
2. Authority只能调用固定root-owned broker socket与冻结profile；caller不得覆盖socket、executable、cwd、environment、timeout、UID、receipt path或remote resolver。
3. Broker成功后authority strict-parse outer receipt及其绑定的inner receipt，重算两级digest，复核approval、remote、source、controller/verifier/profile、nonce、TTL、case topology和cleanup evidence。Outer receipt必须闭合包含peer primary UID/GID、kernel PID、proc starttime、user namespace device/inode、peer cgroup path与dedicated-controller installed-manifest digest，并由authority逐字段复核、纳入evidence digest。
4. Reply/EOF后authority固定以shell-free `/usr/bin/systemctl show` 只查询同一worker unit的`ActiveState,InvocationID,ControlGroup`，再从固定`/sys/fs/cgroup` component-wise no-follow打开匹配receipt inode的ControlGroup并读取`cgroup.procs`；必须同一invocation、inactive且empty。调用方不得覆盖executable、D-Bus endpoint、cgroup root/path或环境；查询不可用或任一不一致返回固定`PREAUTH_CLEANUP_UNVERIFIED` STOP，不得回退本地helper。
5. 只有全部闭合后才由既有唯一result builder返回GO。broker/worker/controller/verifier不得包含GO builder。

## Environment Gate

当前主机安装状态为 `STALE / INACTIVE / DISABLED / NOT_AUTHORIZED_FOR_PREAUTH`：安装manifest绑定旧commit `0b323e26584069019662aa723d30fd763424954c`，已安装broker/test/unit bytes与当前主线不同，没有Node preauthorization profile。future exact9代码落地不等于环境可用。

后续必须另经精确Owner授权，由独立管理员安装当前冻结unit/broker/profile，使用专用controller identity完成installed acceptance，结束后停止并保持disabled。普通ubuntu身份、现有credential helper、放宽socket mode或直接root运行都不是可接受替代。

## TDD Matrix

- Protocol：旧v1逐字段回归；新variant缺失/空/未知/重复/重排字段、candidate字段混入、approval父不匹配、object缺失/多余/污染全部拒绝。
- Source：approval tree/blob closure、mode/raw/blob、canonical digest、direct base和remote错配；symlink、path traversal、Git replace/object/config注入全部fail-closed。
- Receipt：伪造valid receipt但未执行controller、inner/outer digest错配、nonce重放、TTL过期/未来、跨approval/remote/profile/source复用全部STOP。
- Credential boundary：普通UID、错误group、stale install、错误socket owner/mode、ambient credential/proxy/Git config依赖均STOP；不得读取或输出secret。
- Peer identity/lifecycle：错误primary UID/GID/PID、仅supplementary group、proxy/forwarded identity、user-namespace混淆；caller SIGKILL、socket close、read stall、outer deadline与reply write失败必须在任何后台继续前fail-closed并清空per-connection cgroup。
- Process tree：controller和verifier分别覆盖setsid、double-fork、FD3关闭+FD6保留、leader退出、fork storm；worker timeout、caller timeout、receipt rejection后必须无后代；另覆盖socket unit保持active而worker service已正确inactive的正向用例，以及错误unit/invocation/cgroup identity拒绝。
- Source closure：approval/direct-base commit对象、递归tree/blob manifest逐项验证；少对象、多对象、重复、type confusion、错mode/path/raw/size、replace/ref/config注入全部拒绝。
- FD：worker/controller/verifier只获得冻结FD；FD6只读source；宿主repo、FD5或credential path不可见。
- Compatibility：旧approval、旧broker candidate verification、authority result shape、Harness和doctor不变。
- Output：结果不输出receipt原文、nonce、PID、FD、环境、source bytes、stderr或credential。

## Verification Matrix

Draft阶段：strict JSON、重复键拒绝、`productTaskErrors=[]`、三路径/exact9/mode/identity一致性、broker 75项静态测试（允许仅5项installed-host skip）、完整Harness、`git diff --check`。仓库没有`governance-repair.packet.v1`正式JSON Schema，因此只做现有closed-contract/internal-consistency，不伪造schema PASS。

Future exact9：

```text
TMPDIR=/tmp TEMP=/tmp TMP=/tmp node --test scripts/product-authority.test.mjs
PYTHONDONTWRITEBYTECODE=1 TMPDIR=/tmp TEMP=/tmp TMP=/tmp python3 -m unittest scripts/reference/test_chaotang_product_verifier_broker.py
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node scripts/harness-doctor.mjs --check
node --test scripts/harness-doctor.test.mjs
node .agents/hooks/check-harness.mjs --self-test
node scripts/ext-full-value-convergence.mjs --check
node --test scripts/ext-full-value-convergence.test.mjs
git diff --check
```

Installed acceptance另行治理，必须核对安装manifest、root ownership、dedicated identities、socket权限、cgroup v2 controllers、真实setsid/double-fork/fork-storm收口，并在验收后停止/disable所有相关unit。

## Review

- Governance Review：唯一authority、protected-path bootstrap、predecessor no-reanchor、legacy兼容、environment gate。
- Architecture Review：source/candidate协议分离、exact9闭包、两级receipt、cgroup生命周期、错误恢复与无第二事实源。
- Security Review：credential/UID边界、source object验证、nonce/TTL/replay、FD6只读隔离、setsid/double-fork/fork storm、stale install和输出泄漏。

任一P0–P2为NO-GO。P3记录但只有在不改变路径、协议或安全语义时才不阻断治理冻结。

最终只读复核结论：Governance、Architecture、Security均为`GO / P0=0 / P1=0 / P2=0 / P3=0`。该结论只批准治理草案冻结，不构成exact9实施、安装、authority、commit、push或部署授权。

## Rollback And Non-Goals

本轮仅三份未提交草案，回滚为删除本轮草案；不触碰产品或系统。未来exact9只允许直接单亲最小commit和普通fast-forward；已落地后只能通过新的forward-only corrective successor回滚，不改写历史。

本轮不实施、不提交、不推送、不force-push、不安装、不启动服务、不运行authority、不部署；不修改Mingshuo exact10；不创建第二authority/Harness/ledger/database；不宣称抵御已控制的Owner/root/Gitee/systemd/runner。

## Stop Conditions

远端离开`4deb1d937c66957f4d4293ca9106dcec986e38e6`；三文件之外出现修改；future candidate超过exact9；需要修改systemd unit；旧v1行为漂移；approval source被伪装为candidate；可回退same-UID helper；broker或receipt可产出GO；stale install被接受；controller权限被放宽；cgroup、namespace、FD6或后代清理不能机械证明；凭据进入worker/receipt/output；关键验证失败或独立审查P0–P2，均立即STOP。
