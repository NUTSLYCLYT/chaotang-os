# 规格说明：fix-packet-review-local-feedback-gate-20260716

## 背景

P0–P4 三次出现先合/先推后复核。简单检查 review 目录中存在 `PACKET_REVIEW_GO`
会被历史 GO、同文件 NO_GO+GO、复制报告、同提交修改 checker/report、review 后夹带提交绕过。
用户于 2026-07-16 批准修订版 D6-L：只建立严格 SHA/DAG 绑定的本地防误操作门。

## 当前实现与证据

| 分类 | 结论 | 证据路径 / 命令与时间 | 验证方式 / Owner | 是否阻塞 |
| --- | --- | --- | --- | --- |
| 已确认事实 | 当前无 pre-push；现有报告可同时含 NO_GO/GO；本地 hook 可绕过 | `git rev-parse --git-path hooks`；P3/P4 review；2026-07-16 只读审计 | 已验证 / Project Agent | 否 |
| 已确认事实 | 现有 S3 gate 拒绝 merge commit，不兼容 ext `--no-ff` 集成 | `scripts/integration-lease-gate.mjs` 与 ext DAG | 已验证 / Project Agent | 否 |
| 未知问题 | Gitee required check、分支保护和独立 reviewer 公钥未配置 | 仓库无权证明平台设置 | 外部管理员 | 是，阻止 ENFORCED 声明 |

## 数据流与调用链

```text
git pre-push stdin
  -> 仅匹配 origin + refs/heads/feature-chaotang-ext
  -> 从 candidate Git objects 读取 approval/report，不读脏工作区
  -> 校验 remote predecessor B
  -> 校验 implementation H
  -> 校验 review-only R(parent=H)
  -> 校验 merge M(parents=B,R；tree=R.tree)
  -> 本地允许或 STOP
```

## 接口、数据结构与事实源

| 契约 | 生产者 / 事实源 | 消费者 | 兼容性与验证 |
| --- | --- | --- | --- |
| approval-vN.json | 独立 review-only commit R | pre-push verifier | 精确绑定 packet/change/B/H/report digest；仅一个 terminal verdict |
| Git DAG | Git object database | pre-push verifier | 所有 SHA 必须 40 位且 exact-resolve；M 不得含 review 后改树 |
| status | verifier 常量 | CLI/文档 | 只能是 `LOCAL_FEEDBACK_ONLY` |

## 范围

- 新增纯验证模块、pre-push CLI、dispatcher 安装器及测试。
- 从激活 SHA 后前瞻执行，不追溯 P0–P4。
- 只拦截 `origin/feature-chaotang-ext`；其他 remote/ref 不改变。

## 非目标

- 不建立 reviewer 身份、密码学签名、Gitee required check 或分支保护。
- 不把现有历史追加式 P3/P4 review 改写成新 envelope。
- 不修改现有 integration lease gate 或 merge 策略。
- 不部署、不推送。

## 边界条件

| 条件 | 预期行为 | 证据 / 验证 |
| --- | --- | --- |
| 非目标 remote/ref | 放行并报告 `not_target` | 单测 |
| 删除、force、未知 remote SHA | STOP | 单测 |
| 旧 GO、重复 verdict、GO 非末行 | STOP | 单测 |
| review commit 修改产品代码 | STOP | 单测 |
| merge commit 产生额外 tree 变化 | STOP | 单测 |
| `--no-verify` | 可绕过；输出和文档必须明确非安全边界 | 状态测试/文档 |

## 风险与回滚边界

误配置可能阻断 ext 正常 push；安装器必须可逆、幂等、尊重 linked worktree 与
`core.hooksPath`，并拒绝覆盖非 dispatcher hook。回滚只卸载本子 hook；不改用户其他 hooks。

## 计划确认记录

- 批准人：用户
- 批准日期：2026-07-16
- 批准范围：修订版 D6-L，SHA/DAG 绑定的 `LOCAL_FEEDBACK_ONLY` 本地门。
- 明确未批准：伪称 ENFORCED、外部平台设置、部署与推送。

## 验收标准

1. 正确 `B→H→R→M` 且唯一新 approval/report 时通过。
2. R 只允许新增一个版本化 review 与 approval；M tree 必须等于 R tree。
3. envelope 精确绑定 packet/change/B/H/report SHA-256，report 仅一个末行 GO。
4. 安装器支持 linked worktree、`core.hooksPath`、幂等与安全卸载。
5. 所有输出显式声明 `LOCAL_FEEDBACK_ONLY` 和可绕过边界。

## 验证计划

- `node --test scripts/packet-review-local-feedback.nodetest.mjs`
- `node scripts/packet-review-pre-push.mjs --status`
- `node scripts/harness-doctor.mjs`
- `git diff --check`
