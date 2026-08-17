# 任务：P0 合同确定性分诊 V1

> Task ID：`P0-CONTRACT-TRIAGE-V1-20260817`
>
> 本任务只在现有 `/study → ChancellorDraft → DecreeJob → REPLY → 史馆处置` 主链前增加确定性、
> 失败关闭的合同分诊；不建立第二套任务、归档或确认事实源。

## Status

Ready

## Product Definition

隔离账号用户在 `/study` 提交一份脱敏中文制造业/B2B采购合同后，服务端先给出唯一状态：

- `READY_FOR_HUMAN_REVIEW`
- `NEED_INFO`
- `NEED_LEGAL_REVIEW`
- `BLOCKED`

只有 READY 可继续形成拟旨，且仍必须由用户点击现有“下旨”。任何状态都不代表可签、批准签署、付款、
发送或其他现实副作用。

## Frozen Fact Source

1. 请求必须恰有一条 `role=user` 消息。文本按 `CRLF/CR→LF → Unicode NFC → 整段首尾空白移除`
   规范化，保留内部空白与换行；`input_digest` 为规范化 UTF-8 文本的 64 位小写 SHA-256。
2. `backend/app/contract_triage.py` 是四态唯一计算器：纯函数、无 I/O、无 Provider。浏览器、BFF、LLM、
   client owner/status/digest/evidence 均不可信且不能覆盖状态。
3. READY 后只接受唯一精确 route `(刑部, 合同司)`。多部门、重复司、缺 route、非合同司或 roster 漂移
   均失败关闭并撤销 authority。
4. `status / ruleset_version / input_digest / reason_codes / missing_fields` 冻结进现有 DraftAuthority，随
   `approved_route_json` checkpoint 进入 DecreeJob；reserve/consume/restore/decode/execute/archive 均逐字段
   校验，禁止回放重算。
5. REPLY 使用唯一版本化 canonical text projection；serializer 冻结 UTF-8、字段/数组顺序、分隔符和
   换行，decoder 重编码后要求 bytes 完全相等。不新增合同表或结构化史馆查询。

## Signature Safety Boundary

模型不得输出签署许可字段；签署权限只由服务端固定 renderer 产生
`external_effect_authorized=false` 与固定人工审查免责声明。模型原始 draft、expert example、final verdict、
recommendations 和 reply conclusion 在写入、展示、注册 authority、publish 或 archive 前统一执行封闭扫描：

1. Unicode NFKC；
2. 转小写；
3. 移除所有 Unicode 空白与标点；
4. 搜索以下固定规则，不得由 Provider、配置或 UI 扩缩：

```text
(?:可|可以|建议|同意|批准|允许)(?:直接)?(?:签|签署|签订|签约|盖章|执行)
(?:合同|协议)(?:可|可以|建议|同意|批准|允许)(?:直接)?(?:签|签署|签订|签约|盖章|执行)
无需(?:法务|审核|审查|批准|授权).*?即可(?:签|签署|签订|签约|盖章|执行)
已获(?:签署|签约|签订|盖章|执行)?授权
```

命中、类型不符或扫描失败统一返回 `UNSAFE_SIGNATURE_CLAIM`：draft 阶段撤销 authority；job 阶段 FAILED；
均为 0 publish、0 REPLY/archive，且页面不回显危险原文。

## Acceptance Criteria

- [ ] A：完整合成中国大陆制造业采购合同 → 唯一 READY；精确刑部·合同司；用户点击前 0 job；点击后仅一个
  job/REPLY；triage projection 可精确 round-trip。
- [ ] B：缺主体、付款、交付、验收或争议字段 → NEED_INFO；稳定 missing fields；0 model、新/可消费
  authority、job、case、artifact、REPLY；同 owner 旧 READY authority 被撤销。
- [ ] C：境外法域、规避监管、无限责任或未证实签署授权 → NEED_LEGAL_REVIEW 或 BLOCKED；稳定 reason codes；
  与 B 相同的零执行副作用。
- [ ] 必须拒绝 client owner/status/digest/ruleset/evidence、旧 fingerprint、同 idempotency key 不同文本、
  cross-owner、route 漂移、checkpoint/archive lineage 漂移、写库/解析/归档失败。
- [ ] READY 后再提交 B/C 时，旧 fingerprint 下旨必须 409 且 0 job/REPLY；并发失败也不得遗留可消费 authority。
- [ ] 前端严格解析四态及 ruleset/digest/reason/missing/confirmation/external-effect；`canIssue` 同时要求 READY、
  `human_confirmation_required=true`、`external_effect_authorized=false`。

## Delivery Constraints

产品路径严格等于 manifest 的 21 条。任何第22路径立即 STOP 并重新批准。

不新增 `/api/contracts`、合同表、migration、第二 archive/confirmation writer、Provider、页面、上传、tenant
schema、真实客户数据或外部副作用；不修改 `app/orchestration/**`，不接 Direct/LangGraph runtime adapter，
不部署或替换3050。

## Affected Modules

- 模块：确定性合同分诊、现有拟旨 authority、下旨 reserve、DecreeJob checkpoint、史馆 REPLY projection、
  `/study` strict decoder 与状态展示。
- 允许路径：严格等于 manifest `request.productPaths` 中按字典序冻结的 21 条路径。
- 依赖模块：现有 CurrentUser、ChancellorDraft、DecreeJob、Shiguan archive 与前端 study 主链；不新增依赖。
- 非目标：不新增页面、BFF route、合同表、第二写者或运行时 adapter。

## Technical Plan

实现遵循 RED→GREEN；候选冻结后运行 manifest 全矩阵以及真实隔离浏览器 A/B/C、刷新、重复提交、恢复和史馆
回读；Code、Python、Security、Browser Reviewer 必须全部 GO。回滚只针对未来单一产品候选，不改写历史。

具体单写者顺序、纵向切片和逐轮 TDD 见
`docs/superpowers/plans/2026-08-17-p0-contract-triage-v1.md`。

## Implementation Report

- 当前交付：三份未提交 approval packet 治理文件。
- 当前产品实现：未开始；21 条产品路径均未修改。
- 当前外部动作：未 commit、未 push、未 merge、未部署。
- 已完成：准备稿事实源/安全复审、基线重钉至 `157039a1a…`、manifest closed-schema 与路径计数。
- 待完成：根 Harness、authority 回归与精确三文件 digest 全绿后，请求本地 approval commit 授权。

## Acceptance Review

当前只允许准备这三份治理文件；未经 Owner 对精确 parent、三文件 digest、commit SHA/tree 的逐门授权，不得
commit、push、实现产品、merge 或部署。

当前结论：`APPROVAL_PACKET_DRAFT / PRODUCT_NOT_STARTED`。
