# Packet 14 — Fixture Provenance V3 R2

> 状态：`READY / GOVERNED_EXECUTION_REQUIRED / PRODUCT_NOT_IMPLEMENTED`
>
> Task ID：`PACKET-14-FIXTURE-PROVENANCE-V3-R2-20260823`
>
> Proposed manifest digest：`sha256:d9aefb15a117c0180c6e5328f53f1e43259da75507cf3a725205b22a1d37bfcd`

## Status

Ready

产品定义、exact32、验收和停止边界已冻结。本文档自身永不产生产品GO；只有三件套以冻结base的直接单亲子落地主线、
远端未漂移且exact Task ID的M0 consumer返回GO时才可施工。当前治理基线不声称产品实现或产品验收完成。

## Product Definition

- 用户确认：Owner 于 2026-08-23 精确批准基于
  `origin/ext-dev@82fed66aed5f622982f527e62920dfe828a3fd1b`编制冲突后 R2 successor 治理草案；
  该确认不授权提交、推送或产品施工。
- 问题：首版 V3 approval commit `d00c16e1d318ffe5291cb4750048b546d7083ea4`尚未推送时，
  远端以同一旧base的另一直接子`82fed66aed5f622982f527e62920dfe828a3fd1b`前进，普通fast-forward被拒；
  首版approval因此不能再成为远端的冻结base直接子。V2 fixture/browser wire同时仍需完成V3修复。
- 目标用户：需要可信下载、确认、归档和发布证据的朝堂 Owner 与 release operator。
- 目标：在 exact32 内完成 P14 artifact safety、BFF cancellation、V3 fixture provenance 和三份相互独立证明所需的
  runner/contract能力，形成经确定性验证与独立复审的产品字节和fingerprints；实际candidate-bound三证明由后继
  compatibility/final M0执行。本工作包本身不授权产品提交、推送、合并、release 或 deploy。
- 非目标：军机处 Stage B、产品信息架构、新 route/BFF/API/数据库表列、第二 ledger/事实源、生产 fixture、真实模型、
  公网、secret、生产数据、authority/Harness/ADR/CI 或 readiness fingerprint 修改。

### Frozen identity

- Repository/target：`gitee.com/msxn/chaotang-os` / `origin/ext-dev`
- Base commit/tree：`82fed66aed5f622982f527e62920dfe828a3fd1b` /
  `faa76cfa648d78e3798008c559ca62e5194170b0`
- Re-anchor source：`chore(governance): bind final P14 readiness fingerprints`；该base只修改
  `backend/tests/test_six_ministry_readiness_report.py`与`scripts/check_harness.mjs`。
- Readiness contract：base将runtime/successor fingerprint绑定为两个closed pair，显式拒绝legacy/final混搭与未知第三状态；
  R2产品施工不得修改这两条base路径或放宽该pair gate。
- Superseded local-only approval：commit `d00c16e1d318ffe5291cb4750048b546d7083ea4` /
  tree `5100c700cc7f23a9d9e47f27946ce96cf400aac6`，状态`MUST_NOT_PUSH_OR_REPLAY`。
- V3 amendment：
  `docs/migrations/2026-08-23-packet-14-fixture-provenance-v3-amendment.draft.md`
- V3 amendment raw SHA-256：
  `164486ed042257fd0d7efe5d93ba5fe8b35066883445ea9565d71092adaafc41`
- Inherited V2 task：`PACKET-14-REVIEWED-DRAFT-REACHABILITY-AND-BFF-CANCEL-V2-20260823`
- Inherited V2 manifest digest：
  `sha256:263619f1325a6e13ff15b0ef509fcfcb2ddbc7a0892096ff53af857cab991476`
- Product scope：新 approval manifest 的排序 exact32，逐项与 V2 `request.productPaths` 相同。

### Required remediation

1. 下载开始前、正常完成、断连、send failure、timeout 和 cancellation rejection 都必须幂等释放 FD、lease、owner、
   reserved bytes、spool、reader、timer 与上游 fetch。
2. BFF 必须传播入站 `request.signal`，并同时执行 connect/header/body/total deadline 与 262144-byte success cap；
   401/404/503 保持同形、脱敏和 `private,no-store`。
3. SQLite activation、backup、fixture seed 与 artifact 写入必须使用 stable root/child FD、closed basename、
   `O_NOFOLLOW`、owner/mode/nlink/identity 重验、zero-WAL 和失败关闭的 partial-write cleanup。
4. 严格实施已落地 V3 amendment 的 marker/auth/preimage/postimage/provisional/accepted fixture、单一 request ledger、
   identity-bound cleanup 和 receipt wire，不允许 client 自报 PASS。
5. generation contamination deny 必须分别拒绝 workbook SHA 的 `sha256:<64hex>` 与 raw `<64hex>` 表示；
   fixture capability、ID、digest、work product、archive、binding 和 receipt 不得晋级真实 accounting generation。
6. exact32 必须实现并以确定性RED锁定 `P14-REALSTACK`、`P14-GENERATION`、`P14-DELIVERY-BROWSER`
   三条独立证明路径；后继final M0针对同一candidate commit/tree实际运行时，任一不得替代另外两项。

## Acceptance Criteria

- [x] V3 amendment 以 raw SHA
  `164486ed042257fd0d7efe5d93ba5fe8b35066883445ea9565d71092adaafc41` 单独落地主线。
- [x] 新base readiness fingerprint变更已只读核验；closed pair、混搭拒绝和第三状态拒绝测试通过，
  Root Harness与Doctor保持通过。
- [ ] 三件套 canonical digest 获 Owner 精确确认、以 base 的直接单亲子落地主线，exact Task ID 机器返回 GO。
- [ ] 产品候选严格只改 exact32，先建立全部安全 RED，再完成最小 GREEN；需要第33路径立即停止。
- [ ] 15项产品确定性验证分别通过；`candidate-acceptance-blocked`保持公开、无副作用和预期非零，
  使本reviewed-bytes包的`--verify-candidate`必须STOP。
- [ ] exact32内三证明runner/contract及其RED完成；当前包不铸造或接受candidate-bound真实证据。
- [ ] 本阶段冻结reviewed product bytes、exact32 diff与最终fingerprints后停止；真实Chromium双Owner链路及三证明
  由后继compatibility/final M0在同一candidate commit/tree上执行和验收。
- [ ] code/Python/TypeScript/security 独立复审 P0=P1=P2=P3=0，并冻结最终 successor fingerprints。
- [ ] 本阶段完成 reviewed product bytes、exact32 diff 与最终 fingerprints 后停止；candidate commit、
  `--verify-candidate` 和 Owner candidate 决策由后继 compatibility/final M0 治理包完成。

## Delivery Constraints

- 范围：严格等于 approval manifest 的 exact32；产品 candidate 的 changed paths 也必须逐字等于 exact32。
- 兼容性：保持现有生产 API、数据库 schema、owner isolation、Shiguan REPLY、DecreeJob、work-product 与 release 契约。
- 风险与限制：V3 evidence wire 只服务受控验证，不得成为生产 fixture 或第二事实源；不允许读取用户真实工作簿。
- 技能计划：产品施工阶段使用仓库 `codex-engineering-workflow` / Superpowers 路由并执行TDD；当前治理准备不调用产品Skill。
- Codex-only：是；禁止 Claude CLI、Claude runner 与 `gstack-claude`。
- 权限：approval commit/push、产品施工、candidate commit/push、merge、release、deploy 均保持独立授权。

## Affected Modules

- 模块：artifact存储与下载安全、BFF bounded cancellation、SQLite backup/fixture provenance、离线发布验证和真实浏览器证据。
- 允许路径：严格等于
  `.harness/approvals/PACKET-14-FIXTURE-PROVENANCE-V3-R2-20260823.json`
  的 `request.productPaths` exact32。
- 依赖模块：Root Harness、product authority、V3 amendment、真实Chrome/CDP runner、六部 successor compatibility。

不得修改 approval 之外的第33产品路径；尤其不得修改 authority、Harness、CI、ADR、AGENTS、认证/史馆模型、
`backend/tests/run_accounting_synthetic_acceptance.py` 或 readiness fingerprints。

## Technical Plan

- 架构边界：沿用 V2 的 exact32 与三证据分工；V3 amendment 是唯一 fixture/browser provenance合同。
- 接口与依赖：不新增生产接口、表列或状态系统；内部 evidence wire 只按 V3 closed schema 升级并双向拒收旧版本。
- 实施顺序：新干净 approval child → authority GO → 重放 exact32 → safety RED/GREEN → V3 provenance与三证明runner
  RED/GREEN → 全确定性矩阵验证 → 独立复审 → 冻结 fingerprints → 停止；后继final M0才创建和验收candidate。
- 验证计划：分别执行15项产品确定性命令；manifest另含1项故意非零的`candidate-acceptance-blocked`，
  机器不得把当前reviewed bytes判为eligible candidate。同一candidate-bound三份真实证据、isolated candidate和真实Chrome
  验收由后继compatibility/final M0执行，届时新approval才可移除blocker。
- 技术风险：任何 identity、session、SHA表示、postimage、cleanup、privacy或candidate绑定不完整都可能产生伪绿；
  发现时失败关闭，不放宽wire或测试。

## Implementation Report

- 改动摘要：V3 amendment已单独落地主线；首版local-only approval因远端并发而作废，本R2包基于
  `82fed66aed5f622982f527e62920dfe828a3fd1b`重新冻结successor task、plan、approval，未修改产品代码。
- 自审：base/tree、readiness closed fingerprint pair、superseded commit停止边界、amendment raw SHA、V2 exact32、
  non-goals、15项产品verification和1项candidate blocker已冻结。
- 验证：approval closed schema、canonical digest、exact32等同性、Root Harness和Doctor均通过。
- 实际使用的 skill：无；当前为治理准备。
- 验证命令与结果：`check_harness` PASS（146基线文件）；Doctor
  `PASS / STRUCTURE_VALID_NON_AUTHORIZING`；readiness report精准pytest 11/11；product-authority回归在Linux
  临时目录12/12，Doctor回归10/10。
- 独立审查：最终治理字节由架构、实现和安全三方复核，门槛固定为P0=P1=P2=P3=0；结果随Owner授权报告提供。
- 未运行项与原因：未运行产品测试和真实runner，因为机器GO尚未产生，产品施工未开始。
- 剩余风险：产品安全修复、三证据、isolated candidate和最终candidate均未完成；实际authority与Git外部状态必须届时新鲜复核。

## Acceptance Review

- 验收结果：Ready for governed execution；产品验收仍为Pending。
- 验收证据：V3 amendment已落地；三件套closed schema、exact32、Harness、Doctor和治理回归已建立证据。
- 未通过项：本文不记录会漂移的Owner/Git/authority结果；产品实现、15项产品验证、fingerprints以及后继final M0的
  isolated candidate、三份真实证据与candidate接受仍未完成。
