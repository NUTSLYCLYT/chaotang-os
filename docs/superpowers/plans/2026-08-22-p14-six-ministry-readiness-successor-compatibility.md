# P14 × 六部 Readiness 继任兼容修复计划

## 1. Identity and scope

- Task：`P14-SIX-MINISTRY-READINESS-SUCCESSOR-COMPATIBILITY-20260822`
- Base/tree：`48c9497b934bc3d12300cf7d072bc442fdb8c9d5` /
  `cbc9af31de71e937ed27534a862c980ab92306db`
- Approval：task/packet/plan 三路径。
- Candidate：P14 合同、Python readiness verifier、Root Harness 三路径。
- Historical review：69 文件、`sha256:a6c2de2c...a265190`，保持不变。
- Current-content：排除四条封闭路径后的 65 文件、`sha256:013bfb82...23b5e69`。
- Successor pair：只允许 legacy `sha256:709eba...c924` 或 reviewed P14
  `sha256:d98fbc...648d9`，禁止混搭与第三状态。

## 2. Compatibility rule

旧 readiness 仍证明其 2026-08-14 历史快照和未被后继 Packet 接管的当前 65 文件。P14 storage 与
accounting adapter test 不再由旧 current-content 指纹冒充审查，但仍由独立的双状态 composite
fingerprint 持续防漂移，并由新的 P14 approval、全量回归和独立 review 证明新状态。排除集和 pair
fingerprints 都是 closed enum，不提供通配符、目录或未来自动扩展。

## 3. RED to GREEN

1. RED：P14 backend-full 中两条 PENDING confirmation fixture 与一条 tamper expectation 失败。
2. RED：Root Harness/Python readiness 在 P14 storage 合法变更后 current-content fingerprint 失败。
3. GREEN-A：两个 validator 使用完全相同的四项 exclusions、65 count 与 digest。
4. GREEN-B：P14 合同增加唯一第 21 路径，并冻结 publish-before-confirm 与 non-enumerating tamper 语义。
5. Negative：第五条 exclusion、任一 65 文件漂移、历史 review identity 改写、validator policy 分叉均失败。
6. Successor negative：只改 pair 任一路径、旧新混搭或任意第三状态均失败关闭。

## 4. Proof matrix

```bash
cd backend && /usr/bin/python3 -m pytest -q tests/test_six_ministry_readiness_report.py
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node scripts/harness-doctor.mjs --check
node --test scripts/product-authority.test.mjs
node scripts/ext-full-value-convergence.mjs --check
git diff --check
```

## 5. Commit protocol

1. Approval commit parent 必须 exact base，diff 仅三条 approvalCommitPaths；Owner 接受 canonical packet digest
   后才提交/推送。
2. Candidate commit parent 必须 exact approval commit，diff 仅三条 candidatePaths；独立 code/security GO、
   Owner 确认 candidate SHA/tree 后才推送。
3. 远端固定 Gitee URL 双读一致后，再以 candidate 为 base 生成新的 21 路径 P14 M0 三件套。
4. 新 P14 approval digest 经 Owner 接受且 `product-authority --authorize` 返回 GO 后，才修改第 21 路径、
   完成产品候选并推送。

## 6. Stop and rollback

任一 parent/path/hash 漂移、第五 exclusion、历史 report/review 变化、验证失败或未关闭 P1 立即 STOP。
治理 candidate 可单独 revert；不得回退 P14 已建立的安全语义，也不得将 governance 与产品提交混合。
