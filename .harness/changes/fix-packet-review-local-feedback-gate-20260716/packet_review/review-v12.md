# D6-L 最终独立代码复核 v12

## 绑定与范围

| 项 | 值 |
| --- | --- |
| 原始实现基线 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f` |
| v11 NO_GO commit | `74291105d89e1a3f564a911d3d7a019df5fd9a08` |
| reviewed HEAD | `f407016a6784a98b6145171869ddabceca16837e` |
| 完整审查区间 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f..f407016a6784a98b6145171869ddabceca16837e` |
| 分支 | `task/d6-local-review-gate` |
| 审查性质 | 独立、只读实现复核；未修改实现，未创建 approval envelope，未安装共享仓库真实 hooks |

工作树中已有来源外部、未跟踪的 `review-v1.md`、`review-v3.md`、`review-v5.md`、
`review-v7.md` 与 `review-v8-technical-memo.md`。本 reviewer 未修改、删除、暂存或采信这些文件；
本报告单独版本化为 v12。

## 裁决

`GO`。v11 E10 已关闭：`atomicWriteFile()` 使用 activated flag，只有 rename 失败前的路径会 await
清理临时文件；current rename 成功后同步设置 activated，finally 不再执行 I/O，调用方成功路径也
没有后续 await。v9 E7/E8、v10 E9、内容寻址 bundle、旧 bundle 保留、linked worktree、静态
hardlink/symlink 边界与 SHA/DAG gate 均复验通过。完整范围未发现新的阻塞。

## v11 E10 复验

最终 helper 控制流为：

```text
temporary = hooks/.chaotang-packet-review-file-next-<uuid>
activated = false
await writeFile(temporary)
await chmod(temporary)
await rename(temporary, current)
activated = true
finally: only when !activated, await rm(temporary)
```

代码证据：`scripts/install-packet-review-hooks.mjs:145-156`。

- rename 之前任一步骤失败：`activated === false`，临时文件按失败路径清理，旧 current 未被替换。
- rename 失败：同样进入失败清理，旧 current 保持。
- rename 成功：current 已原子激活，随后只执行同步赋值与条件判断，不再 await 或访问文件系统。
- `installManagedAssetBundle()` 在调用 atomic current 写之前完成完整 asset 校验，调用之后无其他
  await，见 `scripts/install-packet-review-hooks.mjs:177-187`。

第 14 项结构回归同时检查调用方顺序与 helper 的 activated/rename/失败清理形状。独立逐行复核与
测试结论一致，E10 为 `CLOSED`。

## E7–E9 与 installer 数据安全复验

| 场景 | 最终机制 / 测试证据 | 结果 |
| --- | --- | --- |
| E7 symlinked `pre-push.d` | 真实目录前置检查；第 19 项 exit 1 且用户目录无 target | CLOSED |
| E8 已有 managed target + 只读目录 | target 不重写；第 21 项 exit 0、target 字节不变、current 切换 | CLOSED |
| E9 commit point 后失败 | 全量 asset 校验前置，helper 成功 rename 后无 await | CLOSED |
| 完整 bundle 后才激活 | staging 写入 CLI/core、digest/layout 校验后 rename 入 bundles | PASS |
| 原子 current 与旧 bundle | 同 hooks filesystem 临时文件 rename；刷新不删除历史 bundle | PASS |
| commit point 前失败 | 第 26 项 source 失败后旧 current/CLI/core 保持 | PASS |
| target/dispatcher hardlink | 所有受管普通文件要求 `nlink === 1` | PASS |
| snapshot symlink/unmanaged entry | 逐级 lstat、精确 entry allowlist 与 bundle digest | PASS |
| linked worktree | verifier 从共享 bundle 执行，不依赖旧 checkout 含 scripts | PASS |
| `core.hooksPath`、幂等、定向卸载 | 第 16/17 项及卸载负例通过 | PASS |

29 项测试中所有 installer 子进程均只作用于测试创建的临时 Git 仓库，并显式传入该仓库 cwd；
本 reviewer 未在共享主仓库执行 installer，也未修改真实 hooks。

## SHA/DAG gate 复核

未发现新的 SHA/DAG 阻塞：

- remote/local/activation 必须为精确、非零、可解析的 40 位 commit SHA。
- bootstrap 只允许 candidate 精确等于 activation；分叉 activation、删除、新建与未知对象 STOP。
- activation 后要求 fast-forward，M 必须为 first parent 等于 B 的双亲 no-ff merge。
- R 只有实现父 H，H 后继 B，且 M tree 必须等于 R tree。
- R 只能新增同版本 report/approval；候选只允许一个 matching root change 与一个 approval。
- approval 精确绑定 B/H/change/Packet/report path/digest；报告只能有一个 terminal verdict，最后
  非空行必须为 `PACKET_REVIEW_GO`。

该结论只证明明确声明的 `LOCAL_FEEDBACK_ONLY` 本地防误操作门。`git push --no-verify`、本地
hook/checker 篡改、其他客户端或机器、非 `origin` alias 仍可绕过；status、manifest 与文档保持
`security_boundary=false`、`required_check_verified=false`，没有伪称外部 `ENFORCED`。

## 完整范围与验证

- `d8d8a6a..f407016` 共 19 个文件，范围保持在根 harness/change 文档、approval contract、
  installer/verifier/测试，没有触碰前后端业务运行时；scope clean。

| 命令 / 检查 | 结果 |
| --- | --- |
| `node --test scripts/packet-review-local-feedback.nodetest.mjs` | PASS，29/29，0 fail/skip |
| `node --check` installer/core/pre-push 三入口 | PASS |
| `node scripts/packet-review-pre-push.mjs --status` | PASS；精确 bootstrap 与诚实本地信任边界 |
| `node scripts/harness-doctor.mjs` | PASS，0 errors / 0 warnings |
| `git diff --check d8d8a6a..f407016` | PASS |
| 完整 diff 与提交范围人工复核 | PASS，无剩余阻塞或范围漂移 |

本报告是对 `f407016a6784a98b6145171869ddabceca16837e` 的版本化独立 GO 复核；它不是 approval
envelope，也不把本地 hook 升格为外部安全边界。

PACKET_REVIEW_GO
