# D6-L 修复后独立代码复核 v10

## 绑定与范围

| 项 | 值 |
| --- | --- |
| 原始实现基线 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f` |
| v9 NO_GO commit | `218b70029fc61fb9ef3838a8b9b7ea1f096609a8` |
| reviewed HEAD | `cf41f55986a6b4c55d3c096dcf66d53d5b52932c` |
| 完整审查区间 | `d8d8a6ae23d013bede6b1db649b06eb5ed38ea1f..cf41f55986a6b4c55d3c096dcf66d53d5b52932c` |
| 分支 | `task/d6-local-review-gate` |
| 审查性质 | 独立、只读实现复核；未修改实现，未创建 approval envelope，未安装共享仓库真实 hooks |

工作树中已有来源外部、未跟踪的 `review-v1.md`、`review-v3.md`、`review-v5.md`、
`review-v7.md` 与 `review-v8-technical-memo.md`。本 reviewer 未修改、删除、暂存或采信这些文件；
本报告单独版本化为 v10。

## 裁决

`NO_GO`。v9 E7 已关闭，symlinked `pre-push.d` 会在任何 target 写入前 fail closed；v9 E8 的
具体 target 后置重写路径也已关闭，已有 managed target 在只读 `pre-push.d` 下可保持字节不变并
成功切换完整新 bundle。但刷新代码在原子替换 `current` 后仍执行一次可能抛错的全量 asset 校验，
所以 `current` 不是最后一个可能失败的步骤，installer 仍可 exit 1 而旧 current 已丢失。这违反
本轮明确验收“任何非零刷新应保持旧 current”，也反驳 CI/wiki 对 final commit step 的声明。

## v9 E7/E8 定向复验

### E7：symlinked `pre-push.d` 越界写

独立临时 Git 仓库复现结果：

```text
STATUS=1
TARGET_EXISTS=no
PARENT_IS_SYMLINK=yes
[packet-review-hooks] pre-push.d is not a real directory; it was not used. STOP.
```

`scripts/install-packet-review-hooks.mjs:258-270` 先要求 hooks 与 `pre-push.d` 都是真实目录；
symlink 仍原样保留，用户目录未新增 target。E7 为 `CLOSED`。

### E8：已有 managed target 的只读目录刷新

在另一新建临时 Git 仓库正常初装后，记录 target/current，修改 source CLI，将 `pre-push.d`
设为 `0555`，再以该临时仓库为显式 cwd 刷新：

```text
STATUS=0
OLD=bundle-4996d109e6b51cf9d16a90e10e0dfea5831a9da13fe0a6c3462db75d22064bc2
NEW=bundle-255d6348b35b8d57c03162bb5c580185b792b13f7c749622d79d77e9f93cad61
TARGET_SAME=0
CLI_COMPLETE=0
CORE_COMPLETE=0
OLD_RETAINED=yes
```

`scripts/install-packet-review-hooks.mjs:285-325` 只在 target 不存在时写入；已有 managed target
不重写。新 bundle 的 CLI/core 与两个 source 逐字节相同，旧 bundle 保留。v9 E8 的原具体路径
为 `CLOSED`。

## 新阻塞 E9：`current` 后仍有可失败校验

- 严重度：P1；置信度：10/10。
- 位置：`scripts/install-packet-review-hooks.mjs:175-184`。
- 原因：第 182 行完成 `current` 的原子 rename 后，第 184 行仍调用
  `assertManagedAssetDirectory(assetDir)`。该调用包含 `lstat`、`readdir`、`readFile`、完整 bundle
  layout/digest 校验，均可抛错；因此文档所称“`current` as its final commit step”在控制流上不成立。
- 独立故障注入：临时仓库 watcher 在观察到 `current` rename 后，向 `bundles/` 加入一个
  unmanaged entry，使第 184 行的正式校验确定性失败。installer 与 watcher 均以该临时仓库为
  显式 cwd；未触碰共享真实 hooks。
- 实际结果：

```text
INSTALLER_STATUS=1
BEFORE=bundle-255d6348b35b8d57c03162bb5c580185b792b13f7c749622d79d77e9f93cad61
AFTER=bundle-b7886f6e6a5c3b569ce0eb15a40b934c7880f2a37916c1ec135280027142902d
OLD_CURRENT_PRESERVED=no
Error: verifier snapshot bundles contain an unmanaged entry
  at assertManagedAssetDirectory (...install-packet-review-hooks.mjs:116)
  at installManagedAssetBundle (...install-packet-review-hooks.mjs:184)
```

- 影响：调用方收到失败状态，但 active pointer 已指向新 bundle。bundle 本身仍完整，旧 bundle
  也仍保留；缺陷是失败事务没有保持旧活动状态，正是本轮要求复核的最后提交点语义。
- 修复要求：把完整 `assertManagedAssetDirectory` 放在 `current` rename 之前，或删除 commit point
  后的重复可失败校验；确保原子替换 `current` 是刷新控制流最后一个可失败步骤。增加结构回归，
  对 current 写入后的路径做静态/故障注入断言，并要求任何 installer 非零退出时 current 仍等于旧值。

## 整体范围与 SHA/DAG gate

- `d8d8a6a..cf41f55` 共 17 个文件，范围保持在根 harness/change 文档、approval contract、
  installer/verifier/测试，没有触碰前后端业务运行时；scope clean。
- SHA/DAG 核心自 v9 后未修改。精确 40 位 commit、exact activation bootstrap、fast-forward、
  `B→H→R→M` parents、M/R tree 相等、review-only additions、唯一 approval/change、report digest 与
  单一末行 GO 的代码与正反例继续成立，未发现新的 gate 阻塞。
- `LOCAL_FEEDBACK_ONLY`、`security_boundary=false`、`required_check_verified=false` 及
  `--no-verify`/本地篡改/其他客户端或机器等绕过边界仍诚实披露，没有伪称 `ENFORCED`。

## 实际验证

| 命令 / 检查 | 结果 |
| --- | --- |
| `node --test scripts/packet-review-local-feedback.nodetest.mjs` | PASS，28/28，0 fail/skip |
| `node --check` installer/core/pre-push 三入口 | PASS |
| `node scripts/packet-review-pre-push.mjs --status` | PASS；精确 bootstrap 与诚实本地信任边界 |
| `node scripts/harness-doctor.mjs` | PASS，0 errors / 0 warnings |
| `git diff --check d8d8a6a..cf41f55` | PASS |
| E7 symlinked parent 临时仓库复现 | PASS，exit 1 且用户目录无 target |
| E8 只读 target 目录刷新临时仓库复现 | PASS，exit 0、target 不变、完整新 bundle、旧 bundle 保留 |
| E9 post-current 校验故障注入 | FAIL，exit 1 但 current 已从旧 bundle 切到新 bundle |

正式 28 项测试没有覆盖 commit point 后校验失败，因此全绿不能消除 E9。修复并补结构回归后需要
新一轮独立复核；本报告不构成 approval envelope。

PACKET_REVIEW_NO_GO
