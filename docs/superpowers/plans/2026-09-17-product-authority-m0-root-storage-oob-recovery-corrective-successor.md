# Root Storage / OOB Recovery Corrective Successor Plan

## Scope

本计划把旧 packet/receipt-only stage 合同替换为完整、闭合、可复算的 preimage stage 合同，但不执行任何 root 或系统动作。现有历史 stage 必须保持不动；未来新 stage 必须使用唯一新名称并逐条满足 Packet 的 392-record payload。

## Immutable baseline

- repository：`gitee.com/msxn/chaotang-os`
- branch：`ext-dev`
- base commit：`a26b76723f516e5b2b679cea1e6486febccee466`
- base tree：`6c1924520ffa59c93136676bbbdc2486b4f086f6`
- root parent：`/var/lib/chaotang-product-verifier`，`root:root 0555`，ext4，dev `2096`，inode `4787912`
- historical stage：`root-stage-oob-recovery-v1`，只读观察为 `root:root 0700`，dev `2096`，inode `5935054`
- new stage：`root-stage-installed-preimage-v3-a548edd3`

## Frozen identities

| identity | digest |
| --- | --- |
| freeze | `sha256:a548edd3d0b1daf211ef1539e570c0d7d28e3bba2b258a71bf04a34a71fc8fad` |
| bundle | `sha256:ee0f581be575ccd352c918f52503590e6fe6e026342c4574e28a11766073e0e5` |
| installation manifest | `sha256:9cbc52ecff9440cf41b7f45c73c68064e2c6ceaa76a9bfeddaf807b8ff928e31` |
| exact2 provenance | `sha256:84e671374c559057ece0a6909908805edd54bbeabdd66f575b7b2969c2bf94a2` |
| old-installation backup inventory | `sha256:74ff3fad4c9b6893299ff77e0db2debfce9d9be19abcf71196cedc60d0c006e2` |
| privileged runtime profile | `sha256:17435c3683a868dfc5da4aeb7716ce3bd44253a4ee443a82d0d490a0863a5df0` |
| gate runtime profile | `sha256:c073e229ae5c313cc4bb3b0a06ba895807b39702adefb9ef8706fa71917eb193` |
| source attestation raw | `sha256:fdc2160704ea4a1e07fa9c9cccd129867c7b419479c5e0f149fb40e38b632ffd` |
| complete 392-record payload | `sha256:860b2debf95afaef097670ca3b2da087bc66add75c89f94675553eaa08ac6f96` |

## Payload derivation

1. 从冻结 preimage 根开始，不包含根自身，递归枚举每个目录和普通文件。
2. 路径必须为 UTF-8 相对路径；拒绝绝对路径、空段、`.`、`..`、NUL、反斜杠、重复路径和非规范路径。
3. 目录记录为 `{path,type:"directory",mode}`；文件记录为 `{path,type:"file",mode,bytes,rawSha256}`。
4. 记录按 path UTF-8 字节序升序组成 JSON array。
5. payload digest 为 `SHA-256(UTF8("chaotang-product-verifier-root-stage-payload-v1\\0") || RFC8785(records))`。
6. 期望结果必须精确为 392 records、253 files、139 directories、335,965,043 file bytes 和 Packet 冻结 digest。

## Future source contract

未来 root executor 只能接收一个已经打开、`O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC` 的 source root FD。所有子路径必须使用相对 dirfd 逐段打开；不得重新解析来源绝对路径。每个来源对象必须与 Packet 类型、模式、字节数和摘要一致；拒绝 symlink、hardlink、special object、xattr、额外路径及 group/world-writable 对象。

来源目录是非可信输入。验证通过只允许复制已绑定字节，不授予任何 payload 执行权。所有 payload，包括带 `0555` 位的 broker、Node、Python、Git、bwrap、systemctl、脚本、共享对象与 pyc，只能作为冻结数据复制。stage 创建和 READY 复核期间禁止对 payload 使用 shell、`exec*`、spawn、subprocess、解释器 import/compile/eval/exec、动态 loader/plugin、Git hook、package lifecycle、service manager 或 runtime-profile 调用；任一尝试均 STOP。executable mode 只保存身份，不构成授权。

## Future destination contract

1. 逐段 no-follow 打开并复核 root parent 的 path、type、uid/gid、mode、dev、inode 与 ext4 identity。
2. 以 `mkdirat` 独占创建新 stage；目标已存在即 STOP，不读取、不进入、不清理、不复用。
3. 在私有 stage 内先以安全可写模式创建目录；文件用 `openat(O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC)` 创建，并在同一 FD 上写入、摘要、`fsync`、`fchown`、`fchmod`、`fstat`。
4. 按冻结顺序复制文件；完成后自底向上设置目录精确模式并 fsync 所有修改过的目录。
5. 通过 stage FD 使用 `openat(O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC)` 创建 root-owned `0400 root-stage-receipt.json`。receipt 最大 8 KiB，严格拒绝重复键和额外字段，raw UTF-8 必须逐字节等于 RFC 8785 canonical bytes 且无尾随 LF；闭合字段精确绑定 Owner 确认的 Packet canonical digest、stage/root-parent fstat identity、payload counts/digest 与全部 frozen identities。
6. receipt 写入后先 `fsync(receipt FD)`，再依次执行 `fchown root:root`、`fchmod 0400`、`fstat`，随后必须再次 `fsync(receipt FD)` 以持久化安全关键元数据，并 `fsync(stage directory FD)`；任一步失败均在 READY 前 STOP。之后 no-follow 重开 receipt，复核 regular/nlink=1/root:root/0400/size、严格闭合 schema、canonical raw bytes 与 `sha256(raw)`；从 root-parent FD 重开新 stage，在不执行任何 payload 的前提下复核完整闭合集合、所有权、模式、字节和摘要后，才可输出 `ROOT_OWNED_STAGE_READY sha256:<receipt canonical raw SHA-256>`。

## Failure and rollback contract

- 未成功创建 stage 前不得产生系统副作用。
- 只有本次调用成功创建并记录 inode 的 stage 才允许失败清理；既存目标永远不清理。
- 清理前必须逐对象复核 inode/type，按 Packet 冻结路径逆序删除，拒绝 wildcard、路径拼接和跨目录跟随。
- cleanup 失败、receipt 写入失败、最终复核失败或 fsync 失败均不得输出 READY；保留失败证据并 STOP。
- 本治理阶段没有 rollback 动作，因为不写系统路径。未来 root-stage rollback 只允许清理同一失败调用创建且尚未 READY 的新 stage；READY stage 的删除需要另一项精确授权。

## Draft verification matrix

- strict UTF-8 JSON and duplicate-key rejection
- closed top-level and nested field contracts
- RFC 8785 Packet canonical digest
- exact 392-record path/type/mode/bytes/raw-SHA set
- payload domain separator, ordering, count and digest recomputation
- all freeze/bundle/installation/provenance/backup/profile identities
- historical stage preserve/no-delete/no-overwrite/no-reuse disposition
- unique new stage name and root-parent identity
- no-follow source/destination traversal, O_EXCL creation, ownership, fsync and receipt contract
- closed receipt fields/types, 8 KiB limit, canonical raw bytes, SHA-256, owner/mode/nlink/size and post-write re-read
- copy-only payload policy; no exec/spawn/import/load/hook/service/profile invocation despite executable mode bits
- failure cleanup scope and no false READY path
- Task `productTaskErrors=[]`
- exact three governance paths, all `100644`
- full Harness and `git diff --check`
- independent Code Review and Security Review with no P0–P2

## Stop conditions

任何 remote/base、root-parent、历史 stage、frozen identity、payload record/digest、路径集合、审查结论或授权边界漂移均立即 STOP。本轮明确不创建 root stage、不写系统路径、不安装、不启动服务、不运行 authority、不提交、不推送、不部署。
