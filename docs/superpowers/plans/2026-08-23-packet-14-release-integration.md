# Packet 14 Release Integration — Single-child Plan

## Contract

- Task：`PACKET-14-TRUSTED-ARTIFACT-DELIVERY-RELEASE-INTEGRATION-V1-20260823`
- Base/tree：`563889d555db64b68aab04f816f1e873593641af` / `fd2c794fa3cac7526a7b16514b26c556e36f4c3b`
- Amendment SHA-256：`d870c969364a665b9c2f433087d05a9c085fd706ea6c8b32b670281ed48f5c69`
- Scope：manifest exact sorted 30 paths。

## Execution Sequence

1. **Governance**：三件套是 amendment remote base 的精确三文件单亲子；Owner 接受 canonical digest 后才提交推送。
2. **Authorize**：运行 `node scripts/product-authority.mjs --authorize --task PACKET-14-TRUSTED-ARTIFACT-DELIVERY-RELEASE-INTEGRATION-V1-20260823`；digest 不符或非 GO 停止。
3. **RED**：只用临时 DB/artifact root 与 disposable acceptance roots 复现16节点。
4. **Download**：open+bounded metadata 后立即 reserve，再唯一 streaming copy+digest；single finally 覆盖失败/transfer。
5. **Activation**：lifespan 在构造/启动 worker 前完成 closed legacy→V2 migration/postimage；失败零 writer。
6. **Registry**：Python唯一事实源；Schema/builder/verifier/acceptance 使用新 digest，隔离跨语言拒绝旧值/漂移。
7. **P14 slice**：最小重放 owner/run/PUBLISHED/digest/manifest、public receipt、raw parser、BFF cancel 与 Study UI。
8. **RC1 browser gate**：在 `scripts/run_rc1_release_acceptance.mjs` 内新增与现有 `runAcceptance` 完全分离的 pre-push browser mode，复用 candidate snapshot、锁定 TEST/runtime、OCI build/import 与三个 smoke containers；caddy、runner-owned edge proxy 与 collector 均仅随机 loopback。页面只经 edge proxy访问业务，proxy按 task 的16-action/route/status closed matrix转发并生成 authoritative request ledger；受控 browser controller 的 out-of-page client 只向 collector 上传两个 PNG、console summary与最终 receipt，页面不见collector/nonce且无CORS/OPTIONS。runner 自命名、`wx`保存、完整校验 PNG/closed JSON，生成 ledger/artifact manifest，逐项绑定 receipt actions；A/B server-issued session在内存分别绑定login identity及后续Cookie，B的404必须来自authenticated B。runner再以 candidate API/临时 datastore 独立核对唯一 SUCCEEDED job、PUBLISHED artifact、单一 terminal receipt、refresh replay与Owner B零所有权；client PASS不能替代poststate。HTTP request framing/size/connection/timeouts按edge/collector分别闭合；upstream强制identity encoding，connect/header/idle/total均从dispatch计时，JSON/HTML/static与整轮流量按route计数，cap+1即abort，XLSX固定1..64MiB MIME/length并流式digest、零整文件buffer；privacy与单一finally cleanup按task闭合，然后生成独立 `rc1-prepush-browser-round.v1`；不得执行client命令或持久化raw HAR/trace。
9. **Evidence separation**：provisional round 固定 `PRE_ACCEPTANCE_PROVISIONAL/nonAuthorizing=true/remoteHead=null/externalEffectAuthorized=false`，使用独立 evidence root/filename；现有 final acceptance、release manifest/verifier 和 P09 envelope exact拒绝它。machine verify-candidate PASS、fresh provisional browser round 和独立 review 全部满足后才请求 Owner 产品推送。candidate 成为 remote head 后，才运行原 `POST_ACCEPTANCE_FINAL` 并由独立 P09-B/release 阶段生成 P09-A closed envelope。
10. **Verify/review**：isolated backend full+Ruff、frontend full、release regressions、V2、Harness/doctor、真实 browser/privacy/cleanup 全绿；code/security P0–P3=0。
11. **Handoff**：报告 candidate SHA/tree、exact30 diff、machine/RC1 evidence 与 rollback，等待 Owner 决定。

## Stop Conditions

- remote/base/digest/authority 不符；或需要第31路径、authority/harness/CI/ADR、新表/列/API/格式/第二ledger；
- 旧 registry/PASS/evidence 被复用，或 activation 晚于 worker、失败仍启动 writer；
- reserve 前整文件 work，或异常泄漏 FD/spool/lease/owner/bytes；
- browser/edge/collector endpoint 非loopback、固定/生产端口；client可提交path/filename/URI/manifest/ledger；HTTP request/response framing、route/static/session byte cap、timeout/connection cap不闭，XLSX被整文件buffer，页面可见collector nonce或需要CORS/OPTIONS；request ledger非runner-owned、16 action未exact覆盖真实业务请求、poststate未独立验证；session/receipt/artifact-manifest/round非closed或不绑approval/candidate/tree/nonce/deadline；
- runner执行client命令、继承未封闭宿主环境、写raw HAR/trace、未清理container/network/port/temp；
- provisional/final schema、evidence root或文件名混用；final verifier/P09接受 provisional；pre-push伪造remoteHead，或缺fresh candidate-bound provisional round仍请求产品push；
- 生产数据、secret、外网、真实模型、用户profile、activation/deploy被触碰；
- 任一 mandatory node/全量门/独立review 失败、阻塞或未运行；
- activation后需full revert/旧writer/覆盖新receipt的restore。

命中任一项保持产品不变并修订合同，不得隐式扩面。
