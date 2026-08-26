# P01 Readiness Compatibility Prerequisite Validator Successor — Plan

任务 ID：`PACKET-01-READINESS-COMPATIBILITY-PREREQUISITE-VALIDATOR-SUCCESSOR-20260826`

状态：`DRAFT / NON_AUTHORIZING / READY_FOR_OWNER_CONFIRMATION`

基线：`eb1469b9a9e04804d218ec2840bf3b1f9630217f` / `61baa914ab5a121b4c584fb8f702cb46d9d4dfff`

## 1. Objective

基于最新 `ext-dev` 重新签发 readiness validator successor。只把旧工作区两文件作为 byte donor，未来在
新 approval 落地后 byte-for-byte 重物化并重新验证；不继承旧 candidate、验证、通过或 authority 身份。

## 2. Current Facts

- 旧 lineage Task 已由 corrective candidate 修改为正式 `Blocked` 并落地 `eb1469b9…`。
- Ready-gated product-flow 必须拒绝该 Task。
- donor 工作区仍绑定 `67cb1816… / f6720644…`，只含两条 validator 修改。
- donor bundle：`sha256:6e82e7d29c2afdb1f7fcad8fdb9dc9b99a17a823ea229802a4a81085e47eb32c`。
- `67cb… → 1e937… → eb1469…` 是两步直接单亲 lineage，changed paths 全为治理文档。
- intervening changes 与两个 validator candidatePaths 零重叠。

## 3. Draft Scope

本轮只允许创建：

1. `docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-validator-successor.md`
2. `docs/product/tasks/2026-08-26-packet-01-readiness-compatibility-prerequisite-validator-successor.packet.json`
3. `docs/superpowers/plans/2026-08-26-packet-01-readiness-compatibility-prerequisite-validator-successor.md`

future candidatePaths 精确为：

1. `backend/tests/test_six_ministry_readiness_report.py`
2. `scripts/check_harness.mjs`

## 4. Donor Freeze

| Path | Mode | Bytes | Raw SHA-256 | Donor blob | Diff SHA-256 |
| --- | --- | ---: | --- | --- | --- |
| `backend/tests/test_six_ministry_readiness_report.py` | `100644` | 12957 | `sha256:d731d3932d3a7ba5b77759d4f745d809c18b016f61cdd36265845296036ca60d` | `5bbf10223053adbbf607a51e8e9d690cdfd1f8d9` | `sha256:03c24371a739d0e752ed20ead03e991f808dc8689998e54e20aed2f91e273c38` |
| `scripts/check_harness.mjs` | `100644` | 158480 | `sha256:f6f6cede41ea1ed9a38780d7fbf570e2321c9857c01b3a9929b806120f14966d` | `8a34d071aa00147b39eedc0450d186169b87b318` | `sha256:5230a5b8e36473e834ff45a5e0a30bc101aae9668ac282e203ac1600375328ef` |

Bundle 使用按 path 字典序的 `{path, mode, bytes, rawSha256}` JSON array，经 RFC 8785 canonical UTF-8
后计算 SHA-256。Combined diff 为两个 path 的 full-index binary diff 原始字节 SHA-256。

## 5. Compatibility Contract

- 现有三 pair 原样同序保留。
- 唯一第四 pair 为 runtime `sha256:da31e809…` 与 successor `sha256:709ebaf1…` 的完整 ordered tuple。
- 集合差必须为 `+1/-0`，最终总数 `4`。
- 四 exclusions、`69 / 65`、historical review、两 successor paths 与 exact10 bundle 不变。
- 拒绝单边、混搭、篡改、未知状态、第五 pair、第五 exclusion、独立 allowlist、笛卡尔积和策略分叉。

## 6. Approval Phase

1. Owner 确认三文件 canonical/raw/bundle 与双审。
2. 实时远端仍为 `eb1469b9…` 时，只创建三文件的直接单亲本地 approval commit。
3. Owner 确认 commit/tree 后，才可普通 fast-forward push。
4. 不物化第二 authority、Harness、运行时或事实源。

## 7. Future Candidate Phase

1. 从落地的新 approval commit 创建唯一、干净、隔离 candidate 工作区。
2. 只有一个 validator 字节写入者。
3. 从 donor byte-for-byte 重物化精确两文件。
4. 开始和结束都核对 raw SHA、blob、模式、字节数、bundle 与 diff。
5. 重新证明全部负向合同和 readiness GREEN，不继承 donor 历史结论。
6. 完整 backend 必须全绿；任何额外失败、意外路径或策略分叉立即 STOP。
7. 双审 GO 后冻结新 candidate；commit 与 push 分别等待 Owner 授权。

## 8. Verification Matrix

草案阶段：

```bash
# strict JSON + duplicate-key rejection
# new Task productTaskErrors=[]
node scripts/check_harness.mjs
git diff --check
```

未来 candidate：

```bash
cd backend && python3 -m pytest -q tests/test_six_ministry_readiness_report.py
cd backend && python3 -m pytest -q
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node scripts/harness-doctor.mjs --check
node --test scripts/harness-doctor.test.mjs
node .agents/hooks/check-harness.mjs --self-test
TMPDIR=/tmp node --test scripts/product-authority.test.mjs
node scripts/ext-full-value-convergence.mjs --check
node --test scripts/ext-full-value-convergence.test.mjs
git diff --check
```

`TMPDIR=/tmp` 只对 product-authority 测试进程生效，解决默认 Windows `v9fs` temp 的
`core.filemode=false` 环境合同不匹配；不得持久改配置。

## 9. Review Questions

Governance Review：

- 新 base、lineage 与三文件范围是否精确？
- donor 是否明确无身份继承？
- candidatePaths、pair、exclusions、counts 与后续顺序是否闭合？
- 新 Task 是否满足产品任务合同并保持 non-authorizing？

Security Review：

- 是否可能通过 donor、旧 approval 或 `Blocked` Task 恢复 authority？
- ordered pair 是否仍为原子 tuple，且拒绝笛卡尔积和第五状态？
- 是否存在 Harness 放宽、证据洗白、范围扩大或持久环境配置变化？

任一 P0–P2 都是 NO-GO。

## 10. Stop Conditions

- `origin/ext-dev` 离开 `eb1469b9…`；
- donor 或 exact10 工作区发生漂移；
- 出现第四条草案路径或第三条 future candidate path；
- pair、exclusions、counts、fingerprints、exact10 bundle 或 lineage 不一致；
- Harness 失败或独立审查出现 P0–P2。

命中任一条件立即 STOP，不得 re-anchor、修改 validator 或扩大范围。

## 11. Non-Authorization Boundary

当前只授权三文件草案与只读验证。不授权 validator 重物化、产品测试、authority、approval materialization、
commit、push、merge、rebase、fetch、pull、candidate、Pilot、Release、发布或部署。
