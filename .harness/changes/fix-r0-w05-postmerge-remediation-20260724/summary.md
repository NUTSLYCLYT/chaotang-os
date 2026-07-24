# 变更摘要：fix-r0-w05-postmerge-remediation-20260724

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-w05-postmerge-remediation-20260724 |
| 类型 | fix |
| 状态 | EXACT_H1_REVIEWED_0_MUST_AWAITING_OWNER_DECISION |
| Owner | Backend / Canonical Runtime |
| 创建日期 | 20260724 |

## 范围

- 主线：仅修复 `R0-W05` 在 post-merge 独立审查中确认的 MUST；不关闭
  W05，不启动 W06。
- 固定基线：`origin/feature-chaotang-ext@3cb508e06464de78facae09b93c132eb16023f94`
  （tree `f9e34a6aee6abea0f5445eaac8d95bf8088a4ca0`）。
- 单写者：`governance/r0-w05-postmerge-remediation-20260724`；
  worktree `.worktrees/r0-w05-postmerge-remediation-20260724`。
- 文件：W05 合同范围、证据状态、generation 状态投影、canonical task
  ingress、公共 API、聚焦测试及本 change 证据；不修改前端。
- 验证：每项先记录行为 RED，再做最小 GREEN；最终运行聚焦回归、
  authority、root/backend doctor、Ruff、diff check 与独立双轴审查。

## 当前结果

- 六项 post-merge MUST 均已形成 RED→GREEN 证据；预冻结独立审查新增的 replay、
  scope snapshot、CAS audit、跨用户版本污染和 publication phantom 也按同一
  Packet 回修。
- canonical task/generation scope、唯一 durable→domain 投影、确定性 evidence
  status 与 worker fail-closed promotion gate 已贯通。
- 本地实现候选 H1 已冻结并完成独立双轴审查：
  `0f2a3e4abd99aef345ac2858daa799c5aadc9dc6`，Standards 与 Spec
  均为 `0 MUST`。
- W05 仍是唯一 `ACTIVE` work package；本记录不把 W05 ledger 改为
  `MERGED_AND_VERIFIED`，W06 仍为 `STOP/BLOCKED_DEPENDENCY`。
- 没有 push、merge、PR、release 或生产切换；H1 只等待 Product Owner/总控
  对候选身份作下一步裁决。

## 本地候选身份

| Identity | Value |
| --- | --- |
| Base | `3cb508e06464de78facae09b93c132eb16023f94` |
| Implementation H1 | `0f2a3e4abd99aef345ac2858daa799c5aadc9dc6` |
| H1 tree | `eec70c552b578cfe6918c80903f0d73e55e18b80` |
| Base→H1 binary diff SHA-256 | `d82c89ea5e89e1bc4f25da615642fe4e3a0d2d44bfdec08453067eccfefafca2` |
| Review result | Standards `0 MUST`；Spec `0 MUST` |
| Remote state | local only；未 push、未 merge |

## 授权

Product Owner 于 2026-07-24 明确批准：

> 批准以 origin/feature-chaotang-ext@3cb508e06464de78facae09b93c132eb16023f94
> 为 base，建立 R0-W05-POSTMERGE-REMEDIATION 单写者 Packet；仅修复本次
> 独立审查 MUST，严格 RED→GREEN→review，不启动 W06，不推送、不合并，
> 候选 exact SHA 另行送审。

机器复核：`R0-W05=GO`；`R0-W06=STOP/BLOCKED_DEPENDENCY`。
