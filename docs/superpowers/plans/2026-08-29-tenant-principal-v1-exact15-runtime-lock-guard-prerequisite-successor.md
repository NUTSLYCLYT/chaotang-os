# Tenant Principal V1 Exact15 Runtime-Lock Guard Prerequisite Successor Plan

任务：`TENANT-PRINCIPAL-V1-EXACT15-RUNTIME-LOCK-GUARD-PREREQUISITE-SUCCESSOR-20260829`

基线：`b6ac2555cb8bd0a279d91eef06c2c26ff3b57ecc` / tree `49f7e16a9842435978aba6a5dc1311916a3e1524`

Approval RFC 8785 canonical digest：`sha256:6a5375457cb83e9ba3178944e2bb819b563eb782b7bd800e04536b6b52a5b27a`

状态：`PLAN_ONLY / PROTECTED_VERIFIER_PREREQUISITE / NON_AUTHORIZING`

## Goal

在不碰 exact15 产品字节的前提下，闭合唯一 runtime-lock candidate verifier 的临时信任根和 pytest guard 实际加载证明，消除“完整测试看似全绿但身份 guard 未执行”的伪绿风险。

## Lineage Boundary

远端当前为 `b6ac2555…`，它只新增前序 exact15 三份治理文件。其 product authority 未产生 child、未 verify、未 push，已因独立安全审查进入 `ABANDONED_AFTER_INDEPENDENT_REVIEW / UNCONSUMED / REISSUE_REQUIRED`。本 prerequisite 是独立 forward-only successor，不消费或继承前序 one-child authority。

现有 exact15 十五路径工作区保持不动。当前四条非 c471 漂移不得进入后续产品；daily 单文件只保留字节证据。exact2 verifier candidate 落地后，exact15 必须基于届时最新 ext-dev 全新签发 successor。

## Frozen Sequence

1. 核验实时远端仍为 `b6ac2555…`，冻结本三文件路径、模式、raw/canonical/bundle 与独立审查结论。
2. 创建唯一三文件 approval commit，普通快进推送后运行本任务 machine authority；非 GO 立即停止。
3. 从 approval commit 创建唯一 exact2 candidate 工作区。
4. 先在 `test_runtime_lock.py` 形成真实 RED：父临时根合同、显式 guard 加载、O_EXCL attestation、分发/plugin 闭包及身份漂移。
5. 仅修改 `runtime_lock.py` 最小实现：可信 `/tmp`、site-packages guard、`-p`、autoload off、外层 attestation 验证、distribution/plugin 枚举。
6. 由 self-hosted verifier 在同一 hash-locked test venv 中先运行 targeted runtime-lock tests，再运行完整 backend/Ruff；随后运行根级完整矩阵，不得调用宿主 Python 的 pytest。
7. Python 与 Security reviewer 只读审查；任一 P0–P2 立即停止。
8. 冻结 exact2 raw/blob/mode/bytes、bundle、full-index diff 与验证 evidence，创建唯一 candidate commit。
9. 在 committed/clean candidate 上运行 machine `--verify-candidate`；PASS 后再次核验远端仍为 approval commit，普通快进推送。
10. 基于新 remote 全新签发严格 c471+daily exact15 successor，重做 RED/GREEN、完整矩阵、独立审查和 machine verify；不部署。

## TDD Contract

RED 必须直接证明旧 verifier 的真实缺口，不能由依赖、导入、网络或临时环境错误替代。至少覆盖：

- parent `/tmp` 非 sticky、非 `01777`、symlink、非目录、非法 owner，以及 verifier 自身为 root/overflow UID；
- sibling conftest 不会被当前 pytest anchor/`--confcutdir` 加载；
- 显式 guard 缺失或未生成 attestation；
- attestation 重复、mode/link/owner/bytes 漂移，或缺少 candidate/app/distribution/plugin 身份字段；
- source root 泄漏、错误 app origin、metadata/wheel digest/candidate identity 漂移；
- lock 外 distribution 或未授权显式 pytest plugin。

GREEN 必须保持现有 lock/wheelhouse/候选 snapshot/完整 backend/Ruff 语义，不得删除、跳过或放宽测试。

## Verification Matrix

- `backend/app/operations/runtime_lock.py verify-candidate` 自托管候选 wheel验证
- `backend/tests/test_runtime_lock.py` targeted 与完整 backend pytest（同一锁定 test venv、由 verifier 顺序执行）
- 全 app/tests Ruff（由 verifier 执行）
- exact2 structure 与 `git diff --check`
- root Harness、Harness self-test、Doctor、hook self-test
- `TMPDIR=/tmp` product-authority regression
- V2 convergence check/tests
- 独立 Python Review 与 Security Review
- machine product-authority authorize/verify-candidate

## Stop Conditions

远端漂移、机器 STOP、第三产品路径、临时根合同无法闭合、guard 无法被机械证明加载、额外 distribution/plugin、测试或 Ruff 失败、候选身份漂移、独立审查 P0–P2，均立即 STOP。禁止 force-push、Pilot、Release、发布或部署。

## Evidence Boundary

本任务只证明 runtime-lock verifier 自身闭合，不证明 exact15 产品通过，也不恢复任何旧 authority/candidate。exact15 必须在本 prerequisite 落地主线后重新签发并重做全部证据。
