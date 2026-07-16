# D6-L 修复后独立复核 v6

## 绑定与范围

| 项 | 值 |
| --- | --- |
| 原始实现基线 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f` |
| v4 NO_GO commit | `d0f4c03` |
| reviewed HEAD | `05b27355c8625db5d67847890fbb55efa1241316` |
| 完整审查区间 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f..05b27355c8625db5d67847890fbb55efa1241316` |
| 审查性质 | 独立、只读；未修改实现，未创建 approval envelope |

工作树中已有来源外部、未跟踪的 `review-v1.md`、`review-v3.md` 与 `review-v5.md`。
本 reviewer 未修改、删除、暂存或采信这些文件；本报告单独版本化为 v6。

## 裁决

`NO_GO`。v4 E4 的 snapshot CLI/core symlink 误写已关闭，snapshot hardlink、额外文件和卸载
边界也能 fail closed；但 target hook 的 hardlink 仍会让重装覆盖用户文件，且当前两个
`atomicCopy` 不是 bundle 级原子替换，第二次复制失败会留下活动混合版本。

## v4 E4 复验

| 场景 | 结果 |
| --- | --- |
| snapshot CLI 替换为指向用户文件的 symlink 后重装 | exit 1；用户文件与 symlink 均保持 |
| snapshot core 替换为指向用户文件的 symlink 后重装 | exit 1；用户文件与 symlink 均保持 |
| snapshot CLI 替换为 hardlink 后重装 | exit 1；`nlink=2`；用户文件保持 |
| snapshot 顶层增加额外文件后重装 | exit 1；extra/target/asset 全部保持 |
| snapshot 顶层增加额外文件后卸载 | exit 1；在删除 target/asset 前停止，全部保持 |

正式新增的两条 symlink 用例与独立 hardlink/extra-file 临时仓库复现一致。v4 E4 判定为
`CLOSED`。

## 阻塞 E5：target hook hardlink 在重装时覆盖用户文件

- 严重度：P1；置信度：10/10。
- 位置：`scripts/install-packet-review-hooks.mjs:21-31,159-164,186-193`。
- 原因：snapshot 文件通过 `assertManagedRegularFile()` 强制 `nlink === 1`，但 dispatcher/target
  使用的 `readManagedFile()` 不检查 link count。只要 hardlink 的共享 inode 含管理 marker，
  重装末尾的 `writeFile(target, ...)` 就会原地截断该 inode。
- 最小复现：
  1. 隔离临时仓库正常安装。
  2. 把 target 内容复制到 `user-owned-hook-backup`，追加 `USER SENTINEL MUST SURVIVE`。
  3. 删除 target，再将 `user-owned-hook-backup` hardlink 到 target 路径。
  4. 重跑 installer。
- 实际结果：

```json
{"exit":0,"nlink":2,"userPreserved":false,"sentinelPreserved":false}
```

- 影响：安装器静默覆盖 hooks 目录外的用户文件，属于确定性数据破坏，不可用
  `LOCAL_FEEDBACK_ONLY` 的可绕过声明豁免。
- 修复要求：所有会被写入或删除的受管普通文件，包括 dispatcher 与 target，都必须在操作前
  `lstat` 并要求 `nlink === 1`；补 target/dispatcher hardlink 的 install/reinstall/uninstall
  回归矩阵。hardlink 不可确认时必须 fail closed。

补充验证：相同 target hardlink 直接执行 uninstall 时，当前实现只移除 target 目录项，
`user-owned-hook-backup` 内容保持。因此确定的破坏路径是重装写入，不是本次卸载的 `rm`。

## 阻塞 E6：两文件替换不是 bundle 级原子事务

- 严重度：P1；置信度：9/10。
- 位置：`scripts/install-packet-review-hooks.mjs:76-85,139-141,181-184`。
- 原因：CLI 与 core 分别 `atomicCopy`。每个单文件 rename 是原子的，但两者之间没有 staging
  bundle、commit point 或 rollback；source 也只用 `existsSync`，没有先验证为普通文件。
- 最小复现：正常安装后，把 source CLI 改为新版本，把 source core 路径改为目录，然后重装。
  第一个 `atomicCopy` 成功，第二个 `copyFile` 抛错。
- 实际结果：

```json
{"exit":1,"cliChanged":true,"corePreserved":true,"targetStillExists":true}
```

- 影响：installer 虽返回失败，活动 target 仍指向一个“新 CLI + 旧 core”的 snapshot；现有布局
  校验不验证内容版本或成对 digest，之后执行 hook 时可能误阻断或绕过。wiki 声称重装原子替换
  两个受管 JavaScript 文件，当前只做到逐文件原子。
- 修复要求：先验证两个 source 都是非 symlink、单链接普通文件，再把完整 snapshot 写入独立
  staging bundle；所有复制成功后通过单一 commit point 切换活动版本。失败必须保持旧 bundle
  字节不变。补“第二文件复制失败，两个活动文件均不变”的回归测试。

## hardlink、额外文件与卸载边界

- snapshot `.managed`、CLI、core 的 `nlink !== 1` 会被拒绝；目录 symlink 也会被拒绝。
- snapshot 顶层与 `lib/` 使用精确 entry allowlist，额外文件使 install/uninstall 在任何删除前
  exit 1。独立复现确认 extra、target、asset 均保持。
- `pre-push.d` 的其他正常 subhook 仍被保留；stdin replay 与 linked worktree 旧 checkout 用例通过。
- E5 表明 hardlink 约束没有覆盖 target/dispatcher，因此整体“不会覆盖 unmanaged hook”DoD
  尚未闭合。

## 完整差异与信任边界

- `d8d8a6a..05b2735` 共 15 个文件，范围仍在根 harness、hook/verifier、测试与独立 v2/v4
  记录，没有触碰前后端业务运行时。
- `B -> H -> R -> M`、精确 activation、envelope/report digest/terminal GO、merge tree 与多 ref
  逻辑未被本轮修改，既有正反例继续通过。
- status、README、wiki、manifest 与 CI 摘要保持 `LOCAL_FEEDBACK_ONLY`、
  `security_boundary=false`、`required_check_verified=false`；remote alias、`--no-verify`、本地
  篡改和替代客户端/机器等残余绕过面已有披露，没有伪称 `ENFORCED`。
- 文档对 snapshot 内部 symlink 的修复声明准确；对“两文件原子替换”的声明被 E6 反证。

## 实际验证

| 命令/检查 | 结果 |
| --- | --- |
| `node --check` 三个实现入口 | PASS |
| `node --test scripts/packet-review-local-feedback.nodetest.mjs` | PASS，23/23 |
| `node scripts/packet-review-pre-push.mjs --status` | PASS |
| `node scripts/harness-doctor.mjs` | PASS，0 errors / 0 warnings |
| `git diff --check d8d8a6a..05b2735` | PASS |
| CLI/core snapshot symlink 定向复验 | PASS，均 exit 1 且目标保持 |
| snapshot hardlink / extra-file / uninstall 临时仓库复验 | PASS，fail closed 且无误删 |
| E5 target hardlink 重装复现 | FAIL：exit 0 并覆盖用户 inode |
| E6 第二文件复制失败复现 | FAIL：exit 1 但活动 snapshot 已部分更新 |

修复 E5/E6 并补齐回归后，需要再次独立复核。本报告不构成 approval envelope。

PACKET_REVIEW_NO_GO
