# Packet 09-A Release Evidence V2 — Single-child Plan

## Contract

- Task：`PACKET-09A-RELEASE-EVIDENCE-V2-20260821`
- Base：`17d6be6538bfbfeeaf5c6fa13eee5d09dd1208a9`
- Base tree：`03eaa2218429c9b25ee88fda02c5e648a5ea632a`
- Contract SHA-256：`27728301f51c7fe7bd929d99b45de86c76807b4c9c5eba22e7e42b0e18e8acc5`
- Transition：RED → closed schema → strict read-only verifier → fixed vectors → exact single product child。
- Rollback：P15 consumer 前独立 revert；consumer 存在后保留 v2 reader，后继只能使用 v3。

## Execution sequence

1. **Authorize**：Owner 接受 approval manifest digest 并单独授权 approval commit/push；在干净远端头运行
   `node scripts/product-authority.mjs --authorize --task PACKET-09A-RELEASE-EVIDENCE-V2-20260821`，非 GO 停止。
2. **RED**：新增唯一测试文件，固定合同 15 节点与 digest/order/privacy/budget/splice 向量，确认是缺能力失败。
3. **Schema**：实现 exact Release Evidence v2、附带 closed command registry 和全部 enum/预算。
4. **Parser**：实现 bounded UTF-8、duplicate-key rejection、RFC 8785、safe relative path 和 typed refs。
5. **Verifier**：重算 identity、checks、artifacts、storage、journey、review、rollback、conclusion 与全部 digest；只读。
6. **Negative proof**：旧日志、NOT_RUN/BLOCKED、secret/path canary、超预算、跨对象 splice、伪 Gitee/authority 全拒绝。
7. **Verify**：运行 approval matrix、V2、Root Harness/doctor、candidate verifier 和独立 code/security review。
8. **Handoff**：报告 candidate SHA/tree、三路径 diff、RED/GREEN、evidence digest 与 rollback；等待 Owner push 决定。

## Stop conditions

- 远端 `ext-dev` 离开 approval commit或 product authority 非 GO；
- 需要第四条产品路径或修改 runtime、Harness/authority/CI/ADR；
- 工具需要执行命令、网络、Docker、备份、浏览器、上传、push 或部署；
- RED 非预期缺能力失败，或 GREEN 需要删除/放宽节点；
- strict parsing、identity、privacy、budget、nonauthorizing 或 rollback 任一边界不成立；
- 独立审查存在未关闭 P0/P1。

命中任一 stop condition 均保持产品不变，修订合同并重新取得独立 M0，不得隐式扩面。
