# Packet 14 — Workbook Oracle Correction Amendment

> 状态：`CONTRACT_AMENDMENT_DRAFT / PRODUCT_STOP / NON_AUTHORIZING`
>
> 日期：`2026-08-24`

## 1. 冻结身份与停止边界

- Repository：`gitee.com/msxn/chaotang-os`
- Target：`origin/ext-dev`
- 起草基线 commit/tree：
  `4d109ca5f021ad62e5158d0b9266d93710f77f60` /
  `e004bc607d260f158ea82350a49f89ab9c8583f8`
- 现行 task：`PACKET-14-FIXTURE-PROVENANCE-V3-R2-20260823`
- 现行 approval canonical digest：
  `sha256:d9aefb15a117c0180c6e5328f53f1e43259da75507cf3a725205b22a1d37bfcd`
- 被修正合同：
  `docs/migrations/2026-08-23-packet-14-fixture-provenance-v3-amendment.draft.md`
- 被修正合同 raw SHA-256：
  `164486ed042257fd0d7efe5d93ba5fe8b35066883445ea9565d71092adaafc41`
- 本文件只修正 workbook sealed oracle、其逐项 ZIP 投影，以及所有由 workbook bytes/size/raw SHA 派生的
  数据库行、manifest、binding、delta、projection、provisional/accepted fixture 和 forbidden-set 字段；这些派生字段
  必须按本文件第3节替换或重算。V3 amendment 的 marker、auth、preimage、ledger、cleanup、privacy、三证明和
  所有其它安全停止条件继续逐字有效。
- 本文件不产生产品 GO，不授权提交、推送、candidate、merge、release 或 deploy。现有 exact32 产品字节
  必须继续未提交，并在旧 `1585/f762...` oracle 上零写 fail-closed。

## 2. 已证明的合同不可达

现行 V3 amendment 冻结 workbook 为：

- bytes：`1585`
- raw SHA-256：
  `f76254e2291e1e44076ec6a08d87a194de859b2b50daaf14ded876de86741867`

仓库、所有 refs 与 dangling objects 中不存在这组 sealed bytes，合同也没有提供可唯一重建它的 raw XML、
CRC、compressed size、uncompressed size 或 base64 oracle。SHA-256 不能反推出缺失内容，因此任何让 runner
从 candidate bytes 反向生成 expected、只比较自报 digest，或把另一份 workbook 标成 `f762...` 的实现都会伪造 PASS。

只读取证结果：

- `git rev-list --objects --all` 中只有 3 个历史 `.xlsx`，大小分别为 `18135/16750/12630`，均非目标；
- 全 object database 仅有 3 个 `1585`-byte blob，raw SHA 分别以
  `e61e073d.../8b20e53c.../d26c1c9e...` 开头，均非 `f762...`；
- `git fsck --full --no-reflogs --unreachable` 未发现目标 dangling blob；
- `git log --all -S'def _p14_xlsx_bytes'` 无历史提交，证明旧 generator 从未进入 refs；
- R2 exact32 的安全实现会在任一数据库或 artifact 写入前返回
  `p14_fixture_workbook_oracle_mismatch`，runner 返回
  `PREPUSH_RUNNER_POSTIMAGE_ORACLE_UNAVAILABLE`，两者均不铸造 accepted fixture 或 proof。

## 3. 修正后的唯一 workbook oracle

后继 successor 必须把 V3 amendment 的 `artifactEntry` freeze 替换为以下唯一值；其它字段和算法不变：

- `schemaVersion=rc1-p14-artifact-entry.v1`
- `relativePath=report_artifacts/<artifactId>.xlsx`
- `bytes="1689"`
- `sha256=sha256:9f11480835418351644da35e5d195686fd64a4a52dde1bf730c268cd298f7c33`

`artifactId` 继续由现行 V3 `fixtureSeedDigest` 按 purpose `artifact` 动态派生，因此
`relativePath` 和 `artifactEntryDigest` 不是跨会话常量。runner 与 CLI 必须先分别从同一获批 seed 独立派生
`artifactId`，再以实际 `relativePath=report_artifacts/<derived artifactId>.xlsx` 构造 exact
`artifactEntry`，最后按通用 canonical digest 规则独立重算 `artifactEntryDigest`。不得对字面占位符
`<artifactId>` 求摘要并把结果冻结为全局 oracle，也不得接受调用方自报的 `artifactEntryDigest`。

旧合同中所有 workbook-dependent 值必须一致替换，不允许只更新 `artifactEntry`：

| inherited location | corrected value/rule |
| --- | --- |
| `report_artifacts.file_sha256` | raw 64hex `9f11480835418351644da35e5d195686fd64a4a52dde1bf730c268cd298f7c33` |
| `WorkProductEnvelope.artifact_manifest[0].content_digest` | 同一 raw 64hex |
| private fixture binding `artifactSha256` | `sha256:9f11480835418351644da35e5d195686fd64a4a52dde1bf730c268cd298f7c33` |
| private fixture binding `artifactBytes` | JSON number `1689` |
| fixture projection `artifactSha256` / `artifactBytes` | 同一 `sha256:` prefixed值 / 无前导零JSON string `"1689"` |
| provisional fixture `artifactSha256` | 同一 `sha256:` prefixed值；不得新增 `artifactBytes` 字段 |
| postimage `fixtureProjection` | 使用上述 projection 的SHA与bytes；postimage顶层不得新增这两个字段 |
| accepted fixture | 不新增SHA或bytes字段；从更新后的对象重算 `provisionalFixtureDigest`、`runnerPostimageDigest`、`fixtureDeltaDigest`、`fixtureProjectionDigest` 和最终 `fixtureDigest` |
| fixture delta `artifactEntry` | 使用本节新 oracle、实际派生路径和动态 `artifactEntryDigest` |
| generation forbidden set | 必须同时包含新 raw 64hex 与 `sha256:` prefixed值；旧raw/prefixed值也继续作为拒收输入 |
| 所有包含上述值的 canonical digest | 从更新后的完整对象独立重算；不得沿用旧摘要或接受调用方自报摘要 |

任何仍含旧 `1585`、旧 raw/prefixed `f76254e2291e1e44076ec6a08d87a194de859b2b50daaf14ded876de86741867`
的候选 postimage、数据库行、manifest、binding、delta、projection、provisional/accepted fixture 或 proof 都必须拒收。
这条替换矩阵优先于被修正 V3 合同中对应的旧 exact values；除此之外不得扩大解释。

`zipEntries` 顺序和 exact values 固定如下：

| name | crc32 | compressedBytes | uncompressedBytes | entryDigest |
| --- | ---: | ---: | ---: | --- |
| `[Content_Types].xml` | `230187374` | `254` | `557` | `sha256:ba972eb63929542316795ed459465635d917e887d2dc4242ccb948600c472dc8` |
| `_rels/.rels` | `2347489944` | `174` | `295` | `sha256:08035627e39a13cebe6fed87e13b2f3f540d7577087204f757ddc59d8764a788` |
| `xl/workbook.xml` | `2568681345` | `208` | `289` | `sha256:867bfb6b0379d8842ab0bf6c7f76958524f30b01cf5aadcc2f91d76874af916a` |
| `xl/_rels/workbook.xml.rels` | `1803746650` | `177` | `296` | `sha256:67569c135daedc6180df5947db350fadc2e06ccf1f3814fff61c3d563f9081c8` |
| `xl/worksheets/sheet1.xml` | `1526570287` | `284` | `369` | `sha256:04ae34fd4de48cc981009e0883afae18ccd0f3d738657a89610fdc833ebca069` |

每个 entry 仍固定：

- `schemaVersion=rc1-p14-xlsx-entry.v1`
- `method=DEFLATE`
- `dosTimestamp=2026-08-23T00:00:00`
- `createSystem=UNIX`
- `mode=0100600`

上述固定 `entryDigest` 与按实际派生路径动态计算的 `artifactEntryDigest` 均使用被修正 V3 合同现行的通用
canonical digest规则：键名字典序、无额外空白、不含 digest 自身，计算UTF-8 raw SHA-256后加一个
`sha256:` 前缀。本节这些对象的全部字段和值均为ASCII，因此不得借此改变V3对其它对象的JSON字符转义规则。
数值继续使用无前导零十进制 JSON string。

## 4. Sealed raw-byte oracle

为消除 zlib 版本、ZIP writer 和 entry insertion order 的歧义，runner 的 expected bytes 必须来自本 amendment
冻结的独立 base64 oracle；不得调用或导入 candidate 的 `_p14_xlsx_bytes`，不得读取 candidate artifact 后反向生成。
base64 解码后必须恰为 `1689` bytes，并先得到上节 raw SHA，之后才可与 candidate actual bytes 比较：

```text
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
```

该 base64 oracle 只允许存在于独立 release runner/oracle verifier 源码闭包和本 amendment；不得进入 candidate wheel、
backend generator 或 seed CLI，也不得被这些路径导入、读取或解码。seed CLI 只能调用 candidate generator 产生 actual bytes；
runner 必须独立解码本 oracle 后与 actual bytes 比较。oracle 也不得通过 API、页面、日志、fixture stdout、release receipt
或业务成果暴露。它是 delivery fixture，不是 PASS、generation evidence、用户工作簿或业务价值事实。

## 5. 双向拒收与验证

后继 successor 必须新增并通过：

1. 新 oracle 对 `bytes/raw SHA/base64/entry order/CRC/size/method/time/system/mode/entryDigest` 任一漂移均在写前
   失败关闭；动态 `artifactEntryDigest` 必须绑定双方独立派生的实际 `artifactId/relativePath`，任一不一致同样在写前失败关闭；
2. 旧 `1585/f762...`、缺失 base64、candidate-self-derived expected 和 expected/actual 同源 helper 全部拒收；
3. backend generator 的 actual bytes 与 runner 独立 base64 oracle逐字一致；runner 先验证自身 oracle，再读 candidate actual；
4. workbook raw SHA 与 `sha256:` prefixed SHA 继续同时进入 generation forbidden set；
5. fixture capability、provenance、IDs/digests、work product、archive、binding、receipt继续不得进入 generation 或 release PASS；
6. 真实 accepted fixture、`P14-REALSTACK`、`P14-GENERATION`、`P14-DELIVERY-BROWSER` 仍必须绑定同一 candidate
   commit/tree 并分别通过，任一不得替代其它证明。

## 6. 治理顺序

1. 独立 code/Python/security 合同复审本 amendment，P0=P1=P2=P3 必须全部为零；
2. Owner 只可按本文件最终 raw SHA 精确确认，并只授权单文件普通 commit/push；不得夹带 task/plan/approval 或产品代码；
3. 远端双读确认 amendment 成为 `origin/ext-dev` 新头后，R2 approval 必须返回 STOP；
4. 基于新远端头创建全新 successor task/plan/approval，重新冻结 exact product paths、runner/controller/source digest、
   Chrome identity、runtime/successor fingerprints和本 amendment 的完整替换矩阵；
5. Owner 再按新 manifest/bundle 精确确认治理三件套，普通 fast-forward 落地后机器 GO；
6. 只有新机器 GO 后，才允许把当前未提交 exact32 产品字节重放到新 approval 的直接单亲子，并实施本 oracle correction；
7. candidate commit/push、真实 Chrome、三份证明、release/deploy继续分别需要独立授权。

## 7. 回滚与非目标

- 本 amendment 未提交时，回滚仅为放弃这一份草案；不触碰用户工作树和现有 exact32 产品字节。
- 不修改大殿、军机处、翰林院、API namespace、数据库表列、认证模型、第二 registry/ledger 或生产 feature flag。
- 不把 delivery fixture 当真实业务结果，不允许真实模型、公网、secret、生产数据、现有用户数据或不可逆外部动作。
- 不放宽 Root Harness、readiness fingerprint、candidate blocker或任何旧 wire拒收门。
