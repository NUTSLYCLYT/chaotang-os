# Six Ministry Readiness Validator Self-Reference Repair Plan

## 1. Governance identity

- Task：`SIX-MINISTRY-READINESS-VALIDATOR-SELF-REFERENCE-REPAIR-20260816`
- Base/tree：`32cd88ab60819ad15d978f923a0a339cf6bed9db` /
  `d2812970a3306f3dda81317cb5683ecd21e57c5f`
- Approval paths：governance packet + task/plan 共 3 路径。当前机器 Harness 拒绝
  `.harness/changes/**`，所以不创建或放宽该旧控制面。
- Candidate paths：Python verifier 与根 Harness 共 2 路径；不创建 M0 approval，不改 report/schema/runtime。
- Historical reviewed set：报告列出的 69 文件，identity `sha256:a6c2de2c...a265190`。
- Current content set：历史集合精确排除 root checker 与 Python verifier 后的 67 文件，identity
  `sha256:6f4158f5...1a43196c`。

## 2. Why smaller repairs fail

1. 只更新报告为当前 69 文件指纹，会冒领旧 code/python/security review，且根 Harness 仍固定历史指纹。
2. 只改 Python 测试并排除 root checker，该测试本身仍属于 68 文件集合；修改它会使 `fe726…` 失效。
3. 只有让两个 validator 都位于当前内容证明集合之外，历史 review 与当前内容检查才能同时非自引用。

## 3. RED to GREEN

1. RED-A：当前 `test_six_ministry_readiness_report.py` 精确 4 pass / 1 fail。
2. RED-B：模拟修改 Python verifier 后，根 Harness 的 68-file fingerprint 必然不同于 `fe726…`。
3. Preflight：`node scripts/harness-doctor.mjs --check` 记录治理前基线；失败即停止而非放宽 doctor。
4. GREEN：
   - Harness 将 current-content exclusions 固定为两个精确路径，并把内容集合长度固定为 67；
   - Python verifier 使用同一排除集、算法、长度和 `6f4158…`；
   - 报告三处历史 `a6c2…`、69 文件清单、review status/reviewer/count 完全不改。
5. Negative：排除集增加第三项、移除一项、重复/缺验证器、任一 67 文件变化、报告历史指纹变化均失败。

## 4. Proof matrix

```bash
cd backend && /usr/bin/python3 -m pytest -q tests/test_six_ministry_readiness_report.py
cd backend && /usr/bin/python3 -m pytest -q
node scripts/check_harness.mjs
node scripts/check_harness.mjs --self-test
node scripts/harness-doctor.mjs --check
node --test scripts/harness-doctor.test.mjs
node --test scripts/product-authority.test.mjs
node .agents/hooks/check-harness.mjs --self-test
node .agents/skills/product-flow/scripts/run-claude-delivery.mjs --self-test
git diff --check
```

Approval commit 形成后、推送前必须记录：

```bash
/usr/bin/git show -s --format='%P' <approval-commit>  # exact 32cd88ab... single parent
/usr/bin/git diff --name-only 32cd88ab60819ad15d978f923a0a339cf6bed9db <approval-commit>
```

第二条输出必须逐字等于 packet 的 3 个 `approvalCommitPaths`。治理 candidate 形成后、推送前必须记录：

```bash
/usr/bin/git show -s --format='%P' <candidate-commit>  # exact approval commit single parent
/usr/bin/git diff --name-only <approval-commit> <candidate-commit>
```

第二条输出必须逐字等于 packet 的 2 个 `candidatePaths`。两组输出、commit/tree 和 `git diff --check`
必须交给 Owner 分别确认；packet 没有自动 consumer，不能省略这项人工机械门。

## 5. Review and freeze

- 独立 code review：校验集合算术、SHA 算法、历史/current 语义、所有负测和 exact scope。
- 独立 security review：检查自授权、checker 绕过、排除集扩张、review provenance 与 fail-closed。
- 最终候选实质变化后所有验证重新运行；任何 finding 未关闭不得提交或推送。
- governance packet 使用 RFC 8785 canonical JSON（复用 `scripts/product-authority.mjs` 导出的
  `parseJsonStrict`/`canonicalDigest`）计算 digest；Owner 只批准该精确 digest，不批准未来候选字节。

## 6. Recovery of the product line

1. Approval commit 经精确 parent/path 机械检查与 Owner 确认后才允许推送。
2. 治理候选经精确 parent/path 机械检查及 Owner 对 candidate SHA/tree 二次确认后才允许推送。
3. 远端落地后，以新 commit/tree 重新生成双编排 6 路径 approval；Owner 确认新 canonical digest。
4. 把已冻结公共合同候选作为新 approval 的精确单亲子，运行 full M0 verify。
5. 公共合同落地后才分别建立 Direct adapter 与 LangGraph adapter 任务；共享合同仍单写者。

## 7. Stop and rollback

立即 STOP：Owner 未确认 packet、base/remote 漂移、路径扩大、报告/schema变化、排除超过两个验证器、
67 文件 digest 不匹配、任何验证失败或审查有未关闭 finding。回滚只撤销单一治理候选。
