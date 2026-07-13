# 多 Agent 控制面 S10 推广运行手册

## 当前结论

S10 当前为 `IMPLEMENTED_LOCAL_OBSERVE_PENDING`。包含 policy 的提交落地后才可执行真实 Observe 启动；启动前不得写成 `ROLLOUT`。Observe 不新增发布阻断；它写 git-common-dir 下独立的 SQLite v1 rollout ledger，主控制库保持 schema v8，便于回滚到 S9。`Mandatory` 和 `ENFORCED` 必须等待真实时间、外部门禁和连续 20 次真实 production release，任何本地测试都不能替代。

## 权威入口

```bash
node scripts/rollout-control.mjs status
node scripts/rollout-control.mjs evaluate
node scripts/harness-task.mjs step --task <task-id> --owner <owner> --step step-<id> --credential-file /owner-only/lease-credential.json
node scripts/rollout-control.mjs collect-task --task <task-id>
node scripts/rollout-control.mjs collect-release --release <release-id>
node scripts/rollout-control.mjs verify-acceptance --id A1
node scripts/rollout-control.mjs collect-acceptance --id A1
node scripts/rollout-control.mjs record-incident --release <release-id> --ticket INC-<id> --severity P0 --reason '<reason>'
node scripts/rollout-control.mjs advance --to warn
node scripts/rollout-watch.mjs --once
```

生产 CLI 没有 `--now`、`--external`、`--passed` 或批量导入 JSON。测试时钟和构造事件只在 `NODE_ENV=test`、显式 test adapter、隔离数据库三项同时成立时可用。

## 阶段门

| 阶段 | 最短真实时间 | 行为 | 晋级事实 |
| --- | ---: | --- | --- |
| Observe | 2 天 | 只记录 | 同类 baseline 20 + observation 20；完整率 100%；重复工作下降 ≥80%；端口/构建/路径冲突 0 |
| Warn | 2 天 | 越界需人工原因后继续 | 误报率 <2%，外部单调 anchor 可验证 |
| Enforce paths | 3 天 | 无租约/证明的路径操作硬拦 | Gitee protected branch 的 S3 required check 真实启用，无 P0/P1 误拦 |
| Enforce resources | 3 天 | 端口/build/release 冲突硬拦 | S2/S5/S6/S8/S9 权威证据和外部 release/rollout trust 全部通过 |
| Mandatory | 长期 | 所有入口强制控制面 | A1–A12 + 20 个唯一连续真实 production READY、无事故、外部 checkpoint 对齐 |

baseline 只接受 Observe 激活前已经完成的 `task.metrics.finalized`，observation 只接受激活后完成的同类任务；每个任务必须有唯一 `task.step.completed` 审计，重跑必须记 `task.step.retried`。零重复 baseline 无法证明下降 80%，因此保持不合格。历史没有权威指标时保持 `unknown`，绝不能按零处理。失败后恢复、skipped、rolled back、重复 release ID、非 production、无独立 checkpoint 的 release 都不计入连续次数；事故会把连续计数归零。

## 自动回退

- Warn：误报 >5% 或单任务新增耗时 >300 秒，回 Observe。
- Enforce paths：任一 P0 误拦或误报 >2%，回 Warn。
- Enforce resources：控制面阻断发布 >900 秒，回 Enforce paths 并恢复 stable wrapper pointer。
- 回退前写入 active lease/lock、wrapper 和 ledger checkpoint 快照；不删除活跃资源记录。
- Mandatory 紧急通道只能消费 S9 双人独立 Ed25519 签名、最长 30 分钟、绑定 commit/release 的单次票据。原 production gate 仍必须全绿且不得 SKIP。

## 外部管理员待办

1. 在 Gitee protected branch 配置并验证 S3 required check。
2. 将 S8 release evidence 从本地 signer 切换到独立 protected authority。
3. 按下节部署仓库外单调 rollout authority；policy 已从第一版固定绝对路径与 SHA-256，部署字节不一致会 fail closed。
4. 为 S9 配置两个独立审批域公钥及原子 replay authority。
5. 逐项产出 A1–A12 机器验证 audit/checkpoint；不要手工写数据库。

任何一项未配置，promotion 都会 fail closed，但 Observe 仍可继续采集真实数据。

## Rollout authority 部署

仓库只保存可审查的参考源 `scripts/reference/chaotang-rollout-authority.mjs`；生产执行文件和状态都不得位于仓库、worktree 或 git-common-dir。当前 policy 固定：

```text
command: /opt/chaotang-rollout-authority/bin/chaotang-rollout-authority
sha256:  ec9be4dd130395f4cc4cec645aac596f09188c0d5d938728be99b296d0b566e9
state:   /var/lib/chaotang-rollout-authority/authority-state.json
socket:  /run/chaotang-rollout-authority/authority.sock
```

由独立 authority 管理员在目标机部署；不要让项目发布脚本执行这些命令：

```bash
sudo install -d -o <authority-user> -g <authority-group> -m 0700 /var/lib/chaotang-rollout-authority
sudo install -d -o <authority-user> -g <controller-group> -m 2750 /run/chaotang-rollout-authority
sudo install -d -o root -g root -m 0755 /opt/chaotang-rollout-authority/bin
sudo install -o root -g root -m 0555 scripts/reference/chaotang-rollout-authority.mjs \
  /opt/chaotang-rollout-authority/bin/chaotang-rollout-authority
sha256sum /opt/chaotang-rollout-authority/bin/chaotang-rollout-authority
sudo -u <authority-user> /opt/chaotang-rollout-authority/bin/chaotang-rollout-authority --init
sudo -u <authority-user> /opt/chaotang-rollout-authority/bin/chaotang-rollout-authority --serve
```

`--serve` 应由 systemd 以 `<authority-user>` 常驻运行，且设置 `NoNewPrivileges=yes`、`ProtectSystem=strict`、`ProtectHome=yes`、`ReadWritePaths=/var/lib/chaotang-rollout-authority /run/chaotang-rollout-authority`。无参数执行文件只是 Unix socket client；controller 身份加入 `<controller-group>` 后只能提交固定协议请求，不能读取 owner-only state，也不能执行需要 authority uid 的管理参数。不得把 controller/发布账号加入 authority 管理组或授予切换到 authority uid 的 sudo 权限。参考程序要求状态目录 `0700`、状态和管理员输入文件 `0600`、runtime 目录 `2750`（setgid 确保 socket 继承 controller group）、socket `0660`，并用进程锁、原子 rename、fsync、全状态摘要和 hash-linked history 保护单调 head。

初始化后四项 promotion control 全为 `false`，release 与 A1–A12 approval 均为空。管理员只能用 owner-only JSON 文件显式配置；缺失、字段不完整、重复授权、旧 sequence/digest、时钟回拨或本地 head 不是 authority 最新 head都会拒绝：

```bash
sudo -u <authority-user> /opt/chaotang-rollout-authority/bin/chaotang-rollout-authority --status
sudo -u <authority-user> /opt/chaotang-rollout-authority/bin/chaotang-rollout-authority --approve-release /protected/release.json
sudo -u <authority-user> /opt/chaotang-rollout-authority/bin/chaotang-rollout-authority --approve-acceptance /protected/acceptance.json
sudo -u <authority-user> /opt/chaotang-rollout-authority/bin/chaotang-rollout-authority --approve-operation /protected/one-use-operation.json
```

reference authority 不提供自行设置 promotion controls 的管理命令，四项 control 默认且持续为 false，因此它单独部署时所有生产晋级都 fail closed。要晋级必须由独立的 S3 required-check、S8 release signer/checkpoint、S9 recovery authority 组成受保护的外部聚合 provider，并实现同一协议；rollout authority 不能用本地 JSON 自证这些事实。authority 对 `append` 强制 sequence 恰好递增、固定 policy digest，并拒绝没有单次 semantic authorization 的 privileged event；对 `verify` 强制 sequence/digest 等于最新 head；每个成功响应都包含非回拨 `trusted_time`。

## 值守、停止与恢复

- Observe 巡检：值班 owner 以 `node scripts/rollout-watch.mjs --interval-seconds 14400` 常驻巡检，每天复核一次 `evaluate`；关注 ledger/anchor 校验失败、时钟回拨、wrapper pointer 漂移、误报率、任务开销和发布阻断时长。`evaluate` 不合格返回非零退出码。任何校验失败按 P0 控制面事故处理，停止晋级并用 `record-incident` 绑定当次 release。
- 停止采集：Observe 本身不阻断业务。需要停用时，先保存 `status` 输出和 git-common-dir 下 owner-only 的 rollout DB/pointer 快照，再由两人复核后把调用入口回切 S9 stable wrapper；不得删除或改写 ledger。当前 CLI 故意不提供无审计的 `disable` 开关。
- 手工降级：只有自动回退未能执行时使用。先冻结晋级和发布，保存 active lease/lock 快照，再执行 `node scripts/rollout-control.mjs rollback-stage --actor <owner> --reason '<incident reason>'`；该入口必须经外部 authority 批准并以 DB 提交后 CAS 切换 pointer。若崩溃造成 pointer/DB 不一致，先由两人核对证据，再执行 `reconcile-pointer --actor ... --reason ... --state <DB-version> --pointer <file-version>`。保留故障 DB 供审计，不要编辑 SQLite 行。
- anchor 故障：Observe 可继续记录本地事件，但任何需要外部事实的晋级和 enforce 阶段操作都 fail closed。恢复后必须先验证本地 ledger head 与外部最新 sequence/digest 完全一致；不一致不得采用“较新的一边”猜测修复。
- DB 恢复：rollout DB 打开/完整性失败会自动保全 owner-only crash-set 快照。从快照恢复前先停止所有控制面 writer，保留当前损坏文件，执行 SQLite integrity check，并用外部单调 anchor 验证恢复副本的 sequence/digest 正是最新 head；DB 被删而 activation marker/pointer 仍在时所有核心入口 fail closed。主 control DB 固定 schema v8；rollout DB 独立 schema v1，二者不得互相迁移。
- 告警归属：项目 owner 为第一响应人，release commander 为发布期第二响应人；安全/信任锚异常升级给独立 authority 管理员。恢复完成前状态保持 `ROLLOUT` 或更低，不得声明 `ENFORCED`。
