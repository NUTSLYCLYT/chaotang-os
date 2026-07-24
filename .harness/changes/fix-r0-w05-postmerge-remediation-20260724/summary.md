# 变更摘要：fix-r0-w05-postmerge-remediation-20260724

> 执行授权：`NOT_GRANTED_BY_CHANGE_RECORD`
> 本目录只记录需求与证据；产品实施必须绑定获批 amendment 和 exact-HEAD 执行权威。

| 字段 | 值 |
| --- | --- |
| Change ID | fix-r0-w05-postmerge-remediation-20260724 |
| 类型 | fix |
| 状态 | MERGED_AT_PR17 / POSTMERGE_CLOSEOUT_TRACKED |
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
- 候选冻结与 exact review 时，W05 仍是唯一 `ACTIVE` work package，且本
  remediation Packet 没有修改 ledger；这是当时的审查前提。
- 后续经 Product Owner 选择，源分支被推送并通过 Gitee PR #17 合入
  `feature-chaotang-ext`。merge `ad77c16d` 的 tree 与候选 H3 完全相同。
- 合并后的证据纠偏与 W05 静默关闭由
  `.harness/changes/fix-r0-w05-postmerge-closeout-20260724/` 接管；W06 不随
  W05 完成而自动激活。

## 本地候选身份

| Identity | Value |
| --- | --- |
| Base | `3cb508e06464de78facae09b93c132eb16023f94` |
| Implementation H1 | `0f2a3e4abd99aef345ac2858daa799c5aadc9dc6` |
| H1 tree | `eec70c552b578cfe6918c80903f0d73e55e18b80` |
| Base→H1 binary diff SHA-256 | `d82c89ea5e89e1bc4f25da615642fe4e3a0d2d44bfdec08453067eccfefafca2` |
| Review result | Standards `0 MUST`；Spec `0 MUST` |
| Remote state | merged by PR #17 at `ad77c16d1820c0c1420845c2b7a3d8cb9e52894e` |
| Merge tree | `354e427354adfc234b89deeaac2ee937048b9ca2`（等于 H3 tree） |

## 授权

Product Owner 于 2026-07-24 明确批准：

> 批准以 origin/feature-chaotang-ext@3cb508e06464de78facae09b93c132eb16023f94
> 为 base，建立 R0-W05-POSTMERGE-REMEDIATION 单写者 Packet；仅修复本次
> 独立审查 MUST，严格 RED→GREEN→review，不启动 W06，不推送、不合并，
> 候选 exact SHA 另行送审。

上述授权与机器复核描述的是 remediation 施工/冻结时点。后续 push/PR/merge 与
post-merge closeout 均由 Product Owner 另行明确批准；当前 closeout 候选预期
W05/W06 都为 `STOP/NO_ACTIVE_WORK_PACKAGE`。
