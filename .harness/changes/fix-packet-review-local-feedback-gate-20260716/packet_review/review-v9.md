# D6-L 最终独立代码复核 v9

## 绑定与范围

| 项 | 值 |
| --- | --- |
| 原始实现基线 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f` |
| reviewed HEAD | `6d4ee7ac036bfba8fcc1347ae02880dae59ac58c` |
| 完整审查区间 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f..6d4ee7ac036bfba8fcc1347ae02880dae59ac58c` |
| 分支 | `task/d6-local-review-gate` |
| 审查性质 | 独立、只读实现复核；未修改实现，未创建 approval envelope，未安装共享仓库真实 hooks |

工作树中已有来源外部、未跟踪的 `review-v1.md`、`review-v3.md`、`review-v5.md`、
`review-v7.md` 与 `review-v8-technical-memo.md`。本 reviewer 未修改、删除、暂存或采信这些文件；
本报告单独版本化为 v9。

## 裁决

`NO_GO`。v2、v4、v6 已记录的 E1–E6 在最终代码中均有对应修复，内容寻址 bundle 也确实先完整
构建并校验，再通过单文件 rename 原子切换 `current`，旧 bundle 会保留，linked worktree 与
SHA/DAG gate 的正式测试均通过。但独立临时仓库复现出两个新的确定性安装器阻塞：安装器会跟随
`pre-push.d` 目录符号链接写到 hooks 外；并且在 `current` 已切换后 target 写入失败时，命令退出 1
却留下新 bundle 活跃。这两项分别违反 symlink fail-closed 和“失败刷新保持旧状态”的验收要求。

## 既有阻塞与最终结构复验

| 项 | 最终证据 | 结果 |
| --- | --- | --- |
| E1 activation 后夹带 | `scripts/lib/packet-review-local-feedback.mjs:131-138` 仅允许精确 activation SHA | CLOSED |
| E2 unmanaged target 卸载误删 | `scripts/install-packet-review-hooks.mjs:213-221` 删除前先验证 target/assets | CLOSED |
| E3 linked worktree 依赖旧 checkout | target 从共享 asset root 的 `current` 解析 bundle；端到端用例通过 | CLOSED |
| E4 snapshot 内部 symlink 误写 | `assertManagedAssetDirectory()`/`assertManagedBundle()` 逐级 `lstat` 并校验精确布局 | CLOSED |
| E5 target hardlink 误写 | `readManagedFile()` 要求普通文件且 `nlink === 1`；回归用例通过 | CLOSED |
| E6 双文件活动版本撕裂 | CLI/core 写入同一内容寻址 staging bundle，完整校验后才 rename 入 bundles | CLOSED |
| v8 活动路径空窗 | 活跃入口固定为普通文件 `current`，以同文件系统 rename 原子替换；旧 bundle 不删除 | CLOSED |

## 阻塞 E7：`pre-push.d` 目录 symlink 被跟随并写出 hooks

- 严重度：P1；置信度：10/10。
- 位置：`scripts/install-packet-review-hooks.mjs:247,292-300`。
- 原因：安装前直接 `mkdir(pre-push.d, {recursive:true})`，但从未对 `pre-push.d` 本身执行
  `lstat` 并要求真实目录。若它是目录符号链接，后续 target rename 会解析链接目标。
- 独立复现：在新建临时 Git 仓库中，将 `.git/hooks/pre-push.d` 链接到仓库内的
  `user-owned-hooks/`，再以该临时仓库为显式 cwd 执行 installer。
- 实际结果：installer exit 0，并在 symlink 目标创建
  `user-owned-hooks/chaotang-packet-review`（374 bytes）；`pre-push.d` 仍是原符号链接。
- 影响：安装器跨出解析出的 hooks 目录写入用户目录，且后续卸载会沿同一路径移除该 subhook。
  这与 change 对 unmanaged/symlinked hook fail-closed 的数据安全承诺不一致。
- 修复要求：在任何创建、读取、写入或删除 target 前，`lstat` 验证 `pre-push.d` 为真实目录且不是
  symlink；不可确认时在任何写操作前 STOP。增加 install/reinstall/uninstall 的目录 symlink 回归。

## 阻塞 E8：post-commit 失败返回非零但新 bundle 已活跃

- 严重度：P1；置信度：10/10。
- 位置：`scripts/install-packet-review-hooks.mjs:167-176,292-300`。
- 原因：刷新先在第 174 行原子替换 `current`，之后才重写 target。target 写入是同一次 installer
  成功路径的一部分，却没有预检、回滚或将其移到 commit point 前。
- 独立复现：在新建临时 Git 仓库正常安装；记录旧 `current`；修改 source CLI 形成新 bundle；
  将 `pre-push.d` 改为不可写；再以该临时仓库为显式 cwd 重装。
- 实际结果：target rename 报 `EACCES`，installer exit 1；但 `current` 已从
  `bundle-4996d109...` 切为 `bundle-0768b955...`，旧/new pointer 比较不相等。
- 影响：调用方得到“刷新失败”，活动 verifier 状态却已改变。现有第 23 项测试只覆盖 source core
  在 commit point 前失败，不能证明 commit point 后的失败保持旧状态；CI 中“失败刷新不变”的声明
  因而过宽。
- 修复要求：让所有可能使命令失败的 target 验证/写入在切 `current` 前完成，或把 target 设计成
  安装后无需每次刷新重写的稳定入口；`current` rename 应是最后一个可失败的状态提交点。补充
  “bundle 已构建、target 激活失败”回归，断言 exit 1 时 current 与旧活动 bundle 均不变。

## SHA/DAG gate 复核

未发现新的 SHA/DAG 阻塞：

- remote/local/activation 均要求精确、非零、可解析的 40 位 commit SHA；删除、新建与未知对象 STOP。
- bootstrap 只允许 candidate 等于精确 activation；分叉 activation STOP。
- activation 后要求 fast-forward，候选必须为 first-parent 等于 remote predecessor 的双亲 no-ff merge。
- R 仅有一个实现父 H，H 必须后继 B；M tree 必须精确等于 R tree。
- R 只能新增同版本 report 与 approval；候选只能新增一个 matching root change 和一个 approval。
- approval 精确绑定 B/H/change/Packet/report path/digest；报告只允许一个 terminal verdict，且最后非空行
  必须是 `PACKET_REVIEW_GO`。

这些结论仍受已明确披露的本地信任边界限制：`--no-verify`、本地 checker/hook 篡改、其他客户端或
机器、非 `origin` alias 都可绕过；代码与文档没有把它伪称为外部强制门。

## 实际验证

| 命令 / 检查 | 结果 |
| --- | --- |
| `node --test scripts/packet-review-local-feedback.nodetest.mjs` | PASS，26/26，0 fail/skip |
| `node --check` installer/core/pre-push 三入口 | PASS |
| `node scripts/packet-review-pre-push.mjs --status` | PASS；`LOCAL_FEEDBACK_ONLY`、`security_boundary=false`、`required_check_verified=false` |
| `node scripts/harness-doctor.mjs` | PASS，0 errors / 0 warnings |
| `git diff --check d8d8a6a..6d4ee7a` | PASS |
| E7 临时仓库目录 symlink 复现 | FAIL：installer exit 0，并在 symlink 目标写入 subhook |
| E8 临时仓库 post-commit 失败复现 | FAIL：installer exit 1，但 active `current` 已改变 |

正式 26 项测试证明了 SHA/DAG 主路径、现有静态 hardlink/symlink 防护、内容寻址 bundle、旧 bundle
保留、commit point 前失败和 linked worktree；它们没有覆盖 E7/E8，因此全绿不能消除阻塞。修复后
需要新一轮独立复核；本报告不构成 approval envelope。

PACKET_REVIEW_NO_GO
