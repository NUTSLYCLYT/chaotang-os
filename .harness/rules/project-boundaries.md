# Project Boundaries

## Canonical Lines

| 层级 | 路径 | 事实源 |
| --- | --- | --- |
| Root coordination | `.harness/`、`AGENTS.md`、`scripts/harness-doctor.mjs` | 项目入口、边界与只读观察 |
| Frontend experience | `frontend/` | 页面、BFF、浏览器契约与前端验证 |
| Backend runtime | `backend/`、`backend/harness/` | API、运行、证据、评测与归档 |

`.agents/`、`.claude/` 与 `.codex/` 只配置 agent/tool 调用，不得拥有业务逻辑、运行状态、第二
Outcome ledger 或第四套 Harness 事实源。

## G1 Limits

- G1 只建立 `BOOTSTRAP_OBSERVE` 根观察核，不恢复旧 root v1/v2、R0、trust、runtime、rollout、
  release、lease、change history、模板或 generator。
- Root doctor 只能读取 closed schema/manifest、磁盘状态，并调用 ext authority 与 M0 consumer 的
  `--status`；它不能调用 digest、authorize 或 candidate verification。
- `--check` 通过不等于 READY；`--status` 不等于治理 GO；`--ready` 必须固定 NOT_READY。
- Frontend 缺少 `frontend/.harness` 是 `ABSENT` 事实；backend 只有候选评测目录且无 manifest/doctor，
  是 `PARTIAL` 事实。不得把二者伪装 READY。
- 产品、CI、数据库、ADR 0028、外部平台配置和现有 ext authority 不属于 G1 修改范围。

## M0 Limits

- `product-authority.m0.v1` 只防聊天批准误读、陈旧 base、路径扩大、自授权同提交、验证遗漏和
  非 fast-forward 候选；不防已控制 Owner 会话、OS owner、Gitee owner 或整个 runner 的攻击者。
- Approval manifest 必须先以独立提交落地并记录 `APPROVED_FOR_ONE_CHILD`；产品候选只能是其精确
  单亲子，且不得修改 `.harness/`、authority、Harness、根入口、CI 或 ADR 0028。
- 远端一旦离开 approval commit，该批准即失效或已消费；不新增数据库、lease、HSM、私钥或第二 ledger。
- Consumer 的 PASS/GO 不能代替 Owner 对最终 candidate SHA/tree 和 commit/push/merge/deploy 的确认。

## M0 pre-authority receipt boundary

- v2 approval 只能通过现有 `scripts/product-authority.mjs --authorize` 进入；外部 receipt 文件、caller supplied
  FD、same-UID inline helper/fallback、持久 nonce/lease/ledger 和第二 GO builder 均被禁止。
- authority 先后只读确认实时 remote，并只打包 approval commit、直接 base commit、approval root tree、全部
  recursive subtree/blob 的 exact closure；replace refs、仓库 config 和额外对象不进入 broker 信任边界。
- credential-separated broker 必须由 root-owned socket 接受连接，先用 `SO_PEERCRED` 及 `/proc` starttime、
  user namespace、cgroup 绑定 dedicated controller，再读取请求。approval-source 只读物化，不存在 candidate 身份。
- controller/verifier/runner 源字节必须绑定 raw SHA-256、Git blob SHA-1、mode 与 bytes；worker 只在独立 UID、
  PID/network namespace 和 per-connection cgroup 中运行，FD ABI 精确为 `3/4/6`，FD5 不可见。
- inner/outer receipt 必须绑定 approval/base/remote/source manifest、controller/verifier/runner、18-case、nonce/TTL、
  live peer、systemd invocation 与 service cgroup。任何成功、失败、超时或调用者断开最终都由
  `KillMode=control-group` 收口；authority 只在同一 service inactive 且 cgroup empty 后输出低敏 evidence digest。
- 仓库 source 不能证明已安装主机环境。current exact bytes、runtime profile、installation manifest、socket/unit
  和 installed acceptance 未独立冻结并安装时，v2 fail closed；本 contract 不授权安装、启用或启动服务。
