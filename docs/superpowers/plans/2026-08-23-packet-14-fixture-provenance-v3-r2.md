# Packet 14 Fixture Provenance V3 R2 — Governed Plan

## Contract

- Task：`PACKET-14-FIXTURE-PROVENANCE-V3-R2-20260823`
- Target：`origin/ext-dev`
- Base/tree：`82fed66aed5f622982f527e62920dfe828a3fd1b` /
  `faa76cfa648d78e3798008c559ca62e5194170b0`
- V3 amendment raw SHA-256：
  `164486ed042257fd0d7efe5d93ba5fe8b35066883445ea9565d71092adaafc41`
- Proposed manifest digest：
  `sha256:d9aefb15a117c0180c6e5328f53f1e43259da75507cf3a725205b22a1d37bfcd`
- Re-anchor cause：远端先落地`82fed66aed5f622982f527e62920dfe828a3fd1b` readiness fingerprint commit；
  旧local-only approval `d00c16e1d318ffe5291cb4750048b546d7083ea4`是同一旧base的sibling，永久禁止推送或重放。
- Scope：V2 productPaths byte-for-byte exact32；不得增加、删除或重排。
- Exit：完成经过验证和独立复审的产品字节与最终fingerprints后停止；不自动形成可推送candidate。

## Governed sequence

1. 先证明new base只含已知readiness fingerprint两路径变更，closed pair同时接受legacy/final完整状态并拒绝混搭与未知状态；
   再对task/plan/approval执行closed schema、base/tree、amendment SHA、exact32、canonical digest、
   最终三文件raw/bundle摘要和路径审查。
2. Owner精确接受manifest canonical digest及最终三文件摘要，并只授权创建本地approval commit。
3. 创建恰三文件的本地commit，核验direct parent=`82fed66aed5f622982f527e62920dfe828a3fd1b`、
   changed paths、commit SHA/tree与Harness后报告Owner；此步不推送。
4. Owner单独确认approval commit SHA/tree并授权普通fast-forward push。
5. 推送后远端双读稳定，再从新干净worktree运行：
   `node scripts/product-authority.mjs --authorize --task PACKET-14-FIXTURE-PROVENANCE-V3-R2-20260823`。
6. 只有机器GO后，才从approval commit的直接单亲子工作树重放exact32；不得复用或提交旧dirty产品工作树。
7. 先锁定artifact lifecycle、unique binding、SQLite activation、BFF cancellation/cap和DTO splice的RED，再做最小GREEN。
8. 按V3 amendment实现marker/auth/preimage/postimage、deterministic fixture、runner-accepted digest、单一request ledger和cleanup。
9. generation forbidden set分别注入prefixed/raw workbook SHA及全部fixture专属ID/digest；共享candidate/source/auth/round值不得误拒。
10. 在exact32内完成REALSTACK、GENERATION、DELIVERY-BROWSER三条runner/contract能力及确定性RED；
   当前包不创建candidate commit，也不铸造真实证明PASS。
11. 分别完成15项产品verification、真实runner合同负测与全量独立复审；manifest中的
   `candidate-acceptance-blocked`必须保持预期非零，使当前`--verify-candidate`机器STOP。isolated candidate、
   真实Chrome双Owner旅程、privacy/poststate/PNG/console/ledger/cleanup由后继final M0实际验收。
12. 复审P0–P3全零后冻结最终two fingerprints和exact32 diff，停止产品工作，不提交candidate。
13. readiness compatibility、最终M0、candidate commit/push、merge、release、deploy分别走后续独立治理和Owner确认。

## Required RED

- 下载未消费、正常、断连、send failure、timeout、cancel rejection及abort/deadline竞争全部释放资源。
- pre-aborted、never-headers、headers后断连、body中断、declared/undeclared/chunked cap+1和timer清理。
- cross-owner、错误artifact/work-product/version/receipt sequence、duplicate-key/oversize JSON与同形错误。
- ancestor/child symlink、hardlink、wrong owner/mode/nlink、identity replacement、WAL/SHM和partial multi-DB write。
- marker重放、第二consume/start、session row交换/第三row/revoked/expired/Cookie splice和root/container bind漂移。
- workbook损坏/替换、额外row/file/receipt、FAILED job、commit flag/provider result及postimage concurrent splice。
- prefixed与raw workbook SHA分别污染generation evidence；fixture capability/ID/digest不得晋级generation或release PASS。
- fake Chrome/CDP、binary/source drift、额外API action、ledger乱序、cleanup deadline耗尽、terminal probe后late recreate。

## Verification matrix

Manifest内16项按ID排序：15项产品验证，加1项公开、无副作用、故意非零的candidate blocker。

1. `backend-focused-pytest`：八个受影响backend测试文件的精准pytest。
2. `backend-full-pytest`：backend全量pytest。
3. `backend-ruff`：backend Ruff。
4. `candidate-acceptance-blocked`：`node -e "process.exit(1)"`；固定阻止本包产生candidate eligibility。
5. `frontend-build`
6. `frontend-lint`
7. `frontend-tests`
8. `frontend-typecheck`
9. `product-authority-regression`
10. `release-evidence-regression`
11. `release-recovery-regression`
12. `root-harness`
13. `root-harness-doctor`
14. `root-harness-doctor-regression`
15. `v2-convergence`
16. `v2-convergence-regression`

15项产品命令证明当前reviewed bytes与runner合同；candidate blocker是刻意的机器STOP，不得被隐藏、删除或解释为测试失败。
后继final M0的新approval才可移除它，并加入isolated candidate与同一candidate-bound的
REALSTACK、GENERATION、DELIVERY-BROWSER真实runner证据。

## Stop conditions

- remote/base/tree/amendment SHA/task ID/manifest digest/exact32/authority任一不符。
- 旧local-only approval `d00c16e1d318ffe5291cb4750048b546d7083ea4`被推送、合并、变基、cherry-pick或作为authority输入。
- 需要第33产品路径，或需要修改生产数据库schema、API namespace、auth/Shiguan模型、Harness、authority、CI、ADR或fingerprints。
- fixture被算作generation、客户端仍可铸造PASS、raw/prefixed SHA任一未拒绝，或identity/privacy/poststate/cleanup不完整。
- 后继final M0中的真实Chrome、双Owner、三份证明或任一验证被NOT_RUN、mock、fallback或静态数据替代。
- 需要真实模型、公网、secret、生产数据、用户工作簿、现有浏览器profile或不可逆外部动作。

## Non-goals and rollback

- 不进入军机处Stage B，不新增route/BFF/表列/第二ledger/事实源，不建设生产fixture或插件平台。
- 不合并、变基、cherry-pick或强推旧sibling；R2只能作为new base的全新直接单亲子。
- 三件套未提交时只需放弃这三个草案，不影响已落地amendment、用户工作树或产品代码。
- 产品草稿只能存在于新授权的隔离child；失败时丢弃该child，不reset、stash、clean或覆盖用户修改。
- activation后不得恢复旧writer或旧receipt；只能另批forward-compatible successor。
