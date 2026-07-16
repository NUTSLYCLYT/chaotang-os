# D6-L 修复后独立代码复核 v11

## 绑定与范围

| 项 | 值 |
| --- | --- |
| 原始实现基线 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f` |
| v10 NO_GO commit | `404a9959f8c01d6ccc47da8cc71e225e3f74bcc5` |
| reviewed HEAD | `9293193205810335cbfcb9ef79327cad3563a8f6` |
| 完整审查区间 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f..9293193205810335cbfcb9ef79327cad3563a8f6` |
| 分支 | `task/d6-local-review-gate` |
| 审查性质 | 独立、只读实现复核；未修改实现，未创建 approval envelope，未安装共享仓库真实 hooks |

工作树中已有来源外部、未跟踪的 `review-v1.md`、`review-v3.md`、`review-v5.md`、
`review-v7.md` 与 `review-v8-technical-memo.md`。本 reviewer 未修改、删除、暂存或采信这些文件；
本报告单独版本化为 v11。

## 裁决

`NO_GO`。v10 E9 的外层全量校验已移动到 `current` 激活之前，v9 E7/E8 回归和全部正式验证也
继续通过；但实际执行原子 current 写入的 helper 在 rename 成功后仍于 `finally` 中执行一次
`await rm(...)`。因此真实 filesystem commit 后仍有 await/可失败步骤，本轮新增结构测试只扫描
调用方函数，没有展开 helper，错误地产生 GREEN。明确验收“current 原子写后无其他 await/可失败
步骤”仍未满足。

## v10 E9 复验

`scripts/install-packet-review-hooks.mjs:175-184` 现在先完成：

1. 创建并校验完整内容寻址 bundle；
2. `await assertManagedAssetDirectory(assetDir)` 全量校验现有 asset root 与新 bundle；
3. 最后调用 `atomicWriteFile(...current...)`。

`installManagedAssetBundle()` 调用点之后确实没有其他 await，v10 指出的外层 post-current 全量校验
已关闭。但 helper 的真实顺序是：

```text
scripts/install-packet-review-hooks.mjs:148  await writeFile(temporary, ...)
scripts/install-packet-review-hooks.mjs:149  await chmod(temporary, ...)
scripts/install-packet-review-hooks.mjs:150  await rename(temporary, destination)  # current 已激活
scripts/install-packet-review-hooks.mjs:152  await rm(temporary, {force:true})     # 激活后仍可失败
```

所以 E9 只能判定为 `PARTIAL`，不能关闭。

## 阻塞 E10：结构测试没有跨 helper 验证 commit point

- 严重度：P1；置信度：10/10。
- 位置：`scripts/install-packet-review-hooks.mjs:145-153`；
  `scripts/packet-review-local-feedback.nodetest.mjs:263-275`。
- 原因：`atomicWriteFile()` 的 `finally` 无条件在 rename 后 await 清理临时路径。若该清理出现
  I/O/权限/并发路径错误，installer 可非零退出而新 current 已活跃。
- 测试缺口：新增测试只截取 `installManagedAssetBundle()`，并从 helper 调用文本之后搜索 `await`；
  它没有检查 `atomicWriteFile()` 内 rename 后的控制流，因此无法证明测试名声称的
  “current activation is the final fallible step”。
- 影响：与 v10 相同，调用方可收到失败状态，但活动 verifier 已改变；CI/wiki 的“final fallible
  commit step”仍比代码事实更强。
- 修复要求：给 `atomicWriteFile()` 增加 activated/moved 标志，只在 rename 未成功时 await 清理；
  rename 成功后不得再执行任何 await 或可抛错操作。结构回归必须直接检查 helper，证明 current
  rename 后无 await，而不只检查调用方。

## v9 E7/E8 回归

| 场景 | 证据 | 结果 |
| --- | --- | --- |
| symlinked `pre-push.d` | 第 19 项测试：installer exit 1，用户目录无 target | CLOSED |
| 内容寻址刷新与旧 bundle 保留 | 第 20 项测试：新 current、新 bundle 完整、旧 bundle 字节保持 | CLOSED |
| 已有 managed target + 只读 `pre-push.d` | 第 21 项测试：刷新 exit 0、target 字节不变、current 切换 | CLOSED |
| commit point 前 source 失败 | 第 26 项测试：exit 1、旧 current/CLI/core 保持 | CLOSED |

所有测试中的 installer 都只运行在测试创建的临时 Git 仓库，并显式传入该仓库 cwd；未执行或修改
共享主仓库真实 hooks。

## 整体范围与 SHA/DAG gate

- `d8d8a6a..9293193` 共 18 个文件，范围保持在根 harness/change 文档、approval contract、
  installer/verifier/测试，没有触碰前后端业务运行时；scope clean。
- SHA/DAG 核心本轮未修改。精确 40 位 SHA、exact activation、fast-forward、`B→H→R→M`、
  M/R tree 相等、review-only additions、唯一 approval/change、report digest 与唯一末行 GO 的实现
  和正反例继续成立，未发现新的 gate 阻塞。
- `LOCAL_FEEDBACK_ONLY`、`security_boundary=false`、`required_check_verified=false` 与已知本地
  绕过边界仍诚实披露，没有伪称 `ENFORCED`。

## 实际验证

| 命令 / 检查 | 结果 |
| --- | --- |
| `node --test scripts/packet-review-local-feedback.nodetest.mjs` | PASS，29/29，0 fail/skip |
| `node --check` installer/core/pre-push 三入口 | PASS |
| `node scripts/packet-review-pre-push.mjs --status` | PASS；精确 bootstrap 与诚实本地信任边界 |
| `node scripts/harness-doctor.mjs` | PASS，0 errors / 0 warnings |
| `git diff --check d8d8a6a..9293193` | PASS |
| helper 级 commit-point 控制流检查 | FAIL：current rename 后仍有 `await rm` |

正式 29 项测试未覆盖 helper 内 rename 后的 await，因此全绿不能消除 E10。修复并补 helper 级结构
回归后需要新一轮独立复核；本报告不构成 approval envelope。

PACKET_REVIEW_NO_GO
