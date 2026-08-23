# Packet 14 Reviewed Draft and Reachability Remediation — Governed Plan

## Contract

- Task：`PACKET-14-REVIEWED-DRAFT-AND-REACHABILITY-REMEDIATION-V1-20260823`
- Target：`origin/ext-dev`
- Base/tree：`56488ba001796103653ae68f4ac9a2d9dacde89b` / `2ece2188d47430e6dc1049859b2bd33b2d0150a1`
- Amendment SHA-256：`d3b6671b3a7601fc6ed7fc0771dfef00bb57d5fdc03f52467cecbabab7d82b6a`
- Proposed manifest digest：`sha256:9698a8f1a854444f440b912ad334070fd4c584c1d8e46a9b471641b3a7cca9ba`
- Scope：manifest exact sorted 30 product paths。
- Exit：reviewed product bytes + final two six-ministry fingerprints；非可接受产品 candidate。

## Sequence

1. **Approval gate**：三件套 closed schema、base/tree、amendment SHA、exact30 与 canonical digest 独立复审；Owner 接受后
   才允许 governance commit/push。
2. **Remote/machine gate**：远端双读稳定后，从新干净 worktree 对 exact Task ID 运行 authority；非 GO 停止。
3. **TDD safety remediation**：先补 download lifecycle、management/unique binding、legacy-row/symlink activation、BFF
   abort/deadline/cap、DTO splice 的 RED，再做最小修复。
4. **Reachability implementation**：严格按 amendment 在已批准 `sqlite_backup.py` 与 RC1 runner 内实现一次性 delivery fixture、
   v2 closed wire、14-action runner-owned edge/collector/browser；不新增产品路径或生产接口。
5. **Three proofs**：REALSTACK、GENERATION、DELIVERY-BROWSER 使用同一 candidate commit/tree 独立 PASS；任一不得替代另一项。
6. **Draft verification**：backend full+Ruff、frontend full、release regressions、三证据、privacy/cleanup 全绿。Root Harness
   只可因 final current/successor fingerprints 尚未登记而精确失败；其它失败不得继续。
7. **Independent review**：code/Python/TypeScript/security P0–P3=0；修复后重跑全矩阵。
8. **Freeze and stop**：计算 final two fingerprints、保存 exact30 diff，停止产品工作且不提交产品 candidate。
9. **Successor compatibility**：另包精确修改 readiness test + protected Root Harness；独立治理 approval/candidate/review/push。
10. **Final P14**：以 compatibility 远端头新立 M0，byte-for-byte 重放 reviewed draft；完整机器门、Harness/doctor/V2 与三证据
    全绿后再向 Owner 请求产品 commit/push。
11. **Stage transition**：Core RC 形成唯一 clean SHA/tree 前，不建立或实施军机处 Stage B Packet。

## Proof matrix

- Backend focused：confirmation/storage/work-product/report-artifact/decree/readiness/sqlite-backup；full pytest + Ruff。
- Frontend full：tests/lint/typecheck/build；abort/deadline/cap/splice/cancel rejection 负测。
- Release：offline build/verify、deployment、release evidence、RC1 acceptance regressions。
- Three candidate-bound proofs：REALSTACK identity/cleanup；GENERATION full chain；DELIVERY-BROWSER v2 ledger/poststate/privacy/PNG/
  console/framing/caps/timeouts/normal+failure cleanup。
- Governance：product-authority regression、Root Harness/self-test/doctor、V2 convergence、exact path/status、diff-check、remote drift。

## Non-goals

不修改 Harness/authority/ADR/CI，不新增产品路径、表/列/API/format/ledger/生产开关，不把 fixture 冒充 generation，不进入
军机处，不读取生产数据/secret，不调用真实模型或公网，不执行未独立授权的产品 commit/push/merge/release/deploy。
