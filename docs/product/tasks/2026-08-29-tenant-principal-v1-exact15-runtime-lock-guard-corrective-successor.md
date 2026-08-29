# TENANT-PRINCIPAL-V1-EXACT15-RUNTIME-LOCK-GUARD-CORRECTIVE-SUCCESSOR-20260829

## Status

Draft

`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

## Product Definition

这是 exact15 之前的 forward-only runtime-lock corrective successor。它基于 `origin/ext-dev@11151f1618aa2a7a216fccaa59b1764916a55ae5`（tree `77b723ce7161171e30590a6e705e0fc4e9859c66`），修复前序 exact2 独立复审发现的可信握手、进程树回收、真实插件负向证明与机器超时裕量问题。

前序任务 `TENANT-PRINCIPAL-V1-EXACT15-RUNTIME-LOCK-GUARD-PREREQUISITE-SUCCESSOR-20260829` 的 one-child authority 未产生产品 commit、未运行正式 machine candidate verify、未推送产品 child，现按 Owner 常驻 forward-only corrective successor 授权进入 `ABANDONED_BY_OWNER_UNCONSUMED / REISSUE_REQUIRED`。其 approval commit 和未提交 exact2 字节只作历史证据与 byte donor，不继承 authority、candidate、验证或通过身份。

## Acceptance Criteria

- [ ] candidate 精确修改 `backend/app/operations/runtime_lock.py` 与 `backend/tests/test_runtime_lock.py`，均为 `M/100644`，不得出现第三条路径。
- [ ] 同一个 `pytest_load_initial_conftests` trusted hook-wrapper 必须完成两次独立握手：pre-yield 在任何 candidate conftest 导入前，post-yield 在全部初始 conftest 加载后且 collection/tests 前；恶意 conftest 注销 guard、伪造任一 attestation 或抢发 ready 必须 fail-closed。
- [ ] pytest 子进程使用独立 POSIX session/process group；启动失败、握手失败、超时、异常与正常退出后的清理均不得遗留 descendant。
- [ ] distribution、available plugin、active plugin、candidate wheel、Git commit/tree、source-root 与 attestation inode/FD 绑定继续 fail-closed。
- [ ] 新增真实外部 module/plugin object、source-root 子路径、恶意 conftest、same-UID attestation replacement、child→grandchild 超时回收负向测试。
- [ ] 完整 backend inventory 精确来自 candidate commit tree 中 mode `100644`、匹配 `backend/tests/test_*.py` 的 139 条顶层 POSIX 路径；`paths=sorted(paths)`，`shard_i=paths[i::3]`，固定 `count=3`、`index=0..2`，每次调用都重算三片并断言 multiset union 的 `missing=0 / duplicate=0 / unexpected=0`。
- [ ] file inventory preimage 为按 path 排序的 `{path,mode:"100644",blob}` JSON array；nodeid preimage 为 pytest collection 顺序的 string JSON array；均使用 RFC 8785 canonical UTF-8 bytes 的 SHA-256。每个 shard 输出 full inventory count/digest、shard file count/digest、collected nodeid count/digest、terminal nodeid count/digest及固定键 `{passed,skipped,xfailed,xpassed,failed,error}` 的 outcome counts。
- [ ] terminal outcome 在 `pytest_runtest_logfinish` 后按 collection 顺序归并，每个 nodeid 只出现一次，优先级固定为 `error(setup/teardown failed) > failed(call failed) > xpassed > xfailed > skipped > passed`；未知、缺失或重复 terminal state 必须 STOP。
- [ ] 每个 shard 先用相同冻结 conftest 完成全量 collect-only，再运行自己的 file shard；实际 collected nodeids 必须精确等于全量 collection 中归属该 shard 文件的 nodeids，terminal nodeids 必须与 collected nodeids 一一闭合。三 shard 合集证明 nodeid `missing=0 / duplicate=0 / unexpected=0`。
- [ ] Owner 明确批准本 successor 使用三个串行 machine shard entry 的新拓扑；每个 entry 内含独立 targeted、full collect-only、backend shard pytest 子进程及 Ruff。`backend/tests/conftest.py` 必须仍为唯一 conftest，raw `sha256:958ba53433b0c8994f3dc8254bc3953c8c3fd0b130d372f4f40f6246cbaebd15`，不得含 session-scoped fixture 或 collection/deselection mutator。另运行一次不受 machine 单项上限影响的单进程 backend-full diagnostic 作 parity evidence。
- [ ] 每个 shard 都从相同 candidate commit/tree 独立构建 wheel、离线安装闭包、运行 targeted runtime-lock、全量 collect-only、其 backend shard 与 exact2 Ruff；targeted 对 `test_runtime_lock.py` 的重复是有意的额外验证，不计入 shard duplicate。
- [ ] 每个 shard 命令固定 `--deadline-seconds 240`，内部全流程 deadline 覆盖构建、安装、targeted、collect-only、backend shard、Ruff和所有子进程；必须在外层 `300000ms` 前至少保留 60 秒清理余量。
- [ ] 三个 shard、Harness、doctor、authority regression、V2、diff-check 与独立 Python/Security/Code Review 全部通过后，才允许形成 candidate commit；machine verify PASS 后才允许普通 fast-forward push。

## Delivery Constraints

- 只允许一个 exact2 产品字节写入者；审查者只读。
- 不修改 product-authority、approval schema、Harness、lock、wheelhouse、pyproject、依赖、tenant principal API、数据库或业务合同。
- 不删除、跳过或放宽测试；仅允许上述 Owner 明确批准且机械冻结的三 session shard 拓扑。
- 仅使用进程级 `TMPDIR=/tmp TEMP=/tmp TMP=/tmp`；不得持久修改系统、用户、Git、Python、pytest 或 Node 配置。解释器使用 `-I`，不得把任何会被 isolated mode 忽略的 Python 环境变量当作确定性证据；确定性只来自显式排序与 canonical preimage。
- 任一 P0–P2、远端漂移、第三条 product path、machine STOP、验证失败或需扩大范围立即 STOP。
- 禁止 force-push、merge、rebase、fetch、pull、Pilot、Release、发布或部署。

## Affected Modules

- 模块：Backend runtime-lock candidate verifier 与其独立安全回归。
- 允许路径：`backend/app/operations/runtime_lock.py`、`backend/tests/test_runtime_lock.py`。

## Technical Plan

1. 从最新 approval commit 创建唯一隔离 candidate 工作区，先 byte-for-byte 重物化前序 exact2 donor 字节，不继承其身份。
2. 先增加恶意 conftest 抢占两阶段 ready/attestation、外部 plugin 真实加载、Popen 启动失败 FD、child→grandchild no-ready/post-ACK timeout、内部 deadline、shard file/nodeid 缺失/重复/越界的真实 RED。
3. 用 `pytest_load_initial_conftests` try-first hook-wrapper：pre-yield 写第一份 O_EXCL attestation并完成 parent持FD/ACK；post-yield 由同一已捕获 hook continuation 核对 guard仍注册、冻结 conftest和完整 active plugin，再写第二份独立 O_EXCL attestation并完成第二次parent持FD/ACK。两份 phase/path/FD/inode/bytes 任一缺失、重复或漂移均 STOP；不得把第二信任点推迟到可被注销的 `pytest_sessionstart`。
4. 所有 verifier 子进程均用 `start_new_session=True` 并记录 pgid；240秒全流程 deadline、SIGTERM、异常、握手失败和正常 leader 退出路径均关闭pipe FD，先 TERM group、有界 grace，再 KILL group、有界 wait，最后确认无存活 descendant后才清理 temp root；Popen 构造失败也必须关闭全部已建FD。
5. 按冻结 preimage/算法实现 file inventory、全量 collect-only、3-way path shard与实际 nodeid/outcome attestation，证明三 shard file及nodeid均 `missing=0 / duplicate=0 / unexpected=0`。
6. 在 `/tmp` 隔离临时 Git 仓创建 diagnostic direct child，完成一次单进程 backend-full parity gate，并执行两轮冷启动 shard 0/1/2；每片两轮最大 wall time必须 `<=240s`。
7. 完成根级矩阵与独立三审；冻结 exact2 raw/blob/mode/bytes、bundle、full-index diff 与 verification evidence。
8. 仅在 machine authority/verify 全部 PASS 后创建并推送一个普通 fast-forward product child；随后 exact15 必须基于届时最新 ext-dev 重新签发 successor。

## Implementation Report

前序 exact2 donor 工作区保持未提交，当前观测身份仅作被拒绝证据：

- `backend/app/operations/runtime_lock.py`: raw `sha256:82555e9b812b431813e9409052a7a91ec1857dd943bb17773e9fc709acdde124`，blob `fdde3cf2612c0a82cde299572ebfc1f03cfa7463`，`100644`，`76039` bytes。
- `backend/tests/test_runtime_lock.py`: raw `sha256:d741e22b0cf93cec0f17c6f7b06a11bada5d07a9254232b86a96fde58e0fe96a`，blob `0caed4a66b30397172d2c50c522a3e65f2d4304f`，`100644`，`25938` bytes。
- donor combined full-index diff：`sha256:65f73f17de2bf826658332164250cedaab268764aabdd04048ecf08a02b7553b`。
- 隔离 self-hosted 正向证据：targeted `27 passed / 1 skipped`，backend-full `4344 passed / 5 skipped / 2 warnings in 239.85s`，Ruff PASS，总耗时约 `266s`。
- 独立复审结论：`STOP / NO_GO_BY_INDEPENDENT_REVIEW`；阻断为 pre-conftest handshake、descendant cleanup、真实 plugin 负向与 300 秒余量。

以上摘要不得作为新 candidate、验证或通过身份；新 successor 必须重物化、重新 RED/GREEN、重新全矩阵和重新三审。

## Acceptance Review

当前仅为非授权治理草案。只有三文件治理包冻结、approval commit 普通快进落地、machine authority GO、exact2 新 candidate 完整验收、machine verify PASS 后，才可普通快进推送 candidate。任何旧 exact14、旧 exact15、前序 exact2 authority 或 donor evidence 均不得恢复、消费、继承或 re-anchor。
