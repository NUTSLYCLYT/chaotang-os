# Packet 15 Offline Release / Recovery — Single-child Plan

## Contract

- Task：`PACKET-15-OFFLINE-RELEASE-RECOVERY-V2-20260821`
- Base：`be2ae54a3c6ee571b558c37f67ab051ac3830c91`
- Base tree：`8f0b136a0e6a273bb8cdfc22bb99094180d70fdd`
- Contract SHA-256：`aa88b6deed3273f72e40aaf10731a267e99b529d792d7ded45a26471a58b4fc8`
- Transition：RED → registry/backup → runtime lock → loopback deploy → bundle/verifier → RC1 runner → exact single product child。
- Rollback：未部署时独立 revert；部署后只能消费 prior immutable release + matching cold backup，生产恢复另行授权。

## Execution sequence

1. **Amend**：先锁定 writer-stop 可执行时序、TEST closure 与第 26 条 runtime-lock verifier；Owner 接受
   修订合同先作为独立 governance evidence commit 落地，再重钉 base；Owner 接受 amendment manifest
   digest 并单独授权三件套 commit/push；在干净远端头运行
   `node scripts/product-authority.mjs --authorize --task PACKET-15-OFFLINE-RELEASE-RECOVERY-V2-20260821`，非 GO 停止。
2. **RED**：建立合同 18 节点；固定当前缺能力、错误公网部署 checker、七库遗漏和旧 RC1 runner 失败。
3. **Registry**：实现唯一七库 closed registry、schema contract digest、PRESENT/ABSENT 和 readiness 共用事实源。
4. **Backup**：TDD 实现 online/cold capture、manifest、verify、new-root rehearse、artifact 对账与文件系统负例。
5. **Runtime lock**：实现 pyproject BUILD/RUNTIME/TEST roots、distribution/edge/wheel closed lock、
   METADATA/ZIP 预算和标准库-only 离线安装边界；candidate 只读消费 root-owned wheelhouse。
6. **Deployment**：把 Compose/Caddy 收敛到 ADR 0041 loopback 单 backend，并让 checker 拒绝公网/TLS/floating/root。
7. **Bundle**：实现 provisional/final builder、包外 expectation、P09-A binding、closed manifest/SBOM/provenance 验真。
8. **Runner**：M0 只跑 mock/no-daemon/no-network；另行授权 disposable host 后才执行真实 build/backup/restart 1+10 轮。
9. **Verify**：运行 approval matrix、全部 18 节点、后端/前端全矩阵、V2、Root Harness/doctor 与独立四角色审查。
10. **Handoff**：报告 candidate SHA/tree、26 路径 diff、RED/GREEN、evidence/rollback 和未运行外部验收；等待 Owner push 决定。

## Stop conditions

- 远端 `ext-dev` 离开 approval commit或 product authority 非 GO；
- 需要第 27 条产品路径、数据库 schema、业务 API、页面、Harness/authority/CI/ADR；
- M0 需要网络、Docker daemon、生产路径、secret、真实 OCI/image/bundle 构建、备份、恢复或部署；合同§6
  规定的离线 candidate wheel build 是隔离身份验证的一部分，不属于此 STOP 条件；
- 七库 registry/readiness/backup/release digest 不同源，或未知/敏感 entry 被读取；
- backup 可覆盖已有目录、cold writer-stop evidence 不闭合、runtime lock/wheelhouse 不可重放；
- bundle 从内部推导 expectation、旧 donor PASS 日志被复用、NOT_RUN 被升级；
- RED 非预期缺能力失败，或 GREEN 需要删除/放宽节点；
- 独立审查存在未关闭 P0/P1。

命中任一 stop condition 均保持产品不变，修订合同并重新取得独立 M0，不得隐式扩面。
