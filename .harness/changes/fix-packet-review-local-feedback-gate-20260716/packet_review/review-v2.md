# D6-L 独立复核 v2

## 绑定与范围

| 项 | 值 |
| --- | --- |
| 审查区间 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f..7cbcfcad33c3daca1135fcc2f00cdacbf860fa08` |
| reviewed HEAD | `7cbcfcad33c3daca1135fcc2f00cdacbf860fa08` |
| 分支 | `task/d6-local-review-gate` |
| 审查性质 | 独立、只读；未创建 approval envelope，未修改实现 |

审查期间工作树中出现了一份来源不明、未跟踪的 `review-v1.md`。该文件不是本 reviewer
产物，本 reviewer 未修改、删除、暂存或采信其 GO 裁决；本报告单独版本化为 v2。

## 结论

`NO_GO`。常规激活后的 `B -> H -> R -> M`、envelope 精确字段、report digest、单一末行 GO、
merge tree 等检查方向正确，多 ref stdin 解析也会保留全部更新；但下列三个确定性行为会造成
门禁绕过或误删/误阻断，必须修复并补回归测试。

## 阻塞项

### E1：pre-activation 可在首次推送中夹带任意未审提交

- 严重度：P1；置信度：10/10。
- 位置：`scripts/lib/packet-review-local-feedback.mjs:131-136`。
- 复现：临时 Git DAG 仅为线性 `B -> A(activation) -> U(unreviewed)`，`U` 没有 merge、review、
  report 或 approval。调用 `verifyPacketReviewPush(remoteSha=B, localSha=U, activationSha=A)`
  返回 `{"allowed":true,"status":"pre_activation"}`。
- 原因：pre-activation 分支只验证 `B -> activation -> candidate` 祖先关系，随后直接放行，
  不约束 candidate 必须是激活载荷本身，也不限制 activation 之后的提交。
- 影响：文档声称“激活提交之后前瞻执行”，但同一次 bootstrap push 中 activation 之后的任意
  Packet 可绕过 DAG/envelope 复核；status 也没有披露这一 bootstrap 例外。
- 修复要求：把首次激活允许的 candidate 绑定为一个可审计的精确 bootstrap SHA/树或同等严格
  形状，并增加“activation 后夹带线性提交/merge 提交必须拒绝”的测试；同步修正文档和 status。

### E2：卸载会删除同名但非本安装器管理的用户子 hook

- 严重度：P1；置信度：10/10。
- 位置：`scripts/install-packet-review-hooks.mjs:35-40`。
- 复现：在解析出的 hooks 目录预置未含 `TARGET_MARKER` 的
  `pre-push.d/chaotang-packet-review`，执行 `node scripts/install-packet-review-hooks.mjs --uninstall`。
  进程退出 0，输出“other hooks preserved”，但该用户文件从存在变为不存在。
- 原因：安装路径会检查 marker 后拒绝覆盖，卸载路径却在 `existsSync(target)` 后无条件 `rm`。
- 影响：违反“只卸载本子 hook / other hooks preserved”的实现承诺，可能直接丢失用户 hook。
- 修复要求：卸载前读取并精确确认受管 marker；unmanaged、符号链接或不可确认目标必须保留并
  fail closed。补充 unmanaged-target uninstall 回归测试。

### E3：共享 hooks 会误阻断不含 verifier 的兄弟 linked worktree

- 严重度：P1；置信度：10/10。
- 位置：`scripts/install-packet-review-hooks.mjs:81-87`；现有测试仅覆盖
  `scripts/packet-review-local-feedback.nodetest.mjs:291-305` 的安装位置。
- 复现：在含 D6 脚本的 worktree 安装到共享 `.git/hooks`，从停留在旧提交、没有
  `scripts/packet-review-pre-push.mjs` 的兄弟 worktree 执行 dispatcher，stdin 只有非目标
  `refs/heads/dev` 更新。结果退出 1，报 `MODULE_NOT_FOUND: <sibling>/scripts/packet-review-pre-push.mjs`。
- 原因：共享 subhook 每次按执行 push 的 worktree `--show-toplevel` 解析 verifier；linked
  worktree 共享 hook 目录但不共享 checkout 内容。
- 影响：文档声称支持 linked worktree，实际会让旧 task/release worktree 的非目标 push 也被
  本门误杀。
- 修复要求：让共享 hook 从稳定、可验证的位置执行，或在缺少当前版本 verifier 时对非目标 ref
  安全分流；新增“兄弟 worktree 不含脚本 + 非目标 push”端到端测试。目标 ext 更新仍须 fail closed。

## 文档与证据一致性

- `LOCAL_FEEDBACK_ONLY`、`security_boundary=false`、`required_check_verified=false` 的主声明诚实；
  `--no-verify`、本地篡改和外部 required check 缺失均有明确披露。
- 但 `.harness/wiki/packet-review-local-feedback.md:12-13,30-32` 对“激活后执行”和 linked-worktree
  支持的描述被 E1/E3 反证；安装/卸载“不覆盖或保留其他 hook”的描述被 E2 反证。
- `.harness/changes/fix-packet-review-local-feedback-gate-20260716/ci_result/ci_summary.md:42-70`
  仍保留“待填写”模板，与同文件前半部的最终验证声明不一致。修复阻塞项时应一并收口。

## 实际验证

| 命令/检查 | 结果 |
| --- | --- |
| `node --check` 三个实现入口 | PASS |
| `node --test scripts/packet-review-local-feedback.nodetest.mjs` | PASS，19/19 |
| `node scripts/packet-review-pre-push.mjs --status` | PASS，诚实输出 `LOCAL_FEEDBACK_ONLY` |
| `node scripts/harness-doctor.mjs` | PASS，0 errors / 0 warnings |
| `git diff --check d8d8a6a..7cbcfca` | PASS |
| E1 临时仓库最小复现 | FAIL：无 review/envelope 的 `B-A-U` 被放行 |
| E2 临时 hooks 最小复现 | FAIL：unmanaged 同名子 hook 被删除 |
| E3 双 worktree 最小复现 | FAIL：非目标 push 因兄弟 worktree 缺脚本退出 1 |

现有 19 项测试证明了主路径和一批拒绝路径，但没有覆盖以上三个失败条件，因此测试全绿不能消除
阻塞。修复后需重新独立复核；本报告不构成 approval envelope。

PACKET_REVIEW_NO_GO
