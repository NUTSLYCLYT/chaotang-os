# 铭硕第一交付 Project Fact Pack V1 Exact22 Lineage Corrective Successor Plan

任务：`MINGSHUO-FIRST-DELIVERY-PROJECT-FACT-PACK-V1-EXACT22-LINEAGE-CORRECTIVE-SUCCESSOR-20260913`

基线：`62827a3676f3714eb5be1948571451835456eb34 / dac3f0b2e13cd42fe0d4cc222c1f7eba8561e6df`

## Status

Draft

`DRAFT / NON_AUTHORIZING`

## Product Definition

以原 exact19 为业务边界，以唯一 Python Fact Pack evaluator 为语义源，新增 source-provenance manifest、Node relay 和 relay tests 三条 lineage 闭合路径。新 exact22 只解决“原 exact19 无法满足现行 exact8 relay last-touch/source identity”的确定性矛盾，不新增业务能力、不复制 evaluator、不放宽来源验证。

前序 exact19 authority 固定为 `ABANDONED_BY_OWNER_UNCONSUMED / NO_REANCHOR`；未提交产品字节固定为 `BYTE_DONOR_ONLY / NO_CANDIDATE_IDENTITY / NO_VERIFICATION_INHERITANCE`。新 approval、machine GO、候选、完整验证和 machine verify 均必须重新形成。

## Acceptance Criteria

- [ ] exact22 精确为原 exact19 加三条 provenance/relay 路径，结构 `5 ADD + 17 MODIFY`、全 `100644`。
- [ ] relay 只信任新 formal approval 的唯一直接单亲 exact22 candidate；原 exact19 十九路径必须与三条新增路径由同一 candidate 全部重物化和触碰；旧 task、旧 approval、split last-touch、23rd path 或伪造 descendant 无法通过。
- [ ] provenance manifest 的四个有序 source records 与最终 candidate tree/bytes/mode/size/raw SHA 一致；stale、tamper、reorder、duplicate、extra 或路径身份漂移在 Python 启动前失败关闭。`--check` 只能在来源验证后从同一次已验证的 golden bytes 解析 fixture。
- [ ] 固定且受身份验证的 `/usr/bin/unshare`（版本精确 `unshare from util-linux 2.39.3`）必须建立 user+network namespace 后才启动 Python；真实 provenance-valid evaluator/子进程的 IPv4、IPv6、DNS/socket 外联均由内核拒绝，隔离不可用时不得降级执行。
- [ ] evaluator 只继承闭合环境与 stdin/stdout/stderr；宿主 proxy、cloud、SSH、token、HOME 或额外文件描述符不得进入 evaluator。
- [ ] Node 不拥有 Fact Pack 语义；Python evaluator、exact19 HTTP/tenant/storage/runtime/Release 合同均不回退。
- [ ] 完整矩阵、三审和 machine verify-candidate 全部通过才可形成可推送身份。

## Delivery Constraints

- 只允许 formal approval exact22；不得改第二十三路径或另建 evaluator、manifest、registry、authority、数据库、API 或事实源。
- 不改 Harness、readiness/sqlite backup 产品实现、前端、BFF、Scene Pack、WorkProduct、史馆或军机处。
- 只用 synthetic/脱敏测试；无网络、模型、IMA、真实客户、真实价格、凭据、外部发布、生产安装或部署。源码身份验证不能替代运行时 network namespace。
- 不继承旧 exact19 的 authority/candidate/verification/review identity，不以测试或环境豁免降低 source/lineage 门槛。

## Affected Modules

- 模块：Mingshuo project/fact-pack persistence、runtime/release identity，以及 Fact Pack provenance 与 compatibility relay。
- 允许路径：formal approval manifest 的 exact22。

## Technical Plan

1. Governance freeze：strict JSON/duplicate/schema/manifest、Task contract、路径/结构/模式、Harness 与三审，Owner 确认唯一 canonical digest。
2. Approval/authority：相同 JSON bytes 物化正式 approval；三文件直接单亲提交/普通快进后仅运行一次 machine authority。
3. RED/lineage：旧 exact8/exact19 approval、非直接 child、split last-touch、缺失/额外路径、approval blob/parent/base/tree 漂移。
4. RED/source：manifest stale/tamper/reorder/duplicate/extra、source bytes/blob/size/mode/symlink/hardlink/TOCTOU、golden fixture 验证前读取或验证后二次读取、trusted Git/Python/unshare/config/env 漂移，以及第二 evaluator/输出泄漏。
5. RED/isolation：让 provenance-valid synthetic evaluator 及其子进程真实尝试 IPv4、IPv6、DNS/socket 外联；注入 proxy/cloud/SSH/token/HOME 和额外 fd；模拟 unshare 缺失、版本/身份漂移与 namespace 创建失败。任何外联成功、credential/fd 可见或降级直跑均失败。
6. GREEN/business：重物化并由同一 exact22 candidate 触碰 exact19 全部十九路径，最小纠正同范围缺陷；保持认证、tenant、canonical full-pack digest、UTC 复评估、幂等、rollback、runtime registry与 Release identity。
7. GREEN/relay：改绑本 task/approval/22 paths，保留直接单亲、last-touch、fixed tool/source、bounded resource、redacted STOP；固定验证 `/usr/bin/unshare`，只以 user+network namespace 启动 Python，隔离失败不降级；`--check` 从 `verifiedSources()` 返回的 golden bytes 取 fixture，不提前读取或再次打开。
8. GREEN/provenance：先冻结最终 evaluator/relay bytes，再机械更新唯一四记录 manifest；复核 candidate tree 与工作区 identity。
9. Verify：focused→runtime/release→backend full/Ruff→relay tests/check（含真实 network/credential isolation）→Harness/doctor/hook→`TMPDIR=/tmp` authority regression→V2/diff→Governance/Python/Security 三审。
10. Candidate：冻结 exact22 raw/blob/mode/bytes/bundle/diff/evidence；直接单亲提交后重跑 identity-sensitive matrix 与 machine verify-candidate。
11. Land：仅 machine PASS 且远端仍为 approval 时普通快进；任何 STOP、drift、P0–P2 或范围扩大均停止，不 re-anchor、不强推。

## Implementation Report

尚未实施。只读复现已确认旧 relay 把 `PRODUCT_PATHS` 固定为 exact8，导致 exact19 direct child 的 last-touch 集合分裂，并使 provenance 中的 evaluator identity 过期。exact22 是闭合既有来源与谱系验证的最小范围，不是新的业务阶段。

## Acceptance Review

Pending. 治理包通过后仍须 Owner 精确确认 canonical digest；没有 formal approval、machine GO、exact22 验证、三审和 machine verify 时不得形成产品 candidate 或推送。
