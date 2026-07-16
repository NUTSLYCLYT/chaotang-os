# D6-L 修复后独立复核 v4

## 绑定与范围

| 项 | 值 |
| --- | --- |
| 原始实现基线 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f` |
| v2 NO_GO commit | `d3464cc` |
| reviewed HEAD | `c695e4008008952fc9823744c9aa67bf8ad78041` |
| 完整审查区间 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f..c695e4008008952fc9823744c9aa67bf8ad78041` |
| 审查性质 | 独立、只读；未修改实现，未创建 approval envelope |

工作树中已有来源外部、未跟踪的 `review-v1.md` 与 `review-v3.md`。本 reviewer 未修改、
删除、暂存或采信这两个文件；本报告单独版本化为 v4。

## 裁决

`NO_GO`。v2 的 E1/E2/E3 均已按原复现路径关闭，正式测试和根级验证也通过；但固定红队的
“误删/误写面”发现一个新的确定性 P1：重装会跟随受管 snapshot 内部的符号链接并覆盖用户文件。

## v2 阻塞复验

| 原阻塞 | 修复证据 | 独立结果 |
| --- | --- | --- |
| E1 pre-activation 夹带 | `scripts/lib/packet-review-local-feedback.mjs:131-138` 只允许 `candidate === activation`；线性 `B -> A -> U` 复现现在抛出 `pre-activation target update must end at the exact activation commit` | CLOSED |
| E2 uninstall 删除 unmanaged 同名 hook | `scripts/install-packet-review-hooks.mjs:76-85` 在任何删除前验证 target 与 asset marker；原 unmanaged target 复现退出 1 且字节保持不变 | CLOSED |
| E3 兄弟 linked worktree 缺 verifier 误伤 | `scripts/install-packet-review-hooks.mjs:142-152` 使用共享 snapshot；从不含 scripts 的旧兄弟 worktree 推送非目标 ref 退出 0 | CLOSED |

针对三项用例单独执行：

```text
node --test --test-name-pattern='pre-activation allows only|uninstall refuses|installed hook does not depend' scripts/packet-review-local-feedback.nodetest.mjs
3 passed / 0 failed
```

## 新阻塞 E4：snapshot 内部符号链接导致重装覆盖用户文件

- 严重度：P1；置信度：10/10。
- 位置：`scripts/install-packet-review-hooks.mjs:34-45,120-145`。
- 原因：`assertManagedAssetDirectory()` 只用 `lstat` 校验 snapshot 顶层目录和 `.managed`，没有
  校验固定目标 `packet-review-pre-push.mjs`、`lib/`、`lib/packet-review-local-feedback.mjs`。
  随后的 `copyFile()` 会跟随目标符号链接。
- 最小复现：
  1. 在隔离临时仓库正常安装一次。
  2. 将共享 snapshot 的 `packet-review-pre-push.mjs` 替换为指向 `user-owned.txt` 的符号链接；
     `user-owned.txt` 初始内容为 `USER DATA MUST SURVIVE`。
  3. 再次运行 installer。
- 实际结果：第二次安装退出 0；snapshot CLI 仍是符号链接；`user-owned.txt` 被静默截断并改写为
  verifier CLI 源码。实测摘要：

```json
{"secondInstall":0,"snapshotCliStillSymlink":true,"victimPreserved":false,"victimPrefix":"#!/usr/bin/env node\nimpo"}
```

- 影响：这不是单纯的本地门可绕过问题，而是安装器对 hooks 目录外任意可写用户文件的数据破坏；
  同时直接反驳 `.harness/wiki/packet-review-local-feedback.md:34-36` 和 change summary 中
  “拒绝 symlinked verifier snapshot / 不覆盖 unmanaged 文件”的声明。
- 修复要求：在写入前用 `lstat` 逐级验证 assetDir、`lib/` 和两个固定目标均为预期的真实
  目录/普通文件且不是符号链接；对已存在但不可确认的内部项 fail closed。补充 CLI 与 lib 两条
  内部 symlink 回归测试。采用临时目录加原子替换可同时减少两文件版本撕裂窗口。

## 固定红队三问

### 1. 绕过面

- E1 bootstrap 夹带已关闭；正常激活后仍严格验证 `B -> H -> R -> M`、review-only diff、merge
  tree、唯一 approval/change、report digest 与末行 GO。
- `remoteName !== origin` 即使 remote ref 仍是 ext，也返回 `not_target`；实测 remote alias 为
  `{"allowed":true,"status":"not_target"}`。这与“只拦 origin/ext”的明示范围一致，但仍是
  本地反馈门的残余绕过面。
- `--no-verify`、本地 hook/checker 篡改、替代客户端/机器仍可绕过；status、README、wiki 和
  manifest 均明确 `LOCAL_FEEDBACK_ONLY`、`security_boundary=false`、
  `required_check_verified=false`，没有伪称 `ENFORCED`。

### 2. 误删/误写面

- unmanaged 同名 target 的卸载误删已关闭，dispatcher/target 顶层 symlink 也会被
  `readManagedFile()` 拒绝。
- E4 表明 snapshot 内部 symlink 仍可把重装写操作导向用户文件，当前不满足安全安装/卸载 DoD。

### 3. 误伤面

- 多 ref stdin 全量解析，任一目标 ext 更新失败会阻断整次 push；非目标 ref 保持 `not_target`。
- E3 的旧兄弟 worktree 非目标 push 已恢复为退出 0，共享 snapshot 不再依赖该 checkout 含脚本。
- target 删除、新建、未知 SHA、非 fast-forward 与分叉 activation 均 fail closed，符合规格。

## 完整差异与文档一致性

- `d8d8a6a..c695e40` 共 14 个文件，范围保持在根 harness、hook/verifier 脚本、测试与独立 v2
  记录，没有触碰前后端业务运行时。
- approval schema、运行时手工 shape 校验、manifest、verification matrix 与 status 的核心字段一致。
- CI 摘要中的模板占位已收口，当前诚实标记为 `VERIFIED_PARTIAL`，等待修复后独立 GO。
- 除 E4 的 symlink snapshot 声明外，文档与实际边界一致。

## 实际验证

| 命令/检查 | 结果 |
| --- | --- |
| `node --check` 三个实现入口 | PASS |
| `node --test scripts/packet-review-local-feedback.nodetest.mjs` | PASS，21/21 |
| E1/E2/E3 targeted Node tests | PASS，3/3 |
| `node scripts/packet-review-pre-push.mjs --status` | PASS，含精确 bootstrap 与诚实信任边界 |
| `node scripts/harness-doctor.mjs` | PASS，0 errors / 0 warnings |
| `git diff --check d8d8a6a..c695e40` | PASS |
| E4 隔离临时仓库 symlink 重装复现 | FAIL：installer 退出 0 并覆盖用户文件 |

修复 E4 并补齐内部 snapshot symlink 回归后，需要再次独立复核。本报告不构成 approval envelope。

PACKET_REVIEW_NO_GO
