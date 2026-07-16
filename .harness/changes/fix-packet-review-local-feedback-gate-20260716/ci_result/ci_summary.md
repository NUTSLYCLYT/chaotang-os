# CI 摘要：fix-packet-review-local-feedback-gate-20260716

## 结论

`READY_FOR_REVIEW`。D6-L 已实现为诚实的 `LOCAL_FEEDBACK_ONLY` 本地防误操作门；未安装到真实
hooks，未配置或宣称外部 required check。

## TDD 证据

| 阶段 | 结果 | 证明 |
| --- | --- | --- |
| RED 1 | `ERR_MODULE_NOT_FOUND` | 核心 verifier 尚不存在 |
| GREEN 1 | 7/7 | 正确 DAG 通过；旧/重复 GO、错 SHA、review 改代码、merge 改树被拒绝 |
| RED 2 | 5 failed / 7 passed | CLI 与 installer 尚不存在 |
| GREEN 2 | 12/12 | status、core.hooksPath、linked worktree、幂等/卸载、stdin replay |
| RED 3 | Missing expected exception | 多 root change 尚未被拒绝 |
| GREEN 3 | 14/14 | 唯一 root change 与 Packet ID 绑定 |
| RED 4 | manifest property `undefined` | 工程清单尚未登记 |
| GREEN 4 | 18/18 | manifest/contract/docs/installer/verifier 全部可复现 |
| RED 5 | Missing expected exception | 分叉 activation history 被误当 pre-activation |
| GREEN 5 | 19/19 | 仅 `remote→activation→candidate` 可首次启用，分叉历史 STOP |
| 独立复核 v2 | `PACKET_REVIEW_NO_GO` | 发现 activation 后夹带、卸载误删、兄弟 worktree 缺脚本三项阻塞 |
| RED 6 | 3/3 failed | 三项独立复核缺陷均有最小复现 |
| GREEN 6 | 3/3 passed | bootstrap 绑定精确 activation；卸载 fail closed；共享 verifier 快照可执行 |
| RED 7 | status 字段 `undefined` | status 尚未披露 bootstrap 例外的精确策略 |
| GREEN 7 | 21/21 | status 输出 `bootstrap_policy=exact_activation_commit_only` |
| 独立复核 v4 | `PACKET_REVIEW_NO_GO` | E1/E2/E3 关闭；发现 snapshot 内部 symlink 重装误写用户文件 |
| RED 8 | 1/1 failed | symlinked snapshot CLI 被 `copyFile` 跟随，安装器错误退出 0 |
| GREEN 8 | 2/2 passed | CLI/core symlink 均 fail closed，用户文件与 symlink 保持不变 |
| 独立复核 v6 | `PACKET_REVIEW_NO_GO` | E4 关闭；发现 target hardlink 误写与双文件刷新撕裂 |
| RED 9 | 2/2 failed | hardlink 重装退出 0；core 复制失败后活动 CLI/core 版本不一致 |
| GREEN 9 | 2/2 passed | 受管文件须单链接；完整 bundle 构建验证成功后才切换活动目录 |
| v8 技术探测 | reviewer 工具策略中断、未形成正式裁决 | 发现双 rename 之间活动路径空窗与 SIGKILL 恢复缺口 |
| RED 10 | `current` 路径 `ENOENT` | 旧实现没有可原子切换的稳定 bundle 指针 |
| GREEN 10 | 26/26 | 内容寻址不可变 bundle；原子 current；旧 bundle 保留；失败刷新不变 |
| 独立复核 v9 | `PACKET_REVIEW_NO_GO` | SHA/DAG 无新阻塞；发现 `pre-push.d` symlink 越界写与失败后 current 已切换 |
| RED 11 | 2/2 failed | symlinked 父目录写出 hooks；只读 target 目录使刷新非零但 current 已改变 |
| GREEN 11 | 2/2 passed | 父目录须真实；已受管 target 不重写；`current` 是刷新最后提交步骤 |
| 独立复核 v10 | `PACKET_REVIEW_NO_GO` | E7/E8 关闭；发现 current 写后仍有一次可失败全量校验 |
| RED 12 | 结构顺序断言失败 | asset 全量校验位于 current 激活之后 |
| GREEN 12 | 29/29 | 全量校验前置；current 写后无任何 `await` |

## 最终验证

| 命令 | 结果 |
| --- | --- |
| `node --check` 三个实现模块 | PASS |
| `node --test scripts/packet-review-local-feedback.nodetest.mjs` | PASS：29/29，0 fail/skip |
| `node scripts/packet-review-pre-push.mjs --status` | PASS：精确 bootstrap 策略、`LOCAL_FEEDBACK_ONLY`、`security_boundary=false`、`required_check_verified=false` |
| `python3 -m json.tool` contract + manifest | PASS |
| `node scripts/harness-doctor.mjs` | PASS：0 errors / 0 warnings |
| `git diff --check` | PASS |

## 安全边界

- 可阻断：历史/重复/非末行 GO、错 predecessor/head/digest、多个 Packet/change、review 夹带代码、
  merge 后改树、删除/新建/非 fast-forward ext 更新、分叉 activation、bootstrap 后夹带提交。
- 安装边界：verifier 使用共享的内容寻址不可变 bundle；精确校验内部布局与 digest，原子切换
  `current` 普通文件并保留旧 bundle；`pre-push.d` 必须是真实目录，已受管 target 刷新不重写；
  unmanaged/symlinked hook 或快照在安装和卸载时均 fail closed。
- 不能阻断：`git push --no-verify`、本地 hook/checker 篡改、其他机器/客户端直接推送，或使用
  非 `origin` remote alias 推向同名 ref（本门明确只匹配精确 `origin`）。
- 升格 `ENFORCED` 的前置条件仍是仓库外 reviewer 签名、公钥信任锚、受保护 base verifier、
  Gitee required check 与分支保护；本 Packet 不包含这些外部变更。

## 未验证项

- 未安装到真实 `.git/hooks`；仅在隔离临时仓库验证安装、卸载和执行。
- 未配置外部签名、公钥信任锚、Gitee required check 或分支保护。
- 修复提交尚待新一轮独立复核；最后一个正式裁决 v10 仍为 `NO_GO`，不能提前合入。

## 环境偏差与恢复

- v8 技术复现第一次漏设子进程 cwd，误在共享主仓库执行两次受管 installer。
- 随即执行受管 `--uninstall`，确认真实 hooks 下 `pre-push`、D6 subhook、D6 asset root 均为
  `ABSENT`；既有 pre-commit/前端 hook 与 tracked 文件未改。

## Diff 与回滚复核

- changed files：根 harness contract/manifest/wiki/change record 与三个脚本入口/测试。
- diff review：`git diff --check` PASS；修复后独立复核待执行。
- 回滚是否演练：隔离临时仓库两次安装后定向卸载 PASS，其他 subhook/dispatcher 保留。

## 完成定义映射

| DoD | 证据 | 状态 |
| --- | --- | --- |
| SHA/DAG/报告/envelope 精确绑定 | 临时真实 Git DAG 正反例 | PASS |
| bootstrap 不可夹带 | exact activation 与后续候选回归测试 | PASS |
| 不覆盖/不误删用户 hook | install/uninstall unmanaged 回归测试 | PASS |
| snapshot 内部不可导向用户文件 | CLI/core symlink 重装回归测试 | PASS |
| 受管 hook 不可改写硬链接 peer | target hardlink 重装回归测试 | PASS |
| snapshot 刷新不产生版本撕裂 | 第二份 source 失败时旧 bundle 字节不变 | PASS |
| 安装刷新无活动路径空窗 | 内容寻址 bundle + 原子 current + 旧 bundle 保留 | PASS |
| target 路径不越出 hooks | symlinked `pre-push.d` 退出 1 且用户目录无新文件 | PASS |
| 非零刷新不先激活新版本 | target 稳定不重写，`current` 最后提交 | PASS |
| current 后无可失败步骤 | 安装器结构顺序回归测试 | PASS |
| linked worktree 不依赖旧 checkout | 兄弟 worktree 端到端 dispatcher 测试 | PASS |
| 诚实信任边界 | status、manifest、wiki | PASS |
| 修复后独立 GO | 新一轮版本化复核 | PENDING |

## 声明状态

- `VERIFIED_PARTIAL`：实现侧验证完成；独立 GO 尚未取得。
