# Root Storage Preimage Persistence Lineage Corrective Successor Plan

## Scope

本计划只冻结一次重启后仍存在的非系统预映像及其 forward-only lineage。前序临时源预映像已消失，旧 `d278975b…` 治理包继续作为历史证据，但不得复用旧 payload、freeze、bundle、installation、provenance、inventory 或 profile identity。

## Immutable baseline

- repository：`gitee.com/msxn/chaotang-os`
- branch：`ext-dev`
- base commit：`d278975b1d7e696b709b9e72440d0afe5b14baf2`
- base tree：`01e348ba6d3726dcb91fca5ef1a2240794d6ae57`
- persistent evidence root：`/home/ubuntu/chaotang-oob-preimages/root-storage-preimage-lineage-v4-20260917`
- frozen generation：`generation-v4`
- future stage name：`root-stage-installed-preimage-v4-29e50f08`
- predecessor source：`ABSENT_AFTER_REBOOT / NO_REUSE`

## Frozen identities

| identity | digest |
| --- | --- |
| payload | `sha256:ced8b81f4707d76e25d3b5792131300001895fa1149deba437eb391d2c870e14` |
| freeze | `sha256:29e50f08c71552bf550432f5075d248a337326d90e1afa092d935bb99c643b73` |
| bundle | `sha256:b8e0a17e380ed74f6ec982e7c4a0133ddd3491321ab50e62bfa4e0e986c8a827` |
| installation manifest | `sha256:9cfe145406d8867502101d8a21c11c9c950356ea40c8ddfc2a56b1a02bb77e80` |
| exact2 provenance | `sha256:67d9c0f7acbe9fd7c1890a75815b176954c37d7e15080b651519f9691dca3fdc` |
| old-installation inventory | `sha256:e87712490b0509a23f5144ef7053486b6737dfdfec1d04711b75ede010720634` |
| privileged runtime profile | `sha256:62f2614f674c93c2fec798256b4857d9e0faf4f3af1e4e378d706c73752244f2` |
| node preauthorization profile | `sha256:f5accd9bc7bfb95563f20f59fe5860c432c1dce5b35a489de9f7c73a23f871cd` |

## Rebuild and persistence contract

1. 生成器、只读 orchestrator、preimage 与 evidence summary 均位于稳定非系统目录；不依赖 `/tmp` 生存期。
2. 输出目录必须预先不存在；生成器拒绝复用或覆盖。generation-v1 失败目录和被审查拒绝的 generation-v2、generation-v3 保持不动，generation-v4 是唯一冻结成功代次。
3. profile 结构只从前序 Packet 的路径蓝图派生；每个文件字节重新从当前显式 host source 或精确 Git blob 读取。
4. host symlink 仅允许解析到 regular source；输出逐项用独占新文件写入，最终禁止 symlink、hardlink、special object、xattr、capability 与 group/world writable mode。
5. exact9 commit/tree 继续绑定 broker 与 unit；exact2 commit/tree 继续绑定 installed-acceptance test，并证明该 blob 在当前基线未漂移。
6. 旧安装 inventory 只读观察显式路径，不递归进入或读取历史 root stage。

## Payload derivation

1. 从 generation-v4 `preimage/` 根开始，不包含根自身，递归枚举目录和普通文件。
2. 目录记录为 `{path,type:"directory",mode}`；文件记录为 `{path,type:"file",mode,bytes,rawSha256}`。
3. 路径按 UTF-8 bytes 升序，拒绝绝对路径、`.`、`..`、空段、重复路径和非规范对象。
4. digest 为 `SHA-256(UTF8("chaotang-root-storage-preimage-payload-v2\0") || RFC8785(records))`。
5. 闭合结果精确为 389 records、251 files、138 directories、335,876,716 bytes。

## Future root-stage boundary

本治理包不创建 root stage。未来若另行授权，可信 executor 仍须使用已打开的 no-follow source root FD、逐段 dirfd traversal、O_EXCL destination、逐文件摘要/模式/所有权校验、完整 fsync 和 closed canonical receipt。未来 stage 必须使用唯一名称 `root-stage-installed-preimage-v4-29e50f08`，不能覆盖或复用任何旧 stage。

带执行位的 payload 仍只是字节身份。stage 创建和 READY 验证期间不得 shell、exec、spawn、import、动态加载、运行 hook、调用 service manager、broker、Node、Python、Git、bwrap 或 systemctl。

## Verification matrix

- strict UTF-8 JSON and duplicate-key rejection
- RFC 8785 Packet canonical digest
- exact 389-record payload set and domain-separated digest
- all component digest recomputation
- official broker runtime-profile and installation validators
- no symlink/hardlink/special/xattr/capability/group-world-writable object
- clean `d278975b…` detached worktree and live remote equality
- Task `productTaskErrors=[]`
- exact three governance paths, all `100644`
- full Harness and `git diff --check`
- independent Code Review and Security Review, no P0–P2

## Stop conditions

任何 remote/base、payload、component identity、source path、review conclusion、第四条治理路径或权限边界漂移立即 STOP。不写 `/etc`、`/opt`、`/var`、`/run` 或 systemd，不创建 root stage，不安装，不启动服务，不运行 authority，不提交，不推送，不部署。
