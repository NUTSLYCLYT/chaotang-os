# Product Authority Credential-Separated Executor Installed Acceptance Corrective Successor

任务 ID：`PRODUCT-AUTHORITY-CREDENTIAL-SEPARATED-EXECUTOR-INSTALLED-ACCEPTANCE-CORRECTIVE-SUCCESSOR-20260903`

冻结基线：`412282cea743d41357709aa2ae9a18890ed4c64d`

冻结基线 tree：`f203716e636f2eda46844c504f26521ffd832624`

> 治理状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`
>
> 本 successor 只纠正 exact4 在真实安装验收中暴露的启动期 `NoNewPrivileges`/`CAP_SETUID`
> 顺序矛盾，以及安装测试脚本与 closed JSON 字符合同的矛盾。它不扩大既有 CapabilityBoundingSet 或
> AmbientCapabilities，不成为第二 authority，不授权生产部署。

## Status

Draft

## Product Definition

`412282cea743d41357709aa2ae9a18890ed4c64d` 已将 credential-separated executor exact4
落到 `ext-dev`。静态矩阵和独立审查曾通过；管理员随后把 exact4 安装到非生产 WSL 主机并运行同一冻结测试。
在修复 F: automount 启动阻塞、隔离 `/run` 与 systemd manager 只读可见性后，真实验收进入全部五项测试，返回：

`FAIL / testsRun=5 / failures=8 / errors=3 / detailsSha256=sha256:685e15300f9243d351421936e58bc2ad467c3901ce0238bfc9f0f684b6e5cc55`

唯一根因组为：

1. 非生产 acceptance orchestrator 的 frozen transient allowlist 对应 `0xe6`（`DAC_OVERRIDE`、
   `DAC_READ_SEARCH`、`KILL`、`SETGID`、`SETUID`）。systemd 255 在 unit 级 `NoNewPrivileges=yes` 下实际产生
   `CapPrm=CapEff=0x66`、`CapBnd=0xe6`，即 `CAP_SETUID` 未进入 permitted/effective；`setresgid()` 成功而
   `setresuid()` 以 `EPERM` 失败，真实 controller身份链在安全屏障前退出。exact4 service 的不同 frozen allowlist
   对应 `0xeb`（`CHOWN`、`DAC_OVERRIDE`、`FOWNER`、`KILL`、`SETGID`、`SETUID`）；同一 systemd 顺序预期
   为 `CapPrm=CapEff=0x6b`、`CapBnd=0xeb`，必须由 candidate 的可执行进程测试机械确认。
2. acceptance orchestrator 在 unit 级 `NoNewPrivileges=no` 时保留 `CapPrm=CapEff=CapBnd=0xe6`；进程在读取任何请求前自行
   `PR_SET_NO_NEW_PRIVS` 后，kernel 状态为 `NoNewPrivs=1` 且 `setresgid/setresuid` 均成功。这给出不扩大
   CapabilityBoundingSet/AmbientCapabilities、只恢复既有 bounding set 内 `CAP_SETUID` 到 permitted/effective
   并严格用于专用身份降权的安全顺序修复。service candidate 必须对 `0xeb` 做同型证明。
3. installed acceptance 把包含换行的 Python 脚本直接放入 closed JSON `args`；broker 正确返回
   `JSON_CONTROL_CHARACTER`。测试必须编码成无控制字符的单行启动器，而不是放宽 JSON 字符合同。

当前 `412282ce…` 产品提交和已安装字节保留为历史失败证据；不得静默改写或宣布 installed acceptance 通过。

## Acceptance Criteria

- [ ] approval commit 是 `412282ce…` 的直接单亲子，只含本 Task、Packet、Plan 三条 `ADD / 100644`。
- [ ] future candidate 只修改 frozen exact3：service unit、broker、broker test；不得触及 socket、authority 或第四路径。
- [ ] service unit 保持原 `CapabilityBoundingSet=0xeb`、ambient empty、network、filesystem、cgroup 与 resource
  hardening；仅把 systemd 的早置 `NoNewPrivileges` 交给 broker 启动期内核调用。允许的特权变化只是在
  fixed root supervisor 启动阶段恢复既有 bounding set 内 `CAP_SETUID/CAP_SETGID` 的 permitted/effective 位。
- [ ] broker `main()` 的所有角色都必须把 `PR_SET_NO_NEW_PRIVS` 与 `PR_GET_NO_NEW_PRIVS`/`/proc/self/status`
  双复核作为首个可执行安全动作，早于 `parse_cli()`、stdin/socket recv/peek、helper/fork/thread 创建和任何
  attacker-controlled parse，并证明启动期单线程、`CapInh=CapAmb=0`。只有 `--serve-stdio` root supervisor
  在任何 transport read 前必须再证明 `CapPrm=CapEff=CapBnd=0xeb`；ingest/snapshot/cleanup/worker helper
  必须按各自既有角色边界验证 inherited `0xeb` 或已经清零的集合，绝不把 supervisor 断言误用于 helper。
  失败立即退出且不得监听/消费请求。
- [ ] root supervisor仍无 `CAP_SYS_ADMIN`；`CAP_SETUID/CAP_SETGID` 只用于专用身份降权，child在exec前五类
  capability集合归零并保持原 kernel attestation/barrier。
- [ ] installed acceptance 脚本先按严格 UTF-8、最大 65536 bytes 编码，再用带 padding 的 RFC 4648 standard
  Base64 alphabet；decode 使用 `validate=True`，并在 compile/exec 前要求 `b64encode(decoded)` 与原 ASCII
  payload 字节相等。唯一 launcher 模板为
  `import base64;b=b'<PAYLOAD>';d=base64.b64decode(b,validate=True);base64.b64encode(d)==b or (_ for _ in ()).throw(ValueError('NON_CANONICAL_BASE64'));len(d)<=65536 or (_ for _ in ()).throw(ValueError('PAYLOAD_TOO_LARGE'));exec(compile(d.decode('utf-8','strict'),'<ctpv-installed-acceptance>','exec'))`；
  不使用 shell。原 `JSON_CONTROL_CHARACTER`、NUL 与其他控制字符负向门禁不得放宽。
- [ ] 新测试真实证明旧顺序 RED、新顺序 GREEN、多行脚本不再进入 raw JSON、篡改编码或非 canonical
  launcher fail closed。
- [ ] 静态矩阵、完整 Harness、独立 Governance/Python/Security Review 与重新安装后的 5/5 real-host
  acceptance 全绿；任一 P0–P2 或关键门失败立即 STOP。

## Delivery Constraints

- approvalCommitPaths 精确三条；candidatePaths 精确三条；第四条路径立即 STOP。
- 不修改 `scripts/product-authority.mjs`、`.harness/approvals/`、socket unit、runtime profile、readiness、P14、
  frontend 或业务运行时。
- 不放宽 capability集合、JSON控制字符拒绝、credential attestation、网络隔离、disconnect cleanup或路径合同。
- 本包是 forward-only governance repair；不存在可用的 machine runner，不得声称 product-authority GO。Owner
  必须在引用本任务 ID 与最终 canonical digest 的一条显式条件链中分别授权：approval commit、approval
  fast-forward push、exact3 实施、candidate commit、candidate fast-forward push；同一消息可合并
  列出这些 checkpoint，但遗漏的动作即未授权。远端必须先精确等于未来 approval commit，才允许 exact3 写入；
  candidate 的唯一 parent 必须精确等于该已落地 approval commit，而不只是任意单亲提交。管理员重装/验收另需在
  exact3 candidate与v7 orchestrator字节均冻结后，由Owner或管理员精确确认candidate commit/tree、v7 raw SHA、
  `0555 root:root`模式/owner和唯一命令身份；不得由前置条件链预授权未知root executable。
- repository candidate落地不等于系统安装授权；root-owned重装与real-host验收仍受独立管理员边界约束。
- 全流程只形成非生产、可回滚 Release Candidate，不部署生产。

## Affected Modules

- 模块：Product Authority credential-separated executor installed acceptance corrective successor
- 允许路径：`deploy/systemd/chaotang-product-verifier@.service`；`scripts/reference/chaotang-product-verifier-broker.py`；`scripts/reference/test_chaotang_product_verifier_broker.py`

## Technical Plan

1. 以 `412282ce… / f203716e…` 为唯一 base，冻结本三文件治理包并形成直接单亲 approval commit。
2. Owner 确认三文件 canonical/raw/bundle 身份并按 Delivery Constraints 显式授权条件链、且远端精确等于未来
   approval commit 后，在唯一隔离 candidate 工作区先增加负向测试：unit 早置 NNP 导致 `CAP_SETUID` 丢失；broker 未在读取请求前
   自置 NNP；raw 多行 args 被 closed JSON拒绝；编码脚本 round-trip、tamper与边界错误失败关闭。
3. service unit只把 `NoNewPrivileges` 改为 `no`；broker entrypoint所有角色在任何解析或可变输入之前执行
   `_prctl_no_new_privs()`并验证 `/proc/self/status`，随后仅对 `--serve-stdio` root supervisor 校验完整 `0xeb`
   启动集合，对 helper 校验各自既有 role-specific capability 集合。保留原 capability bounding set与所有其他 hardening。
4. 测试端按冻结 RFC 4648 规则将 installed script转换为严格ASCII Base64并生成唯一单行launcher，launcher本身在
   compile/exec 前执行 canonical re-encode byte equality；分类、args digest、
   request digest仍绑定最终单行字节。负测覆盖payload篡改不重算digest、只重算argsDigest、两个digest都重算但
   Base64 pad bits非canonical，以及raw multiline/NUL/control在JSON层拒绝。
5. 运行 broker单测、unit静态检查、Harness/self-test、Doctor/tests、authority回归、V2检查、diff check与三审。
   exact3 test新增的`--verify-repository-candidate`仅作candidate-owned诊断，不得形成PASS。candidate commit形成后，
   必须运行本Task冻结、从approval parent提取的独立verifier；它从detached HEAD与hash-verified raw commit object
   推导candidate/approval，机械拒绝parent不等、approval非三条ADD/100644、candidate非exact3三条M/100644、
   dirty/untracked、raw/blob/full-index diff或fixed remote漂移。独立receipt必须与diagnostic共享字段逐项相等。
6. candidate落地主线后，只有在条件链中的独立管理员授权 checkpoint 生效时才更新非生产 root-owned安装，执行同一冻结
   5 项验收。每次调用由 root-owned orchestrator 用 `getrandom(32)` 生成32 raw bytes，编码为无padding、精确43字符的
   RFC4648 base64url challenge；`challengeSha256`是raw bytes的SHA-256，run ID精确为
   `ctpv-run-sha256-<challengeSha256 hex>`。orchestrator在`/run/chaotang-product-verifier-acceptance-20260903-v7/consumed`
   创建`0700 root:root`、非symlink父目录，并用`O_EXCL|O_NOFOLLOW`创建`0600 root:root`issued record；记录绑定
   当前kernel boot ID与`CLOCK_BOOTTIME`纳秒，900秒freshness只按同一boot的该单调时钟判断。成功后以同目录
   `O_EXCL`临时文件+fsync+atomic rename写为consumed，issued/consumed记录保留到重启且任何同名均拒绝。
   challenge只传给本次 transient。closed acceptance receipt必须把从已验证installation manifest v2读取的
   `installationCandidateCommit/installationCandidateTree`与每个synthetic request graph的
   `syntheticExpectedCommit/syntheticExpectedTree`分字段记录，禁止把fixture identity冒充安装身份。顶层
   `orchestratorInvocationId`只表示acceptance transient。root peer另以`unauthenticatedProbe`绑定closed
   `protocol_error(PEER_CREDENTIAL_REJECTED)`的response digest、uid/gid与`requestExecutionObserved=false`；root orchestrator
   必须在socket激活的unit仍live时从cgroup/systemd与`systemctl show`独立记录`serviceUnitName`、`serviceInvocationId`及
   `effectiveServiceUnitDigest`，且该unit/InvocationID不得与19项authenticated执行重复；因拒绝发生在broker request前，
   `brokerServiceInstance`与`brokerReceiptDigest`必须为null。其余精确19项authenticated `serviceExecutions`逐请求绑定
   `requestDigest`、synthetic commit/tree、root orchestrator从cgroup/systemd校验的`serviceUnitName`、该unit仍live时
   `systemctl show`得到的`serviceInvocationId`、broker receipt的`brokerServiceInstance`、receipt digest、
   effective unit digest与outcome：real gate、timeout、timeout后next，再按八个ACCEPTANCE_STAGES
   声明顺序各一项disconnect和next。brokerServiceInstance必须等于serviceInvocationId；只有预期disconnect可使
   brokerServiceInstance与receipt digest为null；所有service unit与InvocationID必须唯一。
   receipt同时回绑challenge digest、run ID、installation manifest digest、四个installed
   file records、privileged/gate profile digests与effective service unit digest；orchestrator比较当前 challenge、限制
   900 秒 freshness并拒绝已消费 run ID。外层 canonical envelope绑定开始/结束时间、inner stdout digest及pre/post
   inactive/disabled状态，identity不匹配或旧 receipt 重放立即拒绝；
   无论成败停止全部相关单元并保持 disabled。

## Immutable Candidate Verifier

下列 fenced block 内 UTF-8 bytes 是 approval-controlled 独立 verifier，精确 `11514` bytes，raw SHA-256 为
`sha256:07e30251f7ee65705788c4b99a8bd500202ba35bf082607fbdcaf954f9cb2e3c`。controller 必须从 candidate 的
唯一 approval parent读取本 Task，精确提取block内容，以`O_EXCL`写入`/tmp/ctpv_exact3_candidate_verifier.mjs`
并设为`0500`，复核bytes/raw后通过Packet冻结的`/usr/bin/env -i`闭合环境执行；candidate-owned诊断输出不得单独形成PASS。
controller在exec前还必须复核Packet冻结的env/node/git/ssh、SSH identity及common Git config身份；任一漂移即STOP。

```javascript
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const [repoRoot, packetPath, expectedTaskId] = process.argv.slice(2);
if (!repoRoot || !packetPath || !expectedTaskId) throw new Error("VERIFIER_ARGS_INVALID");
const cwd = fs.realpathSync(repoRoot);
const GIT = "/usr/bin/git";
const GIT_RAW_SHA256 = "sha256:2a8c18fbf43da9f692d75474c72bea9dfd796c260b0f3dfe456376abc3bbd668";
const NODE_RAW_SHA256 = "sha256:93956de2e59480474a7b46571da1651180b1a050cdf32641ebec4ce6e478e068";
const SSH = "/usr/bin/ssh";
const SSH_RAW_SHA256 = "sha256:3b0701113d8982d71c8cc74e5a1949f03c6f71da804cf4f3507315afbf07042c";
const SSH_IDENTITY = "/home/ubuntu/.ssh/gitee_lyt_id_rsa";
const SSH_IDENTITY_RAW_SHA256 = "sha256:40014f9834f8653b2302a627583124eb31087f9b1a9264034f987b7022aae7e9";
const GITEE_HOST_KEY = "gitee.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEKxHSJ7084RmkJ4YdEi5tngynE8aZe2uEoVVsB/OvYN\n";
const COMMON_DIR = "/home/ubuntu/Projects/chaotang-os/.git";
const COMMON_CONFIG_RAW_SHA256 = "sha256:92a47d2f012d43862f0e2becca58fbae38c8d61564c47e081aad2c3c1f3eea66";
const REMOTE_URL = "git@gitee.com:msxn/chaotang-os.git";
const BASE_COMMIT = "412282cea743d41357709aa2ae9a18890ed4c64d";
const MAX_OUTPUT = 16 * 1024 * 1024;

function sha(bytes) { return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`; }
const gitStat = fs.lstatSync(GIT);
if (!gitStat.isFile() || gitStat.isSymbolicLink() || (gitStat.mode & 0o7777) !== 0o755 || sha(fs.readFileSync(GIT)) !== GIT_RAW_SHA256) throw new Error("GIT_BINARY_IDENTITY_MISMATCH");
const nodeStat = fs.lstatSync(process.execPath);
if (fs.realpathSync(process.execPath) !== "/usr/bin/node" || !nodeStat.isFile() || nodeStat.isSymbolicLink() || (nodeStat.mode & 0o7777) !== 0o755 || sha(fs.readFileSync(process.execPath)) !== NODE_RAW_SHA256) throw new Error("NODE_BINARY_IDENTITY_MISMATCH");
const sshStat = fs.lstatSync(SSH);
if (!sshStat.isFile() || sshStat.isSymbolicLink() || (sshStat.mode & 0o7777) !== 0o755 || sha(fs.readFileSync(SSH)) !== SSH_RAW_SHA256) throw new Error("SSH_BINARY_IDENTITY_MISMATCH");
const identityStat = fs.lstatSync(SSH_IDENTITY);
if (!identityStat.isFile() || identityStat.isSymbolicLink() || (identityStat.mode & 0o7777) !== 0o600 || identityStat.nlink !== 1 || identityStat.uid !== process.getuid() || sha(fs.readFileSync(SSH_IDENTITY)) !== SSH_IDENTITY_RAW_SHA256) throw new Error("SSH_IDENTITY_METADATA_MISMATCH");
const knownHostsPath = `/tmp/ctpv-gitee-known-host-${process.pid}`;
const knownHostsFd = fs.openSync(knownHostsPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
fs.writeFileSync(knownHostsFd, GITEE_HOST_KEY, { encoding: "ascii" });
fs.fsyncSync(knownHostsFd); fs.closeSync(knownHostsFd);
process.on("exit", () => { try { fs.unlinkSync(knownHostsPath); } catch {} });
const gitEnvironment = Object.freeze({
  HOME: "/nonexistent", LANG: "C", LC_ALL: "C", PATH: "/usr/bin:/bin",
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_TERMINAL_PROMPT: "0", GIT_NO_REPLACE_OBJECTS: "1", GIT_SSH_VARIANT: "ssh",
  GIT_SSH_COMMAND: `${SSH} -F /dev/null -i ${SSH_IDENTITY} -o IdentitiesOnly=yes -o UserKnownHostsFile=${knownHostsPath} -o StrictHostKeyChecking=yes -o ConnectTimeout=10 -o HostKeyAlias=gitee.com -o HostName=180.76.198.225`
});
function git(args, input = undefined, commandCwd = cwd) {
  const fixedArgs = ["--no-replace-objects", "-c", "core.pager=cat", "-c", "core.fsmonitor=false", "-c", "diff.external=", "-c", "diff.trustExitCode=false", ...args];
  const result = spawnSync(GIT, fixedArgs, { cwd: commandCwd, encoding: null, input, shell: false, env: gitEnvironment, timeout: 30000, maxBuffer: MAX_OUTPUT, killSignal: "SIGKILL" });
  if (result.status !== 0 || result.signal || result.error) {
    throw new Error(`GIT_FAILED:${args[0]}:${result.status}:${result.signal ?? ""}`);
  }
  return result.stdout;
}

function text(args, input = undefined, commandCwd = cwd) { return git(args, input, commandCwd).toString("utf8").trim(); }
function canonical(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  throw new Error("CANONICAL_VALUE_INVALID");
}
function commitObject(oid) {
  if (!/^[0-9a-f]{40}$/.test(oid)) throw new Error("COMMIT_OID_INVALID");
  const body = git(["cat-file", "commit", oid]);
  const computed = crypto.createHash("sha1").update(Buffer.from(`commit ${body.length}\0`, "ascii")).update(body).digest("hex");
  if (computed !== oid) throw new Error(`COMMIT_OBJECT_HASH_MISMATCH:${oid}`);
  const header = body.toString("utf8").split("\n\n", 1)[0].split("\n");
  const trees = header.filter((line) => line.startsWith("tree ")).map((line) => line.slice(5));
  const parents = header.filter((line) => line.startsWith("parent ")).map((line) => line.slice(7));
  if (trees.length !== 1 || parents.length !== 1 || !/^[0-9a-f]{40}$/.test(trees[0]) || !/^[0-9a-f]{40}$/.test(parents[0])) throw new Error(`NOT_DIRECT_SINGLE_PARENT:${oid}`);
  return { commit: oid, parent: parents[0], tree: trees[0] };
}
function changes(left, right) {
  const raw = text(["diff-tree", "--no-commit-id", "--name-status", "--no-renames", "-r", left, right]);
  if (!raw) return [];
  return raw.split("\n").map((line) => {
    const [status, candidatePath, extra] = line.split("\t");
    if (extra !== undefined || !/^[AM]$/.test(status) || !candidatePath) throw new Error("CHANGE_RECORD_INVALID");
    return { status, path: candidatePath };
  });
}
function same(left, right) { return canonical(left) === canonical(right); }
function treeRecord(commit, candidatePath) {
  const line = text(["ls-tree", commit, "--", candidatePath]);
  const match = /^100644 blob ([0-9a-f]{40})\t(.+)$/.exec(line);
  if (!match || match[2] !== candidatePath) throw new Error(`MODE_OR_TYPE_MISMATCH:${commit}:${candidatePath}`);
  const bytes = git(["show", `${commit}:${candidatePath}`]);
  const oid = text(["hash-object", "--stdin"], bytes);
  if (oid !== match[1]) throw new Error(`BLOB_MISMATCH:${commit}:${candidatePath}`);
  return { path: candidatePath, mode: "100644", bytes: bytes.length, rawSha256: sha(bytes), gitBlobOid: oid };
}

function stableFileSnapshot(candidatePath, expectedRawSha256, expectedMode) {
  const fd = fs.openSync(candidatePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    const metadata = (value) => ({
      dev: value.dev.toString(), ino: value.ino.toString(), mode: Number(value.mode & 0o7777n),
      uid: Number(value.uid), gid: Number(value.gid), nlink: Number(value.nlink), size: value.size.toString(),
      mtimeNs: value.mtimeNs.toString(), ctimeNs: value.ctimeNs.toString()
    });
    if (!before.isFile() || before.nlink !== 1n || Number(before.mode & 0o7777n) !== expectedMode || Number(before.uid) !== process.getuid()) throw new Error(`FILE_METADATA_MISMATCH:${candidatePath}`);
    const bytes = fs.readFileSync(fd);
    const after = fs.fstatSync(fd, { bigint: true });
    if (!same(metadata(before), metadata(after)) || BigInt(bytes.length) !== after.size) throw new Error(`FILE_CHANGED_DURING_READ:${candidatePath}`);
    if (sha(bytes) !== expectedRawSha256) throw new Error(`FILE_IDENTITY_MISMATCH:${candidatePath}`);
    return { rawSha256: sha(bytes), metadata: metadata(after) };
  } finally {
    fs.closeSync(fd);
  }
}

function metadataSnapshot() {
  const config = stableFileSnapshot(`${COMMON_DIR}/config`, COMMON_CONFIG_RAW_SHA256, 0o644);
  for (const suffix of ["info/grafts", "shallow", "objects/info/alternates"]) {
    if (fs.existsSync(`${COMMON_DIR}/${suffix}`)) throw new Error(`UNTRUSTED_GIT_METADATA:${suffix}`);
  }
  const gitDir = fs.realpathSync(text(["rev-parse", "--git-dir"]));
  if (!gitDir.startsWith(`${COMMON_DIR}/worktrees/`)) throw new Error("WORKTREE_GIT_DIR_INVALID");
  const files = ["HEAD", "index", "commondir", "gitdir"].map((name) => {
    const bytes = fs.readFileSync(`${gitDir}/${name}`);
    return { name, bytes: bytes.length, rawSha256: sha(bytes) };
  });
  return { config, gitDir, files };
}

if (fs.realpathSync(text(["rev-parse", "--show-toplevel"])) !== cwd || fs.realpathSync(text(["rev-parse", "--git-common-dir"])) !== COMMON_DIR || text(["rev-parse", "--is-inside-work-tree"]) !== "true") throw new Error("REPOSITORY_IDENTITY_MISMATCH");
const metadataBefore = metadataSnapshot();
if (text(["status", "--porcelain=v1", "-uall"]) !== "") throw new Error("WORKTREE_NOT_CLEAN");
const headRaw = fs.readFileSync(`${metadataBefore.gitDir}/HEAD`, "ascii").trim();
const candidateLine = commitObject(headRaw);
const approvalLine = commitObject(candidateLine.parent);
const approvalBytes = git(["show", `${approvalLine.commit}:${packetPath}`]);
const packet = JSON.parse(approvalBytes.toString("utf8"));
if (packet.taskId !== expectedTaskId || packet.request.baseCommit !== BASE_COMMIT || approvalLine.parent !== BASE_COMMIT) throw new Error("PACKET_IDENTITY_MISMATCH");

const approvalExpected = packet.request.approvalCommitPaths.map((candidatePath) => ({ status: "A", path: candidatePath })).sort((a, b) => a.path.localeCompare(b.path));
const candidateExpected = packet.request.candidatePaths.map((candidatePath) => ({ status: "M", path: candidatePath })).sort((a, b) => a.path.localeCompare(b.path));
const approvalObserved = changes(approvalLine.parent, approvalLine.commit).sort((a, b) => a.path.localeCompare(b.path));
const candidateObserved = changes(candidateLine.parent, candidateLine.commit).sort((a, b) => a.path.localeCompare(b.path));
if (!same(approvalObserved, approvalExpected)) throw new Error("APPROVAL_PATH_SET_MISMATCH");
if (!same(candidateObserved, candidateExpected)) throw new Error("CANDIDATE_PATH_SET_MISMATCH");
for (const approvalPath of packet.request.approvalCommitPaths) treeRecord(approvalLine.commit, approvalPath);

const remoteFields = text(["ls-remote", REMOTE_URL, "refs/heads/ext-dev"], undefined, "/").split(/\s+/);
if (remoteFields.length !== 2 || remoteFields[0] !== approvalLine.commit || remoteFields[1] !== "refs/heads/ext-dev") throw new Error("REMOTE_HEAD_MISMATCH");

const records = [];
for (const candidatePath of [...packet.request.candidatePaths].sort()) {
  records.push(treeRecord(candidateLine.commit, candidatePath));
}

const diffBytes = git(["diff", "--no-ext-diff", "--no-textconv", "--full-index", "--binary", approvalLine.commit, candidateLine.commit, "--", ...packet.request.candidatePaths]);
const metadataAfter = metadataSnapshot();
if (!same(metadataAfter, metadataBefore)) throw new Error("GIT_METADATA_CHANGED_DURING_VERIFICATION");
const receipt = {
  schemaVersion: "chaotang-exact3-independent-candidate-verification.v1",
  taskId: expectedTaskId,
  baseCommit: approvalLine.parent,
  approvalCommit: approvalLine.commit,
  candidateCommit: candidateLine.commit,
  candidateTree: candidateLine.tree,
  records,
  candidateBundleDigest: sha(Buffer.from(canonical(records), "utf8")),
  fullIndexDiffSha256: sha(diffBytes),
  liveRemoteHead: remoteFields[0],
  decision: "PASS"
};
process.stdout.write(`${canonical(receipt)}\n`);
```

## Implementation Report

本轮只冻结治理合同。已完成的诊断不修改 repository product bytes：F: 条目已备份并改为
`noauto,nofail,x-systemd.automount`；exact4安装仍保持 disabled/inactive；v6验收助手只新增只读
`/run/systemd/system`可见性且独立安全审查 `GO / P0=0 / P1=0 / P2=0`。真实 5 项验收失败证明
exact4 本身仍需 forward-only corrective candidate。

## Acceptance Review

当前结论：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`。旧 exact4 不具有 installed acceptance
通过身份。只有 exact3 静态矩阵和三审通过、候选快进落地、管理员重新安装且 frozen installed acceptance
返回精确 `5 tests / 0 failures / 0 errors` 后，credential-separated executor 才可供后续 Product Authority
executor-integration successor 消费。
