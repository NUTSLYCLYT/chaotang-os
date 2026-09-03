# Product Authority Credential-Separated Executor Capability Boundary Lineage Successor Plan

任务：`PRODUCT-AUTHORITY-CREDENTIAL-SEPARATED-EXECUTOR-CAPABILITY-BOUNDARY-LINEAGE-SUCCESSOR-20260903`

## Objective

在 `origin/ext-dev` 已从 `8282247208f3d79a8158aa7dc3138a49b1b919fb` 前进到
`d5574ea6587724c80edd4c5c1487c1c0e8e1a5b3`，再经
`b05ddbc7d722bd364dbee5e9cee31fce07bda5de` 修复 Harness baseline 自洽后，forward-only 重建 credential-separated executor
capability boundary exact3 的合法谱系，保留已验证 donor 价值，并避免 re-anchor。

## Scope

Governance approval paths 精确为三份新文件：

1. `docs/product/tasks/2026-09-03-product-authority-credential-separated-executor-capability-boundary-lineage-successor.md`
2. `docs/product/tasks/2026-09-03-product-authority-credential-separated-executor-capability-boundary-lineage-successor.packet.json`
3. `docs/superpowers/plans/2026-09-03-product-authority-credential-separated-executor-capability-boundary-lineage-successor.md`

Future candidate paths 精确为三份既有产品路径：

1. `deploy/systemd/chaotang-product-verifier@.service`
2. `scripts/reference/chaotang-product-verifier-broker.py`
3. `scripts/reference/test_chaotang_product_verifier_broker.py`

## Non-goals

- 不修改 Scene Pack、agentic org amendment、业务前端、业务后端、数据库、客户数据、P01/P10/P14 或旧 donor 工作区。
- 不恢复、继承或消费 `8282247…` 旧 approval 的旧 candidate 身份。
- 不创建第二 authority/runtime/ledger，不修改 product-authority 或 Harness 门禁。
- 不执行生产部署。

## Lineage handling

1. 只读确认 `8282247…` 是 `b05ddbc7…` 的祖先，且中间保持单亲提交链。
2. 记录三笔漂移/前置修复提交：
   - `2dffd64932ed83a88cde52565c2067e8540b65e7`：Scene Pack V1 board loop。
   - `d5574ea6587724c80edd4c5c1487c1c0e8e1a5b3`：agentic org project organization amendment。
   - `b05ddbc7d722bd364dbee5e9cee31fce07bda5de`：restore d557 Harness baseline self-consistency。
3. 机械确认三笔提交与 exact3 candidate paths 零重叠。
4. 将旧 exact3 工作区身份标记为 byte donor only，未来只允许从最新 approval commit 重新物化。

## Implementation sequence

1. 完成三文件 governance package 的 strict JSON、重复键拒绝、Task 合同、路径、模式、canonical digest、raw SHA 和 bundle 检查。
2. Governance / Python / Security 只读三审无 P0–P2 后，创建本地 approval commit。
3. 远端仍为 `b05ddbc7…` 时普通快进推送 approval commit。
4. 从新 approval commit 创建唯一 candidate 工作区，byte-for-byte 重物化 donor exact3。
5. 重新运行：
   - `python3 -I -B scripts/reference/test_chaotang_product_verifier_broker.py`
   - `node scripts/check_harness.mjs`
   - `node scripts/check_harness.mjs --self-test`
   - `node scripts/harness-doctor.mjs --check`
   - `node --test scripts/harness-doctor.test.mjs`
   - `node .agents/hooks/check-harness.mjs --self-test`
   - `TMPDIR=/tmp node --test scripts/product-authority.test.mjs`
   - `node scripts/ext-full-value-convergence.mjs --check`
   - `node --test scripts/ext-full-value-convergence.test.mjs`
   - `git diff --check`
6. 再做 Governance / Python / Security 三审。若全 GO，则创建本地 candidate commit 并普通快进推送。
7. candidate 落地后才允许非生产 root/systemd installed acceptance；验收结束必须停止并 disabled。

## Security invariants

- `0x2011eb` 只属于 `--serve-stdio` startup setup。
- `serve-stdio` 在读取任何请求字节前必须降到 `0xeb`。
- snapshot/cleanup helper 在 exec 前不得超过 `0xeb`。
- ingest、worker 与 gate observable final identity 必须为专用 uid/gid、empty groups、NoNewPrivs=1、五类 capability 全零。
- private launcher 只建立 private network namespace，不用 user namespace map 伪造身份。

## Rollback

本包所有 Git 写入均为普通 fast-forward 单亲提交。若 candidate 或非生产 installed acceptance 失败：

- 保留失败证据；
- 不 force-push；
- 不删除 donor；
- systemd/socket 临时验收单元必须停止并 disabled；
- 下一步只能创建新的 forward-only corrective successor。

## Review notes

Governance Review 检查 lineage、零重叠、路径和 non-authorizing 边界。Python Review 检查能力降级、namespace 合同和测试真实性。
Security Review 检查高危 capability 是否仅存在于 setup 窗口、是否不会进入请求处理和 helper/gate。
